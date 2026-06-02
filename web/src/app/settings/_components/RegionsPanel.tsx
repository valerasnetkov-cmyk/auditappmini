'use client'

import type { FormEvent } from 'react'
import type { RegionRecord } from '@/lib/types'
import { getRegionVehicleCount } from '../_lib/settings'

export function RegionsPanel({
  regions,
  newRegion,
  editingRegionId,
  editingRegionName,
  savingRegionId,
  deletingRegionId,
  writeBlocked,
  onChangeNewRegion,
  onChangeEditingName,
  onAddRegion,
  onStartEdit,
  onCancelEdit,
  onSaveRegion,
  onDeleteRegion,
}: {
  regions: RegionRecord[]
  newRegion: string
  editingRegionId: string | null
  editingRegionName: string
  savingRegionId: string | null
  deletingRegionId: string | null
  writeBlocked: boolean
  onChangeNewRegion: (value: string) => void
  onChangeEditingName: (value: string) => void
  onAddRegion: (event: FormEvent) => void
  onStartEdit: (region: RegionRecord) => void
  onCancelEdit: () => void
  onSaveRegion: (region: RegionRecord) => void
  onDeleteRegion: (region: RegionRecord) => void
}) {
  return (
    <div className="card mb-4 p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">Регионы техники</h2>
        <p className="mt-1 text-sm text-foreground-secondary">
          Ниже показаны только регионы, у которых сейчас есть техника. Новые регионы добавляются в справочник и становятся доступны в выпадающих списках карточек техники.
        </p>
      </div>

      <form onSubmit={onAddRegion} className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={newRegion}
          onChange={(event) => onChangeNewRegion(event.target.value)}
          placeholder="Название региона"
          disabled={writeBlocked}
          className="input flex-1"
        />
        <button
          type="submit"
          disabled={!newRegion.trim() || writeBlocked}
          className="btn btn-success whitespace-nowrap disabled:opacity-50"
        >
          Добавить
        </button>
      </form>

      <div className="space-y-2">
        {regions.length ? (
          regions.map((region) => {
            const isEditing = editingRegionId === region.id
            const vehicleCount = getRegionVehicleCount(region)

            return (
              <div key={region.id} className="rounded-card border border-line bg-muted-surface p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <input
                        value={editingRegionName}
                        onChange={(event) => onChangeEditingName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            onSaveRegion(region)
                          }

                          if (event.key === 'Escape') {
                            onCancelEdit()
                          }
                        }}
                        className="input"
                        disabled={writeBlocked}
                        autoFocus
                      />
                    ) : (
                      <>
                        <div className="font-semibold text-foreground">{region.name}</div>
                        <div className="mt-1 text-sm text-foreground-muted">Техники в регионе: {vehicleCount}</div>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onSaveRegion(region)}
                          disabled={savingRegionId === region.id || writeBlocked}
                          className="btn btn-primary btn-sm disabled:opacity-50"
                        >
                          {savingRegionId === region.id ? 'Сохранение...' : 'Сохранить'}
                        </button>
                        <button type="button" onClick={onCancelEdit} className="btn btn-secondary btn-sm">
                          Отмена
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onStartEdit(region)}
                          disabled={writeBlocked}
                          className="btn btn-secondary btn-sm disabled:opacity-50"
                        >
                          Редактировать
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteRegion(region)}
                          disabled={deletingRegionId === region.id || writeBlocked}
                          className="btn btn-danger btn-sm disabled:opacity-50"
                        >
                          {deletingRegionId === region.id ? 'Удаление...' : 'Удалить'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-card border border-dashed border-line-strong bg-muted-surface p-5 text-center text-sm text-foreground-muted">
            Пока нет регионов с привязанной техникой.
          </div>
        )}
      </div>
    </div>
  )
}
