// Tests for the Redis client wrapper.
//
// We do NOT require a live Redis server; these tests cover the
// "not configured" and "configured but unreachable" code paths
// and the module-state management.

import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

const {
  isRedisConfigured,
  isRedisAvailable,
  getRedisStatus,
  pingRedis,
  shutdownRedis,
  resetRedisForTests,
} = await import('../../src/services/redisClient.js')

describe('redisClient (no REDIS_URL)', () => {
  before(() => {
    delete process.env.REDIS_URL
    resetRedisForTests()
  })

  after(async () => {
    await shutdownRedis()
  })

  test('isRedisConfigured returns false when REDIS_URL is unset', () => {
    assert.equal(isRedisConfigured(), false)
  })

  test('isRedisAvailable returns false when not configured', () => {
    assert.equal(isRedisAvailable(), false)
  })

  test('getRedisStatus reports not-configured', () => {
    const status = getRedisStatus()
    assert.equal(status.configured, false)
    assert.equal(status.connected, false)
  })

  test('pingRedis returns ok=false with reason', async () => {
    const result = await pingRedis()
    assert.equal(result.ok, false)
    assert.match(result.reason, /REDIS_URL/)
  })
})

describe('redisClient (REDIS_URL set but unreachable)', () => {
  beforeEach(() => {
    resetRedisForTests()
  })

  test('isRedisConfigured returns true', () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:1'
    assert.equal(isRedisConfigured(), true)
  })

  test('isRedisAvailable returns false (no live connection)', () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:1'
    assert.equal(isRedisAvailable(), false)
  })

  test('getRedisStatus reports configured=true, connected=false', () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:1'
    const status = getRedisStatus()
    assert.equal(status.configured, true)
    assert.equal(status.connected, false)
  })

  test('pingRedis times out and reports failure', async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:1'
    const result = await pingRedis()
    assert.equal(result.ok, false)
  })

  test('invalid URL falls back to null client (does not throw)', () => {
    process.env.REDIS_URL = 'not-a-valid-url'
    assert.doesNotThrow(() => {
      const status = getRedisStatus()
      assert.equal(status.configured, true)
    })
  })
})
