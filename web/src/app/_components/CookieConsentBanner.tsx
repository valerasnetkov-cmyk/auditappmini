'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import styles from '../landing.module.css'

const COOKIE_CONSENT_KEY = 'auditavto_cookie_consent'

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(window.localStorage.getItem(COOKIE_CONSENT_KEY) !== 'accepted')
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const acceptCookies = () => {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <aside className={styles.cookieBanner} aria-label="Уведомление о cookies">
      <div>
        <strong>Мы используем cookies</strong>
        <p>
          AuditAvto использует обязательные cookies и локальное хранение для входа,
          настроек интерфейса и улучшения работы публичного сайта.
        </p>
      </div>
      <div className={styles.cookieActions}>
        <Link href="/cookie-policy">Подробнее</Link>
        <button type="button" onClick={acceptCookies}>Понятно</button>
      </div>
    </aside>
  )
}
