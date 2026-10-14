import { expect, test, type Page } from '@playwright/test'
import { TEST_API_PORT } from '../helpers/paths'
import { seedTasks, type SeedTask } from '../helpers/seed'

// TEST-PLAN.md T-46 ~ T-48: 다른 기기에서 이미 지운 카드를 이 화면(새로고침 전)에서 건드릴 때.
// "다른 기기"는 테스트가 서버에 직접 DELETE를 보내는 것으로 흉내 낸다.

const NOTICE = '이미 지워진 카드입니다. 다른 기기에서 지웠을 수 있습니다.'

const column = (page: Page, name: string) => page.getByRole('region', { name })
const titles = (page: Page, name: string) => column(page, name).locator('.card-title')
const card = (page: Page, columnName: string, title: string) =>
  column(page, columnName).locator('.card').filter({ has: page.locator('.card-title', { hasText: title }) })

const CARDS: SeedTask[] = [
  { id: 1, title: '장보기', description: null, status: 'TODO', ordered_at: 100 },
  { id: 2, title: '보고서 쓰기', description: null, status: 'TODO', ordered_at: 200 },
]

async function openBoard(page: Page) {
  seedTasks(CARDS)
  await page.goto('/')
  await expect(page.locator('.card')).toHaveCount(CARDS.length)
}

/** 다른 기기에서 카드를 지운다. 이 화면은 아직 모른다. */
async function deleteElsewhere(page: Page, id: number) {
  const response = await page.request.delete(`http://127.0.0.1:${TEST_API_PORT}/api/tasks/${id}`)
  expect(response.status()).toBe(204)
}

test('T-46 지워진 카드를 고쳐 저장하면 카드가 빠지고 보드 위에 안내가 보이며, 닫기로 닫힌다', async ({ page }) => {
  await openBoard(page)
  await deleteElsewhere(page, 1)

  await card(page, '할 일', '장보기').getByRole('button', { name: '수정' }).click()
  await page.locator('.card-editing').getByLabel('제목').fill('마트 가기')
  await page.locator('.card-editing').getByRole('button', { name: '저장' }).click()

  await expect(page.getByRole('status')).toContainText(NOTICE)
  await expect(page.locator('.card-editing')).toHaveCount(0)
  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기'])
  await expect(page.getByText('저장하지 못했습니다. 다시 시도해 주세요.')).toHaveCount(0)

  await page.getByRole('status').getByRole('button', { name: '닫기' }).click()
  await expect(page.getByText(NOTICE)).toHaveCount(0)

  await page.reload()
  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기'])
})

test('T-47 지워진 카드를 상태 메뉴로 옮기면 카드가 빠지고 보드 위에 안내가 보인다', async ({ page }) => {
  await openBoard(page)
  await deleteElsewhere(page, 1)

  const target = card(page, '할 일', '장보기')
  await target.locator('.status-pill').click()
  await target.getByRole('group', { name: '상태 고르기' }).getByRole('button', { name: '완료', exact: true }).click()

  await expect(page.getByRole('status')).toContainText(NOTICE)
  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기'])
  await expect(titles(page, '완료')).toHaveCount(0)
  await expect(page.getByText('옮기지 못했습니다. 다시 시도해 주세요.')).toHaveCount(0)
  await expect(page.locator('.column-count')).toHaveText(['1', '0', '0'])
})

test('T-47 (끌어다 놓기) 지워진 카드를 다른 칸에 놓아도 카드가 빠지고 안내가 보인다', async ({ page }) => {
  await openBoard(page)
  await deleteElsewhere(page, 1)

  await card(page, '할 일', '장보기').dragTo(column(page, '완료'))

  await expect(page.getByRole('status')).toContainText(NOTICE)
  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기'])
  await expect(titles(page, '완료')).toHaveCount(0)
})

test('T-48 지워진 카드를 지우면 안내 없이 카드만 빠진다', async ({ page }) => {
  await openBoard(page)
  await deleteElsewhere(page, 1)

  const target = card(page, '할 일', '장보기')
  await target.getByRole('button', { name: '삭제' }).click()
  await target.getByRole('button', { name: '예' }).click()

  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기'])
  await expect(page.getByText(NOTICE)).toHaveCount(0)
  await expect(page.getByText('지우지 못했습니다. 다시 시도해 주세요.')).toHaveCount(0)
})
