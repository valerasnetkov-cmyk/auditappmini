import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { getSecret, resetSecretStoreForTests } from '../../src/services/secretStore.js'

describe('getSecret', () => {
  test('returns env value when set with sufficient length', () => {
    process.env.TEST_SECRET = 'a'.repeat(48)
    assert.equal(getSecret('TEST_SECRET'), 'a'.repeat(48))
    delete process.env.TEST_SECRET
  })

  test('throws when env value is too short', () => {
    process.env.TEST_SECRET = 'short'
    assert.throws(
      () => getSecret('TEST_SECRET'),
      /must be at least 32 characters long/,
    )
    delete process.env.TEST_SECRET
  })

  test('throws when env value is missing and no fallback allowed', () => {
    delete process.env.TEST_SECRET
    assert.throws(
      () => getSecret('TEST_SECRET'),
      /must be set in the environment/,
    )
  })

  test('generates a random fallback when allowed', () => {
    delete process.env.TEST_SECRET
    const value = getSecret('TEST_SECRET', { allowRandomFallback: true })
    assert.equal(typeof value, 'string')
    assert.ok(value.length >= 64, `expected >= 64 chars, got ${value.length}`)
  })

  test('returns the same random value on subsequent calls', () => {
    resetSecretStoreForTests()
    delete process.env.TEST_SECRET
    const a = getSecret('TEST_SECRET', { allowRandomFallback: true })
    const b = getSecret('TEST_SECRET', { allowRandomFallback: true })
    assert.equal(a, b)
    resetSecretStoreForTests()
  })

  test('resetSecretStoreForTests clears the cache', () => {
    delete process.env.TEST_SECRET
    const a = getSecret('TEST_SECRET', { allowRandomFallback: true })
    resetSecretStoreForTests()
    const b = getSecret('TEST_SECRET', { allowRandomFallback: true })
    assert.notEqual(a, b)
    resetSecretStoreForTests()
  })
})
