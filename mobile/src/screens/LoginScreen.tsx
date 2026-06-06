import { useEffect } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import { useTheme } from '../theme'
import { Button, Card, ErrorText, Subtitle, Title } from '../components'
import { useLogin } from '../hooks/useLogin'

export function LoginScreen({ onLogin, initialMessage = '' }: { onLogin: () => void; initialMessage?: string }) {
  const { colors } = useTheme()
  const { email, setEmail, password, setPassword, loading, error, handleLogin, setError } = useLogin()

  useEffect(() => {
    setError(initialMessage)
  }, [initialMessage, setError])

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Card>
        <Title>Аудит техники</Title>
        <Subtitle>Вход в систему</Subtitle>
        {error ? <ErrorText>{error}</ErrorText> : null}
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border },
          ]}
          placeholder="Email"
          placeholderTextColor={colors.mutedText}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border },
          ]}
          placeholder="Пароль"
          placeholderTextColor={colors.mutedText}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Button
          title={loading ? 'Вход…' : 'Войти'}
          variant="primary"
          loading={loading}
          onPress={() => handleLogin(onLogin)}
        />
      </Card>
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
  input: {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 16,
    borderWidth: 1,
  },
})
