import React, { useState, useEffect } from 'react'
import { View, TextInput, Button, Text, StyleSheet } from 'react-native'
import api from '../api/api'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useNavigation } from '@react-navigation/native'
import { useToast } from '../contexts/ToastContext'

export default function RegistrationScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigation = useNavigation()
  const { showToast } = useToast()
  const register = async () => {
    // reset errors
    setNameError(null); setEmailError(null); setPasswordError(null); setGeneralError(null)
    let ok = true
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!name) { setNameError('Введите имя'); ok = false }
    if (!email) { setEmailError('Введите email'); ok = false } else if (!emailRegex.test(email)) { setEmailError('Неверный email'); ok = false }
    if (!password) { setPasswordError('Введите пароль'); ok = false } else if (password.length < 6) { setPasswordError('Пароль должен содержать не менее 6 символов'); ok = false }
    if (!ok) { setGeneralError('Пожалуйста исправьте ошибки в форме'); return }

    setLoading(true)
    try {
      const res = await api.register({ email, password, name, role: 'inspector' })
      const token = res?.data?.token
      if (token) {
        await AsyncStorage.setItem('auth_token', token)
        showToast('Регистрация прошла успешно', 'success')
        setTimeout(() => {
          navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] })
        }, 900)
        return
      }
      // Try login as fallback
      const loginRes = await api.login(email, password)
      const t = loginRes?.data?.token
      if (t) {
        await AsyncStorage.setItem('auth_token', t)
        navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] })
        return
      }
      setGeneralError('Не удалось зарегистрироваться.')
      showToast('Не удалось зарегистрироваться', 'error')
    } catch (e: any) {
      setGeneralError(e?.message ?? 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  // Inline validation handlers
  const onNameBlur = () => {
    if (!name || name.trim().length < 2) setNameError('Имя должно быть не менее 2 символов')
    else setNameError(null)
  }
  const onEmailBlur = () => {
    if (!email) { setEmailError('Введите email'); return }
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!re.test(email)) setEmailError('Неверный email')
    else setEmailError(null)
  }
  const onPasswordBlur = () => {
    if (!password) { setPasswordError('Введите пароль'); return }
    if (password.length < 6) setPasswordError('Пароль должен содержать не менее 6 символов')
    else setPasswordError(null)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>
      <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} onBlur={onNameBlur} />
      {nameError ? <Text style={styles.error}>{nameError}</Text> : null}
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" onBlur={onEmailBlur} />
      {emailError ? <Text style={styles.error}>{emailError}</Text> : null}
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry onBlur={onPasswordBlur} />
      <Text style={styles.hint}>Пароль должен содержать не менее 6 символов; рекомендуется использовать буквы и цифры.</Text>
      {passwordError ? <Text style={styles.error}>{passwordError}</Text> : null}
      {generalError ? <Text style={styles.error}>{generalError}</Text> : null}
      {loading ? (
        <Text style={styles.loading}>Регистрация...</Text>
      ) : (
        <Button title="Register" onPress={register} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16 },
  title: { fontSize: 22, marginBottom: 12, textAlign: 'center' },
  input: { height: 40, borderColor: '#ccc', borderWidth: 1, marginBottom: 6, paddingHorizontal: 8 },
  error: { color: '#e11d48', fontSize: 12, marginBottom: 6 },
  loading: { textAlign: 'center', marginTop: 6, color: '#374151' },
  hint: { fontSize: 12, color: '#6b7280', textAlign: 'left', marginTop: 6, marginLeft: 2 }
  ,toast: { position: 'absolute', top: 10, left: 10, right: 10, padding: 12, borderRadius: 8, elevation: 4 },
  toastSuccess: { backgroundColor: '#34d399' },
  toastError: { backgroundColor: '#f87171' },
  toastText: { color: '#fff', textAlign: 'center' }
})
