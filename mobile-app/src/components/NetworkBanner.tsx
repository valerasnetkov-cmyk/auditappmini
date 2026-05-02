import React from 'react'
import { View, Text, Button, StyleSheet } from 'react-native'

export default function NetworkBanner({ isOnline, onRetry }: { isOnline: boolean | null, onRetry: () => void }) {
  if (isOnline !== false) return null
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Нет интернет-соединения</Text>
      <Button title="Проверить снова" onPress={onRetry} color="#111827" />
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', zIndex: 9999
  },
  text: {
    color: '#111', fontWeight: '600', marginRight: 8
  }
})
