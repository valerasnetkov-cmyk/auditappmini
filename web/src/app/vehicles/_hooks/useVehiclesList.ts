'use client'

import { useEffect, useMemo, useState } from 'react'
import api from '@/lib/api/client'
import { requireAuthToken } from '@/lib/auth'
import type { RegionRecord, VehicleRecord } from '@/lib/types'
import { ITEMS_PER_BATCH, type SortConfig, type SortableVehicleKey } from '../_lib/vehicles'

type LoadArgs = {
  searchQuery: string
  statusFilter: string
  inspectionStatusFilter: string
}

type Setters = {
  setVehicles: (value: VehicleRecord[]) => void
  setRegions: (value: RegionRecord[]) => void
  setLoading: (value: boolean) => void
  setError: (value: string) => void
  setTotalCount: (value: number) => void
}

async function loadData(args: LoadArgs, setters: Setters) {
  try {
    setters.setLoading(true)
    setters.setError('')

    const [vehiclesRes, regionsRes] = await Promise.all([
      api.getVehicles({
        page: 1,
        limit: 100,
        search: args.searchQuery,
        status: args.statusFilter || undefined,
        inspectionStatus: args.inspectionStatusFilter || undefined,
      }),
      api.getRegions(),
    ])

    if (vehiclesRes.error) {
      setters.setError(vehiclesRes.error)
      return
    }

    if (regionsRes.error) {
      setters.setError(regionsRes.error)
      return
    }

    setters.setVehicles(vehiclesRes.data || [])
    setters.setRegions(regionsRes.data || [])
    setters.setTotalCount(vehiclesRes.pagination?.total || vehiclesRes.data?.length || 0)
  } catch {
    setters.setError('Не удалось загрузить список техники')
  } finally {
    setters.setLoading(false)
  }
}

function sortVehicles(
  vehicles: VehicleRecord[],
  sortConfig: SortConfig,
  regionFilter: string,
): VehicleRecord[] {
  const filtered = regionFilter ? vehicles.filter((vehicle) => vehicle.region === regionFilter) : vehicles

  return [...filtered].sort((left, right) => {
    let leftValue: string | number = sortConfig.key === 'inspectionSchedule'
      ? left.inspection_schedule?.status || ''
      : left[sortConfig.key] ?? ''
    let rightValue: string | number = sortConfig.key === 'inspectionSchedule'
      ? right.inspection_schedule?.status || ''
      : right[sortConfig.key] ?? ''

    if (typeof leftValue === 'string') leftValue = leftValue.toLowerCase()
    if (typeof rightValue === 'string') rightValue = rightValue.toLowerCase()

    if (leftValue < rightValue) return sortConfig.direction === 'asc' ? -1 : 1
    if (leftValue > rightValue) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })
}

export function useVehiclesList() {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([])
  const [regions, setRegions] = useState<RegionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [inspectionStatusFilter, setInspectionStatusFilter] = useState('')
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_BATCH)
  const [totalCount, setTotalCount] = useState(0)
  const [error, setError] = useState('')
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'number', direction: 'asc' })

  const reload = () =>
    loadData({ searchQuery, statusFilter, inspectionStatusFilter }, {
      setVehicles, setRegions, setLoading, setError, setTotalCount,
    })

  useEffect(() => {
    if (!requireAuthToken()) return
    void loadData({ searchQuery, statusFilter, inspectionStatusFilter }, {
      setVehicles, setRegions, setLoading, setError, setTotalCount,
    })
  }, [searchQuery, statusFilter, inspectionStatusFilter])

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setVisibleCount(ITEMS_PER_BATCH)
  }

  const handleStatusChange = (value: string) => {
    setStatusFilter(value)
    setVisibleCount(ITEMS_PER_BATCH)
  }

  const handleRegionChange = (value: string) => {
    setRegionFilter(value)
    setVisibleCount(ITEMS_PER_BATCH)
  }

  const handleInspectionStatusChange = (value: string) => {
    setInspectionStatusFilter(value)
    setVisibleCount(ITEMS_PER_BATCH)
  }

  const handleSort = (key: SortableVehicleKey) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const sortedVehicles = useMemo(
    () => sortVehicles(vehicles, sortConfig, regionFilter),
    [vehicles, sortConfig, regionFilter],
  )

  const visibleVehicles = sortedVehicles.slice(0, visibleCount)
  const hasMoreVehicles = visibleCount < sortedVehicles.length

  const loadMore = () => {
    setVisibleCount((value) => Math.min(value + ITEMS_PER_BATCH, sortedVehicles.length))
  }

  return {
    state: {
      vehicles,
      regions,
      loading,
      searchQuery,
      statusFilter,
      regionFilter,
      inspectionStatusFilter,
      totalCount,
      error,
      sortConfig,
      visibleVehicles,
      hasMoreVehicles,
    },
    actions: {
      setError,
      setSearchQuery: handleSearchChange,
      setStatusFilter: handleStatusChange,
      setRegionFilter: handleRegionChange,
      setInspectionStatusFilter: handleInspectionStatusChange,
      handleSort,
      loadMore,
      reload,
    },
  }
}
