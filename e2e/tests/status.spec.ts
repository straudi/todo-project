import { expect, test, type Page } from '@playwright/test'
import { seedTasks, type SeedTask } from '../helpers/seed'

// TEST-PLAN.md "상태 바꾸기와 되돌리기" T-14 ~ T-24.

const column = (page: Page, name: string) => page.getByRole('region', { name })
const titles = (page: Page, name: string) => column(page, name).locator('.card-title')
const card = (page: Page, columnName: string, title: string) =>
  column(page, columnName).locator('.card').filter({ has: page.locator('.card-title', { hasText: title }) })
const statusPill = (page: Page, columnName: string, title: string) =>
  card(page, columnName, title).locator('.status-pill')
const statusMenu = (page: Page, columnName: string, title: string) =>
  card(page, columnName, title).getByRole('group', { name: '상태 고르기' })

/** 카드의 상태 표시를 누르고, 메뉴에서 상태를 고른다 (SCREEN-SPEC.md "상태 표시와 상태 메뉴"). */
async function pickStatus(page: Page, columnName: string, title: string, label: string) {
  await statusPill(page, columnName, title).click()
  await statusMenu(page, columnName, title).getByRole('button', { name: label, exact: true }).click()
}

/** 화면이 상태 바꾸기 요청을 보낸 횟수를 센다. */
function countStatusRequests(page: Page) {
  const counter = { count: 0 }
  page.on('request', (request) => {
    if (request.method() === 'PATCH' && new URL(request.url()).pathname.endsWith('/status')) {
      counter.count += 1
    }
  })
  return counter
}

async function openBoard(page: Page, tasks: SeedTask[]) {
  seedTasks(tasks)
  await page.goto('/')
  await expect(page.locator('.card')).toHaveCount(tasks.length)
}

test('T-14 할 일 → 진행 중: 버튼을 누르면 진행 중 칸 맨 위로 가고, 새로고침해도 그대로다', async ({ page }) => {
  await openBoard(page, [
    { id: 1, title: '보고서 쓰기', description: null, status: 'TODO', ordered_at: 100 },
    { id: 2, title: '청소', description: null, status: 'IN_PROGRESS', ordered_at: 200 },
  ])

  await pickStatus(page, '할 일', '보고서 쓰기', '진행 중')

  await expect(titles(page, '할 일')).toHaveCount(0)
  await expect(titles(page, '진행 중')).toHaveText(['보고서 쓰기', '청소'])
  await page.reload()
  await expect(titles(page, '진행 중')).toHaveText(['보고서 쓰기', '청소'])
})

test('T-15 할 일 → 완료: 진행 중 칸을 거치지 않고 바로 완료 칸 맨 위로 간다', async ({ page }) => {
  await openBoard(page, [
    { id: 1, title: '마트 가기', description: null, status: 'TODO', ordered_at: 100 },
    { id: 2, title: '운동', description: null, status: 'DONE', ordered_at: 200 },
  ])
  const statusRequests = countStatusRequests(page)

  await pickStatus(page, '할 일', '마트 가기', '완료')

  await expect(titles(page, '완료')).toHaveText(['마트 가기', '운동'])
  await expect(titles(page, '진행 중')).toHaveCount(0)
  expect(statusRequests.count).toBe(1)
})

test('T-16 진행 중 → 완료', async ({ page }) => {
  await openBoard(page, [
    { id: 1, title: '보고서 쓰기', description: null, status: 'IN_PROGRESS', ordered_at: 100 },
    { id: 2, title: '운동', description: null, status: 'DONE', ordered_at: 200 },
  ])

  await pickStatus(page, '진행 중', '보고서 쓰기', '완료')

  await expect(titles(page, '진행 중')).toHaveCount(0)
  await expect(titles(page, '완료')).toHaveText(['보고서 쓰기', '운동'])
})

test('T-17 되돌리기: 완료 → 할 일, 원래 있던 카드들은 그 아래에 있다', async ({ page }) => {
  await openBoard(page, [
    { id: 1, title: '장보기', description: null, status: 'TODO', ordered_at: 100 },
    { id: 2, title: '청소', description: null, status: 'TODO', ordered_at: 200 },
    { id: 3, title: '마트 가기', description: null, status: 'DONE', ordered_at: 300 },
  ])

  await pickStatus(page, '완료', '마트 가기', '할 일')

  await expect(titles(page, '할 일')).toHaveText(['마트 가기', '청소', '장보기'])
  await expect(titles(page, '완료')).toHaveCount(0)
})

