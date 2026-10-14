import { chromium, expect, test, type Page } from '@playwright/test'
import { TEST_WEB_PORT } from '../helpers/paths'
import { seedTasks, type SeedTask } from '../helpers/seed'

const COLUMN_NAMES = ['할 일', '진행 중', '완료'] as const

const column = (page: Page, name: string) => page.getByRole('region', { name })

/** 칸마다 카드의 제목과 설명을 위에서부터 읽는다. */
async function readBoard(page: Page) {
  const board: Record<string, { title: string; description: string | null }[]> = {}
  for (const name of COLUMN_NAMES) {
    board[name] = await column(page, name)
      .locator('.card')
      .evaluateAll((cards) =>
        cards.map((card) => ({
          title: card.querySelector('.card-title')?.textContent ?? '',
          description: card.querySelector('.card-description')?.textContent ?? null,
        })),
      )
  }
  return board
}

// T-27, T-28: 세 칸 모두에 카드가 있다.
const CARDS_IN_ALL_COLUMNS: SeedTask[] = [
  { id: 1, title: '장보기', description: '우유, 계란', status: 'TODO', ordered_at: 100 },
  { id: 2, title: '보고서 쓰기', description: null, status: 'TODO', ordered_at: 200 },
  { id: 3, title: '청소', description: '거실\n부엌', status: 'IN_PROGRESS', ordered_at: 300 },
  { id: 4, title: '운동', description: null, status: 'DONE', ordered_at: 400 },
  { id: 5, title: '책 읽기', description: '3장까지', status: 'DONE', ordered_at: 500 },
]

const EXPECTED_BOARD = {
  '할 일': [
    { title: '보고서 쓰기', description: null },
    { title: '장보기', description: '우유, 계란' },
  ],
  '진행 중': [{ title: '청소', description: '거실\n부엌' }],
  완료: [
    { title: '책 읽기', description: '3장까지' },
    { title: '운동', description: null },
  ],
}

test('저장소에 넣어 둔 카드가 GET /api/tasks를 거쳐 상태에 맞는 칸에 순서대로 보인다', async ({ page }) => {
  seedTasks([
    { id: 1, title: '먼저 만든 할 일', description: null, status: 'TODO', ordered_at: 100 },
    { id: 2, title: '진행 중인 일', description: '설명이 있는 카드', status: 'IN_PROGRESS', ordered_at: 200 },
    { id: 3, title: '나중에 만든 할 일', description: null, status: 'TODO', ordered_at: 300 },
    { id: 4, title: '끝난 일', description: null, status: 'DONE', ordered_at: 400 },
  ])

  const listResponse = page.waitForResponse(
    (response) => response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/tasks',
  )
  await page.goto('/')
  expect((await listResponse).status()).toBe(200)

  await expect(column(page, '할 일').locator('.card-title')).toHaveText(['나중에 만든 할 일', '먼저 만든 할 일'])
  await expect(column(page, '진행 중').locator('.card-title')).toHaveText(['진행 중인 일'])
  await expect(column(page, '진행 중').locator('.card-description')).toHaveText(['설명이 있는 카드'])
  await expect(column(page, '완료').locator('.card-title')).toHaveText(['끝난 일'])
  // 설명이 없는 카드에는 설명이 보이지 않는다.
  await expect(column(page, '할 일').locator('.card-description')).toHaveCount(0)
  // 카드가 있는 칸에는 "카드 없음"이 보이지 않는다.
  await expect(page.getByText('카드 없음')).toHaveCount(0)
})

test('T-01 빈 보드에서는 세 칸이 가로로 나란히 보이고, 칸마다 개수 0과 "카드 없음"이 보인다', async ({ page }) => {
  seedTasks([])
  await page.goto('/')

  const boxes = []
  for (const name of COLUMN_NAMES) {
    const section = column(page, name)
    await expect(section.getByRole('heading', { name })).toBeVisible()
    await expect(section.locator('.card')).toHaveCount(0)
    // 칸 안에는 칸 이름, 개수 0, "카드 없음"만 있다.
    await expect(section.locator('.column-count')).toHaveText('0')
    await expect(section).toHaveText(`${name}0카드 없음`)
    boxes.push(await section.boundingBox())
  }
  // 왼쪽부터 할 일 → 진행 중 → 완료, 같은 높이에 나란히.
  expect(boxes[0]!.x).toBeLessThan(boxes[1]!.x)
  expect(boxes[1]!.x).toBeLessThan(boxes[2]!.x)
  expect(boxes[0]!.y).toBe(boxes[1]!.y)
  expect(boxes[1]!.y).toBe(boxes[2]!.y)

  await expect(page.getByRole('button', { name: '새 카드' })).toBeVisible()
})

