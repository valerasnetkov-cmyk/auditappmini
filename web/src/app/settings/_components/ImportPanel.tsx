'use client'

import type { RefObject } from 'react'
import type { ChangeEvent } from 'react'
import type { ImportResult } from '../_lib/settings'

export function ImportPanel({
  fileRef,
  importing,
  importResult,
  createBlocked,
  companyUsageLoading,
  onFileChange,
  onImport,
}: {
  fileRef: RefObject<HTMLInputElement>
  importing: boolean
  importResult: ImportResult | null
  createBlocked: boolean
  companyUsageLoading: boolean
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onImport: () => void
}) {
  return (
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
          onChange={onFileChange}
          disabled={companyUsageLoading || createBlocked}
          className="block w-full text-sm text-foreground-muted file:mr-4 file:rounded-pill file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
        />
        <button
          onClick={onImport}
          disabled={importing || companyUsageLoading || createBlocked}
          className="btn btn-primary whitespace-nowrap disabled:opacity-50"
        >
          {companyUsageLoading ? 'Проверка...' : importing ? 'Импорт...' : 'Импортировать'}
        </button>
      </div>

      {createBlocked ? (
        <div className="alert-danger mt-4 rounded-card px-4 py-3 text-sm">
          {createBlocked ? 'Лимит тарифа исчерпан или подписка приостановлена. Импорт техники недоступен.' : ''}
        </div>
      ) : null}

      {importResult ? (
        <div className="alert-success mt-4 rounded-card p-4">
          <p className="font-medium">Импортировано: {importResult.imported}</p>
          {importResult.regionsAdded ? (
            <p className="mt-1 text-sm">Новых регионов добавлено: {importResult.regionsAdded}</p>
          ) : null}
          {importResult.errors.length ? (
            <div className="mt-3 text-sm">
              <p className="font-medium text-status-danger">Ошибок: {importResult.errors.length}</p>
              <ul className="mt-1 space-y-1">
                {importResult.errors.slice(0, 5).map((item) => (
                  <li key={`${item.row}-${item.error}`}>
                    Строка {item.row}: {item.error}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
