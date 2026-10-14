import { expect, test, type Page } from '@playwright/test'
import { execSync, spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { PYTHON, ROOT } from '../helpers/paths'
import { seedTasks, type SeedTask } from '../helpers/seed'

// TEST-PLAN.md T-29 서버 재시작.
// 다른 테스트와 달리 서버를 직접 켜고 실제로 끈 뒤 다시 켠다.
// 실제로 쓸 때처럼 빌드한 화면을 서버가 함께 보여 주는 방식으로 연다 (DECISIONS.md D-013).

const PORT = 8002
const APP_URL = `http://127.0.0.1:${PORT}/`
const DB_PATH = path.join(ROOT, 'e2e', '.data', 'restart.db')

const column = (page: Page, name: string) => page.getByRole('region', { name })

async function readBoard(page: Page) {
  const board: Record<string, string[]> = {}
  for (const name of ['할 일', '진행 중', '완료']) {
    board[name] = await column(page, name).locator('.card-title').allTextContents()
  }
  return board
}

function startServer(): ChildProcess {
  return spawn(
    PYTHON,
    ['-m', 'uvicorn', 'app.main:app', '--app-dir', 'backend', '--host', '127.0.0.1', '--port', String(PORT)],
    { cwd: ROOT, env: { ...process.env, TASKS_DB_PATH: DB_PATH }, stdio: 'ignore' },
  )
}

async function isUp(): Promise<boolean> {
  try {
    return (await fetch(`${APP_URL}api/tasks`)).ok
  } catch {
    return false
  }
}

async function waitUntil(wanted: boolean) {
  for (let i = 0; i < 100; i++) {
    if ((await isUp()) === wanted) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`server did not become ${wanted ? 'up' : 'down'}`)
}

async function stopServer(server: ChildProcess) {
  server.kill()
  await waitUntil(false)
}

const CARDS: SeedTask[] = [
  { id: 1, title: '장보기', description: '우유, 계란', status: 'TODO', ordered_at: 100 },
  { id: 2, title: '보고서 쓰기', description: null, status: 'TODO', ordered_at: 200 },
  { id: 3, title: '청소', description: null, status: 'IN_PROGRESS', ordered_at: 300 },
  { id: 4, title: '운동', description: null, status: 'DONE', ordered_at: 400 },
]

let server: ChildProcess | undefined

test.beforeAll(() => {
  // 서버가 보여 줄 화면을 빌드한다.
  execSync('npm run build', { cwd: path.join(ROOT, 'frontend'), stdio: 'ignore' })
})

test.afterAll(() => {
  server?.kill()
})

test('T-29 서버를 껐다 켠 뒤 새로고침해도 칸마다 같은 카드가 같은 순서로 보인다', async ({ page }) => {
  test.setTimeout(60_000)

  server = startServer()
  await waitUntil(true)
  seedTasks(CARDS, DB_PATH)
  await page.goto(APP_URL)
  await expect(column(page, '할 일').locator('.card')).toHaveCount(2)
  const before = await readBoard(page)
  expect(before).toEqual({ '할 일': ['보고서 쓰기', '장보기'], '진행 중': ['청소'], 완료: ['운동'] })

  // 서버를 실제로 끈다. 꺼진 동안에는 서버에 닿지 않는다.
  await stopServer(server)
  expect(await isUp()).toBe(false)

  server = startServer()
  await waitUntil(true)
  await page.reload()
  await expect(column(page, '할 일').locator('.card')).toHaveCount(2)
  expect(await readBoard(page)).toEqual(before)
  await expect(column(page, '할 일').locator('.card-description')).toHaveText(['우유, 계란'])
})
