import { expect, test, type Page, type Route } from '@playwright/test'
import { seedTasks, type SeedTask } from '../helpers/seed'

// TEST-PLAN.md "처리 중" T-49 ~ T-52.
// 브라우저에서 해당 요청을 붙잡아 두어 서버 응답을 늦추고, 응답 전과 응답 뒤를 나눠 확인한다.

const column = (page: Page, name: string) => page.getByRole('region', { name })
const titles = (page: Page, name: string) => column(page, name).locator('.card-title')
const card = (page: Page, columnName: string, title: string) =>
  column(page, columnName).locator('.card').filter({ has: page.locator('.card-title', { hasText: title }) })
const dialog = (page: Page) => page.getByRole('dialog', { name: '카드 만들기' })

/** method와 주소가 맞는 요청을 붙잡아 둔다. release()를 부르면 서버로 보낸다. */
async function holdRequests(page: Page, method: string, pathname: string) {
  const held: Route[] = []
  await page.route(
    (url) => url.pathname === pathname,
    async (route) => {
      if (route.request().method() === method) {
        held.push(route)
      } else {
        await route.continue()
      }
    },
  )
  return {
    count: () => held.length,
    release: async () => {
      for (const route of held.splice(0)) {
        await route.continue()
      }
    },
  }
}

const CARD: SeedTask = { id: 1, title: '장보기', description: null, status: 'TODO', ordered_at: 100 }

async function openBoard(page: Page, tasks: SeedTask[]) {
  seedTasks(tasks)
  await page.goto('/')
  await expect(page.locator('.card')).toHaveCount(tasks.length)
}

test('T-49 만들기 처리 중에는 만들기와 취소를 누를 수 없고, 응답 뒤에 카드가 한 장만 생긴다', async ({ page }) => {
  await openBoard(page, [])
  const create = await holdRequests(page, 'POST', '/api/tasks')

  await page.getByRole('button', { name: '새 카드' }).click()
  await dialog(page).getByLabel('제목').fill('처리 중 카드')
  await dialog(page).getByRole('button', { name: '만들기' }).click()

  // 응답 전
  await expect.poll(create.count).toBe(1)
  await expect(dialog(page).getByRole('button', { name: '만들기' })).toBeDisabled()
  await expect(dialog(page).getByRole('button', { name: '취소' })).toBeDisabled()
  await dialog(page).getByRole('button', { name: '만들기' }).click({ force: true })
  await expect(dialog(page)).toBeVisible()
  await expect(page.locator('.card')).toHaveCount(0)
  expect(create.count()).toBe(1)

  // 응답 뒤
  await create.release()
  await expect(dialog(page)).toBeHidden()
  await expect(titles(page, '할 일')).toHaveText(['처리 중 카드'])
})

test('T-50 저장 처리 중에는 저장과 취소를 누를 수 없고, 응답 뒤에 바뀐 내용이 보인다', async ({ page }) => {
  await openBoard(page, [CARD])
  const save = await holdRequests(page, 'PATCH', '/api/tasks/1')

  await card(page, '할 일', '장보기').getByRole('button', { name: '수정' }).click()
  await page.locator('.card-editing').getByLabel('제목').fill('마트 가기')
  await page.locator('.card-editing').getByRole('button', { name: '저장' }).click()

  // 응답 전: 수정 중인 채로 있고, 보드에 바뀐 제목이 미리 보이지 않는다.
  await expect.poll(save.count).toBe(1)
  await expect(page.locator('.card-editing').getByRole('button', { name: '저장' })).toBeDisabled()
  await expect(page.locator('.card-editing').getByRole('button', { name: '취소' })).toBeDisabled()
  await expect(page.locator('.card-title', { hasText: '마트 가기' })).toHaveCount(0)

  // 응답 뒤
  await save.release()
  await expect(page.locator('.card-editing')).toHaveCount(0)
  await expect(titles(page, '할 일')).toHaveText(['마트 가기'])
})

test('T-51 옮기기 처리 중에는 카드가 원래 칸에 있고 상태 표시와 끌기를 쓸 수 없다', async ({ page }) => {
  await openBoard(page, [CARD])
  const move = await holdRequests(page, 'PATCH', '/api/tasks/1/status')

  const target = card(page, '할 일', '장보기')
  await target.locator('.status-pill').click()
  await target.getByRole('group', { name: '상태 고르기' }).getByRole('button', { name: '완료', exact: true }).click()

  // 응답 전
  await expect.poll(move.count).toBe(1)
  await expect(titles(page, '할 일')).toHaveText(['장보기'])
  await expect(titles(page, '완료')).toHaveCount(0)
  await expect(target.locator('.status-pill')).toBeDisabled()
  await expect(target).toHaveAttribute('draggable', 'false')

  // 응답 뒤
  await move.release()
  await expect(titles(page, '완료')).toHaveText(['장보기'])
  await expect(titles(page, '할 일')).toHaveCount(0)
})

test('T-52 삭제 처리 중에는 카드가 남아 있고 예와 아니오를 누를 수 없다', async ({ page }) => {
  await openBoard(page, [CARD])
  const remove = await holdRequests(page, 'DELETE', '/api/tasks/1')

  const target = card(page, '할 일', '장보기')
  await target.getByRole('button', { name: '삭제' }).click()
  await target.getByRole('button', { name: '예' }).click()

  // 응답 전
  await expect.poll(remove.count).toBe(1)
  await expect(titles(page, '할 일')).toHaveText(['장보기'])
  await expect(target.getByRole('button', { name: '예' })).toBeDisabled()
  await expect(target.getByRole('button', { name: '아니오' })).toBeDisabled()

  // 응답 뒤
  await remove.release()
  await expect(page.locator('.card')).toHaveCount(0)
})
