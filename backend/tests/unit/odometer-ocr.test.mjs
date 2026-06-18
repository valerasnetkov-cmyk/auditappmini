import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  normalizeOdometerCandidate,
  parseOdometerCandidates,
  parseTesseractTsv,
} from '../../src/services/odometerOcr.js'

test('normalizeOdometerCandidate extracts safe positive integer digits', () => {
  assert.equal(normalizeOdometerCandidate('128 450 km'), 128450)
  assert.equal(normalizeOdometerCandidate('001234'), 1234)
  assert.equal(normalizeOdometerCandidate(''), null)
  assert.equal(normalizeOdometerCandidate('abc'), null)
  assert.equal(normalizeOdometerCandidate('-123'), null)
})

test('parseOdometerCandidates returns unique numeric candidates from OCR text', () => {
  assert.deepEqual(parseOdometerCandidates('odo 128 450 km / trip 123.4 / 128450'), [128450, 1234])
  assert.deepEqual(parseOdometerCandidates('no digits here'), [])
  assert.deepEqual(parseOdometerCandidates('bad -123 and valid 456'), [456])
})

test('parseTesseractTsv returns raw text and normalized confidence', () => {
  const tsv = [
    'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
    '5\t1\t1\t1\t1\t1\t0\t0\t10\t10\t82.5\t128',
    '5\t1\t1\t1\t1\t2\t12\t0\t10\t10\t77.5\t450',
    '5\t1\t1\t1\t1\t3\t24\t0\t10\t10\t-1\t',
  ].join('\n')

  const parsed = parseTesseractTsv(tsv)
  assert.equal(parsed.rawText, '128 450')
  assert.equal(parsed.confidence, 0.8)
})
