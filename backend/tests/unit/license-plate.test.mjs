import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidRussianLicensePlate,
  LICENSE_PLATE_ALLOWED_CYRILLIC,
  normalizeVehicleNumberToCyrillic,
} from '../../src/utils/transliteration.js'

describe('isValidRussianLicensePlate', () => {
  test('valid plate with Cyrillic letters', () => {
    assert.equal(isValidRussianLicensePlate('А012ХМ63'), true)
  })

  test('valid plate with Latin look-alikes', () => {
    assert.equal(isValidRussianLicensePlate('A012XM63'), true)
  })

  test('rejects plate with invalid letters', () => {
    assert.equal(isValidRussianLicensePlate('А012ЖМ63'), false)
  })

  test('rejects plate with too few digits', () => {
    assert.equal(isValidRussianLicensePlate('А12ХМ63'), false)
  })

  test('rejects empty string', () => {
    assert.equal(isValidRussianLicensePlate(''), false)
  })
})

describe('LICENSE_PLATE_ALLOWED_CYRILLIC', () => {
  test('contains the Russian plate alphabet as an array', () => {
    assert.ok(Array.isArray(LICENSE_PLATE_ALLOWED_CYRILLIC))
    assert.deepEqual(LICENSE_PLATE_ALLOWED_CYRILLIC, ['А', 'В', 'Е', 'К', 'М', 'Н', 'О', 'Р', 'С', 'Т', 'У', 'Х'])
  })
})

describe('normalizeVehicleNumberToCyrillic', () => {
  test('Latin look-alikes are converted to Cyrillic', () => {
    assert.equal(normalizeVehicleNumberToCyrillic('A012XM63'), 'А012ХМ63')
  })

  test('digits are preserved', () => {
    assert.equal(normalizeVehicleNumberToCyrillic('X999MK99'), 'Х999МК99')
  })
})
