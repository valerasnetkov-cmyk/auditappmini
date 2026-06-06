import type { InspectionDetail } from '@/lib/types'
import { formatDateTime, getTypeLabel } from './checklist'

export function printIncidentCard(inspection: InspectionDetail) {
  const defectsMarkup = inspection.defects.length
    ? inspection.defects
        .map(
          (defect, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${defect.title}</td>
              <td>${defect.comment || 'Без описания'}</td>
              <td>${formatDateTime(defect.created_at)}</td>
              <td>${defect.photos.length}</td>
            </tr>
          `,
        )
        .join('')
    : '<tr><td colspan="5">Дефекты не зафиксированы</td></tr>'

  const printWindow = window.open('', '_blank', 'width=1100,height=900')
  if (!printWindow) return

  printWindow.document.write(`
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="utf-8" />
        <title>Карточка ДТП ${inspection.vehicle_number}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
          h1, h2 { margin: 0 0 12px; }
          .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
          .card { border: 1px solid #dbe2ea; border-radius: 12px; padding: 14px; background: #f8fafc; }
          .label { font-size: 12px; color: #64748b; margin-bottom: 4px; }
          .value { font-size: 15px; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th { text-align: left; background: #eff6ff; }
          th, td { font-size: 13px; padding: 8px; border: 1px solid #dbe2ea; }
        </style>
      </head>
      <body>
        <h1>Карточка ДТП</h1>
        <p style="margin:0 0 20px;color:#475569;">${inspection.vehicle_number} · ${inspection.vehicle_name}</p>
        <div class="grid">
          <div class="card"><div class="label">Инспектор</div><div class="value">${inspection.inspector_name || 'Не указано'}</div></div>
          <div class="card"><div class="label">Тип осмотра</div><div class="value">${getTypeLabel(inspection.type)}</div></div>
          <div class="card"><div class="label">Время ДТП</div><div class="value">${formatDateTime(inspection.accident_occurred_at)}</div></div>
          <div class="card"><div class="label">Время осмотра</div><div class="value">${formatDateTime(inspection.created_at)}</div></div>
          <div class="card"><div class="label">Место ДТП</div><div class="value">${inspection.accident_location || 'Не указано'}</div></div>
          <div class="card"><div class="label">Количество дефектов</div><div class="value">${inspection.defects.length}</div></div>
        </div>
        <h2>Дефекты</h2>
        <table>
          <thead><tr><th>№</th><th>Дефект</th><th>Описание</th><th>Зафиксирован</th><th>Фото</th></tr></thead>
          <tbody>${defectsMarkup}</tbody>
        </table>
      </body>
    </html>
  `)

  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}
