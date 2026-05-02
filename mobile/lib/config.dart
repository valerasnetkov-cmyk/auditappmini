class ApiConfig {
  static const String baseUrl = 'http://10.0.2.2:3001/api';
}

class AppConstants {
  // Quick inspection items (5-10)
  static const List<String> quickChecklist = [
    'Внешний вид',
    'Повреждения кузова',
    'Колёса',
    'Стекла',
    'Госномер',
  ];

  // Full inspection items (10-15)
  static const List<String> fullChecklist = [
    'Внешний вид',
    'Повреждения кузова',
    'Лакокрасочное покрытие',
    'Колёса',
    'Стекла',
    'Фары и фонари',
    'Зеркала',
    'Двери',
    'Госномер',
    'Двигатель',
    'Салон',
    'Приборная панель',
  ];
}
