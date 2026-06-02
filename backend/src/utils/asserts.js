export function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }
}

export function assertOneOf(value, allowedValues, name) {
  if (!allowedValues.includes(value)) {
    throw new Error(`${name} must be one of: ${allowedValues.join(', ')}`)
  }
}
