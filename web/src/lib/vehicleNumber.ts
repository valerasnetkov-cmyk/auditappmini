// Latin to Cyrillic mapping (for display purposes if needed)
const LATIN_TO_CYRILLIC: Record<string, string> = {
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

// Cyrillic to Latin mapping (for input normalization)
const CYRILLIC_TO_LATIN: Record<string, string> = {
  'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H',
  'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'У': 'Y', 'Х': 'X'
}

export const ALLOWED_VEHICLE_LETTERS = ['A', 'B', 'E', 'K', 'M', 'H', 'O', 'P', 'C', 'T', 'Y', 'X'] as const

const ALLOWED_VEHICLE_LETTER_SET = new Set<string>(ALLOWED_VEHICLE_LETTERS)
const RUSSIAN_PLATE_PATTERN = /^[ABEKMHOPCTYX]\d{3}[ABEKMHOPCTYX]{2}\d{2,3}$/

// Normalize: transliterate Cyrillic to Latin, then clean up
export function normalizeVehicleNumber(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .split('')
    .map((symbol) => CYRILLIC_TO_LATIN[symbol] || symbol) // Transliterate Cyrillic to Latin
    .filter((symbol) => /\d/.test(symbol) || ALLOWED_VEHICLE_LETTER_SET.has(symbol))
    .join('')
    .slice(0, 9)
}

export function isValidVehicleNumber(value: string) {
  return RUSSIAN_PLATE_PATTERN.test(normalizeVehicleNumber(value))
}

export const VEHICLE_NUMBER_HELP =
  'Format: A123BC77 or A123BC177. Only letters A, B, E, K, M, H, O, P, C, T, Y, X are allowed.'
