'use client'

import { FormEvent } from 'react'
import { useParams } from 'next/navigation'
import api from '@/lib/api/client'
import Layout from '@/components/Layout'
import AlertsList from './_components/AlertsList'
import AuditLogs from './_components/AuditLogs'
import CompanyHeader, { CompanyMetrics } from './_components/CompanyHeader'
import CompanyEditForm from './_components/CompanyEditForm'
import LimitsForm from './_components/LimitsForm'
import OwnersSection from './_components/OwnersSection'
import PaymentsList from './_components/PaymentsList'
import BillingDetailsForm from './_components/BillingDetailsForm'
import CompanyPhotosPanel from './_components/CompanyPhotosPanel'
import { useCompanyDetails } from './_hooks/useCompanyDetails'
import type { ResourceCompanyPhoto } from '@/lib/types'

export default function ResourceCompanyDetailsPage() {
  const params = useParams<{ id: string }>()
  const companyId = decodeURIComponent(params.id)
  const details = useCompanyDetails(companyId)

  const handleCompanySave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!details.companyForm) return
    void details.withSave(async () => {
      const result = await api.updateResourceCompany(companyId, details.companyForm!)
      if (result.data) {
        details.showMessage('Карточка компании обновлена')
        return true
      }
      details.showError(result.error || 'Не удалось обновить компанию')
      return false
    })
  }

  const handleLimitsSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void details.withSave(async () => {
      const result = await api.updateResourceCompanyLimits(companyId, {
        ...details.limitForm,
        ocrEnabled: Boolean(details.limitForm.ocrEnabled),
        accidentModuleEnabled: Boolean(details.limitForm.accidentModuleEnabled),
        analyticsEnabled: Boolean(details.limitForm.analyticsEnabled),
        pdfReportEnabled: Boolean(details.limitForm.pdfReportEnabled),
        apiAccessEnabled: Boolean(details.limitForm.apiAccessEnabled),
      })
      if (result.data) {
        details.showMessage('Тариф и лимиты обновлены')
        return true
      }
      details.showError(result.error || 'Не удалось обновить лимиты')
      return false
    })
  }

  const handleOwnerCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void details.withSave(async () => {
      const result = await api.createResourceOwner(companyId, {
        ...details.ownerForm,
        issue_setup_link: true,
      })
      if (result.data) {
        const owner = result.data
        details.setOwnerForm({ email: '', name: '' })
        if (owner.setup?.setup_url) {
          details.setSetupLink(owner.id, owner.setup.setup_url)
          details.showMessage('Владелец создан. Ссылка активации готова для копирования.')
        } else {
          details.showMessage('Владелец создан')
        }
        return true
      }
      details.showError(result.error || 'Не удалось создать владельца')
      return false
    })
  }

  const handleOwnerDeactivate = (ownerId: string) => {
    void details.withSave(async () => {
      const result = await api.deleteResourceOwner(ownerId)
      if (!result.error) {
        details.showMessage('Владелец отключен')
        return true
      }
      details.showError(result.error)
      return false
    })
  }

  const handleIssueOwnerSetupLink = (ownerId: string) => {
    void details.withSave(async () => {
      const result = await api.issueResourceOwnerSetupLink(ownerId)
      const url = result.data?.setup?.setup_url
      if (url) {
        details.setSetupLink(ownerId, url)
        details.showMessage('Новая setup-ссылка создана. Скопируйте её и передайте владельцу.')
        return true
      }
      details.showError(result.error || 'Не удалось создать setup-ссылку')
      return false
    })
  }

  const handleCopySetupLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      details.showMessage('Setup-ссылка скопирована в буфер обмена')
    } catch {
      details.showError('Не удалось скопировать ссылку. Выделите и скопируйте её вручную.')
    }
  }

  const handlePhotoUpdated = (photo: ResourceCompanyPhoto) => {
    details.setData((current) => {
      if (!current) return current
      return {
        ...current,
        recentPhotos: (current.recentPhotos || []).map((item) => (item.id === photo.id ? { ...item, ...photo } : item)),
      }
    })
  }

  const company = details.data?.company
  const subscriptionStatus = details.data?.subscription?.status || company?.status || 'active'

  return (
    <Layout currentPage="resource-companies">
      <div className="resource-admin-page mx-auto max-w-[1500px] space-y-8 px-6 py-6">
        <CompanyHeader data={details.data} subscriptionStatus={subscriptionStatus} />

        {details.error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{details.error}</div> : null}
        {details.message ? <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{details.message}</div> : null}

        {details.loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">Загрузка карточки компании...</div>
        ) : details.data && company && details.companyForm ? (
          <>
            <CompanyMetrics data={details.data} />

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <CompanyEditForm
                form={details.companyForm}
                setForm={details.setCompanyForm}
                onSubmit={handleCompanySave}
                saving={details.saving}
              />
              <OwnersSection
                owners={details.data.owners}
                ownerForm={details.ownerForm}
                setOwnerForm={details.setOwnerForm}
                ownerSetupLinks={details.ownerSetupLinks}
                saving={details.saving}
                onCreateOwner={handleOwnerCreate}
                onDeactivateOwner={handleOwnerDeactivate}
                onIssueSetupLink={handleIssueOwnerSetupLink}
                onCopySetupLink={handleCopySetupLink}
              />
            </div>

            <LimitsForm
              form={details.limitForm}
              setForm={details.setLimitForm}
              plans={details.data.plans}
              onSubmit={handleLimitsSave}
              saving={details.saving}
            />

            <BillingDetailsForm companyId={companyId} />

            <CompanyPhotosPanel
              companyId={companyId}
              photos={details.data.recentPhotos || []}
              onPhotoUpdated={handlePhotoUpdated}
            />

            <div className="grid gap-4 xl:grid-cols-2">
              <PaymentsList payments={details.data.payments} />
              <AlertsList alerts={details.data.alerts} />
            </div>

            <AuditLogs logs={details.data.auditLogs} />
          </>
        ) : null}
      </div>
    </Layout>
  )
}
