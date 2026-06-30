import { sendAlert } from '../src/services/alertService.js'

const result = await sendAlert({
  severity: 'medium',
  source: 'alert-dry-run',
  message: 'Auditmini alert dry-run',
  context: {
    command: 'npm --prefix backend run alerts:dry-run',
    token: 'must-not-leak',
  },
}, {
  env: {
    ...process.env,
    TELEGRAM_ALERTS_DRY_RUN: 'true',
  },
})

console.log(JSON.stringify(result, null, 2))

if (!result.ok || !result.dryRun || result.delivered) {
  process.exit(1)
}
