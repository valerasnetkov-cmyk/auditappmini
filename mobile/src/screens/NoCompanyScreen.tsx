import { StyleSheet, View } from 'react-native'
import { useTheme } from '../theme'
import { api } from '../api'
import { Button, Subtitle } from '../components'

export function NoCompanyScreen({ onSignedOut }: { onSignedOut: () => void }) {
  const { colors } = useTheme()
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Subtitle>Нет доступных компаний — обратитесь к администратору</Subtitle>
      <View style={styles.action}>
        <Button
          title="Выйти"
          variant="primary"
          onPress={async () => {
            await api.logout()
            onSignedOut()
          }}
        />
      </View>
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
  action: {
    width: '100%',
    maxWidth: 340,
  },
})
