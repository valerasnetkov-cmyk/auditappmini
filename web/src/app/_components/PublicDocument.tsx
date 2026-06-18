import Link from 'next/link'
import Image from 'next/image'
import type { ReactNode } from 'react'
import styles from './public-document.module.css'

type PublicDocumentProps = {
  title: string
  description: string
  updated: string
  children: ReactNode
}

export function PublicDocument({ title, description, updated, children }: PublicDocumentProps) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="AuditAvto">
          <Image src="/brand/auditavto-logo-horizontal.svg" alt="AuditAvto" width={244} height={48} priority />
        </Link>
        <Link href="/">На главную</Link>
      </header>

      <article className={styles.document}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Публичная информация</p>
          <h1>{title}</h1>
          <p>{description}</p>
          <small>Обновлено: {updated}</small>
        </div>
        <div className={styles.content}>{children}</div>
      </article>

      <footer className={styles.footer}>
        <Link href="/privacy">Конфиденциальность</Link>
        <Link href="/terms">Пользовательское соглашение</Link>
        <Link href="/offer">Оферта</Link>
        <Link href="/personal-data-consent">Согласие на ПДн</Link>
        <Link href="/marketing-consent">Согласие на рассылку</Link>
        <Link href="/security">Безопасность</Link>
        <Link href="/cookie-policy">Cookies</Link>
        <a href="mailto:info@auditavto.ru">info@auditavto.ru</a>
      </footer>
    </main>
  )
}
