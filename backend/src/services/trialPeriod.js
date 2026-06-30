export function addDaysDate(value, days) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function minIsoDate(left, right) {
  if (!left) return right || null
  if (!right) return left || null
  return String(left).slice(0, 10) <= String(right).slice(0, 10)
    ? String(left).slice(0, 10)
    : String(right).slice(0, 10)
}

export function resolveTrialUntil(company, billingRow, trialDays = 30) {
  if (billingRow?.billing_status !== 'trial') return billingRow?.trial_until || null
  const createdTrialEnd = addDaysDate(company?.created_at, trialDays)
  return minIsoDate(billingRow?.trial_until, createdTrialEnd)
}
