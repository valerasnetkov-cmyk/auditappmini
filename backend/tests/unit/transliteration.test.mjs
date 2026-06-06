import { test } from 'node:test'
import assert from 'node:assert/strict'
import { transliterateCyrillicToLatin } from '../../src/utils/transliteration.js'

test('transliterateCyrillicToLatin: basic plate', () => {
  assert.equal(transliterateCyrillicToLatin('А012ХМ63'), 'A012XM63')
})

test('transliterateCyrillicToLatin: all Cyrillic letters', () => {
  assert.equal(transliterateCyrillicToLatin('АВЕКМНОРСТУХ'), 'ABEKMHOPCTYX')
})

test('transliterateCyrillicToLatin: mixed with digits', () => {
  assert.equal(transliterateCyrillicToLatin('Х123МК45'), 'X123MK45')
})

test('transliterateCyrillicToLatin: already Latin passes through', () => {
  assert.equal(transliterateCyrillicToLatin('A012XM63'), 'A012XM63')
})

test('transliterateCyrillicToLatin: empty string', () => {
  assert.equal(transliterateCyrillicToLatin(''), '')
})

test('transliterateCyrillicToLatin: undefined input', () => {
  assert.equal(transliterateCyrillicToLatin(undefined), '')
})

test('transliterateCyrillicToLatin: null input', () => {
  assert.equal(transliterateCyrillicToLatin(null), '')
})

test('transliterateCyrillicToLatin: lowercase Cyrillic', () => {
  assert.equal(transliterateCyrillicToLatin('а012хм63'), 'A012XM63')
})

test('transliterateCyrillicToLatin: with spaces', () => {
  assert.equal(transliterateCyrillicToLatin('А 012 ХМ 63'), 'A 012 XM 63')
})

test('transliterateCyrillicToLatin: partial Cyrillic', () => {
  assert.equal(transliterateCyrillicToLatin('ABC-ХМ-77'), 'ABC-XM-77')
})
