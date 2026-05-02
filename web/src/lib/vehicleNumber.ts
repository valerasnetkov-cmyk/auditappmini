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

export const ALLOWED_VEHICLE_LETTERS = ['А', 'В', 'Е', 'К', 'М', 'Н', 'О', 'Р', 'С', 'Т', 'У', 'Х'] as const

const ALLOWED_VEHICLE_LETTER_SET = new Set<string>(ALLOWED_VEHICLE_LETTERS)
const RUSSIAN_PLATE_PATTERN = /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$/

export function normalizeVehicleNumber(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .split('')
    .map((symbol) => LATIN_TO_CYRILLIC[symbol] || symbol)
    .filter((symbol) => /\d/.test(symbol) || ALLOWED_VEHICLE_LETTER_SET.has(symbol))
    .join('')
    .slice(0, 9)
}

export function isValidVehicleNumber(value: string) {
  return RUSSIAN_PLATE_PATTERN.test(normalizeVehicleNumber(value))
}

export const VEHICLE_NUMBER_HELP =
  'Формат: А123ВС77 или А123ВС177. Разрешены только буквы А, В, Е, К, М, Н, О, Р, С, Т, У, Х.'
