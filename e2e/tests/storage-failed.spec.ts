import { expect, test, type Page } from '@playwright/test'
import { chmodSync } from 'node:fs'
import { TEST_DB_PATH } from '../helpers/paths'
import { seedTasks, type SeedTask } from '../helpers/seed'

// TEST-PLAN.md T-53 저장소에 쓰지 못할 때.
// 테스트용 저장소 파일을 읽기 전용으로 바꿔 쓰기를 실제로 실패시킨다 (서버는 500 STORAGE_FAILED).

const column = (page: Page, name: string) => page.getByRole('region', { name })
const titles = (page: Page, name: string) => column(page, name).locator('.card-title')
const card = (page: Page, columnName: string, title: string) =>
  column(page, columnName).locator('.card').filter({ has: page.locator('.card-title', { hasText: title }) })
const dialog = (page: Page) => page.getByRole('dialog', { name: '카드 만들기' })

const CARDS: SeedTask[] = [
  { id: 1, title: '장보기', description: null, status: 'TODO', ordered_at: 100 },
  { id: 2, title: '보고서 쓰기', description: null, status: 'TODO', ordered_at: 200 },
]

function makeReadOnly() {
  chmodSync(TEST_DB_PATH, 0o444)
}

function makeWritable() {
  chmodSync(TEST_DB_PATH, 0o644)
}

test.afterEach(() => {
  // 테스트가 중간에 실패해도 다음 테스트가 쓸 수 있게 되돌린다.
  makeWritable()
})

test('T-53 저장소에 쓰지 못하면 만들기, 수정, 옮기기, 삭제마다 실패 문구가 보이고 저장소는 그대로다', async ({ page }) => {
  seedTasks(CARDS)
  await page.goto('/')
  await expect(page.locator('.card')).toHaveCount(2)
  const storageFailures: number[] = []
  page.on('response', async (response) => {
    if (new URL(response.url()).pathname.startsWith('/api/tasks') && response.status() === 500) {
      const body = await response.json().catch(() => null)
      if (body?.errors?.[0]?.reason === 'STORAGE_FAILED') {
        storageFailures.push(response.status())
      }
    }
  })

  makeReadOnly()

  // 만들기
  await page.getByRole('button', { name: '새 카드' }).click()
  await dialog(page).getByLabel('제목').fill('새 카드')
  await dialog(page).getByRole('button', { name: '만들기' }).click()
  await expect(dialog(page).getByText('저장하지 못했습니다. 다시 시도해 주세요.')).toBeVisible()
  await dialog(page).getByRole('button', { name: '취소' }).click()

  // 수정
  await card(page, '할 일', '장보기').getByRole('button', { name: '수정' }).click()
  await page.locator('.card-editing').getByLabel('제목').fill('마트 가기')
  await page.locator('.card-editing').getByRole('button', { name: '저장' }).click()
  await expect(page.locator('.card-editing').getByText('저장하지 못했습니다. 다시 시도해 주세요.')).toBeVisible()
  await page.locator('.card-editing').getByRole('button', { name: '취소' }).click()

  // 옮기기
  const mart = card(page, '할 일', '장보기')
  await mart.locator('.status-pill').click()
  await mart.getByRole('group', { name: '상태 고르기' }).getByRole('button', { name: '완료', exact: true }).click()
  await expect(mart.getByText('옮기지 못했습니다. 다시 시도해 주세요.')).toBeVisible()

  // 삭제
  const report = card(page, '할 일', '보고서 쓰기')
  await report.getByRole('button', { name: '삭제' }).click()
  await report.getByRole('button', { name: '예' }).click()
  await expect(report.getByText('지우지 못했습니다. 다시 시도해 주세요.')).toBeVisible()

  // 응답 본문을 읽는 기록은 비동기라, 4개가 모일 때까지 기다린다.
  await expect.poll(() => storageFailures.length).toBe(4)

  // 되돌린 뒤 새로고침하면 저장소는 그대로다.
  makeWritable()
  await page.reload()
  await expect(titles(page, '할 일')).toHaveText(['보고서 쓰기', '장보기'])
  await expect(titles(page, '완료')).toHaveCount(0)
})
