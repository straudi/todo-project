import os
import sqlite3
import stat
from contextlib import closing

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.storage import Storage

STORAGE_FAILED = {"errors": [{"field": None, "reason": "STORAGE_FAILED"}]}


@pytest.fixture
def db_path(tmp_path):
    return tmp_path / "tasks.db"


@pytest.fixture
def client(db_path):
    with TestClient(create_app(db_path)) as client:
        with closing(sqlite3.connect(db_path)) as conn, conn:
            conn.execute(
                "INSERT INTO tasks (id, title, description, status, ordered_at, created_at)"
                " VALUES (1, '장보기', NULL, 'TODO', 100, 100)"
            )
        yield client


@pytest.fixture
def read_only(db_path, client):
    """저장소 파일을 읽기 전용으로 바꿔 쓰기를 실제로 실패시킨다. 끝나면 되돌린다."""
    os.chmod(db_path, stat.S_IREAD)
    yield
    os.chmod(db_path, stat.S_IREAD | stat.S_IWRITE)


ONE_CARD = [{"id": 1, "title": "장보기", "description": None, "status": "TODO", "created_at": "1970-01-01T00:00:00Z"}]


@pytest.mark.parametrize(
    "method, path, body",
    [
        ("POST", "/api/tasks", {"title": "새 카드", "description": None}),
        ("PATCH", "/api/tasks/1", {"title": "마트 가기", "description": None}),
        ("PATCH", "/api/tasks/1/status", {"status": "DONE"}),
        ("DELETE", "/api/tasks/1", None),
    ],
)
def test_write_failure_returns_500_storage_failed(client, read_only, tmp_path, method, path, body):
    response = client.request(method, path, json=body)

    assert response.status_code == 500
    assert response.json() == STORAGE_FAILED
    # 파일 경로 같은 내부 정보는 응답에 넣지 않는다.
    assert str(tmp_path) not in response.text
    # 읽기는 되므로, 저장소가 그대로인지 확인할 수 있다.
    assert client.get("/api/tasks").json() == ONE_CARD


def test_read_failure_returns_500_storage_failed(client, monkeypatch):
    def broken_list(self):
        raise sqlite3.OperationalError("disk I/O error")

    monkeypatch.setattr(Storage, "list_tasks", broken_list)

    response = client.get("/api/tasks")

    assert response.status_code == 500
    assert response.json() == STORAGE_FAILED
