'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api/client'
import type { SettingsResponse } from '@/lib/types'

export function InspectionScheduleSettingsPanel({
  disabled,
  onStatus,
}: {
  disabled: boolean
  onStatus: (tone: 'success' | 'danger', text: string) => void
}) {
  const [settings, setSettings] = useState<SettingsResponse>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void api.getSettings().then((result) => {
      if (result.data) setSettings(result.data)
      if (result.error) onStatus('danger', result.error)
      setLoading(false)
    })
  }, [onStatus])

  const save = async () => {
    setSaving(true)
    const result = await api.updateSettings({
      default_quick_inspection_interval_days: Number(settings.default_quick_inspection_interval_days),
      default_planned_inspection_interval_days: Number(settings.default_planned_inspection_interval_days),
      notification_days_before: Number(settings.notification_days_before || 3),
    })
    setSaving(false)
    if (result.error) {
      onStatus('danger', result.error)
      return
    }
    if (result.data) setSettings(result.data)
    onStatus('success', 'План-график осмотров сохранён')
  }

  return (
    <section className="card mb-4 p-4">
      <h2 className="mb-1 text-lg font-semibold text-foreground">План-график осмотров</h2>
      <p className="mb-4 text-sm text-foreground-muted">
        Интервалы компании применяются ко всей технике без индивидуального переопределения.
      </p>
      {loading ? (
        <p className="text-sm text-foreground-muted">Загрузка...</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <label>
              <span className="label">Быстрый осмотр, дней</span>
              <input
                type="number"
                min="1"
                max="3650"
                className="input"
                value={settings.default_quick_inspection_interval_days || ''}
                onChange={(event) => setSettings({
                  ...settings,
                  default_quick_inspection_interval_days: Number(event.target.value),
                })}
              />
            </label>
            <label>
              <span className="label">Плановый осмотр, дней</span>
              <input
                type="number"
                min="1"
                max="3650"
                className="input"
                value={settings.default_planned_inspection_interval_days || ''}
                onChange={(event) => setSettings({
                  ...settings,
                  default_planned_inspection_interval_days: Number(event.target.value),
                })}
              />
            </label>
            <label>
              <span className="label">Предупреждать за, дней</span>
              <input
                type="number"
                min="1"
                max="3650"
                className="input"
                value={settings.notification_days_before || ''}
                onChange={(event) => setSettings({
                  ...settings,
                  notification_days_before: Number(event.target.value),
                })}
              />
            </label>
          </div>
          <button
            type="button"
            disabled={disabled || saving}
            onClick={() => void save()}
            className="btn btn-primary mt-4 disabled:opacity-50"
          >
            {saving ? 'Сохраняем...' : 'Сохранить график'}
          </button>
        </>
      )}
    </section>
  )
}
