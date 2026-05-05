import { transliterateCyrillicToLatin } from '../src/utils/transliteration.js'

let passed = 0
let failed = 0

function test(name, input, expected) {
  const result = transliterateCyrillicToLatin(input)
  if (result === expected) {
    console.log(`✅ ${name}: "${input}" → "${result}"`)
    passed++
  } else {
    console.log(`❌ ${name}: "${input}" → "${result}" (ожидалось "${expected}")`)
    failed++
  }
}

console.log('=== Тесты transliterateCyrillicToLatin ===\n')

// Basic Cyrillic to Latin
test('Basic plate', 'А012ХМ63', 'A012XM63')
test('All Cyrillic letters', 'АВЕКМНОРСТУХ', 'ABEKMHOPCTYX')
test('Mixed with digits', 'Х123МК45', 'X123MK45')
test('Already Latin', 'A012XM63', 'A012XM63')
test('Empty string', '', '')
test('Null input', undefined, '')
test('Lowercase Cyrillic', 'а012хм63', 'A012XM63')
test('With spaces', 'А 012 ХМ 63', 'A 012 XM 63')
test('Partial Cyrillic', 'ABC-ХМ-77', 'ABC-XM-77')

console.log(`\n=== Итоги: ${passed} пройдено, ${failed} провалено ===`)
process.exit(failed > 0 ? 1 : 0)
