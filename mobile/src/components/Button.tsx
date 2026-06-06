import { ReactNode } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useTheme } from '../theme'
import { styles } from '../styles'

type Variant = 'primary' | 'secondary'

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  inactiveColor,
}: {
  title: string
  onPress: () => void
  variant?: Variant
  disabled?: boolean
  loading?: boolean
  inactiveColor?: string
}) {
  const { colors } = useTheme()

  const isSecondary = variant === 'secondary'
  const containerStyle = isSecondary ? styles.secondaryButton : styles.button
  const textStyle = isSecondary ? styles.secondaryButtonText : styles.buttonText
  const textColor = isSecondary ? colors.text : colors.buttonText
  const baseColor = isSecondary ? colors.inputBackground : colors.primary
  const borderColor = isSecondary ? colors.border : undefined

  const backgroundColor = disabled
    ? inactiveColor ?? colors.border
    : baseColor

  return (
    <TouchableOpacity
      style={[containerStyle, { backgroundColor, borderColor: borderColor as string | undefined }]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={isSecondary ? colors.text : colors.buttonText} />
      ) : (
        <Text style={[textStyle, { color: textColor }]}>{title}</Text>
      )}
    </TouchableOpacity>
  )
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  const { colors } = useTheme()
  return (
    <View style={[styles.card, { backgroundColor: colors.card }, style]}>
      {children}
    </View>
  )
}
