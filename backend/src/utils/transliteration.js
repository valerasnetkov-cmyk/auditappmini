export function transliterateCyrillicToLatin(s) {
  if (!s) return ''
  const CYR_TO_LAT = {
    'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H',
    'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'У': 'Y', 'Х': 'X'
  }
  let out = ''
  for (let ch of String(s).toUpperCase()) {
    out += CYR_TO_LAT[ch] ?? ch
  }
  return out
}
