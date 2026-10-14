import { expect, test, type Page } from '@playwright/test'
import { seedTasks, type SeedTask } from '../helpers/seed'

// TEST-PLAN.md "카드 수정" T-08(수정 부분), T-09 ~ T-13, "카드 삭제" T-25, T-26.

const column = (page: Page, name: string) => page.getByRole('region', { name })
const titles = (page: Page, name: string) => column(page, name).locator('.card-title')
const card = (page: Page, columnName: string, title: string) =>
  column(page, columnName).locator('.card').filter({ has: page.locator('.card-title', { hasText: title }) })
const editingCard = (page: Page) => page.locator('.card-editing')

/** 화면이 보낸 요청 수를 방식별로 센다. */
function countRequests(page: Page) {
  const counter = { PATCH: 0, DELETE: 0 }
  page.on('request', (request) => {
    const method = request.method()
    if ((method === 'PATCH' || method === 'DELETE') && new URL(request.url()).pathname.startsWith('/api/tasks/')) {
      counter[method] += 1
    }
  })
  return counter
}

async function openBoard(page: Page, tasks: SeedTask[]) {
  seedTasks(tasks)
  await page.goto('/')
  await expect(page.locator('.card')).toHaveCount(tasks.length)
}

// "할 일" 칸에 위에서부터 "보고서 쓰기", "장보기"가 있다.
const TWO_TODO_CARDS: SeedTask[] = [
  { id: 1, title: '장보기', description: '우유, 계란', status: 'TODO', ordered_at: 100 },
  { id: 2, title: '보고서 쓰기', description: '목요일까지', status: 'TODO', ordered_at: 200 },
]

// "할 일" 칸에 위에서부터 "보고서 쓰기", "마트 가기"(설명 "우유")가 있다.
const MART_CARDS: SeedTask[] = [
  { id: 1, title: '마트 가기', description: '우유', status: 'TODO', ordered_at: 100 },
  { id: 2, title: '보고서 쓰기', description: '목요일까지', status: 'TODO', ordered_at: 200 },
]

test('T-08 (수정 부분) 수정을 누르면 설명칸에 설명 전체가 보인다', async ({ page }) => {
  const longDescription = ['첫째 줄', '둘째 줄', '셋째 줄', '넷째 줄', '다섯째 줄', '여섯째 줄'].join('\n')
  await openBoard(page, [{ id: 1, title: '긴 카드', description: longDescription, status: 'TODO', ordered_at: 100 }])

  await card(page, '할 일', '긴 카드').getByRole('button', { name: '수정' }).click()

  const descriptionField = editingCard(page).getByLabel('설명')
  await expect(descriptionField).toHaveValue(longDescription)
  // 설명칸 안에서 잘리지 않고 다 보인다 (넘쳐서 숨은 줄이 없다).
  const clipped = await descriptionField.evaluate((element) => element.scrollHeight > element.clientHeight)
  expect(clipped).toBe(false)
})

test('T-09 내용을 고치면 바뀐 내용이 보이고, 칸 안의 자리는 그대로다', async ({ page }) => {
  await openBoard(page, TWO_TODO_CARDS)

  await card(page, '할 일', '장보기').getByRole('button', { name: '수정' }).click()
  await editingCard(page).getByLabel('제목').fill('마트 가기')
  await editingCard(page).getByLabel('설명').fill('우유')
  await editingCard(page).getByRole('button', { name: '저장' }).click()

  await expect(editingCard(page)).toHaveCount(0)
  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기', '마트 가기'])
  await expect(card(page, '할 일', '마트 가기').locator('.card-description')).toHaveText('우유')
  await page.reload()
  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기', '마트 가기'])
  await expect(card(page, '할 일', '마트 가기').locator('.card-description')).toHaveText('우유')
})

test('T-10 설명을 모두 지우고 저장하면 제목만 보이고, 자리는 그대로다', async ({ page }) => {
  await openBoard(page, MART_CARDS)

  await card(page, '할 일', '마트 가기').getByRole('button', { name: '수정' }).click()
  await editingCard(page).getByLabel('설명').fill('')
  await editingCard(page).getByRole('button', { name: '저장' }).click()

  await expect(editingCard(page)).toHaveCount(0)
  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기', '마트 가기'])
  await expect(card(page, '할 일', '마트 가기').locator('.card-description')).toHaveCount(0)
  await page.reload()
  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기', '마트 가기'])
  await expect(card(page, '할 일', '마트 가기').locator('.card-description')).toHaveCount(0)
})

for (const [name, title] of [
  ['T-11 수정 중 제목 비우기', ''],
  ['T-12 수정 중 제목에 띄어쓰기만 넣기', '   '],
] as const) {
  test(`${name}: 저장하면 안내 문구가 보이고, 취소하면 수정 전 내용이 그대로 보인다`, async ({ page }) => {
    await openBoard(page, MART_CARDS)
    const requests = countRequests(page)

    await card(page, '할 일', '마트 가기').getByRole('button', { name: '수정' }).click()
    await editingCard(page).getByLabel('제목').fill(title)
    await editingCard(page).getByRole('button', { name: '저장' }).click()
    await expect(editingCard(page).getByText('제목을 입력해 주세요.')).toBeVisible()

    await editingCard(page).getByRole('button', { name: '취소' }).click()
    await expect(editingCard(page)).toHaveCount(0)
    await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기', '마트 가기'])
    await expect(card(page, '할 일', '마트 가기').locator('.card-description')).toHaveText('우유')
    // 화면 검사에서 막혀 서버로 보내지 않는다.
    expect(requests.PATCH).toBe(0)
  })
}

test('T-13 수정을 취소하면 원래 내용과 자리가 그대로고, 새로고침해도 같다', async ({ page }) => {
  await openBoard(page, MART_CARDS)
  const requests = countRequests(page)

  await card(page, '할 일', '마트 가기').getByRole('button', { name: '수정' }).click()
  await editingCard(page).getByLabel('제목').fill('바뀐 제목')
  await editingCard(page).getByRole('button', { name: '취소' }).click()

  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기', '마트 가기'])
  expect(requests.PATCH).toBe(0)
  await page.reload()
  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기', '마트 가기'])
})

test('T-25 삭제에서 "아니오"를 누르면 카드가 원래 칸, 원래 자리에 남는다', async ({ page }) => {
  await openBoard(page, MART_CARDS)
  const requests = countRequests(page)

  const target = card(page, '할 일', '마트 가기')
  await target.getByRole('button', { name: '삭제' }).click()
  await expect(target.getByText('정말 지울까요?')).toBeVisible()
  await expect(target.getByRole('button', { name: '예' })).toBeVisible()
  await expect(target.getByRole('button', { name: '아니오' })).toBeVisible()

  await target.getByRole('button', { name: '아니오' }).click()
  await expect(page.getByText('정말 지울까요?')).toHaveCount(0)
  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기', '마트 가기'])
  expect(requests.DELETE).toBe(0)
  await page.reload()
  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기', '마트 가기'])
})

test('T-26 삭제에서 "예"를 누르면 카드가 사라지고, 새로고침해도 없다', async ({ page }) => {
  await openBoard(page, MART_CARDS)

  const target = card(page, '할 일', '마트 가기')
  await target.getByRole('button', { name: '삭제' }).click()
  await target.getByRole('button', { name: '예' }).click()

  await expect(page.getByText('마트 가기')).toHaveCount(0)
  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기'])
  await page.reload()
  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기'])
  await expect(page.getByText('마트 가기')).toHaveCount(0)
})
