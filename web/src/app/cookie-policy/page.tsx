import type { Metadata } from 'next'
import { PublicDocument } from '../_components/PublicDocument'

export const metadata: Metadata = {
  title: 'Cookies — AuditAvto',
  description: 'Информация о cookies и локальном хранении настроек AuditAvto.',
  alternates: { canonical: '/cookie-policy' },
}

export default function CookiePolicyPage() {
  return (
    <PublicDocument
      title="Cookies и локальное хранение"
      description="Сервис использует технические механизмы, необходимые для входа и сохранения пользовательских настроек. Рекламные cookies на публичной странице не заявлены."
      updated="11 июня 2026 года"
    >
      <section>
        <h2>Авторизационная cookie</h2>
        <p>
          После успешного входа API может установить обязательную cookie <code>audit_session</code>.
          Она используется для поддержки авторизованной сессии, недоступна JavaScript-коду страницы
          благодаря HttpOnly и в production передаётся только по защищённому соединению.
        </p>
      </section>

      <section>
        <h2>Срок сессии</h2>
        <p>
          Текущая production-конфигурация предусматривает срок сессии до семи дней. Выход из аккаунта
          удаляет авторизационную cookie. Администратор также может прекратить или отозвать доступ.
        </p>
      </section>

      <section>
        <h2>Local storage</h2>
        <p>
          Браузер может локально сохранять выбранную тему, язык интерфейса и технический признак
          активной сессии. Эти значения используются для работы интерфейса и не являются рекламными
          идентификаторами.
        </p>
      </section>

      <section>
        <h2>Управление</h2>
        <p>
          Cookies и локальные данные можно удалить в настройках браузера. Удаление обязательной
          авторизационной cookie завершит сессию и потребует повторного входа.
        </p>
      </section>
    </PublicDocument>
  )
}