test('T-27 새로고침해도 칸마다 같은 제목, 설명, 순서로 카드가 보인다', async ({ page }) => {
  seedTasks(CARDS_IN_ALL_COLUMNS)
  await page.goto('/')
  await expect(column(page, '할 일').locator('.card')).toHaveCount(2)
  const before = await readBoard(page)
  expect(before).toEqual(EXPECTED_BOARD)

  await page.reload()
  await expect(column(page, '할 일').locator('.card')).toHaveCount(2)
  expect(await readBoard(page)).toEqual(before)
})

test('T-28 브라우저를 닫았다가 다시 열어도 칸마다 같은 카드가 보인다', async () => {
  seedTasks(CARDS_IN_ALL_COLUMNS)
  const appUrl = `http://127.0.0.1:${TEST_WEB_PORT}/`

  // 같은 브라우저의 새 탭이 아니라, Chrome을 새로 띄웠다가 완전히 닫는다.
  const firstBrowser = await chromium.launch({ channel: 'chrome' })
  const firstPage = await firstBrowser.newPage()
  await firstPage.goto(appUrl)
  await expect(column(firstPage, '할 일').locator('.card')).toHaveCount(2)
  const before = await readBoard(firstPage)
  expect(before).toEqual(EXPECTED_BOARD)
  await firstBrowser.close()

  const secondBrowser = await chromium.launch({ channel: 'chrome' })
  try {
    const secondPage = await secondBrowser.newPage()
    await secondPage.goto(appUrl)
    await expect(column(secondPage, '할 일').locator('.card')).toHaveCount(2)
    expect(await readBoard(secondPage)).toEqual(before)
  } finally {
    await secondBrowser.close()
  }
})

test('휴대폰 크기(너비 375px)에서는 세 칸이 세로로 쌓이고, 옆으로 밀지 않아도 다 보인다', async ({ page }) => {
  seedTasks(CARDS_IN_ALL_COLUMNS)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await expect(column(page, '할 일').locator('.card')).toHaveCount(2)

  const boxes = []
  for (const name of COLUMN_NAMES) {
    boxes.push((await column(page, name).boundingBox())!)
  }
  // 위에서부터 할 일 → 진행 중 → 완료로 쌓이고, 앞 칸 아래에 다음 칸이 온다.
  expect(boxes[1].y).toBeGreaterThanOrEqual(boxes[0].y + boxes[0].height)
  expect(boxes[2].y).toBeGreaterThanOrEqual(boxes[1].y + boxes[1].height)
  for (const box of boxes) {
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(375)
  }
  // 페이지가 옆으로 넘치지 않는다.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBe(0)
})

test('T-44 칸별 카드 개수는 만들기, 옮기기, 삭제에 따라 바뀌고, 새로고침해도 같다', async ({ page }) => {
  seedTasks([
    { id: 1, title: '장보기', description: null, status: 'TODO', ordered_at: 100 },
    { id: 2, title: '보고서 쓰기', description: null, status: 'TODO', ordered_at: 200 },
    { id: 3, title: '청소', description: null, status: 'IN_PROGRESS', ordered_at: 300 },
  ])
  await page.goto('/')
  const counts = page.locator('.column-count')
  await expect(counts).toHaveText(['2', '1', '0'])

  await page.getByRole('button', { name: '새 카드' }).click()
  await page.getByRole('dialog').getByLabel('제목').fill('운동')
  await page.getByRole('dialog').getByRole('button', { name: '만들기' }).click()
  await expect(counts).toHaveText(['3', '1', '0'])

  const mart = column(page, '할 일').locator('.card').filter({ hasText: '장보기' })
  await mart.locator('.status-pill').click()
  await mart.getByRole('group', { name: '상태 고르기' }).getByRole('button', { name: '완료', exact: true }).click()
  await expect(counts).toHaveText(['2', '1', '1'])

  const cleaning = column(page, '진행 중').locator('.card').filter({ hasText: '청소' })
  await cleaning.getByRole('button', { name: '삭제' }).click()
  await cleaning.getByRole('button', { name: '예' }).click()
  await expect(counts).toHaveText(['2', '0', '1'])

  await page.reload()
  await expect(counts).toHaveText(['2', '0', '1'])
})
