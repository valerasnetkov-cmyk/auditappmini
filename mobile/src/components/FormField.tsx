import { TextInput, TextInputProps } from 'react-native'
import { useTheme } from '../theme'
import { styles } from '../styles'

export function FormField({
  variant = 'input',
  ...props
}: TextInputProps & { variant?: 'input' | 'comment' }) {
  const { colors } = useTheme()
  const style = variant === 'comment' ? styles.commentInput : styles.input
  return (
    <TextInput
      {...props}
      style={[
        style,
        {
          backgroundColor: colors.inputBackground,
          color: colors.text,
          borderColor: colors.border,
        },
      ]}
      placeholderTextColor={props.placeholderTextColor ?? colors.mutedText}
    />
  )
}
