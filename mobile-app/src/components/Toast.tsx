import React, { useEffect, useRef } from 'react'
import { Animated, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Easing } from 'react-native'

export default function Toast({ visible, message, type, onPress }: { visible: boolean, message: string, type: 'success'|'error'|'info'|'warn', onPress?: () => void }) {
  if (!visible) return null
  const iconMap: Record<string, string> = {
    success: '✔',
    error: '✖',
    info: 'ℹ',
    warn: '⚠'
  }
  const icon = iconMap[type] || 'ℹ'
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(-20)).current
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 260, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
        Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true, easing: Easing.out(Easing.ease) })
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -20, duration: 260, useNativeDriver: true, easing: Easing.in(Easing.ease) }),
        Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true, easing: Easing.in(Easing.ease) })
      ]).start()
    }
  }, [visible])
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={{ width: '100%' }}>
      <Animated.View style={[styles.toast, type === 'success' ? styles.toastSuccess : (type === 'info' ? styles.toastInfo : (type === 'warn' ? styles.toastWarn : styles.toastError)), { opacity, transform: [{ translateY }] }]} accessibilityRole="status" aria-live="polite">
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', top: 40, left: 16, right: 16,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
    zIndex: 9999, elevation: 4
  },
  toastSuccess: { backgroundColor: '#34d399' },
  toastError: { backgroundColor: '#f87171' },
  toastInfo: { backgroundColor: '#3b82f6' },
  toastWarn: { backgroundColor: '#f59e0b' },
  icon: { color: '#fff', fontSize: 14, marginRight: 6 },
  text: { color: '#fff', fontSize: 14, marginLeft: 6 },
})
