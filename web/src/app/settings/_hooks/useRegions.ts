'use client'

import { useCallback, useState } from 'react'
import api from '@/lib/api/client'
import type { RegionRecord } from '@/lib/types'
import { getRegionVehicleCount, type StatusMessage } from '../_lib/settings'

type SetStatus = (status: StatusMessage | null) => void
type BlockInfo = { tone: 'info' | 'danger'; text: string } | null
type GetBlock = () => BlockInfo

export function useRegions() {
  const [regions, setRegions] = useState<RegionRecord[]>([])
  const [newRegion, setNewRegion] = useState('')
  const [editingRegionId, setEditingRegionId] = useState<string | null>(null)
  const [editingRegionName, setEditingRegionName] = useState('')
  const [savingRegionId, setSavingRegionId] = useState<string | null>(null)
  const [deletingRegionId, setDeletingRegionId] = useState<string | null>(null)

  const load = useCallback(async (setStatus: SetStatus) => {
    const result = await api.getRegions()
    if (result.error) {
      setStatus({ tone: 'danger', text: result.error })
      return
    }
    setRegions((result.data || []).filter((region) => getRegionVehicleCount(region) > 0))
  }, [])

  const addRegion = useCallback(
    async (setStatus: SetStatus, getBlock: GetBlock) => {
      const name = newRegion.trim()
      if (!name) return
      const block = getBlock()
      if (block) {
        setStatus(block)
        return
      }
      setStatus(null)
      const result = await api.createRegion({ name })
      if (result.error) {
        setStatus({ tone: 'danger', text: result.error })
        return
      }
      setNewRegion('')
      setStatus({
        tone: 'info',
        text: 'Регион добавлен в справочник. В списке ниже он появится после привязки хотя бы одной машины.',
      })
      await load(setStatus)
    },
    [newRegion, load],
  )

  const startEdit = useCallback(
    (region: RegionRecord, setStatus: SetStatus, block: { tone: 'info' | 'danger'; text: string } | null) => {
      if (block) {
        setStatus(block)
        return
      }
      setEditingRegionId(region.id)
      setEditingRegionName(region.name)
      setStatus(null)
    },
    [],
  )

  const cancelEdit = useCallback(() => {
    setEditingRegionId(null)
    setEditingRegionName('')
  }, [])

  const saveRegion = useCallback(
    async (region: RegionRecord, setStatus: SetStatus, block: { tone: 'info' | 'danger'; text: string } | null) => {
      const name = editingRegionName.trim()
      if (!name || name === region.name) {
        cancelEdit()
        return
      }
      if (block) {
        setStatus(block)
        return
      }
      setSavingRegionId(region.id)
      setStatus(null)
      try {
        const result = await api.updateRegion(region.id, name, region.name)
        if (result.error) {
          setStatus({ tone: 'danger', text: result.error })
          return
        }
        cancelEdit()
        setStatus({
          tone: 'success',
          text:
            result.data?.merged_from && result.data?.merged_into
              ? `Регион "${result.data.merged_from}" объединен с "${result.data.merged_into}". Вся связанная техника перенесена.`
              : 'Регион обновлен. Название региона у связанной техники также изменено.',
        })
        await load(setStatus)
      } finally {
        setSavingRegionId(null)
      }
    },
    [editingRegionName, load, cancelEdit],
  )

  const deleteRegion = useCallback(
    async (region: RegionRecord, setStatus: SetStatus, block: { tone: 'info' | 'danger'; text: string } | null) => {
      if (block) {
        setStatus(block)
        return
      }
      const count = getRegionVehicleCount(region)
      const confirmed = window.confirm(
        `Удалить регион "${region.name}"? У ${count} машин регион будет очищен, сами карточки техники не удалятся.`,
      )
      if (!confirmed) return

      setDeletingRegionId(region.id)
      setStatus(null)
      try {
        const result = await api.deleteRegion(region.id)
        if (result.error) {
          setStatus({ tone: 'danger', text: result.error })
          return
        }
        setStatus({ tone: 'success', text: 'Регион удален, техника отвязана от него.' })
        await load(setStatus)
      } finally {
        setDeletingRegionId(null)
      }
    },
    [load],
  )

  return {
    state: {
      regions,
      newRegion,
      editingRegionId,
      editingRegionName,
      savingRegionId,
      deletingRegionId,
    },
    actions: {
      setNewRegion,
      setEditingRegionName,
      load,
      addRegion,
      startEdit,
      cancelEdit,
      saveRegion,
      deleteRegion,
    },
  }
}
