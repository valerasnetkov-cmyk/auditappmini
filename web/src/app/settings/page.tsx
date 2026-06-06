'use client'

import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import LocaleSwitcher from '@/components/LocaleSwitcher'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import api from '@/lib/api/client'
import { hasAuthSession, isManagerRole } from '@/lib/auth'
import { useCompanyUsagePanel } from './_hooks/useCompanyUsagePanel'
import { useRegions } from './_hooks/useRegions'
import { useServiceRecipients } from './_hooks/useServiceRecipients'
import { useVehicleImport } from './_hooks/useVehicleImport'
import { CompanyUsagePanel } from './_components/CompanyUsagePanel'
import { ImportPanel } from './_components/ImportPanel'
import { RegionsPanel } from './_components/RegionsPanel'
import { ServiceNotificationRecipientsPanel } from './_components/ServiceNotificationRecipientsPanel'
import {
  buildWriteBlockedMessage,
  pickRestriction,
  type StatusMessage,
} from './_lib/settings'

export default function SettingsPage() {
  const router = useRouter()
  const [status, setStatus] = useState<StatusMessage | null>(null)
  const [loading, setLoading] = useState(true)
  const [isManager, setIsManager] = useState(false)
  const [currentRole, setCurrentRole] = useState('')

  const companyUsage = useCompanyUsagePanel()
  const regions = useRegions()
  const serviceRecipients = useServiceRecipients()
  const vehicleImport = useVehicleImport()

  const createRestriction = pickRestriction(companyUsage.usage, 'create')
  const writeRestriction = pickRestriction(companyUsage.usage, 'write')
  const writeBlockedMessage = buildWriteBlockedMessage(
    companyUsage.usage,
    companyUsage.loading,
    writeRestriction,
  )
  const writeBlockedInfo: { tone: 'info' | 'danger'; text: string } | null = writeBlockedMessage
    ? { tone: companyUsage.loading ? 'info' : 'danger', text: writeBlockedMessage } : null

  const regionsActionsRef = useRef(regions.actions)
  const serviceRecipientsActionsRef = useRef(serviceRecipients.actions)
  const companyUsageLoadRef = useRef(companyUsage.load)

  useEffect(() => {
    regionsActionsRef.current = regions.actions
    serviceRecipientsActionsRef.current = serviceRecipients.actions
    companyUsageLoadRef.current = companyUsage.load
  })

  useEffect(() => {
    if (!hasAuthSession()) {
      router.push('/login')
      return
    }

    let cancelled = false

    const loadAccess = async () => {
      const result = await api.getMe()
      if (cancelled) return

      const role = result.data?.role || ''
      const managerRole = isManagerRole(role)
      setCurrentRole(role)
      setIsManager(managerRole)

      setLoading(false)
      if (managerRole) {
        void Promise.all([regionsActionsRef.current.load(setStatus), companyUsageLoadRef.current(setStatus)])
      }
      if (role === 'owner') {
        void serviceRecipientsActionsRef.current.load(setStatus)
      }
    }

    void loadAccess()

    return () => {
      cancelled = true
    }
  }, [router])

  const onImport = () =>
    vehicleImport.actions.runImport(
      setStatus,
      companyUsage.loading
        ? { tone: 'info', text: 'Проверяем статус тарифа компании. Повторите импорт через несколько секунд.' }
        : createRestriction
          ? { tone: 'danger', text: `${createRestriction.title}: ${createRestriction.message}` }
          : null,
      async () => {
        await Promise.all([regions.actions.load(setStatus), companyUsage.load(setStatus)])
      },
    )

  const onAddRegion = (event: FormEvent) => {
    event.preventDefault()
    void regions.actions.addRegion(setStatus, () => writeBlockedInfo)
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
          <div className={`mb-4 rounded-card px-4 py-3 text-sm alert-${status.tone}`}>{status.text}</div>
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
          <CompanyUsagePanel
            usage={companyUsage.usage}
            loading={companyUsage.loading}
            onRefresh={() => void companyUsage.load(setStatus)}
          />
        ) : null}

        {currentRole === 'owner' ? (
          <ServiceNotificationRecipientsPanel
            recipients={serviceRecipients.state.recipients} loading={serviceRecipients.state.loading}
            saving={serviceRecipients.state.saving} disabled={Boolean(writeBlockedMessage)}
            disabledMessage={writeBlockedMessage}
            onToggle={(id, enabled) => {
              void serviceRecipients.actions.toggle(id, enabled, setStatus, writeBlockedInfo)
            }}
          />
        ) : null}

        {isManager ? (
          <ImportPanel fileRef={vehicleImport.state.fileRef} importing={vehicleImport.state.importing}
            importResult={vehicleImport.state.importResult} createBlocked={Boolean(createRestriction)}
            companyUsageLoading={companyUsage.loading} onFileChange={vehicleImport.actions.onFileChange}
            onImport={onImport} />
        ) : null}

        {isManager ? (
          <RegionsPanel
            regions={regions.state.regions}
            newRegion={regions.state.newRegion}
            editingRegionId={regions.state.editingRegionId}
            editingRegionName={regions.state.editingRegionName}
            savingRegionId={regions.state.savingRegionId}
            deletingRegionId={regions.state.deletingRegionId}
            writeBlocked={Boolean(writeBlockedMessage)}
            onChangeNewRegion={regions.actions.setNewRegion}
            onChangeEditingName={regions.actions.setEditingRegionName}
            onAddRegion={onAddRegion}
            onStartEdit={(region) => regions.actions.startEdit(region, setStatus, writeBlockedInfo)}
            onCancelEdit={regions.actions.cancelEdit}
            onSaveRegion={(region) => {
              void regions.actions.saveRegion(region, setStatus, writeBlockedInfo)
            }}
            onDeleteRegion={(region) => {
              void regions.actions.deleteRegion(region, setStatus, writeBlockedInfo)
            }}
          />
        ) : null}

        <div className="card p-4">
          <h2 className="mb-4 text-lg font-semibold text-foreground">О системе</h2>
          <p className="text-foreground-secondary">Аудит Техники v0.1.0 · система независимой фотофиксации состояния техники</p>
        </div>
      </div>
    </Layout>
  )
}
