'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import ManagerAccessDenied from '@/components/ManagerAccessDenied'
import api from '@/lib/api/client'
import { setTimezoneOffset } from '@/lib/dateUtils'
import { useManagerAccess } from '@/lib/useManagerAccess'
import type { ExportType, NotificationItem, RegionRecord } from '@/lib/types'

type MessageTone = 'success' | 'error'

export default function SettingsPage() {
  const managerAccess = useManagerAccess()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addingRegion, setAddingRegion] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [regions, setRegions] = useState<RegionRecord[]>([])
  const [newRegion, setNewRegion] = useState('')
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<MessageTone>('success')
  const [formData, setFormData] = useState({
    scheduled_inspection_days: '30',
    notification_days_before: '3',
    timezone_offset: '3',
  })

  useEffect(() => {
    if (!managerAccess.allowed) return
    void loadData()
  }, [managerAccess.allowed])

  const showMessage = (tone: MessageTone, text: string) => {
    setMessageTone(tone)
    setMessage(text)
  }

  const loadData = async () => {
    try {
      const [settingsRes, notifRes, regionsRes] = await Promise.all([
        api.getSettings(),
        api.getNotifications(),
        api.getRegions(),
      ])

      if (settingsRes.error) {
        showMessage('error', settingsRes.error)
        return
      }

      if (notifRes.error) {
        showMessage('error', notifRes.error)
        return
      }

      if (regionsRes.error) {
        showMessage('error', regionsRes.error)
        return
      }

      if (settingsRes.data) {
        const settings = settingsRes.data
        const timezone = String(settings.timezone_offset ?? 3)
        setTimezoneOffset(Number(timezone))
        setFormData({
          scheduled_inspection_days: String(settings.scheduled_inspection_days ?? 30),
          notification_days_before: String(settings.notification_days_before ?? 3),
          timezone_offset: timezone,
        })
      }

      setNotifications(notifRes.data || [])
      setRegions(regionsRes.data || [])
      setMessage('')
    } catch {
      showMessage('error', 'Не удалось загрузить настройки')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const result = await api.updateSettings({
        scheduled_inspection_days: Number(formData.scheduled_inspection_days),
        notification_days_before: Number(formData.notification_days_before),
        timezone_offset: Number(formData.timezone_offset),
      })

      if (result.error) {
        showMessage('error', result.error)
        return
      }

      setTimezoneOffset(Number(formData.timezone_offset))
      showMessage('success', 'Настройки сохранены')
      await loadData()
    } catch {
      showMessage('error', 'Ошибка сохранения настроек')
    } finally {
      setSaving(false)
    }
  }

  const handleAddRegion = async (event: React.FormEvent) => {
    event.preventDefault()
    const regionName = newRegion.trim()
    if (!regionName) {
      showMessage('error', 'Введите название региона')
      return
    }

    setAddingRegion(true)

    try {
      const result = await api.createRegion({ name: regionName })
      if (result.error) {
        showMessage('error', result.error)
        return
      }

      setNewRegion('')
      showMessage('success', `Регион «${regionName}» добавлен`)
      await loadData()
    } catch {
      showMessage('error', 'Не удалось добавить регион')
    } finally {
      setAddingRegion(false)
    }
  }

  const handleDeleteRegion = async (region: RegionRecord) => {
    if ((region.vehicle_count || 0) > 0) {
      showMessage('error', 'Сначала отвяжите этот регион от техники, потом его можно удалить')
      return
    }

    if (!confirm(`Удалить регион «${region.name}»?`)) return

    try {
      const result = await api.deleteRegion(region.id)
      if (result.error) {
        showMessage('error', result.error)
        return
      }

      showMessage('success', `Регион «${region.name}» удалён`)
      await loadData()
    } catch {
      showMessage('error', 'Не удалось удалить регион')
    }
  }

  const handleExport = async (type: ExportType, format: 'json' | 'csv' = 'csv') => {
    try {
      const result = await api.exportData(type)
      if (result.error) {
        showMessage('error', result.error)
        return
      }

      const items = result.data ?? []
      if (items.length === 0) {
        showMessage('error', 'Нет данных для экспорта')
        return
      }

      let content: string
      let mimeType: string
      let filename: string

      if (format === 'csv') {
        const headers = Object.keys(items[0])
        const csvRows = [
          headers.join(';'),
          ...items.map((row) =>
            headers
              .map((header) => {
                const value = row[header]
                if (value === null || value === undefined) return ''

                const stringValue = String(value)
                return stringValue.includes(';') || stringValue.includes(',') || stringValue.includes('"')
                  ? `"${stringValue.replace(/"/g, '""')}"`
                  : stringValue
              })
              .join(';'),
          ),
        ]
        content = '\ufeff' + csvRows.join('\n')
        mimeType = 'text/csv;charset=utf-8'
        filename = `${type}_${new Date().toISOString().split('T')[0]}.csv`
      } else {
        content = JSON.stringify(items, null, 2)
        mimeType = 'application/json'
        filename = `${type}_${new Date().toISOString().split('T')[0]}.json`
      }

      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)

      showMessage('success', `Файл ${filename} подготовлен`)
    } catch {
      showMessage('error', 'Ошибка экспорта')
    }
  }

  const handleSeed = async () => {
    if (!confirm('Создать демо-данные?')) return

    try {
      const result = await api.seedData({ vehicles: 30, inspections: 50 })
      if (result.error) {
        showMessage('error', result.error)
        return
      }

      showMessage('success', 'Демо-данные созданы')
      await loadData()
    } catch {
      showMessage('error', 'Ошибка создания демо-данных')
    }
  }

  if (managerAccess.loading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!managerAccess.allowed) {
    return (
      <Layout currentPage="settings">
        <div className="p-6">
          <ManagerAccessDenied description="Настройки системы доступны только менеджеру." />
        </div>
      </Layout>
    )
  }

  return (
    <Layout currentPage="settings">
      <div className="p-6">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Настройки</h1>

        {message ? (
          <div className={`mb-4 rounded-lg p-3 ${messageTone === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message}
          </div>
        ) : null}

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Плановые осмотры</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Периодичность планового осмотра, дней
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={formData.scheduled_inspection_days}
                  onChange={(event) => setFormData({ ...formData, scheduled_inspection_days: event.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2"
                />
                <p className="mt-1 text-sm text-slate-500">
                  Через сколько дней технике нужно проходить следующий плановый осмотр.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Напоминать за, дней</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={formData.notification_days_before}
                  onChange={(event) => setFormData({ ...formData, notification_days_before: event.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2"
                />
                <p className="mt-1 text-sm text-slate-500">
                  За сколько дней до планового осмотра система покажет уведомление.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Часовой пояс</label>
                <select
                  value={formData.timezone_offset}
                  onChange={(event) => setFormData({ ...formData, timezone_offset: event.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2"
                >
                  <option value="-12">UTC-12</option>
                  <option value="-11">UTC-11</option>
                  <option value="-10">UTC-10</option>
                  <option value="-9">UTC-9</option>
                  <option value="-8">UTC-8</option>
                  <option value="-7">UTC-7</option>
                  <option value="-6">UTC-6</option>
                  <option value="-5">UTC-5</option>
                  <option value="-4">UTC-4</option>
                  <option value="-3">UTC-3</option>
                  <option value="-2">UTC-2</option>
                  <option value="-1">UTC-1</option>
                  <option value="0">UTC+0</option>
                  <option value="1">UTC+1</option>
                  <option value="2">UTC+2</option>
                  <option value="3">UTC+3 (Москва)</option>
                  <option value="4">UTC+4</option>
                  <option value="5">UTC+5</option>
                  <option value="6">UTC+6</option>
                  <option value="7">UTC+7</option>
                  <option value="8">UTC+8</option>
                  <option value="9">UTC+9</option>
                  <option value="10">UTC+10</option>
                  <option value="11">UTC+11</option>
                  <option value="12">UTC+12</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : 'Сохранить настройки'}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Справочник регионов</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Эти регионы используются в выпадающем списке при добавлении и редактировании техники.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">{regions.length} регионов</span>
            </div>

            <form onSubmit={handleAddRegion} className="mb-5 flex flex-col gap-3 md:flex-row">
              <input
                type="text"
                value={newRegion}
                onChange={(event) => setNewRegion(event.target.value)}
                placeholder="Например, Южно-Сахалинск"
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2"
              />
              <button
                type="submit"
                disabled={addingRegion}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {addingRegion ? 'Добавление...' : 'Добавить регион'}
              </button>
            </form>

            {regions.length === 0 ? (
              <p className="text-sm text-slate-500">Справочник пока пуст.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {regions.map((region) => (
                  <div key={region.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-slate-800">{region.name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Привязано техники: {region.vehicle_count || 0}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteRegion(region)}
                        disabled={(region.vehicle_count || 0) > 0}
                        className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Уведомления о плановых осмотрах</h2>
            {notifications.length === 0 ? (
              <p className="text-slate-500">Сейчас уведомлений нет.</p>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <div
                    key={notification.vehicle_id}
                    className={`rounded-lg border p-4 ${
                      notification.is_overdue ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-900">
                          {notification.vehicle_number} - {notification.vehicle_name}
                        </p>
                        <p className="text-sm text-slate-600">
                          {notification.is_overdue
                            ? `Осмотр просрочен на ${Math.abs(notification.days_until)} дн.`
                            : `До осмотра ${notification.days_until} дн. (${notification.next_due})`}
                        </p>
                        {notification.last_inspection ? (
                          <p className="text-sm text-slate-500">Последний осмотр: {notification.last_inspection}</p>
                        ) : null}
                      </div>
                      <Link href={`/inspections?vehicle=${notification.vehicle_id}`} className="text-sm text-blue-600 hover:underline">
                        Перейти к осмотрам
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Данные</h2>
            <button onClick={handleSeed} className="rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700">
              Создать демо-данные
            </button>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Экспорт данных</h2>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => handleExport('vehicles', 'csv')} className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700">
                  Техника (CSV)
                </button>
                <button onClick={() => handleExport('inspections', 'csv')} className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700">
                  Осмотры (CSV)
                </button>
                <button onClick={() => handleExport('defects', 'csv')} className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700">
                  Дефекты (CSV)
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => handleExport('vehicles', 'json')} className="rounded-lg bg-slate-600 px-4 py-2 text-white hover:bg-slate-700">
                  Техника (JSON)
                </button>
                <button onClick={() => handleExport('inspections', 'json')} className="rounded-lg bg-slate-600 px-4 py-2 text-white hover:bg-slate-700">
                  Осмотры (JSON)
                </button>
                <button onClick={() => handleExport('defects', 'json')} className="rounded-lg bg-slate-600 px-4 py-2 text-white hover:bg-slate-700">
                  Дефекты (JSON)
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  )
}
