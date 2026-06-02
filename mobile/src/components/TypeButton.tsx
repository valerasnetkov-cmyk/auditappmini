import { TouchableOpacity, Text } from 'react-native'
import { useTheme } from '../theme'
import { styles } from '../styles'

export function TypeButton({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string
  selected: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const { colors } = useTheme()
  return (
    <TouchableOpacity
      style={[
        styles.typeButton,
        {
          backgroundColor: selected ? colors.primary : colors.inputBackground,
        },
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text
        style={[
          styles.typeButtonText,
          { color: selected ? colors.buttonText : colors.text },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )
}
