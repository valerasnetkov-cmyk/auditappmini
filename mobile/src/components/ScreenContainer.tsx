import { ReactNode } from 'react'
import { View, Text } from 'react-native'
import { useTheme } from '../theme'
import { styles } from '../styles'

export function ScreenContainer({ children, fullScreen }: { children: ReactNode; fullScreen?: boolean }) {
  const { colors } = useTheme()
  return (
    <View
      style={[
        fullScreen ? styles.fullScreen : styles.container,
        { backgroundColor: colors.background },
      ]}
    >
      {children}
    </View>
  )
}

export function Title({ children, color }: { children: ReactNode; color?: string }) {
  const { colors } = useTheme()
  return <Text style={[styles.title, { color: color || colors.text }]}>{children}</Text>
}

export function Subtitle({ children, color }: { children: ReactNode; color?: string }) {
  const { colors } = useTheme()
  return <Text style={[styles.subtitle, { color: color || colors.mutedText }]}>{children}</Text>
}

export function Label({ children, color }: { children: ReactNode; color?: string }) {
  const { colors } = useTheme()
  return <Text style={[styles.label, { color: color || colors.text }]}>{children}</Text>
}

export function SubLabel({ children, color }: { children: ReactNode; color?: string }) {
  const { colors } = useTheme()
  return <Text style={[styles.sublabel, { color: color || colors.text }]}>{children}</Text>
}

export function ErrorText({ children }: { children: ReactNode }) {
  const { colors } = useTheme()
  if (!children) return null
  return <Text style={[styles.error, { color: colors.danger }]}>{children}</Text>
}
