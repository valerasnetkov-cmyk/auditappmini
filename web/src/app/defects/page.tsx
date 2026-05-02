'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import api from '@/lib/api/client'
import { requireAuthToken } from '@/lib/auth'
import type { DefectRecord, InspectionType, VehicleListItem } from '@/lib/types'

type VisibleRowsFilter = 'all' | 'withPhotos' | 'withoutPhotos' | 'withDescription' | 'withoutDescription'

function getTypeLabel(type?: string) {
  if (type === 'quick') return 'Быстрый'
  if (type === 'scheduled') return 'Плановый'
  if (type === 'accident') return 'ДТП'
  return type || 'Не указано'
}

export default function DefectsPage() {
  const [defects, setDefects] = useState<DefectRecord[]>([])
  const [vehicles, setVehicles] = useState<VehicleListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [regionFilter, setRegionFilter] = useState('')
  const [visibleRows, setVisibleRows] = useState<VisibleRowsFilter>('all')
  const [quickTypeFilter, setQuickTypeFilter] = useState<InspectionType | ''>('')

  useEffect(() => {
    if (!requireAuthToken()) return
    void loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [defectsRes, vehiclesRes] = await Promise.all([
        api.getDefects({ page: 1, limit: 100 }),
        api.getVehiclesList(),
      ])

      setDefects(defectsRes.data || [])
      setVehicles(vehiclesRes.data || [])
    } finally {
      setLoading(false)
    }
  }

  const uniqueRegions = useMemo(
    () => Array.from(new Set(vehicles.map((vehicle) => vehicle.region).filter((region): region is string => Boolean(region)))).sort(),
    [vehicles],
  )

  const filtered = useMemo(() => {
    let items = [...defects].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    if (regionFilter) {
      items = items.filter((defect) => defect.vehicle_region === regionFilter)
    }

    if (quickTypeFilter) {
      items = items.filter((defect) => defect.inspection_type === quickTypeFilter)
    }

    switch (visibleRows) {
      case 'withPhotos':
        items = items.filter((defect) => (defect.photos?.length || 0) > 0)
        break
      case 'withoutPhotos':
        items = items.filter((defect) => (defect.photos?.length || 0) === 0)
        break
      case 'withDescription':
        items = items.filter((defect) => Boolean(defect.comment))
        break
      case 'withoutDescription':
        items = items.filter((defect) => !defect.comment)
        break
      default:
        break
    }

    return items
  }, [defects, regionFilter, visibleRows, quickTypeFilter])

  return (
    <Layout currentPage="defects">
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Дефекты</h1>
          <button onClick={() => void loadData()} className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            Обновить
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-4">
          <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)} className="rounded-lg border px-3 py-2">
            <option value="">Все регионы</option>
            {uniqueRegions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>

          <select value={visibleRows} onChange={(event) => setVisibleRows(event.target.value as VisibleRowsFilter)} className="rounded-lg border px-3 py-2">
            <option value="all">Все записи</option>
            <option value="withPhotos">Только с фото</option>
            <option value="withoutPhotos">Без фото</option>
            <option value="withDescription">С описанием</option>
            <option value="withoutDescription">Без описания</option>
          </select>

          <select value={quickTypeFilter} onChange={(event) => setQuickTypeFilter(event.target.value)} className="rounded-lg border px-3 py-2">
            <option value="">Все типы осмотра</option>
            <option value="quick">Быстрый</option>
            <option value="scheduled">Плановый</option>
            <option value="accident">ДТП</option>
          </select>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-8 text-slate-500 shadow-sm">Загрузка...</div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Госномер</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Регион</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Техника</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Дефект</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Дата выявления</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Осмотр</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Фото</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        Дефекты не найдены
                      </td>
                    </tr>
                  ) : (
                    filtered.map((defect) => (
                      <tr key={defect.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{defect.vehicle_number}</td>
                        <td className="px-4 py-3 text-slate-600">{defect.vehicle_region ?? '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{defect.vehicle_name}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{defect.title}</div>
                          {defect.comment ? <div className="mt-1 text-sm text-slate-500">{defect.comment}</div> : null}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{new Date(defect.created_at).toLocaleString('ru-RU')}</td>
                        <td className="px-4 py-3 text-slate-600">{getTypeLabel(defect.inspection_type)}</td>
                        <td className="px-4 py-3 text-slate-600">{defect.photos?.length ?? 0}</td>
                        <td className="px-4 py-3">
                          <Link href={`/defects/${defect.id}`} className="text-blue-600 hover:underline">
                            Подробнее
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
