import { expect, test } from '@playwright/test'
import {
  API_BASE,
  WEB_BASE,
  apiHeaders,
  archiveVehicle,
  createVehicle,
  getCompanyOwnerToken,
  loginAsCompanyOwner,
} from './helpers'

const VALID_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
)

test('Inspection readiness blocks incomplete completion and exposes generated PDF', async ({ page, request }) => {
  const token = await getCompanyOwnerToken(request)
  const vehicle = await createVehicle(request, token, 'Readiness report vehicle')
  let inspectionId = ''

  try {
    const createResponse = await request.post(`${API_BASE}/api/inspections`, {
      headers: apiHeaders(token),
      data: { vehicle_id: vehicle.id, type: 'quick', checklist: [] },
    })
    expect(createResponse.ok()).toBeTruthy()
    inspectionId = String((await createResponse.json()).id)

    const blockedReadinessResponse = await request.get(
      `${API_BASE}/api/inspections/${inspectionId}/readiness`,
      { headers: apiHeaders(token) },
    )
    expect(blockedReadinessResponse.ok()).toBeTruthy()
    const blockedReadiness = await blockedReadinessResponse.json()
    expect(blockedReadiness.ready).toBe(false)
    expect(blockedReadiness.missing.length).toBeGreaterThan(0)

    await loginAsCompanyOwner(page)
    await page.goto(`${WEB_BASE}/inspections/${inspectionId}`)
    await expect(page.getByText('Осмотр проводится только с мобильного устройства')).toBeVisible()
    await expect(page.getByText('Не хватает данных для завершения')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Завершить осмотр' })).toHaveCount(0)

    const updateResponse = await request.put(`${API_BASE}/api/inspections/${inspectionId}`, {
      headers: apiHeaders(token),
      data: {
        odometer_value: 12345,
        odometer_unit: 'km',
        checklist: [
          { title: 'Внешний вид', result: true },
          { title: 'Повреждения кузова', result: true },
          { title: 'Колёса', result: true },
          { title: 'Стёкла', result: true },
          { title: 'Госномер', result: true },
        ],
      },
    })
    expect(updateResponse.ok()).toBeTruthy()

    for (const photoType of ['front', 'left', 'right', 'rear', 'overview', 'odometer']) {
      const uploadResponse = await request.post(`${API_BASE}/api/inspections/${inspectionId}/photos`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: {
          photo_type: photoType,
          client_photo_id: `e2e-${inspectionId}-${photoType}`,
          captured_at: '2026-06-12T10:00:00.000Z',
          photo: {
            name: `${photoType}.png`,
            mimeType: 'image/png',
            buffer: VALID_PNG,
          },
        },
      })
      expect(uploadResponse.ok()).toBeTruthy()
    }

    const completeResponse = await request.post(`${API_BASE}/api/inspections/${inspectionId}/complete`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(completeResponse.ok()).toBeTruthy()

    const completedReadinessResponse = await request.get(
      `${API_BASE}/api/inspections/${inspectionId}/readiness`,
      { headers: apiHeaders(token) },
    )
    expect(completedReadinessResponse.ok()).toBeTruthy()
    expect((await completedReadinessResponse.json()).ready).toBe(true)

    await page.reload()
    await expect(page.getByText('Согласование осмотра')).toBeVisible()
    await page.getByLabel('Комментарий').fill('Материалы готовы к проверке')
    await page.getByRole('button', { name: 'Отправить на согласование' }).click()
    await expect(page.getByText('На согласовании', { exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Согласовать' }).click()
    await expect(page.getByText('Согласован', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('История решений')).toBeVisible()

    const generateButton = page.getByRole('button', { name: 'Сформировать отчёт' })
    await expect(generateButton).toBeVisible()
    await generateButton.click()
    await expect(page.getByText('PDF-отчёт сформирован')).toBeVisible({ timeout: 15000 })
    const downloadButton = page.getByRole('button', { name: 'Скачать PDF' })
    await expect(downloadButton).toBeVisible()

    await page.goto(`${WEB_BASE}/inspections/${inspectionId}/report`)
    await expect(page.getByText('Целостность подтверждена')).toBeVisible()

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Скачать PDF' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toContain(`inspection-${inspectionId}`)
  } finally {
    await archiveVehicle(request, token, vehicle.id)
  }
})
