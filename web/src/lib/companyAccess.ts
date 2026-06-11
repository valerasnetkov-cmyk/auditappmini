import type { CompanyUsageResponse } from '@/lib/types'

export type CompanyOperationMode = 'create' | 'write'

export type CompanyOperationRestriction = {
  status: string
  title: string
  message: string
}

export function getCompanyOperationRestriction(
  usage: CompanyUsageResponse | null,
  mode: CompanyOperationMode = 'write',
): CompanyOperationRestriction | null {
  if (!usage) return null

  if (usage.company.access_mode === 'demo_readonly') {
    return {
      status: 'demo_readonly',
      title: 'Демо-режим',
      message: 'Изменение данных ограничено. Запросите пилот, чтобы протестировать сервис на своём автопарке.',
    }
  }

  if (usage.company.status === 'inactive') {
    return {
      status: 'inactive',
      title: 'Компания отключена',
      message: 'Операционные действия временно недоступны. История остается доступной для просмотра.',
    }
  }

  const status = usage.subscription?.status

  if (status === 'suspended') {
    return {
      status,
      title: 'Подписка приостановлена',
      message: 'Операционный контур переведен в режим чтения до продления подписки.',
    }
  }

  if (status === 'expired' && mode === 'create') {
    return {
      status,
      title: 'Тариф истек',
      message: 'Создание новых записей, импорт, загрузка фото и OCR временно недоступны до продления тарифа.',
    }
  }

  return null
}
