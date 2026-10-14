import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

// 서버의 venv에 있는 Python (D-012: venv + pip).
export const PYTHON = path.join(ROOT, 'backend', '.venv', 'Scripts', 'python.exe')

// 실제 카드 데이터(backend/data/tasks.db)를 건드리지 않도록 테스트 전용 파일을 쓴다.
export const TEST_DB_PATH = path.join(ROOT, 'e2e', '.data', 'e2e.db')

// 켜 둔 개발 서버(8000, 5173)와 부딪히지 않는 테스트 전용 포트.
export const TEST_API_PORT = 8001
export const TEST_WEB_PORT = 5174
