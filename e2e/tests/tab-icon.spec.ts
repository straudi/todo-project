import { expect, test } from '@playwright/test'

// T-54: 탭 아이콘 (DESIGN.md "브라우저 탭 아이콘")
test('T-54 탭 아이콘', async ({ page }) => {
  const notFound: string[] = []
  page.on('response', (response) => {
    if (response.status() === 404) notFound.push(response.url())
  })

  await page.goto('/')
  await expect(page).toHaveTitle('할 일 카드')

  const icon = page.locator('link[rel="icon"]')
  await expect(icon).toHaveAttribute('type', 'image/svg+xml')
  const href = await icon.getAttribute('href')
  expect(href).toBe('/favicon.svg')

  const response = await page.request.get(href!)
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('image/svg+xml')
  const svg = await response.text()
  expect(svg).toContain('fill="#1660D6"')
  expect(svg).toContain('stroke="#FFFFFF"')

  await page.waitForLoadState('networkidle')
  expect(notFound).toEqual([])
})
