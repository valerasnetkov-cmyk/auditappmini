import type { InspectionType, ChecklistItemResponse, PhotoRecord, InspectionDetail } from '@/lib/types'

export type ChecklistItem = {
  id?: string
  title: string
  result: boolean
  comment: string
}

export type StatusTone = 'success' | 'error'

export const QUICK_CHECKLIST = [
  'Внешний вид',
  'Повреждения кузова',
  'Колеса',
  'Стекла',
  'Госномер',
]

export const SCHEDULED_CHECKLIST = [
  'Внешний вид',
  'Повреждения кузова',
  'Лакокрасочное покрытие',
  'Колеса',
  'Стекла',
  'Фары',
  'Зеркала',
  'Двери',
  'Госномер',
  'Двигатель',
  'Салон',
  'Приборная панель',
]

export const ACCIDENT_CHECKLIST = [
  'Повреждения кузова',
  'Остекление',
  'Ходовая',
  'Кузов',
  'Безопасность',
]

export const CHECKLIST_SECTIONS: Record<string, Record<string, string[]>> = {
  quick: {
    'Кузов': ['Внешний вид', 'Повреждения кузова'],
    'Ходовая': ['Колеса'],
    'Прочее': ['Стекла', 'Госномер'],
  },
  scheduled: {
    'Кузов': [
      'Внешний вид',
      'Повреждения кузова',
      'Лакокрасочное покрытие',
      'Стекла',
      'Фары',
      'Зеркала',
      'Двери',
      'Госномер',
    ],
    'Ходовая': ['Колеса'],
    'Двигатель': ['Двигатель'],
    'Салон': ['Салон', 'Приборная панель'],
  },
  accident: {
    'Кузов': ['Повреждения кузова', 'Кузов'],
    'Ходовая': ['Ходовая'],
    'Безопасность': ['Остекление', 'Безопасность'],
  },
}

export function getTypeLabel(type?: string) {
  if (type === 'quick') return 'Быстрый'
  if (type === 'scheduled') return 'Плановый'
  if (type === 'accident') return 'ДТП'
  return type || 'Не указан'
}

export function getTypeStyle(type?: string) {
  if (type === 'accident') return 'bg-red-100 text-red-800'
  if (type === 'scheduled') return 'bg-purple-100 text-purple-800'
  return 'bg-blue-100 text-blue-800'
}

export function getTypeSelectedStyle(type?: string) {
  if (type === 'accident') return 'border-red-500 bg-red-100 text-red-800'
  if (type === 'scheduled') return 'border-purple-500 bg-purple-100 text-purple-800'
  return 'border-blue-500 bg-blue-100 text-blue-800'
}

export function getChecklistTemplate(type: InspectionType): string[] {
  if (type === 'scheduled') return SCHEDULED_CHECKLIST
  if (type === 'accident') return ACCIDENT_CHECKLIST
  return QUICK_CHECKLIST
}

export function getItemSection(type: InspectionType, title: string): string {
  const sections = CHECKLIST_SECTIONS[type] || CHECKLIST_SECTIONS.quick
  for (const [section, items] of Object.entries(sections)) {
    if (items.includes(title)) return section
  }
  return 'Прочее'
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'Не указано'
  return new Date(value).toLocaleString('ru-RU')
}

export function toDatetimeLocalValue(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

export function groupChecklist(
  type: InspectionType,
  items: ChecklistItem[],
): Record<string, Array<ChecklistItem & { index: number }>> {
  return items.reduce<Record<string, Array<ChecklistItem & { index: number }>>>(
    (groups, item, index) => {
      const section = getItemSection(type, item.title)
      groups[section] = groups[section] || []
      groups[section].push({ ...item, index })
      return groups
    },
    {},
  )
}

export function getPhotoCount(defects: InspectionDetail['defects']) {
  return defects.reduce((sum, defect) => sum + (defect.photos?.length || 0), 0)
}

export function buildChecklistFromExisting(
  type: InspectionType,
  existingItems?: ChecklistItemResponse[],
): ChecklistItem[] {
  if (existingItems?.length) {
    return existingItems.map((item) => ({
      id: item.id,
      title: item.title,
      result: item.result === 1 || item.result === true,
      comment: item.comment || '',
    }))
  }
  return getChecklistTemplate(type).map((title) => ({
    title,
    result: true,
    comment: '',
  }))
}

export function getPhotoPreviewUrl(photo: PhotoRecord) {
  return photo.webp_url || photo.url
}

export function getPhotoThumbUrl(photo: PhotoRecord) {
  return photo.thumb_url || photo.webp_url || photo.url
}
