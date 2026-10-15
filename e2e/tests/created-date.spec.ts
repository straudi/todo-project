import { expect, test, type Page } from '@playwright/test'
import { seedTasks } from '../helpers/seed'

// TEST-PLAN.md "만든 날짜" T-55, T-56.

const column = (page: Page, name: string) => page.getByRole('region', { name })
const card = (page: Page, columnName: string, title: string) =>
  column(page, columnName).locator('.card').filter({ has: page.locator('.card-title', { hasText: title }) })
const editingCard = (page: Page) => page.locator('.card-editing')

// 2026-10-01 03:00:00 UTC (마이크로초). 시간대가 달라도 날짜가 10월 1일로 보이는 시각이다.
const OCT_1 = 1_790_823_600_000_000

/** 브라우저 시간대의 오늘 날짜를 "2026. 10. 15." 모양으로 만든다 (SCREEN-SPEC.md "대안과 결정"). */
async function today(page: Page) {
  return page.evaluate(() => {
    const now = new Date()
    return `${now.getFullYear()}. ${now.getMonth() + 1}. ${now.getDate()}.`
  })
}

test('T-55 새 카드에는 오늘 날짜가 아래 줄 왼쪽에 보이고, 새로고침해도 같다', async ({ page }) => {
  seedTasks([])
  await page.goto('/')
  await page.getByRole('button', { name: '새 카드' }).click()
  const dialog = page.getByRole('dialog', { name: '카드 만들기' })
  await dialog.getByLabel('제목').fill('장보기')
  await dialog.getByRole('button', { name: '만들기' }).click()

  const expected = await today(page)
  const date = card(page, '할 일', '장보기').locator('.card-footer .card-date')
  await expect(date).toHaveText(expected)

  // 아래 줄 왼쪽: 날짜가 상태 표시보다 왼쪽에 있다.
  const dateBox = (await date.boundingBox())!
  const pillBox = (await card(page, '할 일', '장보기').locator('.status-pill').boundingBox())!
  expect(dateBox.x).toBeLessThan(pillBox.x)

  await page.reload()
  await expect(card(page, '할 일', '장보기').locator('.card-date')).toHaveText(expected)
})

test('T-56 옮기거나 고쳐도 만든 날짜가 그대로다', async ({ page }) => {
  seedTasks([{ id: 1, title: '장보기', description: null, status: 'TODO', ordered_at: OCT_1, created_at: OCT_1 }])
  await page.goto('/')
  await expect(card(page, '할 일', '장보기').locator('.card-date')).toHaveText('2026. 10. 1.')

  // 상태 메뉴로 "진행 중"
  await card(page, '할 일', '장보기').locator('.status-pill').click()
  await card(page, '할 일', '장보기')
    .getByRole('group', { name: '상태 고르기' })
    .getByRole('button', { name: '진행 중', exact: true })
    .click()
  await expect(card(page, '진행 중', '장보기').locator('.card-date')).toHaveText('2026. 10. 1.')

  // 끌어다 "완료" 칸에
  await card(page, '진행 중', '장보기').dragTo(column(page, '완료'))
  await expect(card(page, '완료', '장보기').locator('.card-date')).toHaveText('2026. 10. 1.')

  // 수정 중에도 보이고, 고친 뒤에도 그대로
  await card(page, '완료', '장보기').getByRole('button', { name: '수정' }).click()
  await expect(editingCard(page).locator('.card-date')).toHaveText('2026. 10. 1.')
  await editingCard(page).getByLabel('제목').fill('장보기 2')
  await editingCard(page).getByRole('button', { name: '저장' }).click()
  await expect(card(page, '완료', '장보기 2').locator('.card-date')).toHaveText('2026. 10. 1.')

  await page.reload()
  await expect(card(page, '완료', '장보기 2').locator('.card-date')).toHaveText('2026. 10. 1.')
})
