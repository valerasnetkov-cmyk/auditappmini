import { useState } from 'react'
import { Alert } from 'react-native'
import * as Location from 'expo-location'

export type AccidentLocation = {
  latitude: number
  longitude: number
} | null

export function formatCoordinates(location: AccidentLocation) {
  return location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : ''
}

export function useAccidentLocation() {
  const [currentLocation, setCurrentLocation] = useState<AccidentLocation>(null)
  const [locationLoading, setLocationLoading] = useState(false)

  const getCurrentLocation = async (
    onResolved?: (coords: { latitude: number; longitude: number }) => void,
    options: { silent?: boolean } = {},
  ): Promise<AccidentLocation> => {
    setLocationLoading(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        if (!options.silent) Alert.alert('Ошибка', 'Нет доступа к геолокации')
        return null
      }
      const location = await Location.getCurrentPositionAsync({})
      const coordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      }
      setCurrentLocation(coordinates)
      onResolved?.(coordinates)
      return coordinates
    } catch {
      if (!options.silent) Alert.alert('Ошибка', 'Не удалось получить координаты')
      return null
    } finally {
      setLocationLoading(false)
    }
  }

  return { currentLocation, setCurrentLocation, locationLoading, getCurrentLocation, formatCoordinates }
}
