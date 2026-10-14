from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel

from .storage import Storage

# 저장소 파일 위치는 ARCHITECTURE.md "기술과 실행 환경"을 따른다.
DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "tasks.db"


class Task(BaseModel):
    # 응답에 ordered_at을 넣을지는 API-SPEC.md에서 미정이라 넣지 않는다.
    id: int
    title: str
    description: str | None
    status: Literal["TODO", "IN_PROGRESS", "DONE"]


def create_app(db_path: Path = DEFAULT_DB_PATH) -> FastAPI:
    storage = Storage(db_path)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        storage.prepare()
        yield

    app = FastAPI(lifespan=lifespan)

    @app.get("/api/tasks")
    def list_tasks() -> list[Task]:
        return storage.list_tasks()

    return app


app = create_app()
