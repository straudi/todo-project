import pytest
from fastapi.testclient import TestClient

from app.main import create_app

TITLE_EMPTY = {"errors": [{"field": "title", "reason": "TITLE_EMPTY"}]}


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path / "tasks.db")) as client:
        yield client


def test_create_task_returns_201_and_starts_as_todo(client):
    response = client.post("/api/tasks", json={"title": "장보기", "description": "우유, 계란"})

    assert response.status_code == 201
    task = response.json()
    assert task.pop("created_at")  # 값은 test_created_at.py에서 확인한다.
    assert task == {"id": 1, "title": "장보기", "description": "우유, 계란", "status": "TODO"}
    assert client.get("/api/tasks").json() == [response.json()]


def test_new_task_comes_first_in_list(client):
    client.post("/api/tasks", json={"title": "장보기", "description": None})
    client.post("/api/tasks", json={"title": "보고서 쓰기", "description": None})

    titles = [task["title"] for task in client.get("/api/tasks").json()]
    assert titles == ["보고서 쓰기", "장보기"]


# T-37
def test_empty_title_is_rejected_with_422_and_title_empty(client):
    response = client.post("/api/tasks", json={"title": "", "description": None})

    assert response.status_code == 422
    assert response.json() == TITLE_EMPTY
    assert client.get("/api/tasks").json() == []


# T-38
@pytest.mark.parametrize("title", ["   ", "\t", "\n", " \t\n"])
def test_whitespace_only_title_is_rejected_with_422_and_title_empty(client, title):
    response = client.post("/api/tasks", json={"title": title, "description": None})

    assert response.status_code == 422
    assert response.json() == TITLE_EMPTY
    assert client.get("/api/tasks").json() == []


@pytest.mark.parametrize("body", [{"description": "메모"}, {"title": None, "description": "메모"}])
def test_missing_or_null_title_is_rejected_as_title_empty(client, body):
    response = client.post("/api/tasks", json=body)

    assert response.status_code == 422
    assert response.json() == TITLE_EMPTY
    assert client.get("/api/tasks").json() == []


def test_non_text_title_is_rejected_with_invalid_type(client):
    response = client.post("/api/tasks", json={"title": 123, "description": None})

    assert response.status_code == 422
    assert response.json() == {"errors": [{"field": "title", "reason": "INVALID_TYPE"}]}
    assert client.get("/api/tasks").json() == []


def test_title_surrounding_whitespace_is_removed(client):
    response = client.post("/api/tasks", json={"title": "  장보기 \n", "description": None})

    assert response.status_code == 201
    assert response.json()["title"] == "장보기"


@pytest.mark.parametrize("description", ["", "   ", "\n\t"])
def test_blank_description_is_saved_as_null(client, description):
    response = client.post("/api/tasks", json={"title": "장보기", "description": description})

    assert response.status_code == 201
    assert response.json()["description"] is None


def test_status_id_and_ordered_at_in_request_are_ignored(client):
    response = client.post(
        "/api/tasks",
        json={"title": "장보기", "description": None, "status": "DONE", "id": 99, "ordered_at": 1},
    )

    assert response.status_code == 201
    task = response.json()
    assert task.pop("created_at")
    assert task == {"id": 1, "title": "장보기", "description": None, "status": "TODO"}
