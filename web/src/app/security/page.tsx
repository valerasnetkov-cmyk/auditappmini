import type { Metadata } from 'next'
import { PublicDocument } from '../_components/PublicDocument'

export const metadata: Metadata = {
  title: 'Безопасность — AuditAvto',
  description: 'Информация о мерах безопасности и сообщении об уязвимостях AuditAvto.',
  alternates: { canonical: '/security' },
}

export default function SecurityPage() {
  return (
    <PublicDocument
      title="Безопасность"
      description="Краткое описание реализованных мер и правил ответственного сообщения о возможных уязвимостях."
      updated="11 июня 2026 года"
    >
      <section>
        <h2>Контроль доступа</h2>
        <p>
          Рабочая часть сервиса требует авторизации и использует роли для ограничения доступных
          операций. Сессия передаётся в HttpOnly-cookie; production-настройки предусматривают
          атрибуты Secure и SameSite.
        </p>
      </section>

      <section>
        <h2>Защита веб-контура</h2>
        <p>
          Публичный сайт и API доступны по HTTPS. Веб-приложение настроено на запрет встраивания во
          фрейм, запрет MIME-sniffing, ограниченную передачу referrer и HSTS. API дополнительно
          применяет собственные security headers, CORS и ограничения частоты чувствительных запросов.
        </p>
      </section>

      <section>
        <h2>Фото и рабочие данные</h2>
        <p>
          Доступ к фотографиям и данным осмотров должен проверяться в контексте компании и роли.
          Перед пилотом с реальными данными отдельно подтверждаются регион хранения, резервные копии,
          журналы и используемые внешние обработчики.
        </p>
      </section>

      <section>
        <h2>Сообщение об уязвимости</h2>
        <p>
          Отправьте описание, шаги воспроизведения и возможное влияние на
          {' '}<a href="mailto:info@auditavto.ru">info@auditavto.ru</a>. Не получайте доступ к чужим
          данным, не нарушайте работу сервиса и не публикуйте детали до согласования исправления.
          Машиночитаемый контакт доступен в <a href="/.well-known/security.txt">security.txt</a>.
        </p>
      </section>
    </PublicDocument>
  )
}
