'use client'

import { FormEvent, useEffect, useState } from 'react'
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
  region: string
}

const initialForm: VehicleFormState = {
  number: '',
  name: '',
  status: 'active',
  region: '',
}

function getVehicleStatusLabel(status: VehicleStatus) {
  if (status === 'repair') return 'Ремонт'
  return 'В работе'
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
      setLoading(true)
      setError('')

      const result = await api.getRegions({ includeEmpty: true })
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const result = await api.createVehicle({
        number: normalizeVehicleNumber(formData.number),
        name: formData.name.trim(),
        status: formData.status,
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

  const normalizedNumber = normalizeVehicleNumber(formData.number)
  const canSubmit = Boolean(normalizedNumber && formData.name.trim()) && !saving

  if (loading) {
    return (
      <Layout currentPage="vehicles">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout currentPage="vehicles">
      <div className="p-6">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link href="/vehicles" className="mb-2 inline-block text-sm text-primary hover:underline">
              Назад к списку техники
            </Link>
            <h1 className="page-title text-2xl">Новая техника</h1>
            <p className="mt-1 max-w-2xl text-sm text-foreground-muted">
              Добавьте транспортное средство, чтобы затем проводить осмотры, фиксировать дефекты и учитывать события ДТП.
            </p>
          </div>
          <Link href="/vehicles" className="btn btn-secondary">
            Отмена
          </Link>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,42rem),minmax(18rem,1fr)]">
          <section className="card p-6">
            {error ? <div className="alert-danger mb-4 rounded-card px-4 py-3 text-sm">{error}</div> : null}

            <form onSubmit={handleSubmit} className="space-y-5">
              <label className="block">
                <span className="label">Госномер</span>
                <input
                  type="text"
                  value={formData.number}
                  onChange={(event) => setFormData({ ...formData, number: normalizeVehicleNumber(event.target.value) })}
                  autoCapitalize="characters"
                  inputMode="text"
                  maxLength={9}
                  spellCheck={false}
                  className="input"
                  placeholder="А123ВС77"
                  required
                />
                <span className="mt-1 block text-sm text-foreground-muted">{VEHICLE_NUMBER_HELP}</span>
                {formData.number ? (
                  <span className="mt-1 block text-sm text-foreground-secondary">
                    Сохранится как: <span className="font-semibold text-primary">{normalizedNumber || 'номер не распознан'}</span>
                  </span>
                ) : null}
              </label>

              <label className="block">
                <span className="label">Название</span>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                  className="input"
                  placeholder="ГАЗель Next"
                  required
                />
              </label>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="label">Статус</span>
                  <select
                    value={formData.status}
                    onChange={(event) => setFormData({ ...formData, status: event.target.value as VehicleStatus })}
                    className="select"
                  >
                    <option value="active">В работе</option>
                    <option value="repair">Ремонт</option>
                  </select>
                </label>

                <label className="block">
                  <span className="label">Регион</span>
                  <select
                    value={formData.region}
                    onChange={(event) => setFormData({ ...formData, region: event.target.value })}
                    className="select"
                  >
                    <option value="">Не выбран</option>
                    {regions.map((region) => (
                      <option key={region.id} value={region.name}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-foreground-muted">
                    Регионы редактируются администратором в настройках, здесь доступен только выбор из списка.
                  </span>
                </label>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button type="submit" disabled={!canSubmit} className="btn btn-primary disabled:opacity-50">
                  {saving ? 'Сохранение...' : 'Создать'}
                </button>
                <Link href="/vehicles" className="btn btn-secondary">
                  Отмена
                </Link>
              </div>
            </form>
          </section>

          <aside className="card h-fit p-6">
            <h2 className="mb-3 text-lg font-semibold text-foreground">Правила заполнения</h2>
            <div className="space-y-4 text-sm text-foreground-secondary">
              <p>
                Для российских госномеров используются только кириллические буквы с латинскими аналогами:
                <span className="mt-2 block font-semibold text-foreground">А, В, Е, К, М, Н, О, Р, С, Т, У, Х</span>
              </p>
              <p>
                Можно вводить латинские аналоги, например <span className="font-semibold text-foreground">A123BC77</span>.
                Перед сохранением номер будет приведен к кириллической форме.
              </p>
              <div className="rounded-card bg-muted-surface p-4">
                <div className="text-foreground-muted">Текущий статус</div>
                <div className="mt-1 font-semibold text-foreground">{getVehicleStatusLabel(formData.status)}</div>
              </div>
              <div className="rounded-card bg-muted-surface p-4">
                <div className="text-foreground-muted">Выбранный регион</div>
                <div className="mt-1 font-semibold text-foreground">{formData.region || 'Не выбран'}</div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  )
}
