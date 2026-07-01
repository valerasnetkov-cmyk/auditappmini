'use client'

import { useEffect } from 'react'

export function LandingLightTheme() {
  useEffect(() => {
    const root = document.documentElement
    const previousTheme = root.getAttribute('data-theme')
    const previousColorScheme = root.style.colorScheme

    const forceLight = () => {
      if (root.getAttribute('data-theme') !== 'light') {
        root.setAttribute('data-theme', 'light')
      }
      root.style.colorScheme = 'light'
    }

    forceLight()
    const observer = new MutationObserver(forceLight)
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] })

    return () => {
      observer.disconnect()
      if (previousTheme) {
        root.setAttribute('data-theme', previousTheme)
      } else {
        root.removeAttribute('data-theme')
      }
      root.style.colorScheme = previousColorScheme
    }
  }, [])

  return null
}
