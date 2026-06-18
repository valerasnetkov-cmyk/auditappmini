import type { Metadata } from 'next'
import { LegalDocument } from '../_components/LegalDocument'
import { PublicDocument } from '../_components/PublicDocument'

export const metadata: Metadata = {
  title: 'Публичная оферта — AuditAvto',
  description: 'Публичная оферта ООО "Аудит авто" для предоставления доступа к онлайн-сервису AuditAvto.',
  alternates: { canonical: '/offer' },
}

export default function OfferPage() {
  return (
    <PublicDocument
      title="Публичная оферта"
      description="Условия предоставления доступа к онлайн-сервису AuditAvto по подписке / SaaS."
      updated="18 июня 2026 года"
    >
      <LegalDocument fileName="public-offer.md" />
    </PublicDocument>
  )
}
