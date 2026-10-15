import sqlite3
from contextlib import closing

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

TITLE_EMPTY = {"errors": [{"field": "title", "reason": "TITLE_EMPTY"}]}
TASK_NOT_FOUND = {"errors": [{"field": None, "reason": "TASK_NOT_FOUND"}]}


@pytest.fixture
def db_path(tmp_path):
    return tmp_path / "tasks.db"


@pytest.fixture
def client(db_path):
    with TestClient(create_app(db_path)) as client:
        with closing(sqlite3.connect(db_path)) as conn, conn:
            conn.executemany(
                "INSERT INTO tasks (id, title, description, status, ordered_at, created_at)"
                " VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
                [
                    (1, "장보기", "우유", "TODO", 100),
                    (2, "보고서 쓰기", "목요일까지", "TODO", 200),
                    (3, "청소", None, "IN_PROGRESS", 300),
                ],
            )
        yield client


def ordered_at(db_path, task_id):
    with closing(sqlite3.connect(db_path)) as conn:
        return conn.execute("SELECT ordered_at FROM tasks WHERE id = ?", (task_id,)).fetchone()[0]


def ids(client):
    return [task["id"] for task in client.get("/api/tasks").json()]


def test_update_changes_title_and_description_but_not_status_or_place(client, db_path):
    before = ordered_at(db_path, 1)

    response = client.patch("/api/tasks/1", json={"title": "마트 가기", "description": "우유, 계란"})

    assert response.status_code == 200
    assert response.json() == {"id": 1, "title": "마트 가기", "description": "우유, 계란", "status": "TODO", "created_at": "1970-01-01T00:00:00Z"}
    assert ordered_at(db_path, 1) == before
    assert ids(client) == [3, 2, 1]


def test_update_with_blank_description_saves_null(client):
    response = client.patch("/api/tasks/1", json={"title": "장보기", "description": "  "})

    assert response.status_code == 200
    assert response.json()["description"] is None


def test_update_removes_title_surrounding_whitespace(client):
    response = client.patch("/api/tasks/1", json={"title": "  마트 가기\n", "description": None})

    assert response.json()["title"] == "마트 가기"


def test_update_keeps_fields_that_are_not_sent(client):
    response = client.patch("/api/tasks/2", json={"description": "금요일까지"})

    assert response.status_code == 200
    assert response.json() == {"id": 2, "title": "보고서 쓰기", "description": "금요일까지", "status": "TODO", "created_at": "1970-01-01T00:00:00Z"}

    response = client.patch("/api/tasks/2", json={"title": "보고서 마무리"})
    assert response.json()["description"] == "금요일까지"


# T-39
@pytest.mark.parametrize("title", ["  ", "", None])
def test_update_with_empty_title_is_rejected(client, title):
    response = client.patch("/api/tasks/2", json={"title": title, "description": None})

    assert response.status_code == 422
    assert response.json() == TITLE_EMPTY
    task = next(task for task in client.get("/api/tasks").json() if task["id"] == 2)
    assert task == {"id": 2, "title": "보고서 쓰기", "description": "목요일까지", "status": "TODO", "created_at": "1970-01-01T00:00:00Z"}
    assert ids(client) == [3, 2, 1]


def test_delete_removes_task(client):
    response = client.delete("/api/tasks/1")

    assert response.status_code == 204
    assert response.content == b""
    assert ids(client) == [3, 2]


# T-42
@pytest.mark.parametrize(
    "method, path, body",
    [
        ("PATCH", "/api/tasks/99999", {"title": "제목", "description": None}),
        ("PATCH", "/api/tasks/99999/status", {"status": "DONE"}),
        ("DELETE", "/api/tasks/99999", None),
    ],
)
def test_unknown_task_is_rejected_with_404(client, method, path, body):
    response = client.request(method, path, json=body)

    assert response.status_code == 404
    assert response.json() == TASK_NOT_FOUND
    assert ids(client) == [3, 2, 1]


def test_deleted_task_number_is_not_reused(client):
    client.delete("/api/tasks/3")

    response = client.post("/api/tasks", json={"title": "새 카드", "description": None})

    assert response.json()["id"] == 4
