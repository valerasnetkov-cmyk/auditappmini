import React, { useEffect, useState } from 'react'
import { View, Text, Button, StyleSheet } from 'react-native'
import api from '../api/api'
import { useNavigation } from '@react-navigation/native'
import { useToast } from '../contexts/ToastContext'
import NetInfo from '@react-native-community/netinfo'
import NetworkBanner from '../components/NetworkBanner'

export default function DashboardScreen({ navigation }: any) {
  const nav = useNavigation()
  const [stats, setStats] = useState<any>(null)
  const { showToast } = useToast()
  const [isConnected, setIsConnected] = useState<boolean | null>(null)

  const retryConnection = async () => {
    try {
      const state = await NetInfo.fetch()
      const online = state.isConnected
      setIsConnected(online)
      showToast(online ? 'Соединение восстановлено' : 'Нет соединения', online ? 'success' : 'warn')
    } catch {
      showToast('Нет соединения', 'warn')
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getDashboardStats()
        setStats(res?.data || null)
      } catch {
        // ignore
      }
    })()
  }, [])

  // Monitor network connectivity and display toast on changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected
      if (online !== isConnected) {
        setIsConnected(online)
        if (online === false) {
          showToast('Нет сетевого соединения', 'warn')
        } else {
          showToast('Соединение восстановлено', 'success')
        }
      }
    })
    return () => unsubscribe()
  }, [isConnected])

  const logout = async () => {
    try { await api.logout(); } catch { }
    // navigate to Login screen
    nav.reset({ index: 0, routes: [{ name: 'Login' }] })
  }

  return (
    <View style={styles.container}>
      <NetworkBanner isOnline={isConnected} onRetry={retryConnection} />
      <Text style={styles.title}>Dashboard</Text>
      {stats ? (
        <Text>Vehicles: {stats.totalVehicles}, Inspections Today: {stats.inspectionsToday}</Text>
      ) : (
        <Text>Loading stats...</Text>
      )}
      <Button title="View Defects" onPress={() => navigation.navigate('Defects')} />
      <View style={{ height: 8 }} />
      <Button title="Show Info Toast" onPress={() => showToast('Это информационное уведомление', 'info')} />
      <View style={{ height: 8 }} />
      <Button title="Logout" onPress={logout} color="#e74c3c" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, marginBottom: 12 }
})
