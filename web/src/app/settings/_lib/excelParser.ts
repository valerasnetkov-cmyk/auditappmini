import ExcelJS from 'exceljs'
import { isRussianPlateLike, normalizePlateValue, parseToken, type ParsedVehicle } from './settings'

export async function parseVehiclesExcel(buffer: ArrayBuffer): Promise<ParsedVehicle[]> {
  try {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    const sheet = workbook.worksheets[0]
    if (!sheet) return []

    const rows: unknown[][] = []
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : []
      rows.push(values)
    })
    if (!rows.length) return []

    const firstRow = rows[0].map((value) => parseToken(value).toLowerCase())
    const hasHeader = firstRow.some(
      (header) =>
        header.includes('номер') ||
        header.includes('гос') ||
        header.includes('number') ||
        header.includes('название') ||
        header.includes('марка') ||
        header.includes('регион'),
    )

    const headers = hasHeader ? firstRow : ['номер', 'название', 'регион']
    const dataStart = hasHeader ? 1 : 0
    const numberIdx = headers.findIndex(
      (header) =>
        header.includes('номер') || header.includes('number') || header.includes('гос') || header.includes('регистрац'),
    )
    const nameIdx = headers.findIndex(
      (header) => header.includes('название') || header.includes('name') || header.includes('марка') || header.includes('модель'),
    )
    const regionIdx = headers.findIndex(
      (header) => header.includes('регион') || header.includes('region') || header.includes('область'),
    )

    if (numberIdx === -1) return []

    return rows
      .slice(dataStart)
      .map((columns) => ({
        number: normalizePlateValue(columns[numberIdx]),
        name: nameIdx !== -1 ? parseToken(columns[nameIdx]) : '',
        region: regionIdx !== -1 ? parseToken(columns[regionIdx]) : '',
      }))
      .filter(
        (vehicle) =>
          vehicle.number.length > 3 && (isRussianPlateLike(vehicle.number) || vehicle.name || vehicle.region),
      )
  } catch {
    return []
  }
}
