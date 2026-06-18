import Layout from '@/components/Layout'
import Link from 'next/link'

export default function InspectionsNewPage() {
  return (
    <Layout currentPage="inspections">
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="card max-w-xl p-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">Осмотр проводится только с мобильного устройства</h1>
          <p className="mt-3 text-sm leading-6 text-foreground-secondary">
            Веб-панель используется для контроля, истории, дефектов и отчётов. Новый осмотр нужно начать
            в мобильном приложении AuditAvto: фото фиксируются камерой онлайн, без загрузки из галереи.
          </p>
          <Link href="/inspections" className="btn btn-primary mt-6">
            Вернуться к журналу осмотров
          </Link>
        </div>
      </div>
    </Layout>
  )
}
