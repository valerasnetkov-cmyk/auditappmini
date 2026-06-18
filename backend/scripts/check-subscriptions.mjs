import process from 'node:process'
import { initDatabase, getDb } from '../src/db.js'
import { scanSubscriptionAlerts } from '../src/services/subscriptionAlerts.js'

try {
  await initDatabase()
  const result = scanSubscriptionAlerts(getDb(), {
    actorUserId: null,
    actorRole: 'system',
  })

  console.log(JSON.stringify({ ok: true, ...result }, null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
