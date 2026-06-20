'use client'

import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import api from '@/lib/api/client'
import type { ImportResult, StatusMessage } from '../_lib/settings'

type SetStatus = (status: StatusMessage | null) => void

export function useVehicleImport() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) {
      setImportResult(null)
    }
  }

  const runImport = async (
    setStatus: SetStatus,
    block: { tone: 'info' | 'danger'; text: string } | null,
    onSuccess: () => Promise<void>,
  ) => {
    if (block) {
      setStatus(block)
      return
    }

    const file = fileRef.current?.files?.[0]
    if (!file) {
      setStatus({ tone: 'warning', text: 'Выберите Excel-файл для импорта.' })
      return
    }

    setStatus(null)
    setImportResult(null)
    setImporting(true)

    try {
      const { parseVehiclesExcel } = await import('../_lib/excelParser')
      const vehicles = await parseVehiclesExcel(await file.arrayBuffer())
      if (!vehicles.length) {
        setStatus({
          tone: 'danger',
          text: 'Не удалось распознать данные. Проверьте колонки: номер, название, регион.',
        })
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
        await onSuccess()
      }
    } catch {
      setStatus({ tone: 'danger', text: 'Ошибка при импорте Excel-файла.' })
    } finally {
      setImporting(false)
    }
  }

  return { state: { fileRef, importing, importResult }, actions: { onFileChange, runImport } }
}
