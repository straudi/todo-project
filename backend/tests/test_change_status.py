import sqlite3
from contextlib import closing

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

INVALID_STATUS = {"errors": [{"field": "status", "reason": "INVALID_STATUS"}]}
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
                    (1, "장보기", None, "TODO", 100),
                    (2, "보고서 쓰기", None, "TODO", 200),
                    (3, "청소", None, "DONE", 300),
                ],
            )
        yield client


def ordered_at(db_path, task_id):
    with closing(sqlite3.connect(db_path)) as conn:
        return conn.execute("SELECT ordered_at FROM tasks WHERE id = ?", (task_id,)).fetchone()[0]


def test_change_status_moves_card_to_top_of_new_status(client):
    response = client.patch("/api/tasks/1/status", json={"status": "DONE"})

    assert response.status_code == 200
    assert response.json() == {"id": 1, "title": "장보기", "description": None, "status": "DONE", "created_at": "1970-01-01T00:00:00Z"}
    assert [task["id"] for task in client.get("/api/tasks").json()] == [1, 3, 2]


def test_change_status_back_to_todo_is_allowed(client):
    response = client.patch("/api/tasks/3/status", json={"status": "TODO"})

    assert response.status_code == 200
    assert response.json()["status"] == "TODO"
    assert [task["id"] for task in client.get("/api/tasks").json()] == [3, 2, 1]


def test_same_status_changes_nothing(client, db_path):
    before = ordered_at(db_path, 1)

    response = client.patch("/api/tasks/1/status", json={"status": "TODO"})

    assert response.status_code == 200
    assert response.json()["status"] == "TODO"
    assert ordered_at(db_path, 1) == before
    assert [task["id"] for task in client.get("/api/tasks").json()] == [3, 2, 1]


# T-40
@pytest.mark.parametrize("status", ["ARCHIVED", "done", "완료"])
def test_status_other_than_three_values_is_rejected(client, status):
    response = client.patch("/api/tasks/1/status", json={"status": status})

    assert response.status_code == 422
    assert response.json() == INVALID_STATUS
    assert client.get("/api/tasks").json()[2]["status"] == "TODO"


# T-41
@pytest.mark.parametrize("body", [{"status": ""}, {"status": None}, {}, {"status": 1}])
def test_empty_or_missing_status_is_rejected(client, body):
    response = client.patch("/api/tasks/1/status", json=body)

    assert response.status_code == 422
    assert response.json() == INVALID_STATUS
    assert [task["id"] for task in client.get("/api/tasks").json()] == [3, 2, 1]


def test_unknown_task_is_rejected_with_404(client):
    response = client.patch("/api/tasks/99999/status", json={"status": "DONE"})

    assert response.status_code == 404
    assert response.json() == TASK_NOT_FOUND
    assert [task["id"] for task in client.get("/api/tasks").json()] == [3, 2, 1]
