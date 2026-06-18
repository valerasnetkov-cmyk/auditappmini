import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFECT_SEVERITIES,
  validateDefectTransition,
} from '../../src/services/defectLifecycle.js'

test('defect lifecycle accepts supported transitions with a comment', () => {
  assert.equal(validateDefectTransition('open', 'in_progress', 'Назначен ответственный'), null)
  assert.equal(validateDefectTransition('in_progress', 'resolved', 'Неисправность устранена'), null)
  assert.equal(validateDefectTransition('resolved', 'closed', 'Результат проверен'), null)
  assert.equal(validateDefectTransition('closed', 'reopened', 'Проблема повторилась'), null)
})

test('defect lifecycle rejects unsupported transitions and missing comments', () => {
  assert.equal(
    validateDefectTransition('open', 'reopened', 'Ошибка статуса')?.error,
    'DEFECT_STATUS_INVALID_TRANSITION',
  )
  assert.equal(
    validateDefectTransition('open', 'resolved', '')?.error,
    'DEFECT_STATUS_COMMENT_REQUIRED',
  )
  assert.equal(
    validateDefectTransition('open', 'unknown', 'Комментарий')?.error,
    'DEFECT_STATUS_INVALID',
  )
})

test('defect severity contract contains the four supported levels', () => {
  assert.deepEqual(DEFECT_SEVERITIES, ['low', 'medium', 'high', 'critical'])
})
