import type { Metadata } from 'next'
import { LegalDocument } from '../_components/LegalDocument'
import { PublicDocument } from '../_components/PublicDocument'

export const metadata: Metadata = {
  title: 'Политика обработки персональных данных — AuditAvto',
  description: 'Политика обработки персональных данных пользователей AuditAvto.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <PublicDocument
      title="Политика обработки персональных данных"
      description="Порядок обработки персональных данных пользователей auditavto.ru, права субъектов данных и меры защиты."
      updated="18 июня 2026 года"
    >
      <LegalDocument fileName="personal-data-policy.md" />
    </PublicDocument>
  )
}
