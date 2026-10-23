import { expect, test, type Page } from '@playwright/test'
import { seedTasks, type SeedTask } from '../helpers/seed'

// TEST-PLAN.md "화면 다듬기 (P-31)" T-63. 값은 DESIGN.md(3차)를 따른다.

const column = (page: Page, name: string) => page.getByRole('region', { name })
const INK = 'rgb(17, 17, 17)'

async function openBoard(page: Page, tasks: SeedTask[]) {
  seedTasks(tasks)
  await page.goto('/')
  await expect(page.locator('.card')).toHaveCount(tasks.length)
}

function cards(count: number, status: SeedTask['status'], firstId: number): SeedTask[] {
  return Array.from({ length: count }, (_, i) => ({
    id: firstId + i,
    title: `일 ${firstId + i}`,
    description: null,
    status,
    ordered_at: 100 + firstId + i,
  }))
}

test('T-63 카드는 먹색 2px 테두리와 4px 어긋난 그림자, 주 버튼은 노랑이다', async ({ page }) => {
  await openBoard(page, [{ id: 1, title: '장보기', description: null, status: 'TODO', ordered_at: 100 }])

  const card = page.locator('.card').first()
  await expect(card).toHaveCSS('border-top-width', '2px')
  await expect(card).toHaveCSS('border-top-color', INK)
  await expect(card).toHaveCSS('box-shadow', `${INK} 4px 4px 0px 0px`)
  await expect(page.getByRole('button', { name: '새 카드' })).toHaveCSS('background-color', 'rgb(255, 212, 59)')
})

test('T-63 키보드 포커스는 먹색 3px 외곽선이다', async ({ page }) => {
  await openBoard(page, [])

  // 첫 포커스는 머리 영역의 "새 카드"
  await page.keyboard.press('Tab')
  const button = page.getByRole('button', { name: '새 카드' })
  await expect(button).toBeFocused()
  await expect(button).toHaveCSS('outline', `${INK} solid 3px`)
  await expect(button).toHaveCSS('outline-offset', '3px')
})

test('T-63 띄어쓰기 없는 긴 제목 카드도 칸 밖으로 넘치지 않는다', async ({ page }) => {
  await openBoard(page, [{ id: 1, title: 'A'.repeat(300), description: null, status: 'TODO', ordered_at: 100 }])

  const columnBox = (await column(page, '할 일').boundingBox())!
  const cardBox = (await page.locator('.card').first().boundingBox())!
  expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(columnBox.x + columnBox.width)
  const title = page.locator('.card-title').first()
  expect(await title.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
})

test('T-63 375px에서 가로 스크롤이 없고 버튼은 44px 이상이다', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await openBoard(page, [...cards(12, 'TODO', 1), ...cards(3, 'IN_PROGRESS', 20), ...cards(4, 'DONE', 30)])

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  const firstCard = page.locator('.card').first()
  for (const button of [
    page.getByRole('button', { name: '새 카드' }),
    firstCard.locator('.status-pill'),
    firstCard.getByRole('button', { name: '수정' }),
    firstCard.getByRole('button', { name: '삭제' }),
  ]) {
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
})

test('T-63 그림자가 없는 버튼(수정·삭제·상태 표시)은 누르는 순간에도 그림자가 생기거나 움직이지 않는다', async ({ page }) => {
  await openBoard(page, [{ id: 1, title: '장보기', description: null, status: 'TODO', ordered_at: 100 }])
  const card = page.locator('.card').first()

  for (const button of [
    card.getByRole('button', { name: '수정' }),
    card.getByRole('button', { name: '삭제' }),
    card.locator('.status-pill'),
  ]) {
    await button.hover()
    await page.mouse.down()
    await expect(button).toHaveCSS('box-shadow', 'none')
    await expect(button).toHaveCSS('transform', 'none')
    // 버튼 밖에서 떼어 누르기를 취소한다 (수정·삭제·메뉴가 열리지 않게).
    await page.mouse.move(5, 5)
    await page.mouse.up()
  }
})
