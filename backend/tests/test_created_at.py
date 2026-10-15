import sqlite3
import time
from contextlib import closing
from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.main import create_app

# 2026-10-01 03:00:00 UTC, 2026-10-05 03:00:00 UTC (마이크로초)
OCT_1 = 1_790_823_600_000_000
OCT_5 = 1_791_169_200_000_000

# 만든 시각 칸이 생기기 전(P-29 전)의 tasks 표
OLD_TASKS_TABLE = """
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL CHECK (length(title) > 0),
    description TEXT,
    status TEXT NOT NULL CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE')),
    ordered_at INTEGER NOT NULL
)
"""


def created_at_values(db_path):
    with closing(sqlite3.connect(db_path)) as conn:
        return dict(conn.execute("SELECT id, created_at FROM tasks"))


def test_new_task_created_at_is_now_in_utc(tmp_path):
    with TestClient(create_app(tmp_path / "tasks.db")) as client:
        before = int(time.time())
        response = client.post("/api/tasks", json={"title": "장보기", "description": None})
        after = int(time.time())

    created_at = response.json()["created_at"]
    assert created_at.endswith("Z")
    seconds = int(datetime.strptime(created_at, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC).timestamp())
    assert before <= seconds <= after


def test_t56_status_change_and_update_keep_created_at(tmp_path):
    db_path = tmp_path / "tasks.db"
    with TestClient(create_app(db_path)) as client:
        with closing(sqlite3.connect(db_path)) as conn, conn:
            conn.execute(
                "INSERT INTO tasks (id, title, description, status, ordered_at, created_at)"
                " VALUES (1, '장보기', NULL, 'TODO', ?, ?)",
                (OCT_1, OCT_1),
            )

        responses = [
            client.patch("/api/tasks/1/status", json={"status": "IN_PROGRESS"}),
            client.patch("/api/tasks/1/status", json={"status": "DONE"}),
            client.patch(
                "/api/tasks/1",
                json={"title": "장보기 2", "description": None, "created_at": "2000-01-01T00:00:00Z"},
            ),
        ]
        listed = client.get("/api/tasks").json()

    assert [response.status_code for response in responses] == [200, 200, 200]
    assert [response.json()["created_at"] for response in responses] == ["2026-10-01T03:00:00Z"] * 3
    assert listed[0]["created_at"] == "2026-10-01T03:00:00Z"
    assert created_at_values(db_path) == {1: OCT_1}


def test_created_at_in_create_request_is_ignored(tmp_path):
    with TestClient(create_app(tmp_path / "tasks.db")) as client:
        response = client.post(
            "/api/tasks",
            json={"title": "장보기", "description": None, "created_at": "2000-01-01T00:00:00Z"},
        )

    assert response.status_code == 201
    assert not response.json()["created_at"].startswith("2000-")


def test_t57_old_database_gets_created_at_from_ordered_at(tmp_path):
    db_path = tmp_path / "tasks.db"
    with closing(sqlite3.connect(db_path)) as conn, conn:
        conn.execute(OLD_TASKS_TABLE)
        # 1번은 옮긴 적이 없고, 2번은 10월 1일에 만들어 10월 5일에 옮겼다.
        conn.executemany(
            "INSERT INTO tasks (id, title, description, status, ordered_at) VALUES (?, ?, ?, ?, ?)",
            [
                (1, "장보기", "우유", "TODO", OCT_1),
                (2, "보고서 쓰기", None, "DONE", OCT_5),
            ],
        )

    with TestClient(create_app(db_path)) as client:
        first = client.get("/api/tasks").json()
    # 서버를 다시 켜도 값이 바뀌지 않는다.
    with TestClient(create_app(db_path)) as client:
        second = client.get("/api/tasks").json()

    assert first == [
        {"id": 2, "title": "보고서 쓰기", "description": None, "status": "DONE", "created_at": "2026-10-05T03:00:00Z"},
        {"id": 1, "title": "장보기", "description": "우유", "status": "TODO", "created_at": "2026-10-01T03:00:00Z"},
    ]
    assert second == first
    assert created_at_values(db_path) == {1: OCT_1, 2: OCT_5}
