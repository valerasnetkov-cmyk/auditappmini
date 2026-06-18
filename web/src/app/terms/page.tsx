import type { Metadata } from 'next'
import { LegalDocument } from '../_components/LegalDocument'
import { PublicDocument } from '../_components/PublicDocument'

export const metadata: Metadata = {
  title: 'Пользовательское соглашение — AuditAvto',
  description: 'Пользовательское соглашение auditavto.ru.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return (
    <PublicDocument
      title="Пользовательское соглашение"
      description="Условия использования сайта auditavto.ru и функциональности онлайн-сервиса."
      updated="18 июня 2026 года"
    >
      <LegalDocument fileName="terms-of-use.md" />
    </PublicDocument>
  )
}
