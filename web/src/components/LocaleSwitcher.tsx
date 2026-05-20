"use client"

import { setLocale, t } from '@/lib/i18n'
import { useState, useSyncExternalStore } from 'react'

function getStoredLocale() {
  if (typeof window === 'undefined') return 'ru'

  const stored = localStorage.getItem('locale')
  return stored === 'en' || stored === 'ru' ? stored : 'ru'
}

function subscribeToClientReady() {
  return () => {}
}

export default function LocaleSwitcher() {
  const mounted = useSyncExternalStore(subscribeToClientReady, () => true, () => false)
  const [locale, setLocaleState] = useState<'ru' | 'en'>(getStoredLocale)

  if (!mounted) return null

  return (
    <div className="flex items-center gap-2 p-2">
      <span className="text-sm text-gray-600">{t('language') || 'Язык'}:</span>
      <div className="flex gap-1">
        <button
          onClick={() => { setLocale('ru'); setLocaleState('ru'); }}
          className={`px-3 py-1 text-sm rounded ${
            locale === 'ru' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          RU
        </button>
        <button
          onClick={() => { setLocale('en'); setLocaleState('en'); }}
          className={`px-3 py-1 text-sm rounded ${
            locale === 'en' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          EN
        </button>
      </div>
    </div>
  )
}
