from fastapi.testclient import TestClient

from app.main import create_app


def test_serves_built_frontend_and_api_together(tmp_path):
    frontend_dir = tmp_path / "dist"
    frontend_dir.mkdir()
    (frontend_dir / "index.html").write_text("<title>할 일 카드</title>", encoding="utf-8")

    with TestClient(create_app(tmp_path / "tasks.db", frontend_dir)) as client:
        page = client.get("/")
        tasks = client.get("/api/tasks")

    assert page.status_code == 200
    assert "할 일 카드" in page.text
    assert tasks.status_code == 200
    assert tasks.json() == []


def test_without_built_frontend_only_api_is_served(tmp_path):
    with TestClient(create_app(tmp_path / "tasks.db", tmp_path / "no-dist")) as client:
        page = client.get("/")
        tasks = client.get("/api/tasks")

    assert page.status_code == 404
    assert tasks.status_code == 200