test('T-18 되돌리기: 완료 → 진행 중', async ({ page }) => {
  await openBoard(page, [
    { id: 1, title: '청소', description: null, status: 'IN_PROGRESS', ordered_at: 100 },
    { id: 2, title: '보고서 쓰기', description: null, status: 'DONE', ordered_at: 200 },
  ])

  await pickStatus(page, '완료', '보고서 쓰기', '진행 중')

  await expect(titles(page, '진행 중')).toHaveText(['보고서 쓰기', '청소'])
  await expect(titles(page, '완료')).toHaveCount(0)
})

test('T-19 되돌리기: 진행 중 → 할 일', async ({ page }) => {
  await openBoard(page, [
    { id: 1, title: '장보기', description: null, status: 'TODO', ordered_at: 100 },
    { id: 2, title: '보고서 쓰기', description: null, status: 'IN_PROGRESS', ordered_at: 200 },
  ])

  await pickStatus(page, '진행 중', '보고서 쓰기', '할 일')

  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기', '장보기'])
  await expect(titles(page, '진행 중')).toHaveCount(0)
})

test('T-20 메뉴에서 지금 상태는 체크 표시와 함께 보이고 고를 수 없다', async ({ page }) => {
  await openBoard(page, [
    { id: 1, title: '할 일 카드', description: null, status: 'TODO', ordered_at: 100 },
    { id: 2, title: '진행 중 카드', description: null, status: 'IN_PROGRESS', ordered_at: 200 },
    { id: 3, title: '완료 카드', description: null, status: 'DONE', ordered_at: 300 },
  ])
  const statusRequests = countStatusRequests(page)

  const labels = ['할 일', '진행 중', '완료']
  for (const current of labels) {
    const title = `${current} 카드`
    await expect(statusPill(page, current, title)).toHaveText(current)
    await statusPill(page, current, title).click()
    const menu = statusMenu(page, current, title)
    await expect(menu.getByRole('button')).toHaveText(labels)
    const currentItem = menu.getByRole('button', { name: current, exact: true })
    await expect(currentItem).toBeDisabled()
    await expect(currentItem.locator('svg.lucide-check')).toHaveCount(1)
    await currentItem.click({ force: true })
    for (const other of labels.filter((label) => label !== current)) {
      await expect(menu.getByRole('button', { name: other, exact: true })).toBeEnabled()
    }
    await page.keyboard.press('Escape')
    await expect(titles(page, current)).toHaveText([title])
  }
  expect(statusRequests.count).toBe(0)
})

test('T-21 칸 하나가 비게 되면 개수는 0이 되고 "카드 없음"만 보인다', async ({ page }) => {
  await openBoard(page, [
    { id: 1, title: '장보기', description: null, status: 'TODO', ordered_at: 100 },
    { id: 2, title: '보고서 쓰기', description: null, status: 'IN_PROGRESS', ordered_at: 200 },
    { id: 3, title: '운동', description: null, status: 'DONE', ordered_at: 300 },
  ])

  await pickStatus(page, '진행 중', '보고서 쓰기', '완료')

  await expect(column(page, '진행 중')).toBeVisible()
  await expect(column(page, '진행 중').locator('.card')).toHaveCount(0)
  await expect(column(page, '진행 중')).toHaveText('진행 중0카드 없음')
  await expect(titles(page, '할 일')).toHaveText(['장보기'])
  await expect(titles(page, '완료')).toHaveText(['보고서 쓰기', '운동'])
})

