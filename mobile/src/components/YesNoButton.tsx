import { TouchableOpacity, Text } from 'react-native'
import { useTheme } from '../theme'
import { styles } from '../styles'

export function YesNoButton({
  label,
  selected,
  tone,
  onPress,
}: {
  label: string
  selected: boolean
  tone: 'positive' | 'negative'
  onPress: () => void
}) {
  const { colors } = useTheme()
  const activeColor = tone === 'positive' ? colors.success : colors.danger
  return (
    <TouchableOpacity
      style={[
        styles.yesNoButton,
        { backgroundColor: selected ? activeColor : colors.inputBackground },
      ]}
      onPress={onPress}
    >
      <Text style={{ color: selected ? colors.buttonText : colors.text }}>{label}</Text>
    </TouchableOpacity>
  )
}
