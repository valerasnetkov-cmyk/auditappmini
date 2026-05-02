#!/usr/bin/env node
// End-to-end tests for complete-inspection flow
(async () => {
  const api = 'http://localhost:3001/api'
  const fetch = global.fetch
  if (!fetch) {
    console.error('Global fetch not available in this Node version')
    process.exit(1)
  }

  try {
    // 1) Register a new inspector
    const email = 'complete-test-inspector@example.com'
    const regRes = await fetch(`${api}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Secret123!', name: 'Complete Inspector' })
    })
    if (!regRes.ok) {
      const err = await regRes.text()
      console.error('Register failed', regRes.status, err)
      process.exit(2)
    }
    const regData = await regRes.json()
    const token = regData?.token
    if (!token) {
      console.error('No token returned on registration')
      process.exit(3)
    }

    // 2) Create a vehicle
    const vehicleRes = await fetch(`${api}/vehicles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ number: 'Т777ТО77', name: 'Test Vehicle' })
    })
    if (!vehicleRes.ok) {
      console.error('Failed to create vehicle', await vehicleRes.text())
      process.exit(4)
    }
    const vehicle = await vehicleRes.json()
    const vehicleId = vehicle?.id || vehicle?.vehicle_id
    if (!vehicleId) {
      console.error('Vehicle creation did not return id')
      process.exit(5)
    }

    // 3) Create an inspection for this vehicle
    const inspRes = await fetch(`${api}/inspections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ vehicle_id: vehicleId, type: 'quick' })
    })
    if (!inspRes.ok) {
      console.error('Failed to create inspection', await inspRes.text())
      process.exit(6)
    }
    const inspection = await inspRes.json()
    const inspectionId = inspection?.id
    if (!inspectionId) {
      console.error('Inspection creation did not return id')
      process.exit(7)
    }

    // 4) Create two defects for the inspection
    const defect1 = await (async () => {
      const r = await fetch(`${api}/inspections/${inspectionId}/defects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: 'Defect 1', comment: 'Test defect 1' })
      })
      if (!r.ok) throw new Error('Defect1 failed: ' + (await r.text()))
      return await r.json()
    })()

    const defect2 = await (async () => {
      const r = await fetch(`${api}/inspections/${inspectionId}/defects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: 'Defect 2', comment: 'Test defect 2' })
      })
      if (!r.ok) throw new Error('Defect2 failed: ' + (await r.text()))
      return await r.json()
    })()

    // 5) Try to complete inspection without photos -> expect 400
    const completeBad = await fetch(`${api}/inspections/${inspectionId}/complete`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (completeBad.status !== 400) {
      console.error('Expected 400 when no photos exist, got', completeBad.status)
      process.exit(8)
    }

    // 6) Upload photos for both defects
    const testPhotoBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]) // tiny JPEG header bytes
    let FormDataCtor
    if (typeof FormData !== 'undefined') {
      FormDataCtor = FormData
    } else {
      const { default: FD } = await import('form-data')
      FormDataCtor = FD
    }
    const form1 = new FormDataCtor()
    form1.append('photo', testPhotoBuffer, { filename: 'defect1.jpg', contentType: 'image/jpeg' })
    form1.append('geo', 'POINT(0 0)')
    const res1 = await fetch(`${api}/defects/${defect1.id}/photos`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: form1
    })
    if (!res1.ok) {
      console.error('Failed to upload photo for defect1', await res1.text())
      process.exit(9)
    }

    const form2 = new FormDataCtor()
    form2.append('photo', testPhotoBuffer, { filename: 'defect2.jpg', contentType: 'image/jpeg' })
    form2.append('geo', 'POINT(0 0)')
    const res2 = await fetch(`${api}/defects/${defect2.id}/photos`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: form2
    })
    if (!res2.ok) {
      console.error('Failed to upload photo for defect2', await res2.text())
      process.exit(10)
    }

    // 7) Retry complete -> expect 200 with completed flag
    const completeOk = await fetch(`${api}/inspections/${inspectionId}/complete`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!completeOk.ok) {
      console.error('Expected 200 on complete after photos, got', completeOk.status)
      process.exit(11)
    }
    const finished = await completeOk.json()
    if (!finished?.completed) {
      console.error('Inspection not marked as completed')
      process.exit(12)
    }
    console.log('Complete-inspection flow succeeded')
    process.exit(0)
  } catch (err) {
    console.error('Complete inspection tests failed:', err)
    process.exit(99)
  }
})()
