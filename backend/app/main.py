import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .storage import Storage

# 저장소 파일 위치는 ARCHITECTURE.md "기술과 실행 환경"을 따른다.
# 브라우저 테스트는 TASKS_DB_PATH로 테스트용 파일을 가리킨다.
DEFAULT_DB_PATH = Path(
    os.environ.get(
        "TASKS_DB_PATH",
        Path(__file__).resolve().parent.parent / "data" / "tasks.db",
    )
)


class Task(BaseModel):
    # 응답에 ordered_at은 넣지 않는다 (API-SPEC.md "API 계약 결정 기록").
    id: int
    title: str
    description: str | None
    status: Literal["TODO", "IN_PROGRESS", "DONE"]


class TaskCreate(BaseModel):
    # status, id, ordered_at 같은 다른 필드는 무시한다 (API-SPEC.md "API 계약 결정 기록").
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


def create_app(db_path: Path = DEFAULT_DB_PATH) -> FastAPI:
    storage = Storage(db_path)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        storage.prepare()
        yield

    app = FastAPI(lifespan=lifespan)

    @app.exception_handler(InputError)
    async def handle_input_error(request: Request, error: InputError) -> JSONResponse:
        return input_errors_response([{"field": error.field, "reason": error.reason}])

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

    @app.patch("/api/tasks/{task_id}/status")
    def change_status(task_id: int, body: StatusChange) -> Task:
        if body.status not in TASK_STATUSES:
            raise InputError("status", "INVALID_STATUS")
        task = storage.change_status(task_id, body.status)
        if task is None:
            raise TaskNotFound()
        return task

    return app


app = create_app()
