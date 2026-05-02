import React, { useState, useEffect } from 'react'
import { View, TextInput, Button, Text, StyleSheet } from 'react-native'
import api from '../api/api'
import { useNavigation } from '@react-navigation/native'
import { useToast } from '../contexts/ToastContext'
import AsyncStorage from '@react-native-async-storage/async-storage'

export default function LoginScreen({ navigation }: any) {
  const nav = useNavigation()
  const [email, setEmail] = useState('demo_inspector@example.com')
  const [password, setPassword] = useState('demo123')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  const login = async () => {
    // reset field errors and global error
    setEmailError(null)
    setPasswordError(null)
    setGeneralError(null)
    // Basic validation
    let ok = true
    if (!email) { setEmailError('Введите email'); ok = false } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError('Некорректный email'); ok = false }
    if (!password) { setPasswordError('Введите пароль'); ok = false } else if (password.length < 6) { setPasswordError('Пароль должен содержать не менее 6 символов'); ok = false }
    if (!ok) { showToast('Пожалуйста исправьте ошибки в форме', 'error'); return }

    setLoading(true)
    try {
      const res = await api.login(email, password)
      const token = res?.data?.token
      if (token) {
        await AsyncStorage.setItem('auth_token', token)
        showToast('Успешный вход', 'success')
        setTimeout(() => navigation.replace('Dashboard'), 600)
      } else if (res?.data?.mfaRequired) {
        // Navigate to MFA screen with necessary info
        const userId = res?.data?.user?.id
        navigation.navigate('Mfa', { userId })
      } else {
        showToast('Не удалось войти. Попробуйте другой логин.', 'error')
      }
    } catch (e: any) {
      showToast(e?.message ?? 'Ошибка входа', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Toasts are handled by ToastProvider

  return (
    <View style={styles.container}>
      
      <Text style={styles.title}>Login</Text>
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} onBlur={() => {
        if (!email) setEmailError('Введите email'); else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) setEmailError('Некорректный email'); else setEmailError(null)
      }} />
      {emailError ? <Text style={styles.error}>{emailError}</Text> : null}
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry onBlur={() => {
        if (!password) setPasswordError('Введите пароль'); else if (password.length < 6) setPasswordError('Пароль должен содержать не менее 6 символов'); else setPasswordError(null)
      }} />
      <Text style={styles.hint}>Пароль должен содержать не менее 6 символов. Рекомендуется использовать буквы и цифры.</Text>
      {passwordError ? <Text style={styles.error}>{passwordError}</Text> : null}
      {generalError ? <Text style={styles.error}>{generalError}</Text> : null}
      {loading ? (
        <Text style={styles.loading}>Загрузка...</Text>
      ) : (
        <Button title="Login" onPress={login} disabled={!!emailError || !!passwordError} />
      )}
      <View style={{ height: 8 }} />
      <Button title="Register" onPress={() => navigation.navigate('Register')} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16 },
  title: { fontSize: 24, marginBottom: 16, textAlign: 'center' },
  input: { height: 40, borderColor: '#ccc', borderWidth: 1, marginBottom: 12, paddingHorizontal: 8 }
  ,hint: { fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 6 }
})
