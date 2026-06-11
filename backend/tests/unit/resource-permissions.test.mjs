import assert from 'node:assert/strict'
import test from 'node:test'
import {
  RESOURCE_PERMISSION_PRESETS,
  RESOURCE_PERMISSIONS,
} from '../../src/services/resourcePermissions.js'
import { slugifyCompanyName } from '../../src/routes/adminOperations.js'

test('company slug removes legal form and transliterates Cyrillic', () => {
  assert.equal(slugifyCompanyName('ООО "Сахалин Транс Сервис"'), 'sakhalin-trans-servis')
  assert.equal(slugifyCompanyName('ИП Иванов'), 'ivanov')
  assert.equal(slugifyCompanyName('АО Автопарк №7'), 'avtopark-7')
})

test('resource permission presets contain only known permissions', () => {
  const allowed = new Set(RESOURCE_PERMISSIONS)
  for (const permissions of Object.values(RESOURCE_PERMISSION_PRESETS)) {
    assert.equal(permissions.every((permission) => allowed.has(permission)), true)
  }
  assert.equal(RESOURCE_PERMISSION_PRESETS.finance.includes('payments.manage'), true)
  assert.equal(RESOURCE_PERMISSION_PRESETS.support.includes('payments.view'), false)
})
