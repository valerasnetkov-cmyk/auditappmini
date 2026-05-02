import React, { useState } from 'react'
import { View, Text, TextInput, Button, StyleSheet } from 'react-native'
import api from '../api/api'
import { useNavigation, useRoute } from '@react-navigation/native'
import { useToast } from '../contexts/ToastContext'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

export default function MfaScreen() {
  const navigation = useNavigation()
  const route = useRoute()
  const userId = route.params?.userId
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  const verify = async () => {
    if (!code || code.length < 6) {
      showToast('Введите 6-значный код MFA', 'error')
      return
    }
    setLoading(true)
    try {
      const res = await api.verifyMfa(userId, code)
      const token = res?.data?.token
      if (token) {
        // Persist token
        try { await SecureStore.setItemAsync('auth_token', token) } catch {
          try { await AsyncStorage.setItem('auth_token', token) } catch {}
        }
        // Navigate to Dashboard
        navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] })
      } else {
        showToast('Неверный код MFA', 'error')
      }
    } catch (e: any) {
      showToast(e?.message ?? 'Ошибка MFA', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MFA</Text>
      <Text style={styles.label}>Введите код MFA из вашего authenticator</Text>
      <TextInput style={styles.input} placeholder="123456" value={code} onChangeText={setCode} keyboardType="numeric" maxLength={6} />
      <Button title={loading ? 'Проверка...' : 'Подтвердить'} onPress={verify} disabled={loading} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16 },
  title: { fontSize: 22, textAlign: 'center', marginBottom: 12 },
  label: { textAlign: 'center', color: '#555', marginBottom: 8 },
  input: { height: 40, borderColor: '#ccc', borderWidth: 1, marginBottom: 12, paddingHorizontal: 8 }
})
