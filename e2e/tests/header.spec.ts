import { expect, test, type Page } from '@playwright/test'
import { TEST_API_PORT } from '../helpers/paths'
import { seedTasks, type SeedTask } from '../helpers/seed'

// TEST-PLAN.md "화면 다듬기 (P-31)" T-58 ~ T-62.

const column = (page: Page, name: string) => page.getByRole('region', { name })
const card = (page: Page, columnName: string, title: string) =>
  column(page, columnName).locator('.card').filter({ has: page.locator('.card-title', { hasText: title }) })
const statusPill = (page: Page, columnName: string, title: string) =>
  card(page, columnName, title).locator('.status-pill')
const statusMenu = (page: Page, columnName: string, title: string) =>
  card(page, columnName, title).getByRole('group', { name: '상태 고르기' })
const summary = (page: Page) => page.getByRole('group', { name: '상태별 카드 개수' })
const appTitle = (page: Page) => page.getByRole('heading', { level: 1, name: '할 일 카드' })

async function pickStatus(page: Page, columnName: string, title: string, label: string) {
  await statusPill(page, columnName, title).click()
  await statusMenu(page, columnName, title).getByRole('button', { name: label, exact: true }).click()
}

const isApi = (url: URL) => url.pathname.startsWith('/api/')

async function openBoard(page: Page, tasks: SeedTask[]) {
  seedTasks(tasks)
  await page.goto('/')
  await expect(page.locator('.card')).toHaveCount(tasks.length)
}

async function expectSummary(page: Page, tags: string[], total: string) {
  await expect(summary(page).locator('.summary-tag')).toHaveText(tags)
  await expect(summary(page).locator('.summary-total')).toHaveText(total)
}

const CARDS_IN_ALL_COLUMNS: SeedTask[] = [
  { id: 1, title: '장보기', description: '우유, 계란', status: 'TODO', ordered_at: 100 },
  { id: 2, title: '보고서 쓰기', description: null, status: 'TODO', ordered_at: 200 },
  { id: 3, title: '청소', description: null, status: 'IN_PROGRESS', ordered_at: 300 },
  { id: 4, title: '운동', description: null, status: 'DONE', ordered_at: 400 },
  { id: 5, title: '책 읽기', description: null, status: 'DONE', ordered_at: 500 },
]

const TWO_TODO_CARDS: SeedTask[] = [
  { id: 1, title: '장보기', description: null, status: 'TODO', ordered_at: 100 },
  { id: 2, title: '보고서 쓰기', description: null, status: 'TODO', ordered_at: 200 },
]

test('T-58 앱을 열면 앱 제목과 새 카드 버튼이 보인다', async ({ page }) => {
  seedTasks([])
  await page.goto('/')

  await expect(appTitle(page)).toBeVisible()
  await expect(page.getByRole('button', { name: '새 카드' })).toBeVisible()
})

test('T-59 요약 줄의 숫자가 칸별 개수와 같고, 만들기·옮기기·지우기 뒤에도 같다', async ({ page }) => {
  await openBoard(page, CARDS_IN_ALL_COLUMNS)
  await expectSummary(page, ['할 일 2', '진행 중 1', '완료 2'], '· 모두 5장')

  await page.getByRole('button', { name: '새 카드' }).click()
  const dialog = page.getByRole('dialog', { name: '카드 만들기' })
  await dialog.getByLabel('제목').fill('새 일')
  await dialog.getByRole('button', { name: '만들기' }).click()
  await expect(dialog).toHaveCount(0)
  await expectSummary(page, ['할 일 3', '진행 중 1', '완료 2'], '· 모두 6장')

  await pickStatus(page, '할 일', '장보기', '완료')
  await expect(card(page, '완료', '장보기')).toHaveCount(1)
  await expectSummary(page, ['할 일 2', '진행 중 1', '완료 3'], '· 모두 6장')

  await card(page, '완료', '운동').getByRole('button', { name: '삭제' }).click()
  await card(page, '완료', '운동').getByRole('button', { name: '예' }).click()
  await expect(card(page, '완료', '운동')).toHaveCount(0)
  await expectSummary(page, ['할 일 2', '진행 중 1', '완료 2'], '· 모두 5장')
})

test('T-59 옮기기가 실패하면 요약 숫자가 그대로다', async ({ page }) => {
  await openBoard(page, TWO_TODO_CARDS)
  await page.route(isApi, (route) => route.abort('connectionrefused'))

  await pickStatus(page, '할 일', '장보기', '완료')

  await expect(card(page, '할 일', '장보기').getByText('옮기지 못했습니다. 다시 시도해 주세요.')).toBeVisible()
  await expectSummary(page, ['할 일 2', '진행 중 0', '완료 0'], '· 모두 2장')
})

test('T-59 다른 기기에서 지운 카드를 옮기려 하면 요약 숫자가 줄어든다', async ({ page }) => {
  await openBoard(page, TWO_TODO_CARDS)
  const response = await page.request.delete(`http://127.0.0.1:${TEST_API_PORT}/api/tasks/1`)
  expect(response.status()).toBe(204)

  await pickStatus(page, '할 일', '장보기', '완료')

  await expect(page.getByText('이미 지워진 카드입니다. 다른 기기에서 지웠을 수 있습니다.')).toBeVisible()
  await expectSummary(page, ['할 일 1', '진행 중 0', '완료 0'], '· 모두 1장')
})

test('T-59 개수가 두 자리여도 요약 줄이 맞다', async ({ page }) => {
  const twelve: SeedTask[] = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    title: `일 ${i + 1}`,
    description: null,
    status: 'TODO',
    ordered_at: 100 + i,
  }))
  await openBoard(page, twelve)

  await expectSummary(page, ['할 일 12', '진행 중 0', '완료 0'], '· 모두 12장')
  await expect(column(page, '할 일').locator('.column-count')).toHaveText('12')
})

test('T-60 목록을 받지 못하면 요약 줄이 없고 앱 제목과 새 카드는 보인다', async ({ page }) => {
  seedTasks(TWO_TODO_CARDS)
  await page.route(isApi, (route) => route.abort('connectionrefused'))

  await page.goto('/')

  await expect(page.getByText('카드를 불러오지 못했습니다. 새로고침해 주세요.')).toBeVisible()
  await expect(summary(page)).toHaveCount(0)
  await expect(appTitle(page)).toBeVisible()
  await expect(page.getByRole('button', { name: '새 카드' })).toBeVisible()
})

test('T-61 만들기 창에 제목 "새 카드"가 보인다', async ({ page }) => {
  seedTasks([])
  await page.goto('/')

  await page.getByRole('button', { name: '새 카드' }).click()

  const dialog = page.getByRole('dialog', { name: '카드 만들기' })
  await expect(dialog.getByRole('heading', { name: '새 카드' })).toBeVisible()
})

test('T-62 상태 표시의 화살표는 닫혀 있으면 아래, 열리면 위를 가리키고 글자는 그대로다', async ({ page }) => {
  await openBoard(page, [{ id: 1, title: '장보기', description: null, status: 'TODO', ordered_at: 100 }])
  const pill = statusPill(page, '할 일', '장보기')

  await expect(pill.locator('svg.lucide-chevron-down')).toHaveCount(1)
  await expect(pill.locator('svg.lucide-chevron-up')).toHaveCount(0)
  await expect(pill).toHaveText('할 일')

  await pill.click()
  await expect(pill.locator('svg.lucide-chevron-up')).toHaveCount(1)
  await expect(pill.locator('svg.lucide-chevron-down')).toHaveCount(0)
  await expect(pill).toHaveText('할 일')
})
