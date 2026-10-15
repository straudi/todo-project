import sqlite3
import time
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path

# 표와 칸 이름, 저장 종류, 번호 규칙은 DATA-MODEL.md "데이터 규칙 결정 기록"을 따른다.
# AUTOINCREMENT: 지운 카드의 번호를 다시 쓰지 않는다.
# ordered_at, created_at: 마이크로초 단위 시각(숫자).
CREATE_TASKS_TABLE = """
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL CHECK (length(title) > 0),
    description TEXT,
    status TEXT NOT NULL CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE')),
    ordered_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
)
"""

TASK_COLUMNS = "id, title, description, status, created_at"


def to_task(row: sqlite3.Row) -> dict:
    """created_at을 UTC 날짜·시각 글자(초 단위, 끝에 Z)로 바꾼다 (API-SPEC.md "카드 필드")."""
    task = dict(row)
    created = datetime.fromtimestamp(task["created_at"] // 1_000_000, tz=UTC)
    task["created_at"] = created.strftime("%Y-%m-%dT%H:%M:%SZ")
    return task


class Storage:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def prepare(self) -> None:
        """SQLite 파일과 tasks 표가 없으면 만든다.

        created_at 칸이 없는 옛 표에는 칸을 더하고, 있던 카드는 ordered_at 값으로 채운다
        (DATA-MODEL.md "데이터 규칙 결정 기록").
        """
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self._connect()) as conn, conn:
            conn.execute(CREATE_TASKS_TABLE)
            columns = [row["name"] for row in conn.execute("PRAGMA table_info(tasks)")]
            if "created_at" not in columns:
                conn.execute("ALTER TABLE tasks ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0")
                conn.execute("UPDATE tasks SET created_at = ordered_at")

    def list_tasks(self) -> list[dict]:
        """ordered_at이 늦은 것부터, 같으면 id가 큰 것부터 돌려준다."""
        with closing(self._connect()) as conn:
            rows = conn.execute(
                f"SELECT {TASK_COLUMNS} FROM tasks ORDER BY ordered_at DESC, id DESC"
            ).fetchall()
        return [to_task(row) for row in rows]

    def change_status(self, task_id: int, status: str) -> dict | None:
        """다른 상태로 옮기면 순서 기준 시각을 지금으로 바꾼다. 같은 상태면 아무것도 바꾸지 않는다.
        만든 시각은 바꾸지 않는다.

        없는 카드면 None을 돌려준다.
        """
        with closing(self._connect()) as conn, conn:
            row = conn.execute("SELECT status FROM tasks WHERE id = ?", (task_id,)).fetchone()
            if row is None:
                return None
            if row["status"] != status:
                conn.execute(
                    "UPDATE tasks SET status = ?, ordered_at = ? WHERE id = ?",
                    (status, time.time_ns() // 1000, task_id),
                )
            row = conn.execute(f"SELECT {TASK_COLUMNS} FROM tasks WHERE id = ?", (task_id,)).fetchone()
        return to_task(row)

    def update_task(self, task_id: int, changes: dict) -> dict | None:
        """제목과 설명 중 받은 것만 바꾼다. 상태, 순서 기준 시각, 만든 시각은 그대로 둔다.

        없는 카드면 None을 돌려준다.
        """
        columns = [name for name in ("title", "description") if name in changes]
        with closing(self._connect()) as conn, conn:
            if columns:
                assignments = ", ".join(f"{name} = ?" for name in columns)
                conn.execute(
                    f"UPDATE tasks SET {assignments} WHERE id = ?",
                    [changes[name] for name in columns] + [task_id],
                )
            row = conn.execute(f"SELECT {TASK_COLUMNS} FROM tasks WHERE id = ?", (task_id,)).fetchone()
        return to_task(row) if row is not None else None

    def delete_task(self, task_id: int) -> bool:
        """카드를 지운다. 없는 카드면 False를 돌려준다."""
        with closing(self._connect()) as conn, conn:
            cursor = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        return cursor.rowcount > 0

    def create_task(self, title: str, description: str | None) -> dict:
        """새 카드는 항상 TODO로, 순서 기준 시각과 만든 시각은 지금으로 정한다."""
        now = time.time_ns() // 1000
        with closing(self._connect()) as conn, conn:
            cursor = conn.execute(
                "INSERT INTO tasks (title, description, status, ordered_at, created_at)"
                " VALUES (?, ?, 'TODO', ?, ?)",
                (title, description, now, now),
            )
            row = conn.execute(
                f"SELECT {TASK_COLUMNS} FROM tasks WHERE id = ?", (cursor.lastrowid,)
            ).fetchone()
        return to_task(row)
