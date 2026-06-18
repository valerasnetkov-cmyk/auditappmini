import type { Metadata } from 'next'
import { LegalDocument } from '../_components/LegalDocument'
import { PublicDocument } from '../_components/PublicDocument'

export const metadata: Metadata = {
  title: 'Согласие на обработку персональных данных — AuditAvto',
  description: 'Согласие пользователя на обработку персональных данных при использовании auditavto.ru.',
  alternates: { canonical: '/personal-data-consent' },
}

export default function PersonalDataConsentPage() {
  return (
    <PublicDocument
      title="Согласие на обработку персональных данных"
      description="Текст согласия для форм сайта, заявок, регистрации и иных сценариев передачи персональных данных."
      updated="18 июня 2026 года"
    >
      <LegalDocument fileName="personal-data-consent.md" />
    </PublicDocument>
  )
}
