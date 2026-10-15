import logging
import os
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .storage import Storage

logger = logging.getLogger("todo")

# 저장소 파일 위치는 ARCHITECTURE.md "기술과 실행 환경"을 따른다.
# 브라우저 테스트는 TASKS_DB_PATH로 테스트용 파일을 가리킨다.
DEFAULT_DB_PATH = Path(
    os.environ.get(
        "TASKS_DB_PATH",
        Path(__file__).resolve().parent.parent / "data" / "tasks.db",
    )
)

# 실제로 쓸 때는 빌드한 화면(frontend/dist)을 이 서버가 함께 보여 준다 (DECISIONS.md D-013).
# 브라우저 테스트는 FRONTEND_DIST로 다른 폴더를 가리킬 수 있다.
DEFAULT_FRONTEND_DIR = Path(
    os.environ.get(
        "FRONTEND_DIST",
        Path(__file__).resolve().parent.parent.parent / "frontend" / "dist",
    )
)


class Task(BaseModel):
    # 응답에 ordered_at은 넣지 않는다 (API-SPEC.md "API 계약 결정 기록").
    # created_at은 UTC 날짜·시각 글자다 (예: "2026-10-15T09:30:00Z").
    id: int
    title: str
    description: str | None
    status: Literal["TODO", "IN_PROGRESS", "DONE"]
    created_at: str


class TaskCreate(BaseModel):
    # status, id, ordered_at, created_at 같은 다른 필드는 무시한다 (API-SPEC.md "API 계약 결정 기록").
    title: str | None = None
    description: str | None = None


class TaskUpdate(BaseModel):
    # 보낸 필드만 바꾸고, 빠진 필드는 그대로 둔다 (API-SPEC.md "API 계약 결정 기록"). created_at은 무시한다.
    title: str | None = None
    description: str | None = None


class StatusChange(BaseModel):
    # 세 값이 아니면 빈 글자, null, 없음, 다른 종류의 값 모두 INVALID_STATUS로 거절한다.
    status: Any = None


TASK_STATUSES = ("TODO", "IN_PROGRESS", "DONE")


class TaskNotFound(Exception):
    """없는 카드. 404와 {"errors": [{"field": null, "reason": "TASK_NOT_FOUND"}]}로 돌려준다."""


class InputError(Exception):
    """칸별 입력 오류. 422와 {"errors": [{"field", "reason"}]}로 돌려준다."""

    def __init__(self, field: str, reason: str) -> None:
        self.field = field
        self.reason = reason


def input_errors_response(errors: list[dict]) -> JSONResponse:
    return JSONResponse(status_code=422, content={"errors": errors})


def clean_title(title: str | None) -> str:
    # 없거나, 비었거나, 공백(띄어쓰기, 탭, 줄바꿈)뿐이면 거절한다. 앞뒤 공백은 지운다.
    if title is None or title.strip() == "":
        raise InputError("title", "TITLE_EMPTY")
    return title.strip()


def clean_description(description: str | None) -> str | None:
    # 비우거나 공백만 넣은 설명은 null로 저장한다 (DATA-MODEL.md "데이터 규칙 결정 기록").
    if description is None or description.strip() == "":
        return None
    return description


def create_app(
    db_path: Path = DEFAULT_DB_PATH, frontend_dir: Path | None = DEFAULT_FRONTEND_DIR
) -> FastAPI:
    storage = Storage(db_path)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        storage.prepare()
        yield

    app = FastAPI(lifespan=lifespan)

    @app.exception_handler(InputError)
    async def handle_input_error(request: Request, error: InputError) -> JSONResponse:
        return input_errors_response([{"field": error.field, "reason": error.reason}])

    @app.exception_handler(sqlite3.Error)
    async def handle_storage_error(request: Request, error: sqlite3.Error) -> JSONResponse:
        # 저장소에 읽거나 쓰지 못했다. 자세한 내용(파일 경로 등)은 서버 기록에만 남기고,
        # 응답에는 거절 이유 이름만 보낸다 (API-SPEC.md "API 계약 결정 기록").
        logger.error(
            "storage failed: %s %s", request.method, request.url.path, exc_info=error
        )
        return JSONResponse(
            status_code=500,
            content={"errors": [{"field": None, "reason": "STORAGE_FAILED"}]},
        )

    @app.exception_handler(TaskNotFound)
    async def handle_task_not_found(request: Request, error: TaskNotFound) -> JSONResponse:
        return JSONResponse(
            status_code=404,
            content={"errors": [{"field": None, "reason": "TASK_NOT_FOUND"}]},
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, error: RequestValidationError
    ) -> JSONResponse:
        # 글자가 와야 할 곳에 다른 종류의 값이 오면 그 필드에 INVALID_TYPE을 돌려준다.
        errors = []
        for detail in error.errors():
            location = detail["loc"]
            field = str(location[1]) if len(location) > 1 and location[0] == "body" else None
            errors.append({"field": field, "reason": "INVALID_TYPE"})
        return input_errors_response(errors)

    @app.get("/api/tasks")
    def list_tasks() -> list[Task]:
        return storage.list_tasks()

    @app.post("/api/tasks", status_code=201)
    def create_task(body: TaskCreate) -> Task:
        title = clean_title(body.title)
        description = clean_description(body.description)
        return storage.create_task(title, description)

    @app.patch("/api/tasks/{task_id}")
    def update_task(task_id: int, body: TaskUpdate) -> Task:
        changes = {}
        if "title" in body.model_fields_set:
            changes["title"] = clean_title(body.title)
        if "description" in body.model_fields_set:
            changes["description"] = clean_description(body.description)
        task = storage.update_task(task_id, changes)
        if task is None:
            raise TaskNotFound()
        return task

    @app.delete("/api/tasks/{task_id}", status_code=204)
    def delete_task(task_id: int) -> Response:
        if not storage.delete_task(task_id):
            raise TaskNotFound()
        return Response(status_code=204)

    @app.patch("/api/tasks/{task_id}/status")
    def change_status(task_id: int, body: StatusChange) -> Task:
        if body.status not in TASK_STATUSES:
            raise InputError("status", "INVALID_STATUS")
        task = storage.change_status(task_id, body.status)
        if task is None:
            raise TaskNotFound()
        return task

    # 화면 파일은 /api 주소들 뒤에 붙여, /api 요청이 먼저 처리되게 한다.
    # 빌드한 화면이 없으면(개발할 때) 서버는 /api만 맡는다.
    if frontend_dir is not None and frontend_dir.is_dir():
        app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

    return app


app = create_app()
