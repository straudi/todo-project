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
