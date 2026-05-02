import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import api from '../api/api'

export default function DefectDetailScreen({ route }: any) {
  const { id } = route.params
  const [defect, setDefect] = useState<any>(null)

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getDefect(id)
        setDefect(res?.data || null)
      } catch {
        // ignore
      }
    })()
  }, [id])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Defect Detail</Text>
      {defect ? (
        <>
          <Text>ID: {defect.id}</Text>
          <Text>Title: {defect.title}</Text>
          <Text>Description: {defect.comment || '—'}</Text>
        </>
      ) : (
        <Text>Loading...</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, marginBottom: 8 }
})
