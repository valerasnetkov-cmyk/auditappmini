import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useTheme } from '../theme'
import { Subtitle } from '../components'

export function LoadingScreen() {
  const { colors } = useTheme()
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Subtitle color={colors.mutedText}>Загрузка…</Subtitle>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
})
