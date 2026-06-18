import type { Metadata } from 'next'
import { LegalDocument } from '../_components/LegalDocument'
import { PublicDocument } from '../_components/PublicDocument'

export const metadata: Metadata = {
  title: 'Согласие на рекламно-информационные сообщения — AuditAvto',
  description: 'Согласие на получение рекламно-информационных сообщений от AuditAvto.',
  alternates: { canonical: '/marketing-consent' },
}

export default function MarketingConsentPage() {
  return (
    <PublicDocument
      title="Согласие на получение рекламно-информационных сообщений"
      description="Отдельное согласие для новостей, предложений, акций, обновлений сервиса и иных сообщений."
      updated="18 июня 2026 года"
    >
      <LegalDocument fileName="marketing-consent.md" />
    </PublicDocument>
  )
}
