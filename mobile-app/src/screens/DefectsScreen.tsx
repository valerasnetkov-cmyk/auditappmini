import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import api from '../api/api'

export default function DefectsScreen({ navigation }: any) {
  const [defects, setDefects] = useState<any[]>([])

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const res = await api.getDefects({ page: 1, limit: 20 })
      setDefects(res?.data || [])
    } catch (e) {
      console.log('Defects load error', e)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Defects</Text>
      <FlatList
        data={defects}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('DefectDetail', { id: item.id })}>
            <Text style={styles.item}>{item.title || 'Defect'}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, marginBottom: 8 },
  item: { padding: 8, borderBottomWidth: 1, borderColor: '#eee' }
})
