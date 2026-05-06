"use client"

import { useTheme } from '@/lib/theme'
import { t } from '@/lib/i18n'

export default function ThemeSwitcher() {
  const { theme, setTheme, resolvedTheme } = useTheme()

  return (
    <div className="flex items-center gap-2 p-2">
      <span className="text-sm text-foreground-secondary">{t('theme')}:</span>
      
      <div className="flex gap-1">
        <button
          onClick={() => setTheme('light')}
          className={`px-3 py-1 text-sm rounded ${
            theme === 'light' 
              ? 'bg-primary text-foreground-inverse' 
              : 'bg-muted-surface text-foreground-secondary hover:bg-soft-surface'
          }`}
        >
          {t('lightTheme')}
        </button>
        
        <button
          onClick={() => setTheme('dark')}
          className={`px-3 py-1 text-sm rounded ${
            theme === 'dark' 
              ? 'bg-primary text-foreground-inverse' 
              : 'bg-muted-surface text-foreground-secondary hover:bg-soft-surface'
          }`}
        >
          {t('darkTheme')}
        </button>
        
        <button
          onClick={() => setTheme('system')}
          className={`px-3 py-1 text-sm rounded ${
            theme === 'system' 
              ? 'bg-primary text-foreground-inverse' 
              : 'bg-muted-surface text-foreground-secondary hover:bg-soft-surface'
          }`}
        >
          {t('systemTheme')}
        </button>
      </div>
      
      {resolvedTheme && (
        <span className="text-xs text-foreground-muted">
          ({resolvedTheme === 'dark' ? t('darkTheme') : t('lightTheme')})
        </span>
      )}
    </div>
  )
}
