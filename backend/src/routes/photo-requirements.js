// Photo requirements by inspection type
export const photoRequirements = {
  quick: {
    required: [
      'front',
      'left',
      'right', 
      'rear',
      'overview',
      'odometer'
    ],
    optional: [
      'additional'
    ]
  },
  scheduled: {
    required: [
      'front',
      'left',
      'right',
      'rear', 
      'overview',
      'odometer',
      // Technical sections
      'undercarriage',
      'brake_system',
      'electrical',
      'lighting'
    ],
    optional: [
      'additional',
      'damage_detail'
    ]
  },
  accident: {
    required: [
      'front',
      'left',
      'right',
      'rear',
      'overview',
      'accident_location',
      'accident_overview_1',
      'accident_overview_2',
      'accident_overview_3',
      'accident_overview_4',
      'participant_plates',
      'participant_vehicle_sides',
      'damage_detail',
      'damage_identifier',
      'accident_debris',
      'driver_license_front',
      'driver_license_back',
      'vehicle_registration'
    ],
    optional: [
      'odometer',
      'additional'
    ]
  }
}

// Photo type labels for i18n
export const photoTypeLabels = {
  ru: {
    front: 'Фото спереди',
    left: 'Фото левого борта',
    right: 'Фото правого борта',
    rear: 'Фото сзади',
    overview: 'Общий план',
    odometer: 'Фото одометра',
    additional: 'Дополнительное фото',
    undercarriage: 'Ходовая часть',
    brake_system: 'Тормозная система',
    electrical: 'Электрика',
    lighting: 'Освещение',
    damage_detail: 'Повреждение (крупный план)',
    accident_location: 'Место ДТП',
    accident_overview_1: 'Общий план 1',
    accident_overview_2: 'Общий план 2',
    accident_overview_3: 'Общий план 3',
    accident_overview_4: 'Общий план 4',
    participant_plates: 'Госномера участников',
    participant_vehicle_sides: 'Авто с четырёх сторон',
    damage_identifier: 'Повреждение + деталь авто',
    accident_debris: 'Осколки и детали',
    driver_license_front: 'Водительские удостоверения: лицевая сторона',
    driver_license_back: 'Водительские удостоверения: оборотная сторона',
    vehicle_registration: 'СТС участников'
  },
  en: {
    front: 'Front photo',
    left: 'Left side photo',
    right: 'Right side photo', 
    rear: 'Rear photo',
    overview: 'Overview',
    odometer: 'Odometer photo',
    additional: 'Additional photo',
    undercarriage: 'Undercarriage',
    brake_system: 'Brake system',
    electrical: 'Electrical',
    lighting: 'Lighting',
    damage_detail: 'Damage detail',
    accident_location: 'Accident location',
    accident_overview_1: 'Overview 1',
    accident_overview_2: 'Overview 2',
    accident_overview_3: 'Overview 3',
    accident_overview_4: 'Overview 4',
    participant_plates: 'Participant license plates',
    participant_vehicle_sides: 'Vehicles from four sides',
    damage_identifier: 'Damage and vehicle identifier',
    accident_debris: 'Debris and detached parts',
    driver_license_front: 'Driver licenses: front side',
    driver_license_back: 'Driver licenses: back side',
    vehicle_registration: 'Vehicle registrations'
  }
}

// Technical defect categories
export const defectCategories = {
  ru: {
    exterior: 'Внешние дефекты',
    undercarriage: 'Ходовая часть',
    brake_system: 'Тормозная система',
    electrical: 'Электрика',
    lighting: 'Освещение',
    other: 'Прочее'
  },
  en: {
    exterior: 'Exterior defects',
    undercarriage: 'Undercarriage',
    brake_system: 'Brake system',
    electrical: 'Electrical',
    lighting: 'Lighting',
    other: 'Other'
  }
}

export function registerPhotoRequirementRoutes({ app, authenticate }) {
  app.get('/api/photo-requirements/:type', authenticate, (req, res) => {
    const { type } = req.params
    if (!photoRequirements[type]) {
      return res.status(400).json({ error: 'Неизвестный тип осмотра' })
    }
    res.json({
      type,
      requirements: photoRequirements[type],
      labels: photoTypeLabels.ru,
    })
  })

  app.get('/api/defect-categories', authenticate, (req, res) => {
    res.json({
      categories: defectCategories.ru,
    })
  })
}

export default {
  photoRequirements,
  photoTypeLabels,
  defectCategories
}
