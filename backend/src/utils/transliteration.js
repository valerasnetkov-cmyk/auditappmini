export const LICENSE_PLATE_LATIN_TO_CYRILLIC = {
  A: 'А',
  B: 'В',
  E: 'Е',
  K: 'К',
  M: 'М',
  H: 'Н',
  O: 'О',
  P: 'Р',
  C: 'С',
  T: 'Т',
  Y: 'У',
  X: 'Х',
}

export const LICENSE_PLATE_CYRILLIC_TO_LATIN = Object.fromEntries(
  Object.entries(LICENSE_PLATE_LATIN_TO_CYRILLIC).map(([latin, cyrillic]) => [cyrillic, latin]),
)

export const LICENSE_PLATE_ALLOWED_CYRILLIC = Object.values(LICENSE_PLATE_LATIN_TO_CYRILLIC)
export const LICENSE_PLATE_ALLOWED_LATIN = Object.keys(LICENSE_PLATE_LATIN_TO_CYRILLIC)

export const RUSSIAN_LICENSE_PLATE_PATTERN = /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$/

const MOJIBAKE_TO_CYRILLIC = {
  'Рђ': 'А',
  'Р’': 'В',
  'Р•': 'Е',
  'Рљ': 'К',
  'Рњ': 'М',
  'Рќ': 'Н',
  'Рћ': 'О',
  'Р ': 'Р',
  'РЎ': 'С',
  'Рў': 'Т',
  'РЈ': 'У',
  'РҐ': 'Х',
  'Р‘': 'Б',
  'Р“': 'Г',
  'Р”': 'Д',
  'Р–': 'Ж',
  'Р—': 'З',
  'Р': 'И',
  'Р™': 'Й',
  'Р›': 'Л',
  'Рџ': 'П',
  'Р¤': 'Ф',
  'Р¦': 'Ц',
  'Р§': 'Ч',
  'РЁ': 'Ш',
  'Р©': 'Щ',
  'РЄ': 'Ъ',
  'Р«': 'Ы',
  'Р¬': 'Ь',
  'Р­': 'Э',
  'Р®': 'Ю',
  'РЇ': 'Я',
  'Р°': 'а',
  'Р±': 'б',
  'РІ': 'в',
  'Рі': 'г',
  'Рґ': 'д',
  'Рµ': 'е',
  'С‘': 'ё',
  'Р¶': 'ж',
  'Р·': 'з',
  'Рё': 'и',
  'Р№': 'й',
  'Рє': 'к',
  'Р»': 'л',
  'Рј': 'м',
  'РЅ': 'н',
  'Рѕ': 'о',
  'Рї': 'п',
  'СЂ': 'р',
  'СЃ': 'с',
  'С‚': 'т',
  'Сѓ': 'у',
  'С„': 'ф',
  'С…': 'х',
  'С†': 'ц',
  'С‡': 'ч',
  'С€': 'ш',
  'С‰': 'щ',
  'СЉ': 'ъ',
  'С‹': 'ы',
  'СЊ': 'ь',
  'СЌ': 'э',
  'СЋ': 'ю',
  'СЏ': 'я',
}

export function repairMojibakeRussian(value) {
  if (typeof value !== 'string') return value

  return Object.entries(MOJIBAKE_TO_CYRILLIC).reduce(
    (result, [broken, fixed]) => result.replaceAll(broken, fixed),
    value,
  )
}

export function transliterateCyrillicToLatin(value) {
  if (!value) return ''

  return repairMojibakeRussian(String(value))
    .toUpperCase()
    .split('')
    .map((symbol) => LICENSE_PLATE_CYRILLIC_TO_LATIN[symbol] ?? symbol)
    .join('')
}

export function normalizeVehicleNumberToCyrillic(value) {
  if (typeof value !== 'string') return ''

  return repairMojibakeRussian(value)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .split('')
    .map((symbol) => LICENSE_PLATE_LATIN_TO_CYRILLIC[symbol] ?? symbol)
    .filter((symbol) => /\d/.test(symbol) || LICENSE_PLATE_ALLOWED_CYRILLIC.includes(symbol))
    .join('')
    .slice(0, 9)
}

export function isValidRussianLicensePlate(value) {
  return RUSSIAN_LICENSE_PLATE_PATTERN.test(normalizeVehicleNumberToCyrillic(value))
}
