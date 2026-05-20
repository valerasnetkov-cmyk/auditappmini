"use client";

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import NewInspectionModal from '@/components/NewInspectionModal'
import { VehicleRecord } from '@/lib/types'
import api from '@/lib/api/client'

// Page that auto-opens a New Inspection modal when navigated to with a vehicle query param
export default function InspectionsNewPage() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [vehicleFromParam, setVehicleFromParam] = useState<VehicleRecord | null>(null)
  const [vehicles] = useState<VehicleRecord[]>([]) // optional: could fetch list; keep empty to force preselected behaviour

  useEffect(() => {
    const vehParam = typeof window !== 'undefined' ? new URL(window.location.href).searchParams.get('vehicle') : null
    if (!vehParam) return
    // Fetch full vehicle details to prefill modal
    ;(async () => {
      try {
        const res = await api.getVehicle(vehParam)
        if (!res?.error && res?.data) {
          setVehicleFromParam(res.data as VehicleRecord)
        } else {
          setVehicleFromParam({ id: vehParam, number: '', name: '', region: '' } as VehicleRecord)
        }
      } catch {
        setVehicleFromParam({ id: vehParam, number: '', name: '', region: '' } as VehicleRecord)
      } finally {
        setOpen(true)
      }
    })()
  }, [])

  return (
    <Layout currentPage="inspections">
      {/* Auto-opened modal when vehicle param is present */}
      {open && vehicleFromParam ? (
        <NewInspectionModal
          open={true}
          vehicle={vehicleFromParam}
          vehicles={vehicles}
          onClose={() => {
            // Navigate back to vehicle list on close
            router.push('/vehicles')
          }}
        />
      ) : null}
      {!open ? (
        <div className="p-6">Откройте осмотр на странице техники.</div>
      ) : null}
    </Layout>
  )
}
