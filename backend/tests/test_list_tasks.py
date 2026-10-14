import sqlite3
from contextlib import closing

from fastapi.testclient import TestClient

from app.main import create_app


def test_starting_server_creates_database_file_and_tasks_table(tmp_path):
    db_path = tmp_path / "data" / "tasks.db"

    with TestClient(create_app(db_path)):
        pass

    assert db_path.exists()
    with closing(sqlite3.connect(db_path)) as conn:
        columns = [row[1] for row in conn.execute("PRAGMA table_info(tasks)")]
    assert columns == ["id", "title", "description", "status", "ordered_at"]


def test_list_tasks_returns_empty_list_when_no_cards(tmp_path):
    with TestClient(create_app(tmp_path / "tasks.db")) as client:
        response = client.get("/api/tasks")

    assert response.status_code == 200
    assert response.json() == []


def test_list_tasks_orders_by_latest_ordered_at_then_larger_id(tmp_path):
    db_path = tmp_path / "tasks.db"
    with TestClient(create_app(db_path)) as client:
        with closing(sqlite3.connect(db_path)) as conn, conn:
            conn.executemany(
                "INSERT INTO tasks (id, title, description, status, ordered_at)"
                " VALUES (?, ?, ?, ?, ?)",
                [
                    (1, "오래된 카드", None, "TODO", 100),
                    (2, "최근 카드", "설명", "DONE", 300),
                    (3, "같은 시각, 번호 작음", None, "IN_PROGRESS", 200),
                    (4, "같은 시각, 번호 큼", None, "TODO", 200),
                ],
            )
        response = client.get("/api/tasks")

    assert response.status_code == 200
    assert response.json() == [
        {"id": 2, "title": "최근 카드", "description": "설명", "status": "DONE"},
        {"id": 4, "title": "같은 시각, 번호 큼", "description": None, "status": "TODO"},
        {"id": 3, "title": "같은 시각, 번호 작음", "description": None, "status": "IN_PROGRESS"},
        {"id": 1, "title": "오래된 카드", "description": None, "status": "TODO"},
    ]
