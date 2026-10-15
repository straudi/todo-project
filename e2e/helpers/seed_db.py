"""브라우저 테스트용 저장소를 비우고 카드를 넣는다.

사용: python seed_db.py <저장소 파일>
카드 목록은 표준 입력으로 JSON(UTF-8)을 받는다. created_at이 없는 카드는 ordered_at 값을 쓴다.
tasks 표는 서버가 켜질 때 만들므로, 서버가 켜진 뒤에 부른다.
"""

import json
import sqlite3
import sys
from contextlib import closing


def main() -> None:
    db_path = sys.argv[1]
    tasks = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    for task in tasks:
        task.setdefault("created_at", task["ordered_at"])
    with closing(sqlite3.connect(db_path)) as conn, conn:
        conn.execute("DELETE FROM tasks")
        conn.executemany(
            "INSERT INTO tasks (id, title, description, status, ordered_at, created_at)"
            " VALUES (:id, :title, :description, :status, :ordered_at, :created_at)",
            tasks,
        )


if __name__ == "__main__":
    main()
