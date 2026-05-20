export const translations = {
  ru: {
    // Auth
    login: 'Вход',
    logout: 'Выйти',
    email: 'Email',
    password: 'Пароль',
    name: 'Имя',
    role: 'Роль',
    inspector: 'Инспектор',
    manager: 'Менеджер',

    // Navigation
    dashboard: 'Дашборд',
    vehicles: 'Техника',
    inspections: 'Осмотры',
    defects: 'Дефекты',
    users: 'Пользователи',
    profile: 'Профиль',
    settings: 'Настройки',

    // Vehicles
    vehicleNumber: 'Госномер',
    vehicleName: 'Название',
    vehicleStatus: 'Статус',
    active: 'В работе',
    repair: 'Ремонт',
    region: 'Регион',

    // Inspections
    inspectionType: 'Тип осмотра',
    quick: 'Быстрый',
    scheduled: 'Плановый',
    accident: 'ДТП',
    completed: 'Завершён',
    notCompleted: 'Не завершён',

    // Defects
    defect: 'Дефект',
    defectTitle: 'Название дефекта',
    defectComment: 'Комментарий',
    open: 'Открыт',
    closed: 'Закрыт',

    // Photos
    photo: 'Фото',
    uploadPhoto: 'Загрузить фото',

    // Odometer
    odometer: 'Одометр',
    odometerValue: 'Пробег',

    // Actions
    save: 'Сохранить',
    cancel: 'Отмена',
    delete: 'Удалить',
    edit: 'Редактировать',
    create: 'Создать',
    confirm: 'Подтвердить',
    close: 'Закрыть',
    reopen: 'Открыть заново',

    // Status
    loading: 'Загрузка...',
    error: 'Ошибка',
    success: 'Успешно',
    noData: 'Нет данных',

    // Theme
    theme: 'Тема',
    lightTheme: 'Светлая',
    darkTheme: 'Тёмная',
    systemTheme: 'Системная',
    language: 'Язык',

    // Validation errors
    odometerRequired: 'Укажите пробег',
    accidentTimeRequired: 'Укажите время ДТП',
    accidentLocationRequired: 'Укажите место ДТП',
    photosRequired: 'Загрузите обязательные фото',
    defectNeedsPhoto: 'К каждому дефекту нужно фото',

    // Technical categories
    exterior: 'Внешние дефекты',
    undercarriage: 'Ходовая часть',
    brakeSystem: 'Тормозная система',
    electrical: 'Электрика',
    lighting: 'Освещение',
    other: 'Прочее',
  },
  en: {
    // Auth
    login: 'Login',
    logout: 'Logout',
    email: 'Email',
    password: 'Password',
    name: 'Name',
    role: 'Role',
    inspector: 'Inspector',
    manager: 'Manager',

    // Navigation
    dashboard: 'Dashboard',
    vehicles: 'Vehicles',
    inspections: 'Inspections',
    defects: 'Defects',
    users: 'Users',
    profile: 'Profile',
    settings: 'Settings',

    // Vehicles
    vehicleNumber: 'Vehicle Number',
    vehicleName: 'Name',
    vehicleStatus: 'Status',
    active: 'Active',
    repair: 'Repair',
    region: 'Region',

    // Inspections
    inspectionType: 'Inspection Type',
    quick: 'Quick',
    scheduled: 'Scheduled',
    accident: 'Accident',
    completed: 'Completed',
    notCompleted: 'Not Completed',

    // Defects
    defect: 'Defect',
    defectTitle: 'Defect Title',
    defectComment: 'Comment',
    open: 'Open',
    closed: 'Closed',

    // Photos
    photo: 'Photo',
    uploadPhoto: 'Upload Photo',

    // Odometer
    odometer: 'Odometer',
    odometerValue: 'Mileage',

    // Actions
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    confirm: 'Confirm',
    close: 'Close',
    reopen: 'Reopen',

    // Status
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    noData: 'No data',

    // Theme
    theme: 'Theme',
    lightTheme: 'Light',
    darkTheme: 'Dark',
    systemTheme: 'System',
    language: 'Language',

    // Validation errors
    odometerRequired: 'Enter mileage',
    accidentTimeRequired: 'Enter accident time',
    accidentLocationRequired: 'Enter accident location',
    photosRequired: 'Upload required photos',
    defectNeedsPhoto: 'Each defect requires a photo',

    // Technical categories
    exterior: 'Exterior defects',
    undercarriage: 'Undercarriage',
    brakeSystem: 'Brake system',
    electrical: 'Electrical',
    lighting: 'Lighting',
    other: 'Other',
  },
}

export type Locale = keyof typeof translations
export type TranslationKey = keyof typeof translations['ru']

let currentLocale: Locale = 'ru'

export function setLocale(locale: Locale) {
  if (translations[locale]) {
    currentLocale = locale
    localStorage.setItem('locale', locale)
  }
}

export function getLocale(): Locale {
  return currentLocale
}

export function t(key: TranslationKey): string {
  return translations[currentLocale]?.[key] || translations.ru[key] || key
}

export function initLocale() {
  const stored = localStorage.getItem('locale') as Locale | null
  if (stored && translations[stored]) {
    currentLocale = stored
  }
}
