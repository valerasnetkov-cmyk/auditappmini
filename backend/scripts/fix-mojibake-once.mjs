// One-shot script для фиксации mojibake в существующих БД.
//
// Зачем: исторически часть русских строк попала в SQLite в двойной
// перекодировке (UTF-8 → CP1251 → UTF-8). Словарь TEXT_REPLACEMENTS
// в db.js маскировал корневую причину и был удалён в Epic 3.7.
//
// Использование:
//   node backend/scripts/fix-mojibake-once.mjs                # реальный фикс
//   node backend/scripts/fix-mojibake-once.mjs --dry-run     # только отчёт
//
// После Epic 3.1 (sql.js → better-sqlite3) запустите этот скрипт на
// актуальной `backend/data/database.sqlite` один раз. Дальше новые
// записи будут корректным UTF-8 без словарей.
//
// Скрипт идемпотентен: повторный запуск не меняет уже-чистые строки.

import { initDatabase, getDb } from '../src/db.js'
import { repairMojibakeRussian } from '../src/utils/transliteration.js'

const TARGET_COLUMNS = [
  { table: 'users', column: 'name' },
  { table: 'vehicles', column: 'name' },
  { table: 'vehicles', column: 'region' },
  { table: 'regions', column: 'name' },
  { table: 'checklist_items', column: 'title' },
  { table: 'defects', column: 'title' },
  { table: 'defects', column: 'comment' },
]

const dryRun = process.argv.includes('--dry-run')

async function main() {
  await initDatabase()
  const db = getDb()

  let totalFixed = 0
  const perColumn = []

  for (const { table, column } of TARGET_COLUMNS) {
    const select = db.prepare(
      `SELECT rowid, ${column} as value FROM ${table} WHERE ${column} IS NOT NULL`,
    )
    const update = db.prepare(
      `UPDATE ${table} SET ${column} = ? WHERE rowid = ?`,
    )
    let fixed = 0
    const samples = []

    while (select.step()) {
      const row = select.getAsObject()
      const original = row.value
      const repaired = repairMojibakeRussian(original)
      if (repaired !== original) {
        fixed += 1
        if (samples.length < 3) {
          samples.push({ rowid: row.rowid, before: original, after: repaired })
        }
        if (!dryRun) {
          update.run([repaired, row.rowid])
        }
      }
    }

    select.free()
    update.free()
    totalFixed += fixed
    perColumn.push({ table, column, fixed, samples })
  }

  if (dryRun) {
    console.log('[fix-mojibake-once] DRY-RUN — запись в БД не выполнялась.')
  } else {
    console.log(`[fix-mojibake-once] Всего строк исправлено: ${totalFixed}`)
  }

  console.log('\nПодробно по колонкам:')
  for (const { table, column, fixed, samples } of perColumn) {
    console.log(`  ${table}.${column}: ${fixed}`)
    for (const sample of samples) {
      console.log(`    rowid=${sample.rowid}`)
      console.log(`      before: ${sample.before}`)
      console.log(`      after:  ${sample.after}`)
    }
  }

  if (totalFixed === 0) {
    console.log('\nБД чистая. Удалять этот скрипт или оставить как страховку?')
    console.log('  Рекомендация: оставить; запускать перед любой миграцией БД.')
  }
}

main().catch((err) => {
  console.error('[fix-mojibake-once] Ошибка:', err)
  process.exitCode = 1
})
