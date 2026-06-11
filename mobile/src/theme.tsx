import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useColorScheme, Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { auditAvtoDarkTheme, auditAvtoLightTheme } from './theme/auditavtoTheme'

const isWeb = Platform.OS === 'web'

export type ThemeMode = 'system' | 'light' | 'dark'

type ThemeColors = {
  background: string
  surface: string
  card: string
  text: string
  mutedText: string
  border: string
  primary: string
  danger: string
  warning: string
  success: string
  inputBackground: string
  buttonText: string
}

const light: ThemeColors = {
  background: auditAvtoLightTheme.colors.background,
  surface: auditAvtoLightTheme.colors.surface,
  card: auditAvtoLightTheme.colors.surface,
  text: auditAvtoLightTheme.colors.textPrimary,
  mutedText: auditAvtoLightTheme.colors.textMuted,
  border: auditAvtoLightTheme.colors.border,
  primary: auditAvtoLightTheme.colors.orange,
  danger: auditAvtoLightTheme.colors.danger,
  warning: auditAvtoLightTheme.colors.warning,
  success: auditAvtoLightTheme.colors.success,
  inputBackground: auditAvtoLightTheme.colors.mutedSurface,
  buttonText: auditAvtoLightTheme.colors.inverseText,
}

const dark: ThemeColors = {
  background: auditAvtoDarkTheme.colors.background,
  surface: auditAvtoDarkTheme.colors.surface,
  card: auditAvtoDarkTheme.colors.surface,
  text: auditAvtoDarkTheme.colors.textPrimary,
  mutedText: auditAvtoDarkTheme.colors.textMuted,
  border: auditAvtoDarkTheme.colors.border,
  primary: auditAvtoDarkTheme.colors.orange,
  danger: auditAvtoDarkTheme.colors.danger,
  warning: auditAvtoDarkTheme.colors.warning,
  success: auditAvtoDarkTheme.colors.success,
  inputBackground: auditAvtoDarkTheme.colors.mutedSurface,
  buttonText: auditAvtoDarkTheme.colors.inverseText,
}

interface ThemeContextType {
  mode: ThemeMode
  colors: ThemeColors
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'system',
  colors: light,
  setMode: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme()
  const [mode, setModeState] = useState<ThemeMode>('system')

  useEffect(() => {
    loadTheme()
  }, [])

  const loadTheme = async () => {
    try {
      const saved = isWeb 
        ? await AsyncStorage.getItem('theme_mode')
        : await SecureStore.getItemAsync('theme_mode')
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setModeState(saved)
      }
    } catch {}
  }

  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode)
    try {
      if (isWeb) {
        await AsyncStorage.setItem('theme_mode', newMode)
      } else {
        await SecureStore.setItemAsync('theme_mode', newMode)
      }
    } catch {}
  }

  const colors = mode === 'system'
    ? (systemColorScheme === 'dark' ? dark : light)
    : mode === 'dark'
      ? dark
      : light

  return (
    <ThemeContext.Provider value={{ mode, colors, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
