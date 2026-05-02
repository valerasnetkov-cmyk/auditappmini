'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import api from '@/lib/api/client'
import { requireAuthToken } from '@/lib/auth'
import { normalizeVehicleNumber, VEHICLE_NUMBER_HELP } from '@/lib/vehicleNumber'
import type { RegionRecord, VehicleStatus } from '@/lib/types'

type VehicleFormState = {
  number: string
  name: string
  status: VehicleStatus
  qr_code: string
  region: string
}

const initialForm: VehicleFormState = {
  number: '',
  name: '',
  status: 'active',
  qr_code: '',
  region: '',
}

export default function NewVehiclePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [regions, setRegions] = useState<RegionRecord[]>([])
  const [formData, setFormData] = useState<VehicleFormState>(initialForm)

  useEffect(() => {
    if (!requireAuthToken()) return
    void loadRegions()
  }, [])

  const loadRegions = async () => {
    try {
      const result = await api.getRegions()
      if (result.error) {
        setError(result.error)
        return
      }

      setRegions(result.data || [])
    } catch {
      setError('Не удалось загрузить список регионов')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const result = await api.createVehicle({
        number: normalizeVehicleNumber(formData.number),
        name: formData.name.trim(),
        status: formData.status,
        qr_code: formData.qr_code.trim() || undefined,
        region: formData.region || undefined,
      })

      if (result.error) {
        setError(result.error)
        return
      }

      router.push('/vehicles')
    } catch {
      setError('Не удалось сохранить технику')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <Layout currentPage="vehicles">
      <div className="p-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Новая техника</h1>
            <p className="mt-1 text-sm text-slate-500">
              Добавьте транспортное средство, чтобы затем проводить осмотры и учитывать дефекты.
            </p>
          </div>
          <Link href="/vehicles" className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Назад к списку
          </Link>
        </div>

        <div className="max-w-2xl rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Госномер</label>
              <input
                type="text"
                value={formData.number}
                onChange={(event) => setFormData({ ...formData, number: normalizeVehicleNumber(event.target.value) })}
                autoCapitalize="characters"
                inputMode="text"
                maxLength={9}
                spellCheck={false}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder="А123ВС77"
                required
              />
              <p className="mt-1 text-sm text-slate-500">{VEHICLE_NUMBER_HELP}</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Название</label>
              <input
                type="text"
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder="ГАЗель Next"
                required
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Статус</label>
                <select
                  value={formData.status}
                  onChange={(event) => setFormData({ ...formData, status: event.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                >
                  <option value="active">В работе</option>
                  <option value="repair">Ремонт</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Регион</label>
                <select
                  value={formData.region}
                  onChange={(event) => setFormData({ ...formData, region: event.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                >
                  <option value="">Не выбран</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.name}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">QR-код</label>
              <input
                type="text"
                value={formData.qr_code}
                onChange={(event) => setFormData({ ...formData, qr_code: event.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                placeholder="Внутренний код или тег"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Сохранение...' : 'Создать'}
              </button>
              <Link href="/vehicles" className="rounded-lg border border-slate-200 px-6 py-2 text-slate-700 hover:bg-slate-50">
                Отмена
              </Link>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  )
}
