import { expect, test, type Page } from '@playwright/test'
import { seedTasks } from '../helpers/seed'

// TEST-PLAN.md "빈 보드와 카드 만들기" T-02 ~ T-08.

const column = (page: Page, name: string) => page.getByRole('region', { name })
const dialog = (page: Page) => page.getByRole('dialog', { name: '카드 만들기' })

async function openCreateDialog(page: Page) {
  await page.getByRole('button', { name: '새 카드' }).click()
  await expect(dialog(page)).toBeVisible()
}

/** 화면이 POST /api/tasks를 보낸 횟수를 센다. */
function countCreateRequests(page: Page) {
  const counter = { count: 0 }
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/tasks') {
      counter.count += 1
    }
  })
  return counter
}

test.beforeEach(async ({ page }) => {
  seedTasks([])
  await page.goto('/')
})

test('T-02 새 카드 버튼을 누르면 만들기 창이 뜬다', async ({ page }) => {
  await openCreateDialog(page)

  await expect(dialog(page).getByLabel('제목')).toBeVisible()
  await expect(dialog(page).getByLabel('설명')).toBeVisible()
  await expect(dialog(page).getByRole('button', { name: '만들기' })).toBeVisible()
  await expect(dialog(page).getByRole('button', { name: '취소' })).toBeVisible()
})

test('T-03 제목과 설명으로 만들면 할 일 칸 맨 위에 생긴다', async ({ page }) => {
  await openCreateDialog(page)
  await dialog(page).getByLabel('제목').fill('장보기')
  await dialog(page).getByLabel('설명').fill('우유, 계란')
  await dialog(page).getByRole('button', { name: '만들기' }).click()

  await expect(dialog(page)).toBeHidden()
  const firstCard = column(page, '할 일').locator('.card').first()
  await expect(firstCard.locator('.card-title')).toHaveText('장보기')
  await expect(firstCard.locator('.card-description')).toHaveText('우유, 계란')
  await expect(column(page, '진행 중').locator('.card')).toHaveCount(0)
  await expect(column(page, '완료').locator('.card')).toHaveCount(0)
})

test('T-04 설명 없이 만들면 제목만 보이고 기존 카드 위에 놓인다', async ({ page }) => {
  seedTasks([{ id: 1, title: '장보기', description: '우유, 계란', status: 'TODO', ordered_at: 100 }])
  await page.reload()

  await openCreateDialog(page)
  await dialog(page).getByLabel('제목').fill('보고서 쓰기')
  await dialog(page).getByRole('button', { name: '만들기' }).click()

  await expect(dialog(page)).toBeHidden()
  await expect(column(page, '할 일').locator('.card-title')).toHaveText(['보고서 쓰기', '장보기'])
  const newCard = column(page, '할 일').locator('.card').first()
  await expect(newCard.locator('.card-description')).toHaveCount(0)
})

for (const [name, title] of [
  ['T-05 빈 제목', ''],
  ['T-06 띄어쓰기만 넣은 제목', '   '],
] as const) {
  test(`${name}으로 만들면 창이 열린 채 안내 문구가 보이고 카드는 생기지 않는다`, async ({ page }) => {
    const createRequests = countCreateRequests(page)
    await openCreateDialog(page)
    await dialog(page).getByLabel('제목').fill(title)
    await dialog(page).getByLabel('설명').fill('메모')
    await dialog(page).getByRole('button', { name: '만들기' }).click()

    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page).getByText('제목을 입력해 주세요.')).toBeVisible()
    await expect(dialog(page).getByLabel('설명')).toHaveValue('메모')

    await dialog(page).getByRole('button', { name: '취소' }).click()
    await expect(dialog(page)).toBeHidden()
    await expect(page.locator('.card')).toHaveCount(0)
    // 화면 검사에서 막혀 서버로 보내지 않는다 (ARCHITECTURE.md "화면: 입력 검사").
    expect(createRequests.count).toBe(0)
  })
}

test('T-07 만들기를 취소하면 카드가 생기지 않고, 다시 열면 입력칸이 비어 있다', async ({ page }) => {
  await openCreateDialog(page)
  await dialog(page).getByLabel('제목').fill('취소할 카드')
  await dialog(page).getByRole('button', { name: '취소' }).click()

  await expect(dialog(page)).toBeHidden()
  await expect(page.getByText('취소할 카드')).toHaveCount(0)

  await openCreateDialog(page)
  await expect(dialog(page).getByLabel('제목')).toHaveValue('')
  await expect(dialog(page).getByLabel('설명')).toHaveValue('')
})

test('T-08 (보드 부분) 긴 제목은 전부 줄바꿈되어 보이고, 긴 설명은 두 줄까지만 보인다', async ({ page }) => {
  // T-08의 "수정을 누르면 설명 전체가 보인다"는 P-17에서 확인한다.
  const longTitle = '한 줄에 다 들어가지 않는 아주 긴 제목입니다. '.repeat(8).trim()
  const longDescription = ['첫째 줄', '둘째 줄', '셋째 줄', '넷째 줄', '다섯째 줄', '여섯째 줄'].join('\n')

  await openCreateDialog(page)
  await dialog(page).getByLabel('제목').fill(longTitle)
  await dialog(page).getByLabel('설명').fill(longDescription)
  await dialog(page).getByRole('button', { name: '만들기' }).click()
  await expect(dialog(page)).toBeHidden()

  const card = column(page, '할 일').locator('.card').first()
  const title = card.locator('.card-title')
  await expect(title).toHaveText(longTitle)
  const titleBox = await title.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const lineTops = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)))
    return {
      lines: lineTops.size,
      clipped: element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth,
    }
  })
  expect(titleBox.lines).toBeGreaterThan(1)
  expect(titleBox.clipped).toBe(false)

  const descriptionBox = await card.locator('.card-description').evaluate((element) => {
    // 잘린 줄도 그려지는 위치는 있으므로, 글줄 위치의 간격으로 한 줄 높이를 구한다.
    const range = document.createRange()
    range.selectNodeContents(element)
    const lineTops = [...new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)))].sort(
      (a, b) => a - b,
    )
    const lineHeight = lineTops[1] - lineTops[0]
    return {
      visibleLines: Math.round(element.clientHeight / lineHeight),
      clipped: element.scrollHeight > element.clientHeight,
    }
  })
  expect(descriptionBox.visibleLines).toBe(2)
  expect(descriptionBox.clipped).toBe(true)
})

test('만들기 창의 설명칸은 내용에 맞춰 늘어나 스크롤 없이 전체가 보인다', async ({ page }) => {
  // SCREEN-SPEC.md "대안과 결정"의 "설명칸 높이". 수정 중 설명칸은 edit-delete.spec.ts의 T-08에서 확인한다.
  const longDescription = Array.from({ length: 8 }, (_, i) => `${i + 1}번째 줄`).join('\n')

  await openCreateDialog(page)
  const descriptionField = dialog(page).getByLabel('설명')
  await descriptionField.fill(longDescription)

  await expect(descriptionField).toHaveValue(longDescription)
  const clipped = await descriptionField.evaluate((element) => element.scrollHeight > element.clientHeight)
  expect(clipped).toBe(false)
})
