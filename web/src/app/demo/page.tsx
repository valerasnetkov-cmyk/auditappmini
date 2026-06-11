import type { Metadata } from 'next'
import Link from 'next/link'
import {
  CameraIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  TruckIcon,
} from '@heroicons/react/24/outline'
import { DemoLoginButton } from './DemoLoginButton'

export const metadata: Metadata = {
  title: 'Демо AuditAvto — контроль техники на тестовом автопарке',
  description: 'Откройте демо-кабинет AuditAvto с тестовыми осмотрами, дефектами, фото и историей пробега.',
}

const pilotHref = 'mailto:info@auditavto.ru?subject=Запустить пилот AuditAvto'

const demoItems = [
  [TruckIcon, 'Тестовый автопарк', '12 единиц техники с разными статусами и историей.'],
  [ClipboardDocumentCheckIcon, 'Осмотры', 'Быстрые, плановые и ДТП-осмотры с чек-листами.'],
  [CameraIcon, 'Фотофиксация', 'Обязательные фото, одометр и примеры фиксации дефектов.'],
  [ExclamationTriangleIcon, 'Дефекты', 'Активные и закрытые замечания по технике.'],
  [ChartBarIcon, 'Аналитика', 'Сводка по состоянию парка и динамике осмотров.'],
  [LockClosedIcon, 'Безопасный режим', 'Только тестовые данные, без доступа к реальным компаниям.'],
]

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg-app)] px-5 py-8 text-foreground sm:px-8 lg:py-14">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="text-xl font-semibold text-foreground">AuditAvto</Link>
          <Link href="/" className="text-sm font-semibold text-foreground-secondary hover:text-primary">На главную</Link>
        </header>

        <section className="mt-12 grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
              Демо: контроль техники на тестовом автопарке
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-foreground-secondary">
              Посмотрите, как сервис фиксирует осмотры, обязательные фото, дефекты, пробег и историю техники в единой доказательной базе.
            </p>
            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <DemoLoginButton />
              <a href={pilotHref} className="btn btn-secondary min-w-44">Запросить пилот</a>
            </div>
            <p className="mt-5 text-sm text-foreground-muted">
              Регистрация не требуется. Демо открывается в режиме просмотра.
            </p>
          </div>

          <aside className="rounded-card border border-line bg-surface p-6 shadow-card sm:p-8">
            <div className="flex items-center gap-3 text-status-success">
              <CheckCircleIcon aria-hidden="true" className="h-7 w-7" />
              <h2 className="text-xl font-semibold text-foreground">Что посмотреть за 2–3 минуты</h2>
            </div>
            <ol className="mt-6 space-y-5 text-sm leading-6 text-foreground-secondary">
              <li><strong className="text-foreground">1. Дашборд:</strong> оцените общую картину по парку.</li>
              <li><strong className="text-foreground">2. Техника:</strong> откройте карточку и историю осмотров.</li>
              <li><strong className="text-foreground">3. Дефекты:</strong> посмотрите активные замечания и фото.</li>
              <li><strong className="text-foreground">4. Осмотр:</strong> откройте чек-лист, пробег и доказательства.</li>
            </ol>
          </aside>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold text-foreground">Что находится внутри</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {demoItems.map(([Icon, title, text]) => (
              <article key={title as string} className="rounded-card border border-line bg-surface p-5 shadow-card">
                <Icon aria-hidden="true" className="h-7 w-7 text-primary" />
                <h3 className="mt-4 font-semibold text-foreground">{title as string}</h3>
                <p className="mt-2 text-sm leading-6 text-foreground-secondary">{text as string}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-card border border-amber-200 bg-amber-50 p-6 text-amber-950">
          <h2 className="font-semibold">Ограничения демо</h2>
          <p className="mt-2 text-sm leading-6">
            Изменение пользователей, настроек, техники, осмотров, дефектов и фотографий отключено. Демо содержит только обезличенные тестовые данные.
          </p>
        </section>
      </div>
    </main>
  )
}
