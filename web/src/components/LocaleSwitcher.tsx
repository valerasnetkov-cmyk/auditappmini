"use client"

import { setLocale, t } from '@/lib/i18n'
import { useState, useEffect } from 'react'

export default function LocaleSwitcher() {
  const [mounted, setMounted] = useState(false)
  const [locale, setLocaleState] = useState<'ru' | 'en'>('ru')

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('locale') as 'ru' | 'en' | null
    if (stored) setLocaleState(stored)
  }, [])

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