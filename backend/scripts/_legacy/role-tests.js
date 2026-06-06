#!/usr/bin/env node
// Simple backend security tests to ensure public registration cannot create managers
// and that creating users requires manager role
(async () => {
  const api = 'http://localhost:3001/api'
  const fetch = global.fetch
  if (!fetch) {
    console.error('Global fetch not available in this Node version')
    process.exit(1)
  }

  try {
    // 1) Public registration as inspector
    const regRes = await fetch(`${api}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'role-test-registrar@example.com', password: 'Secret123!', name: 'Role Registrar' })
    })
    if (!regRes.ok) {
      const err = await regRes.text()
      console.error('Register failed', regRes.status, err)
      process.exit(2)
    }
    const regData = await regRes.json()
    const inspectorToken = regData?.token
    if (!inspectorToken) {
      console.error('No token returned on registration')
      process.exit(3)
    }

    // 2) Try to create a manager with inspector token -> should fail (403)
    const createMgrRes = await fetch(`${api}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${inspectorToken}`
      },
      body: JSON.stringify({ email: 'role-manager-test@example.com', password: 'Secret123!', name: 'Role Manager Test', role: 'manager' })
    })
    if (createMgrRes.status !== 403) {
      console.error('Expected 403 when inspector tries to create manager, got', createMgrRes.status)
      process.exit(4)
    } else {
      console.log('Inspector cannot create manager (403) as expected')
    }

    // 3) Try to create user without auth -> should be 401
    const createNoAuth = await fetch(`${api}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'role-test-noauth@example.com', password: 'Secret123!', name: 'No Auth User', role: 'inspector' })
    })
    if (createNoAuth.status !== 401 && createNoAuth.status !== 403) {
      console.error('Expected 401/403 when unauthenticated trying to create user, got', createNoAuth.status)
      process.exit(5)
    } else {
      console.log('Unauthenticated create user rejected as expected')
    }
    process.exit(0)
  } catch (err) {
    console.error('Backend security tests failed:', err)
    process.exit(99)
  }
})()
