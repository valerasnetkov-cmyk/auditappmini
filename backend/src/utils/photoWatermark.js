function formatDate(value) {
  if (!value) return 'не указано'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('ru-RU')
}

export function photoCoordinates(photo) {
  if (photo?.captured_lat !== null && photo?.captured_lat !== undefined
    && photo?.captured_lng !== null && photo?.captured_lng !== undefined) {
    return `${photo.captured_lat}, ${photo.captured_lng}`
  }
  const geo = String(photo?.geo || '').trim()
  return geo || 'недоступны'
}

export function buildPhotoWatermarkLines({ photo, inspection = {}, companyName = '', vehicleNumber = '' }) {
  return [
    'auditavto.ru',
    `Компания: ${companyName || inspection.company_name || photo?.company_name || 'не указана'}`,
    `Техника: ${vehicleNumber || inspection.vehicle_number || photo?.vehicle_number || 'не указана'}`,
    `Осмотр: ${inspection.id || photo?.inspection_id || 'не указан'}`,
    `Тип: ${inspection.type || photo?.inspection_type || 'не указан'}`,
    `Дата/время: ${formatDate(photo?.captured_at || photo?.created_at)}`,
    `Координаты: ${photoCoordinates(photo)}`,
  ]
}
