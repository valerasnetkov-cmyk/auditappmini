"use client"

import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import Layout from '@/components/Layout'
import LocaleSwitcher from '@/components/LocaleSwitcher'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import api from '@/lib/api/client'
import { getAuthToken } from '@/lib/auth'
import type { RegionRecord } from '@/lib/types'

type ImportResult = {
  imported: number
  errors: { row: number; error: string }[]
  regionsAdded?: number
}

type StatusMessage = {
  tone: 'success' | 'warning' | 'danger' | 'info'
  text: string
}

type ParsedVehicle = {
  number: string
  name: string
  region: string
}

function getRegionVehicleCount(region: RegionRecord) {
  return Number(region.vehicle_count ?? region.vehicleCount ?? 0)
}

function parseToken(value: unknown) {
  return String(value || '').trim()
}

function normalizePlateValue(value: unknown) {
  return parseToken(value).replace(/\s+/g, '').toUpperCase()
}

function isRussianPlateLike(value: string) {
  return /^[АВЕКМНОРСТУХABEKMHOPCTYX]\d{3}[АВЕКМНОРСТУХABEKMHOPCTYX]{2}\d{2,3}$/i.test(value)
}

export default function SettingsPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [isManager, setIsManager] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [status, setStatus] = useState<StatusMessage | null>(null)
  const [regions, setRegions] = useState<RegionRecord[]>([])
  const [newRegion, setNewRegion] = useState('')
  const [editingRegionId, setEditingRegionId] = useState<string | null>(null)
  const [editingRegionName, setEditingRegionName] = useState('')
  const [savingRegionId, setSavingRegionId] = useState<string | null>(null)
  const [deletingRegionId, setDeletingRegionId] = useState<string | null>(null)

  const loadRegions = async () => {
    const result = await api.getRegions()
    if (result.error) {
      setStatus({ tone: 'danger', text: result.error })
      return
    }

    setRegions((result.data || []).filter((region) => getRegionVehicleCount(region) > 0))
  }

  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      router.push('/login')
      return
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      setIsManager(payload.role === 'manager' || payload.role === 'admin')
    } catch {
      setIsManager(false)
    }

    setLoading(false)
    void loadRegions()
  }, [router])

  const parseExcel = (buffer: ArrayBuffer): ParsedVehicle[] => {
    try {
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      if (!sheetName) return []

      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
      if (!rows.length) return []

      const firstRow = rows[0].map((value) => parseToken(value).toLowerCase())
      const hasHeader = firstRow.some(
        (header) =>
          header.includes('номер') ||
          header.includes('гос') ||
          header.includes('number') ||
          header.includes('название') ||
          header.includes('марка') ||
          header.includes('регион'),
      )

      const headers = hasHeader ? firstRow : ['номер', 'название', 'регион']
      const dataStart = hasHeader ? 1 : 0
      const numberIdx = headers.findIndex((header) => header.includes('номер') || header.includes('number') || header.includes('гос') || header.includes('регистрац'))
      const nameIdx = headers.findIndex((header) => header.includes('название') || header.includes('name') || header.includes('марка') || header.includes('модель'))
      const regionIdx = headers.findIndex((header) => header.includes('регион') || header.includes('region') || header.includes('область'))

      if (numberIdx === -1) return []

      return rows
        .slice(dataStart)
        .map((columns) => ({
          number: normalizePlateValue(columns[numberIdx]),
          name: nameIdx !== -1 ? parseToken(columns[nameIdx]) : '',
          region: regionIdx !== -1 ? parseToken(columns[regionIdx]) : '',
        }))
        .filter((vehicle) => vehicle.number.length > 3 && (isRussianPlateLike(vehicle.number) || vehicle.name || vehicle.region))
    } catch {
      return []
    }
  }

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setStatus({ tone: 'warning', text: 'Выберите Excel-файл для импорта.' })
      return
    }

    setStatus(null)
    setImportResult(null)
    setImporting(true)

    try {
      const vehicles = parseExcel(await file.arrayBuffer())
      if (!vehicles.length) {
        setStatus({ tone: 'danger', text: 'Не удалось распознать данные. Проверьте колонки: номер, название, регион.' })
        return
      }

      const result = await api.importVehicles(vehicles)
      if (result.error) {
        setStatus({ tone: 'danger', text: result.error })
        return
      }

      if (result.data) {
        setImportResult(result.data)
        setStatus({ tone: 'success', text: `Импортировано машин: ${result.data.imported}` })
        await loadRegions()
      }
    } catch {
      setStatus({ tone: 'danger', text: 'Ошибка при импорте Excel-файла.' })
    } finally {
      setImporting(false)
    }
  }

  const handleAddRegion = async (event: FormEvent) => {
    event.preventDefault()

    const name = newRegion.trim()
    if (!name) return

    setStatus(null)
    const result = await api.createRegion({ name })
    if (result.error) {
      setStatus({ tone: 'danger', text: result.error })
      return
    }

    setNewRegion('')
    setStatus({
      tone: 'info',
      text: 'Регион добавлен в справочник. В списке ниже он появится после привязки хотя бы одной машины.',
    })
    await loadRegions()
  }

  const startEditRegion = (region: RegionRecord) => {
    setEditingRegionId(region.id)
    setEditingRegionName(region.name)
    setStatus(null)
  }

  const cancelEditRegion = () => {
    setEditingRegionId(null)
    setEditingRegionName('')
  }

  const handleSaveRegion = async (region: RegionRecord) => {
    const name = editingRegionName.trim()
    if (!name || name === region.name) {
      cancelEditRegion()
      return
    }

    setSavingRegionId(region.id)
    setStatus(null)

    try {
      const result = await api.updateRegion(region.id, name, region.name)
      if (result.error) {
        setStatus({ tone: 'danger', text: result.error })
        return
      }

      cancelEditRegion()
      setStatus({
        tone: 'success',
        text: result.data?.merged_from && result.data?.merged_into
          ? `Регион "${result.data.merged_from}" объединен с "${result.data.merged_into}". Вся связанная техника перенесена.`
          : 'Регион обновлен. Название региона у связанной техники также изменено.',
      })
      await loadRegions()
    } finally {
      setSavingRegionId(null)
    }
  }

  const handleDeleteRegion = async (region: RegionRecord) => {
    const count = getRegionVehicleCount(region)
    const confirmed = window.confirm(
      `Удалить регион "${region.name}"? У ${count} машин регион будет очищен, сами карточки техники не удалятся.`,
    )
    if (!confirmed) return

    setDeletingRegionId(region.id)
    setStatus(null)

    try {
      const result = await api.deleteRegion(region.id)
      if (result.error) {
        setStatus({ tone: 'danger', text: result.error })
        return
      }

      setStatus({ tone: 'success', text: 'Регион удален, техника отвязана от него.' })
      await loadRegions()
    } finally {
      setDeletingRegionId(null)
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) {
      setStatus(null)
      setImportResult(null)
    }
  }

  if (loading) {
    return (
      <Layout currentPage="settings">
        <div className="p-6 text-foreground-muted">Загрузка...</div>
      </Layout>
    )
  }

  return (
    <Layout currentPage="settings">
      <div className="max-w-4xl p-6">
        <div className="mb-6">
          <h1 className="page-title text-2xl">Настройки</h1>
          <p className="mt-1 text-sm text-foreground-muted">Импорт техники, справочник регионов и базовые параметры интерфейса.</p>
        </div>

        {status ? (
          <div className={`mb-4 rounded-card px-4 py-3 text-sm alert-${status.tone}`}>
            {status.text}
          </div>
        ) : null}

        <div className="card mb-4 p-4">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Внешний вид</h2>
          <ThemeSwitcher />
        </div>

        <div className="card mb-4 p-4">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Язык интерфейса</h2>
          <LocaleSwitcher />
        </div>

        {isManager ? (
          <div className="card mb-4 p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Импорт техники из Excel</h2>
                <p className="mt-1 text-sm text-foreground-secondary">
                  Загрузите файл `.xlsx` или `.xls` с колонками: номер, название, регион.
                </p>
                <p className="mt-1 text-xs text-foreground-muted">Пример: А123ВС77 | ГАЗель Next | Москва</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="block w-full text-sm text-foreground-muted file:mr-4 file:rounded-pill file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
              />
              <button onClick={handleImport} disabled={importing} className="btn btn-primary whitespace-nowrap disabled:opacity-50">
                {importing ? 'Импорт...' : 'Импортировать'}
              </button>
            </div>

            {importResult ? (
              <div className="alert-success mt-4 rounded-card p-4">
                <p className="font-medium">Импортировано: {importResult.imported}</p>
                {importResult.regionsAdded ? <p className="mt-1 text-sm">Новых регионов добавлено: {importResult.regionsAdded}</p> : null}
                {importResult.errors.length ? (
                  <div className="mt-3 text-sm">
                    <p className="font-medium text-status-danger">Ошибок: {importResult.errors.length}</p>
                    <ul className="mt-1 space-y-1">
                      {importResult.errors.slice(0, 5).map((item) => (
                        <li key={`${item.row}-${item.error}`}>Строка {item.row}: {item.error}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {isManager ? (
          <div className="card mb-4 p-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-foreground">Регионы техники</h2>
              <p className="mt-1 text-sm text-foreground-secondary">
                Ниже показаны только регионы, у которых сейчас есть техника. Новые регионы добавляются в справочник и становятся доступны в выпадающих списках карточек техники.
              </p>
            </div>

            <form onSubmit={handleAddRegion} className="mb-4 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={newRegion}
                onChange={(event) => setNewRegion(event.target.value)}
                placeholder="Название региона"
                className="input flex-1"
              />
              <button type="submit" disabled={!newRegion.trim()} className="btn btn-success whitespace-nowrap disabled:opacity-50">
                Добавить
              </button>
            </form>

            <div className="space-y-2">
              {regions.length ? (
                regions.map((region) => {
                  const isEditing = editingRegionId === region.id
                  const vehicleCount = getRegionVehicleCount(region)

                  return (
                    <div key={region.id} className="rounded-card border border-line bg-muted-surface p-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <input
                              value={editingRegionName}
                              onChange={(event) => setEditingRegionName(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  void handleSaveRegion(region)
                                }

                                if (event.key === 'Escape') {
                                  cancelEditRegion()
                                }
                              }}
                              className="input"
                              autoFocus
                            />
                          ) : (
                            <>
                              <div className="font-semibold text-foreground">{region.name}</div>
                              <div className="mt-1 text-sm text-foreground-muted">Техники в регионе: {vehicleCount}</div>
                            </>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleSaveRegion(region)}
                                disabled={savingRegionId === region.id}
                                className="btn btn-primary btn-sm disabled:opacity-50"
                              >
                                {savingRegionId === region.id ? 'Сохранение...' : 'Сохранить'}
                              </button>
                              <button type="button" onClick={cancelEditRegion} className="btn btn-secondary btn-sm">
                                Отмена
                              </button>
                            </>
                          ) : (
                            <>
                              <button type="button" onClick={() => startEditRegion(region)} className="btn btn-secondary btn-sm">
                                Редактировать
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteRegion(region)}
                                disabled={deletingRegionId === region.id}
                                className="btn btn-danger btn-sm disabled:opacity-50"
                              >
                                {deletingRegionId === region.id ? 'Удаление...' : 'Удалить'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-card border border-dashed border-line-strong bg-muted-surface p-5 text-center text-sm text-foreground-muted">
                  Пока нет регионов с привязанной техникой.
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="card p-4">
          <h2 className="mb-4 text-lg font-semibold text-foreground">О системе</h2>
          <p className="text-foreground-secondary">Аудит Техники v0.1.0</p>
          <p className="mt-1 text-sm text-foreground-muted">Система независимой фотофиксации состояния техники</p>
        </div>
      </div>
    </Layout>
  )
}
