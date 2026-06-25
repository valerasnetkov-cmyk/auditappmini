'use client'

import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Layout from '@/components/Layout'
import CreateCompanyForm from './_components/CreateCompanyForm'
import CreateOwnerForm from './_components/CreateOwnerForm'
import LimitsForm from './_components/LimitsForm'
import CompaniesRegistry from './_components/CompaniesRegistry'
import { useCompaniesList } from './_hooks/useCompaniesList'
import { useCompanyFormState, useLimitFormState, useOwnerFormState } from './_hooks/useCompanyForms'
import {
  useCopySetupLink,
  useCreateCompany,
  useCreateOwner,
  useDeactivateOwner,
  useIssueOwnerSetupLink,
  useSaveLimits,
  useToggleCompanyStatus,
} from './_hooks/useCompanyActions'

export default function ResourceCompaniesPage() {
  const list = useCompaniesList()
  const searchParams = useSearchParams()
  const companyForm = useCompanyFormState()
  const ownerForm = useOwnerFormState(list.companies)
  const limitForm = useLimitFormState(list.companies)

  const handleCreateCompany = useCreateCompany(list)
  const handleCreateOwner = useCreateOwner(list)
  const handleSaveLimits = useSaveLimits(list)
  const handleToggleCompanyStatus = useToggleCompanyStatus(list)
  const handleDeactivateOwner = useDeactivateOwner(list)
  const handleIssueOwnerSetupLink = useIssueOwnerSetupLink(list)
  const handleCopySetupLink = useCopySetupLink(list)
  const setCompanyForm = companyForm.setForm
  const setLimitForm = limitForm.setForm

  const onCreateCompany = useCallback(() => {
    companyForm.reset()
  }, [companyForm])

  const onCreateOwner = useCallback(() => {
    ownerForm.reset()
  }, [ownerForm])

  const onEditLimits = useCallback((form: ReturnType<typeof import('./_lib/companies').companyLimitForm>) => {
    limitForm.setForm(() => form)
  }, [limitForm])

  useEffect(() => {
    if (searchParams.get('create') !== 'company') return
    const companyName = searchParams.get('name') || ''
    const planCode = searchParams.get('plan') || 'pilot'
    setCompanyForm((current) => ({
      ...current,
      name: companyName || current.name,
    }))
    setLimitForm((current) => ({
      ...current,
      planCode,
    }))
  }, [searchParams, setCompanyForm, setLimitForm])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void list.loadStats(searchParams.toString())
    }, 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return (
    <Layout currentPage="resource-companies">
      <div className="resource-admin-page mx-auto max-w-[1600px] space-y-8 px-6 py-6">
        <div className="resource-admin-hero">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Company registry</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">Компании</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-gray-600">
            Реестр компаний, владельцы, тарифные лимиты и статусы без доступа к операционным карточкам tenant-данных.
          </p>
        </div>

        {list.error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{list.error}</div> : null}
        {list.message ? <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{list.message}</div> : null}

        {list.loading ? (
          <div className="rounded-lg border bg-white p-6 text-sm text-gray-600">Загрузка компаний...</div>
        ) : list.stats ? (
          <>
            <div className="grid gap-4 xl:grid-cols-2">
              <CreateCompanyForm
                form={companyForm.form}
                setForm={companyForm.setForm}
                onSubmit={(event) => void handleCreateCompany(event, companyForm.form, onCreateCompany)}
                saving={list.saving}
              />
              <CreateOwnerForm
                form={ownerForm.form}
                setForm={ownerForm.setForm}
                companies={list.companies}
                onSubmit={(event) => void handleCreateOwner(event, ownerForm.form, onCreateOwner)}
                saving={list.saving}
              />
            </div>

            <LimitsForm
              form={limitForm.form}
              setForm={limitForm.setForm}
              companies={list.companies}
              plans={list.plans}
              onSubmit={(event) => void handleSaveLimits(event, limitForm.form)}
              saving={list.saving}
            />

            <CompaniesRegistry
              companies={list.companies}
              ownerSetupLinks={list.ownerSetupLinks}
              saving={list.saving}
              onCopySetupLink={handleCopySetupLink}
              onIssueSetupLink={handleIssueOwnerSetupLink}
              onDeactivateOwner={handleDeactivateOwner}
              onToggleStatus={handleToggleCompanyStatus}
              onEditLimits={onEditLimits}
            />
          </>
        ) : null}
      </div>
    </Layout>
  )
}
