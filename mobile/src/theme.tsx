import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useColorScheme, Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

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
  background: '#f8fafc',
  surface: '#ffffff',
  card: '#ffffff',
  text: '#0f172a',
  mutedText: '#64748b',
  border: '#e2e8f0',
  primary: '#2563eb',
  danger: '#dc2626',
  warning: '#f59e0b',
  success: '#16a34a',
  inputBackground: '#f1f5f9',
  buttonText: '#ffffff',
}

const dark: ThemeColors = {
  background: '#020617',
  surface: '#0f172a',
  card: '#1e293b',
  text: '#f1f5f9',
  mutedText: '#94a3b8',
  border: '#334155',
  primary: '#3b82f6',
  danger: '#ef4444',
  warning: '#fbbf24',
  success: '#22c55e',
  inputBackground: '#1e293b',
  buttonText: '#ffffff',
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