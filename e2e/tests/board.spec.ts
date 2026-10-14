import { expect, test } from '@playwright/test'
import { seedTasks } from '../helpers/seed'

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

  const column = (name: string) => page.getByRole('region', { name })

  await expect(column('할 일').locator('.card-title')).toHaveText(['나중에 만든 할 일', '먼저 만든 할 일'])
  await expect(column('진행 중').locator('.card-title')).toHaveText(['진행 중인 일'])
  await expect(column('진행 중').locator('.card-description')).toHaveText(['설명이 있는 카드'])
  await expect(column('완료').locator('.card-title')).toHaveText(['끝난 일'])
  // 설명이 없는 카드에는 설명이 보이지 않는다.
  await expect(column('할 일').locator('.card-description')).toHaveCount(0)
})
