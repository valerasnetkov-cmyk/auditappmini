'use client'

import { FormEvent, useCallback } from 'react'
import api from '@/lib/api/client'
import type { SaasCompanyStats } from '@/lib/types'
import type { CompanyForm, LimitForm, OwnerForm } from '../_lib/companies'

export function useCreateCompany(list: { withSave: (action: () => Promise<boolean>) => Promise<void>; showError: (text: string) => void; showMessage: (text: string) => void }) {
  return useCallback(async (event: FormEvent<HTMLFormElement>, form: CompanyForm, onSuccess: () => void) => {
    event.preventDefault()
    await list.withSave(async () => {
      const result = await api.createResourceCompany({
        id: form.id || undefined,
        slug: form.slug || '',
        name: form.name,
        trialDays: form.trialDays,
        limits: {
          planCode: 'pilot',
        },
      })
      if (result.data) {
        onSuccess()
        list.showMessage('Компания создана')
        return true
      }
      list.showError(result.error || 'Не удалось создать компанию')
      return false
    })
  }, [list])
}

export function useCreateOwner(list: { withSave: (action: () => Promise<boolean>) => Promise<void>; showError: (text: string) => void; showMessage: (text: string) => void; setSetupLink: (ownerId: string, url: string) => void }) {
  return useCallback(async (event: FormEvent<HTMLFormElement>, form: OwnerForm, onSuccess: () => void) => {
    event.preventDefault()
    await list.withSave(async () => {
      const result = await api.createResourceOwner(form.companyId, {
        email: form.email,
        name: form.name,
        issue_setup_link: true,
      })
      if (result.data) {
        const owner = result.data
        onSuccess()
        if (owner.setup?.setup_url) {
          list.setSetupLink(owner.id, owner.setup.setup_url)
          list.showMessage('Владелец создан. Ссылка активации готова для копирования.')
        } else {
          list.showMessage('Владелец создан')
        }
        return true
      }
      list.showError(result.error || 'Не удалось создать владельца')
      return false
    })
  }, [list])
}

export function useSaveLimits(list: { withSave: (action: () => Promise<boolean>) => Promise<void>; showError: (text: string) => void; showMessage: (text: string) => void }) {
  return useCallback(async (event: FormEvent<HTMLFormElement>, form: LimitForm) => {
    event.preventDefault()
    await list.withSave(async () => {
      const result = await api.updateResourceCompanyLimits(form.companyId, {
        planCode: form.planCode,
        maxVehicles: form.maxVehicles ?? null,
        maxUsers: form.maxUsers ?? null,
        maxStorageMb: form.maxStorageMb ?? null,
        ocrEnabled: Boolean(form.ocrEnabled),
        accidentModuleEnabled: Boolean(form.accidentModuleEnabled),
        analyticsEnabled: Boolean(form.analyticsEnabled),
        pdfReportEnabled: Boolean(form.pdfReportEnabled),
        apiAccessEnabled: Boolean(form.apiAccessEnabled),
      })
      if (result.data) {
        list.showMessage('Лимиты компании обновлены')
        return true
      }
      list.showError(result.error || 'Не удалось обновить лимиты')
      return false
    })
  }, [list])
}

export function useToggleCompanyStatus(list: { withSave: (action: () => Promise<boolean>) => Promise<void>; showError: (text: string) => void; showMessage: (text: string) => void }) {
  return useCallback(async (company: SaasCompanyStats) => {
    await list.withSave(async () => {
      const result = await api.updateResourceCompany(company.id, {
        slug: company.slug,
        name: company.name,
        region_code: company.region_code || undefined,
        data_residency: company.data_residency || undefined,
        status: company.status === 'inactive' ? 'active' : 'inactive',
      })
      if (result.data) {
        list.showMessage(company.status === 'inactive' ? 'Компания активирована' : 'Компания отключена')
        return true
      }
      list.showError(result.error || 'Не удалось изменить статус компании')
      return false
    })
  }, [list])
}

export function useDeactivateOwner(list: { withSave: (action: () => Promise<boolean>) => Promise<void>; showError: (text: string) => void; showMessage: (text: string) => void }) {
  return useCallback(async (ownerId: string) => {
    await list.withSave(async () => {
      const result = await api.deleteResourceOwner(ownerId)
      if (!result.error) {
        list.showMessage('Владелец отключен')
        return true
      }
      list.showError(result.error)
      return false
    })
  }, [list])
}

export function useIssueOwnerSetupLink(list: { withSave: (action: () => Promise<boolean>) => Promise<void>; showError: (text: string) => void; showMessage: (text: string) => void; setSetupLink: (ownerId: string, url: string) => void }) {
  return useCallback(async (ownerId: string) => {
    await list.withSave(async () => {
      const result = await api.issueResourceOwnerSetupLink(ownerId)
      const url = result.data?.setup?.setup_url
      if (url) {
        list.setSetupLink(ownerId, url)
        list.showMessage('Новая setup-ссылка создана. Скопируйте её и передайте владельцу.')
        return true
      }
      list.showError(result.error || 'Не удалось создать setup-ссылку')
      return false
    })
  }, [list])
}

export function useCopySetupLink(list: { showError: (text: string) => void; showMessage: (text: string) => void }) {
  return useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      list.showMessage('Setup-ссылка скопирована в буфер обмена')
    } catch {
      list.showError('Не удалось скопировать ссылку. Выделите и скопируйте её вручную.')
    }
  }, [list])
}
