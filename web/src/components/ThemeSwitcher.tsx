"use client"

import { useTheme } from '@/lib/theme'
import { t } from '@/lib/i18n'

export default function ThemeSwitcher() {
  const { theme, setTheme, resolvedTheme } = useTheme()

  return (
    <div className="flex items-center gap-2 p-2">
      <span className="text-sm text-gray-600">{t('theme')}:</span>
      
      <div className="flex gap-1">
        <button
          onClick={() => setTheme('light')}
          className={`px-3 py-1 text-sm rounded ${
            theme === 'light' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {t('lightTheme')}
        </button>
        
        <button
          onClick={() => setTheme('dark')}
          className={`px-3 py-1 text-sm rounded ${
            theme === 'dark' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {t('darkTheme')}
        </button>
        
        <button
          onClick={() => setTheme('system')}
          className={`px-3 py-1 text-sm rounded ${
            theme === 'system' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {t('systemTheme')}
        </button>
      </div>
      
      {resolvedTheme && (
        <span className="text-xs text-gray-500">
          ({resolvedTheme === 'dark' ? t('darkTheme') : t('lightTheme')})
        </span>
      )}
    </div>
  )
}