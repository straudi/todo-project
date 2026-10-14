import sqlite3
from contextlib import closing
from pathlib import Path

# 표와 칸 이름, 저장 종류, 번호 규칙은 DATA-MODEL.md "데이터 규칙 결정 기록"을 따른다.
# AUTOINCREMENT: 지운 카드의 번호를 다시 쓰지 않는다.
# ordered_at: 마이크로초 단위 시각(숫자).
CREATE_TASKS_TABLE = """
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL CHECK (length(title) > 0),
    description TEXT,
    status TEXT NOT NULL CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE')),
    ordered_at INTEGER NOT NULL
)
"""


class Storage:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def prepare(self) -> None:
        """SQLite 파일과 tasks 표가 없으면 만든다."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self._connect()) as conn, conn:
            conn.execute(CREATE_TASKS_TABLE)

    def list_tasks(self) -> list[dict]:
        """ordered_at이 늦은 것부터, 같으면 id가 큰 것부터 돌려준다."""
        with closing(self._connect()) as conn:
            rows = conn.execute(
                "SELECT id, title, description, status FROM tasks"
                " ORDER BY ordered_at DESC, id DESC"
            ).fetchall()
        return [dict(row) for row in rows]