test('T-22 카드 세 장 이상의 순서: 되돌린 카드가 맨 위에 오고, 새로고침해도 같다', async ({ page }) => {
  await openBoard(page, [])
  for (const title of ['A', 'B', 'C']) {
    await page.getByRole('button', { name: '새 카드' }).click()
    await page.getByRole('dialog').getByLabel('제목').fill(title)
    await page.getByRole('dialog').getByRole('button', { name: '만들기' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
  }
  await expect(titles(page, '할 일')).toHaveText(['C', 'B', 'A'])

  await pickStatus(page, '할 일', 'B', '진행 중')
  await expect(titles(page, '진행 중')).toHaveText(['B'])
  await pickStatus(page, '진행 중', 'B', '할 일')

  await expect(titles(page, '할 일')).toHaveText(['B', 'C', 'A'])
  await page.reload()
  await expect(titles(page, '할 일')).toHaveText(['B', 'C', 'A'])
})

test('T-23 다른 칸에 끌어다 놓으면 놓은 자리와 상관없이 그 칸 맨 위에 놓인다', async ({ page }) => {
  await openBoard(page, [
    { id: 1, title: '장보기', description: null, status: 'TODO', ordered_at: 100 },
    { id: 2, title: '운동', description: null, status: 'DONE', ordered_at: 200 },
    { id: 3, title: '책 읽기', description: null, status: 'DONE', ordered_at: 300 },
  ])

  // "완료" 칸의 맨 아래 카드 아래쪽 끝에 놓는다.
  const lastDoneCard = card(page, '완료', '운동')
  const box = (await lastDoneCard.boundingBox())!
  await card(page, '할 일', '장보기').dragTo(lastDoneCard, {
    targetPosition: { x: box.width / 2, y: box.height - 2 },
  })

  await expect(titles(page, '완료')).toHaveText(['장보기', '책 읽기', '운동'])
  await expect(titles(page, '할 일')).toHaveCount(0)
})

test('T-24 원래 칸에 끌어다 놓으면 자리가 바뀌지 않고, 새로고침해도 같다', async ({ page }) => {
  await openBoard(page, [
    { id: 1, title: '장보기', description: null, status: 'TODO', ordered_at: 100 },
    { id: 2, title: '보고서 쓰기', description: null, status: 'TODO', ordered_at: 200 },
  ])
  const statusRequests = countStatusRequests(page)
  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기', '장보기'])

  // 두 번째 카드를 "할 일" 칸 맨 위 자리에 놓는다.
  await card(page, '할 일', '장보기').dragTo(card(page, '할 일', '보고서 쓰기'), {
    targetPosition: { x: 10, y: 2 },
  })

  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기', '장보기'])
  expect(statusRequests.count).toBe(0)
  await page.reload()
  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기', '장보기'])
})

test('끄는 동안 원래 카드는 흐려지고, 마우스가 올라간 칸에 테두리가 생긴다 (DESIGN.md)', async ({ page }) => {
  await openBoard(page, [
    { id: 1, title: '장보기', description: null, status: 'TODO', ordered_at: 100 },
    { id: 2, title: '운동', description: null, status: 'DONE', ordered_at: 200 },
  ])

  await card(page, '할 일', '장보기').hover()
  await page.mouse.down()
  const doneBox = (await column(page, '완료').boundingBox())!
  await page.mouse.move(doneBox.x + doneBox.width / 2, doneBox.y + doneBox.height / 2, { steps: 5 })

  await expect(card(page, '할 일', '장보기')).toHaveCSS('opacity', '0.5')
  await expect(column(page, '완료')).toHaveAttribute('data-drop-target')
  await expect(column(page, '할 일')).not.toHaveAttribute('data-drop-target')

  await page.mouse.up()
  await expect(titles(page, '완료')).toHaveText(['장보기', '운동'])
  await expect(page.locator('[data-drop-target]')).toHaveCount(0)
  await expect(card(page, '완료', '장보기')).toHaveCSS('opacity', '1')
})

test('T-45 상태 메뉴는 바깥 누르기, Esc, 상태 표시 다시 누르기로 닫히고, 한 번에 하나만 열린다', async ({ page }) => {
  await openBoard(page, [
    { id: 1, title: '장보기', description: null, status: 'TODO', ordered_at: 100 },
    { id: 2, title: '보고서 쓰기', description: null, status: 'TODO', ordered_at: 200 },
  ])
  const statusRequests = countStatusRequests(page)
  const menus = page.getByRole('group', { name: '상태 고르기' })

  // (1) 메뉴 바깥 누르기
  await statusPill(page, '할 일', '장보기').click()
  await expect(statusMenu(page, '할 일', '장보기')).toBeVisible()
  await column(page, '완료').getByRole('heading', { name: '완료' }).click()
  await expect(menus).toHaveCount(0)

  // (2) Esc 키
  await statusPill(page, '할 일', '장보기').click()
  await expect(statusPill(page, '할 일', '장보기')).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(menus).toHaveCount(0)
  await expect(statusPill(page, '할 일', '장보기')).toHaveAttribute('aria-expanded', 'false')

  // (3) 상태 표시 다시 누르기
  await statusPill(page, '할 일', '장보기').click()
  await statusPill(page, '할 일', '장보기').click()
  await expect(menus).toHaveCount(0)

  // (4) 다른 카드의 상태 표시를 누르면 앞 메뉴는 닫히고 그 카드의 메뉴만 열린다
  await statusPill(page, '할 일', '장보기').click()
  await statusPill(page, '할 일', '보고서 쓰기').click()
  await expect(menus).toHaveCount(1)
  await expect(statusMenu(page, '할 일', '보고서 쓰기')).toBeVisible()

  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기', '장보기'])
  expect(statusRequests.count).toBe(0)
})
