import { expect, test, type Page } from '@playwright/test'
import { seedTasks, type SeedTask } from '../helpers/seed'

// TEST-PLAN.md "저장 실패 (서버에 닿지 못할 때)" T-32 ~ T-36, T-43.
// "서버를 끈다"는 브라우저의 /api 요청을 막아 서버에 닿지 못하게 하는 것으로,
// "서버를 켠다"는 막은 것을 푸는 것으로 대신한다 (TEST-PLAN.md "적용 범위와 확인 방법").

const column = (page: Page, name: string) => page.getByRole('region', { name })
const titles = (page: Page, name: string) => column(page, name).locator('.card-title')
const card = (page: Page, columnName: string, title: string) =>
  column(page, columnName).locator('.card').filter({ has: page.locator('.card-title', { hasText: title }) })
const dialog = (page: Page) => page.getByRole('dialog', { name: '카드 만들기' })
const statusPill = (page: Page, columnName: string, title: string) =>
  card(page, columnName, title).locator('.status-pill')
const statusMenu = (page: Page, columnName: string, title: string) =>
  card(page, columnName, title).getByRole('group', { name: '상태 고르기' })

/** 카드의 상태 표시를 누르고, 메뉴에서 상태를 고른다 (SCREEN-SPEC.md "상태 표시와 상태 메뉴"). */
async function pickStatus(page: Page, columnName: string, title: string, label: string) {
  await statusPill(page, columnName, title).click()
  await statusMenu(page, columnName, title).getByRole('button', { name: label, exact: true }).click()
}
const editingCard = (page: Page) => page.locator('.card-editing')

const isApi = (url: URL) => url.pathname.startsWith('/api/')

async function stopServer(page: Page) {
  await page.route(isApi, (route) => route.abort('connectionrefused'))
}

async function startServer(page: Page) {
  await page.unroute(isApi)
}

async function openBoard(page: Page, tasks: SeedTask[]) {
  seedTasks(tasks)
  await page.goto('/')
  await expect(page.locator('.card')).toHaveCount(tasks.length)
}

const TWO_TODO_CARDS: SeedTask[] = [
  { id: 1, title: '장보기', description: null, status: 'TODO', ordered_at: 100 },
  { id: 2, title: '보고서 쓰기', description: '목요일까지', status: 'TODO', ordered_at: 200 },
]

test('T-32 만들기 실패: 창이 열린 채 입력이 남고 실패 문구가 보이며, 카드는 생기지 않는다', async ({ page }) => {
  await openBoard(page, [])
  await stopServer(page)

  await page.getByRole('button', { name: '새 카드' }).click()
  await dialog(page).getByLabel('제목').fill('실패 카드')
  await dialog(page).getByLabel('설명').fill('메모')
  await dialog(page).getByRole('button', { name: '만들기' }).click()

  await expect(dialog(page).getByText('저장하지 못했습니다. 다시 시도해 주세요.')).toBeVisible()
  await expect(dialog(page).getByLabel('제목')).toHaveValue('실패 카드')
  await expect(dialog(page).getByLabel('설명')).toHaveValue('메모')
  await expect(titles(page, '할 일')).toHaveCount(0)

  await startServer(page)
  await page.reload()
  await expect(page.getByText('실패 카드')).toHaveCount(0)
})

test('T-33 수정 실패: 수정 중인 채로 고치던 글이 남고, 새로고침하면 원래 내용과 자리다', async ({ page }) => {
  await openBoard(page, TWO_TODO_CARDS)
  await stopServer(page)

  await card(page, '할 일', '보고서 쓰기').getByRole('button', { name: '수정' }).click()
  await editingCard(page).getByLabel('제목').fill('바뀐 제목')
  await editingCard(page).getByRole('button', { name: '저장' }).click()

  await expect(editingCard(page).getByText('저장하지 못했습니다. 다시 시도해 주세요.')).toBeVisible()
  await expect(editingCard(page).getByLabel('제목')).toHaveValue('바뀐 제목')

  await startServer(page)
  await page.reload()
  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기', '장보기'])
})

test('T-34 상태 바꾸기 실패 (상태 메뉴): 카드가 원래 자리에 있고 실패 문구가 보이며, 새로고침해도 같다', async ({ page }) => {
  await openBoard(page, TWO_TODO_CARDS)
  await stopServer(page)

  await pickStatus(page, '할 일', '장보기', '완료')

  await expect(card(page, '할 일', '장보기').getByText('옮기지 못했습니다. 다시 시도해 주세요.')).toBeVisible()
  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기', '장보기'])
  await expect(titles(page, '완료')).toHaveCount(0)

  await startServer(page)
  await page.reload()
  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기', '장보기'])
  await expect(page.getByText('옮기지 못했습니다. 다시 시도해 주세요.')).toHaveCount(0)
})

test('옮기기 실패 뒤 다시 시도해 성공하면 실패 문구가 사라진다', async ({ page }) => {
  await openBoard(page, TWO_TODO_CARDS)
  await stopServer(page)
  await pickStatus(page, '할 일', '장보기', '완료')
  await expect(page.getByText('옮기지 못했습니다. 다시 시도해 주세요.')).toBeVisible()

  await startServer(page)
  await pickStatus(page, '할 일', '장보기', '완료')

  await expect(titles(page, '완료')).toHaveText(['장보기'])
  await expect(page.getByText('옮기지 못했습니다. 다시 시도해 주세요.')).toHaveCount(0)
})

test('T-35 상태 바꾸기 실패 (끌어다 놓기): 놓은 뒤에도 카드가 원래 자리에 있다', async ({ page }) => {
  await openBoard(page, TWO_TODO_CARDS)
  await stopServer(page)

  await card(page, '할 일', '장보기').dragTo(column(page, '완료'))

  await expect(card(page, '할 일', '장보기').getByText('옮기지 못했습니다. 다시 시도해 주세요.')).toBeVisible()
  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기', '장보기'])
  await expect(titles(page, '완료')).toHaveCount(0)

  await startServer(page)
  await page.reload()
  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기', '장보기'])
})

test('T-36 삭제 실패: 카드가 남아 있고 실패 문구가 보이며, 새로고침해도 남아 있다', async ({ page }) => {
  await openBoard(page, TWO_TODO_CARDS)
  await stopServer(page)

  const target = card(page, '할 일', '장보기')
  await target.getByRole('button', { name: '삭제' }).click()
  await target.getByRole('button', { name: '예' }).click()

  await expect(target.getByText('지우지 못했습니다. 다시 시도해 주세요.')).toBeVisible()
  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기', '장보기'])

  await startServer(page)
  await page.reload()
  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기', '장보기'])
})

test('T-43 처음 열 때 목록을 받지 못하면 보드 위에 문구가 보이고, "카드 없음"은 보이지 않는다', async ({ page }) => {
  seedTasks(TWO_TODO_CARDS)
  await stopServer(page)

  await page.goto('/')

  await expect(page.getByText('카드를 불러오지 못했습니다. 새로고침해 주세요.')).toBeVisible()
  for (const name of ['할 일', '진행 중', '완료']) {
    await expect(column(page, name).getByRole('heading', { name })).toBeVisible()
  }
  await expect(page.getByText('카드 없음')).toHaveCount(0)
  await expect(page.locator('.column-count')).toHaveCount(0)

  await startServer(page)
  await page.reload()
  await expect(page.getByText('카드를 불러오지 못했습니다. 새로고침해 주세요.')).toHaveCount(0)
  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기', '장보기'])
})
