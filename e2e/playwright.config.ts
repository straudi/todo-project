import { defineConfig } from '@playwright/test'
import { PYTHON, ROOT, TEST_API_PORT, TEST_DB_PATH, TEST_WEB_PORT } from './helpers/paths'

const webUrl = `http://127.0.0.1:${TEST_WEB_PORT}`

export default defineConfig({
  testDir: './tests',
  // 테스트들이 저장소 파일 하나를 함께 쓰므로 한 번에 하나씩 돌린다.
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: webUrl,
    // 이 컴퓨터에 설치된 Chrome을 쓴다 (D-012).
    channel: 'chrome',
  },
  webServer: [
    {
      command: `"${PYTHON}" -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port ${TEST_API_PORT}`,
      cwd: ROOT,
      url: `http://127.0.0.1:${TEST_API_PORT}/api/tasks`,
      env: { TASKS_DB_PATH: TEST_DB_PATH },
      reuseExistingServer: false,
    },
    {
      command: `npm --prefix frontend run dev -- --host 127.0.0.1 --port ${TEST_WEB_PORT} --strictPort`,
      cwd: ROOT,
      url: webUrl,
      env: { API_TARGET: `http://127.0.0.1:${TEST_API_PORT}` },
      reuseExistingServer: false,
    },
  ],
})
