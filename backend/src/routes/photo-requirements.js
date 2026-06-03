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
      'overview',
      'front',
      'left',
      'right',
      'rear',
      'damage_detail',
      'accident_location'
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
    accident_location: 'Место ДТП'
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
    accident_location: 'Accident location'
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
