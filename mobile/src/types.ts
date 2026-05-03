export type UserRole = 'inspector' | 'manager' | 'admin'

export type InspectionType = 'quick' | 'scheduled' | 'accident'

export type InspectionStatus = 'open' | 'closed'

export type VehicleStatus = 'active' | 'repair'

export type Company = {
  id: string
  slug: string
  name: string
  region_code?: string
  distance_unit?: 'km' | 'mi'
}

export type User = {
  id: string
  email: string
  name: string
  role: UserRole
  company_id: string
}

export type Vehicle = {
  id: string
  number: string
  name: string
  status: VehicleStatus
  region?: string
}

export type ChecklistItem = {
  title: string
  result: boolean | null
  comment: string
}

export type PhotoRequirement = {
  id: string
  type: string
  label: string
  required: boolean
}

export type Inspection = {
  id: string
  vehicle_id: string
  vehicle_number: string
  vehicle_name: string
  inspector_id: string
  inspector_name: string
  type: InspectionType
  completed: boolean
  odometer_value?: number
  odometer_unit?: string
  accident_occurred_at?: string
  accident_location?: string
  checklist_items: ChecklistItem[]
  created_at: string
}

export type Defect = {
  id: string
  inspection_id: string
  title: string
  comment?: string
  status: InspectionStatus
  photos: string[]
}

export type CreateInspectionPayload = {
  vehicle_id: string
  type: InspectionType
  odometer_value?: number
  odometer_unit?: string
  checklist: ChecklistItem[]
  accident_occurred_at?: string
  accident_location?: string
}

export type CreateDefectPayload = {
  inspection_id: string
  title: string
  comment?: string
}

export type AuthResponse = {
  token: string
  user: User
}

export type ApiError = {
  error: string
}

export type ApiResponse<T> = T | ApiError

export const PHOTO_REQUIREMENTS: Record<InspectionType, PhotoRequirement[]> = {
  quick: [
    { id: 'front', type: 'quick', label: 'Фронтальная часть', required: true },
    { id: 'left', type: 'quick', label: 'Левый борт', required: true },
    { id: 'right', type: 'quick', label: 'Правый борт', required: true },
    { id: 'rear', type: 'quick', label: 'Задняя часть', required: true },
    { id: 'overall', type: 'quick', label: 'Общий план', required: true },
    { id: 'odometer', type: 'quick', label: 'Одометр', required: true },
  ],
  scheduled: [
    { id: 'front', type: 'scheduled', label: 'Фронтальная часть', required: true },
    { id: 'left', type: 'scheduled', label: 'Левый борт', required: true },
    { id: 'right', type: 'scheduled', label: 'Правый борт', required: true },
    { id: 'rear', type: 'scheduled', label: 'Задняя часть', required: true },
    { id: 'overall', type: 'scheduled', label: 'Общий план', required: true },
    { id: 'odometer', type: 'scheduled', label: 'Одометр', required: true },
    { id: 'additional', type: 'scheduled', label: 'Дополнительные', required: false },
  ],
  accident: [
    { id: 'overall', type: 'accident', label: 'Общий план', required: true },
    { id: 'front', type: 'accident', label: 'Фронтальная часть', required: true },
    { id: 'left', type: 'accident', label: 'Левый борт', required: true },
    { id: 'right', type: 'accident', label: 'Правый борт', required: true },
    { id: 'rear', type: 'accident', label: 'Задняя часть', required: true },
    { id: 'damage_overall', type: 'accident', label: 'Общий план повреждения', required: true },
    { id: 'damage_closeup', type: 'accident', label: 'Крупный план повреждения', required: true },
    { id: 'odometer', type: 'accident', label: 'Одометр', required: false },
  ],
}

export const QUICK_CHECKLIST = [
  'Внешний вид',
  'Повреждения кузова',
  'Колёса',
  'Стёкла',
  'Госномер',
]

export const SCHEDULED_CHECKLIST = [
  { section: 'Внешнее состояние', items: ['Внешний вид', 'Повреждения кузова', 'Лакокрасочное покрытие', 'Стёкла', 'Фары', 'Зеркала', 'Двери', 'Госномер'] },
  { section: 'Ходовая часть', items: ['Нет видимых повреждений подвески', 'Нет течей амортизаторов', 'Шины без критичных повреждений'] },
  { section: 'Тормозная система', items: ['Нет видимых подтёков', 'Тормозные шланги без повреждений', 'Стояночный тормоз работает'] },
  { section: 'Электрика', items: ['Аккумулятор без повреждений', 'Проводка без повреждений', 'Приборная панель без ошибок'] },
  { section: 'Световые приборы', items: ['Ближний свет', 'Дальний свет', 'Габариты', 'Стоп-сигналы', 'Поворотники'] },
]

export const ACCIDENT_CHECKLIST = [
  'Повреждения кузова',
  'Остекление',
  'Ходовая',
  'Кузов',
  'Безопасность',
]