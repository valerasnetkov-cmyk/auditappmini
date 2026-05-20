import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native'
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera'
import { useTheme } from './theme'

type CameraCaptureProps = {
  onCapture: (photo: { base64: string; uri: string }) => void
  onClose: () => void
  title?: string
}

export default function CameraCapture({ onCapture, onClose, title }: CameraCaptureProps) {
  const { colors } = useTheme()
  const cameraRef = useRef<CameraView>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const [facing, setFacing] = useState<'back' | 'front'>('back')
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('auto')

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission()
    }
  }, [])

  const handleCapture = async () => {
    if (!cameraRef.current) return

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
        base64: true,
      })

      if (photo?.base64) {
        onCapture({ base64: photo.base64, uri: photo.uri })
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось сделать фото')
    }
  }

  const toggleFacing = () => {
    setFacing(current => current === 'back' ? 'front' : 'back')
  }

  const toggleFlash = () => {
    setFlash(current => {
      if (current === 'off') return 'on'
      if (current === 'on') return 'auto'
      return 'off'
    })
  }

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.text, { color: colors.text }]}>Загрузка...</Text>
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.text, { color: colors.text }]}>
          Камера требует разрешения
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={requestPermission}
        >
          <Text style={[styles.buttonText, { color: colors.buttonText }]}>
            Разрешить
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cancelButton, { backgroundColor: colors.inputBackground }]}
          onPress={onClose}
        >
          <Text style={[styles.cancelText, { color: colors.text }]}>
            Отмена
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
      >
        <View style={styles.topControls}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
            onPress={toggleFlash}
          >
            <Text style={styles.iconText}>
              {flash === 'on' ? '⚡' : flash === 'off' ? '⚡️' : '⚡A'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
            onPress={toggleFacing}
          >
            <Text style={styles.iconText}>🔄</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
            onPress={onClose}
          >
            <Text style={styles.iconText}>✕</Text>
          </TouchableOpacity>
        </View>

        {title && (
          <View style={styles.titleContainer}>
            <Text style={styles.titleText}>{title}</Text>
          </View>
        )}

        <View style={styles.bottomControls}>
          <TouchableOpacity
            style={[styles.captureButton, { borderColor: colors.buttonText }]}
            onPress={handleCapture}
          >
            <View style={[styles.captureInner, { backgroundColor: colors.buttonText }]} />
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  cancelText: {
    fontSize: 16,
  },
  topControls: {
    position: 'absolute',
    top: 60,
    right: 20,
    left: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 20,
  },
  titleContainer: {
    position: 'absolute',
    bottom: 140,
    left: 20,
    right: 20,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  titleText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
})
