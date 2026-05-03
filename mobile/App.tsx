import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { NavigationContainer } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Alert } from 'react-native'
import * as Location from 'expo-location'
import { ThemeProvider, useTheme } from './src/theme'
import { api } from './src/api'
import type { User, Vehicle, Company } from './src/types'
import { PHOTO_REQUIREMENTS, InspectionType, QUICK_CHECKLIST, SCHEDULED_CHECKLIST, ACCIDENT_CHECKLIST } from './src/types'
import CameraCapture from './src/CameraCapture'

type RootStackParamList = {
  Login: undefined
  Home: undefined
  VehicleNumber: undefined
  InspectionTypeSelect: undefined
  Photos: undefined
  Odometer: undefined
  Checklist: undefined
  AccidentDamage: undefined
  Complete: undefined
}

function App() {
  return (
    <ThemeProvider>
      <Main />
    </ThemeProvider>
  )
}

function Main() {
  const { colors } = useTheme()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const u = await api.getMe()
      setUser(u)
      const comps = await api.getCompanies()
      setCompanies(comps)
      if (comps.length === 1 && comps[0]) {
        setSelectedCompany(comps[0])
      }
    } catch (e: any) {
      console.log('Auth check failed:', e.message)
      setUser(null)
      setCompanies([])
      setSelectedCompany(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (!user) {
    return <LoginScreen onLogin={checkAuth} />
  }

  if (companies.length === 0 || !selectedCompany) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.error, { color: colors.danger }]}>
          Нет доступных компаний
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={async () => {
            await api.logout()
            setUser(null)
            setCompanies([])
            setSelectedCompany(null)
          }}
        >
          <Text style={[styles.buttonText, { color: colors.buttonText }]}>Выйти</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (companies.length > 1 && !selectedCompany) {
    return (
      <CompanySelectScreen
        companies={companies}
        onSelect={setSelectedCompany}
      />
    )
  }

  return <InspectionFlowScreen company={selectedCompany!} />
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const { colors } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Заполните email и пароль')
      return
    }

    setLoading(true)
    setError('')

    try {
      await api.login(email, password)
      onLogin()
    } catch (e: any) {
      setError(e.message || 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.title, { color: colors.text }]}>Аудит техники</Text>
        <Text style={[styles.subtitle, { color: colors.mutedText }]}>Вход в систему</Text>

        {error ? (
          <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
        ) : null}

        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
          placeholder="Email"
          placeholderTextColor={colors.mutedText}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
          placeholder="Пароль"
          placeholderTextColor={colors.mutedText}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.buttonText} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>Войти</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

function CompanySelectScreen({
  companies,
  onSelect,
}: {
  companies: Company[]
  onSelect: (c: Company) => void
}) {
  const { colors } = useTheme()

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Выберите компанию</Text>
      {companies.map((company) => (
        <TouchableOpacity
          key={company.id}
          style={[styles.card, { backgroundColor: colors.card }]}
          onPress={() => onSelect(company)}
        >
          <Text style={[styles.companyName, { color: colors.text }]}>{company.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

function InspectionFlowScreen({ company }: { company: Company }) {
  const { colors } = useTheme()
const [step, setStep] = useState<
    'home' | 'number' | 'type' | 'photos' | 'damage' | 'odometer' | 'checklist' | 'complete'
  >('home')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [inspectionType, setInspectionType] = useState<InspectionType | null>(null)
  const [photos, setPhotos] = useState<Record<string, string>>({})
  const [odometer, setOdometer] = useState('')
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [showCamera, setShowCamera] = useState(false)
  const [cameraTarget, setCameraTarget] = useState<string | null>(null)
  
  // ДТП данные
  const [accidentOccurredAt, setAccidentOccurredAt] = useState('')
  const [accidentLocation, setAccidentLocation] = useState('')
  const [currentLocation, setCurrentLocation] = useState<{latitude: number; longitude: number} | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [defects, setDefects] = useState<{title: string; comment: string; photo: string | null}[]>([])

  const getCurrentLocation = async () => {
    setLocationLoading(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Ошибка', 'Нет доступа к геолокации')
        return
      }
      const location = await Location.getCurrentPositionAsync({})
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      })
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось получить координаты')
    } finally {
      setLocationLoading(false)
    }
  }

  const requiredPhotos = inspectionType ? PHOTO_REQUIREMENTS[inspectionType] : []
  const completedPhotos = requiredPhotos.filter(p => photos[p.id]).length
  const canProceedFromPhotos = completedPhotos === requiredPhotos.length

  const [loading, setLoading] = useState(false)

  const handleNumberSubmit = async () => {
    if (!vehicleNumber) return

    setLoading(true)
    try {
      const normalized = vehicleNumber.toUpperCase().replace(/[^A-Z0-9]/g, '')
      console.log('Resolving:', normalized)
      const v = await api.resolveVehicleNumber(normalized)
      console.log('Vehicle found:', v)
      if (v) {
        setVehicle(v)
        setStep('type')
      } else {
        alert('Техника не найдена')
      }
    } catch (e: any) {
      console.log('Error:', e.message)
      alert('Ошибка: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const openCamera = (photoId: string) => {
    setCameraTarget(photoId)
    setShowCamera(true)
  }

  const handleCameraCapture = (base64: string) => {
    if (cameraTarget) {
      setPhotos(prev => ({ ...prev, [cameraTarget]: `data:image/jpeg;base64,${base64}` }))
    }
    setShowCamera(false)
    setCameraTarget(null)
  }

  const handleCameraClose = () => {
    setShowCamera(false)
    setCameraTarget(null)
  }

  const handlePhotoCapture = (photoId: string) => {
    // Open camera for this photo
    openCamera(photoId)
  }

  const handleClearPhoto = (photoId: string) => {
    setPhotos(prev => {
      const next = { ...prev }
      delete next[photoId]
      return next
    })
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {step === 'home' && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            Осмотр техники
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedText }]}>
            {company.name}
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => setStep('number')}
          >
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>
              Начать осмотр
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'number' && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.label, { color: colors.text }]}>
            Введите номер техники
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
            placeholder="А123БС77"
            placeholderTextColor={colors.mutedText}
            value={vehicleNumber}
            onChangeText={setVehicleNumber}
            autoCapitalize="characters"
            maxLength={10}
          />
          
          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            onPress={() => {
              setCameraTarget('plate_ocr')
              setShowCamera(true)
            }}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              📷 Распознать номер по фото
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, { backgroundColor: loading ? colors.mutedText : colors.primary }]}
            onPress={handleNumberSubmit}
            disabled={loading}
          >
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>
              {loading ? 'Загрузка...' : 'Продолжить'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'type' && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.label, { color: colors.text }]}>
            Выберите тип осмотра
          </Text>
          {(['quick', 'scheduled', 'accident'] as InspectionType[]).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.typeButton,
                { backgroundColor: inspectionType === type ? colors.primary : colors.inputBackground },
              ]}
              onPress={() => {
                setInspectionType(type)
                setStep('photos')
              }}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  { color: inspectionType === type ? colors.buttonText : colors.text },
                ]}
              >
                {type === 'quick' ? 'Быстрый' : type === 'scheduled' ? 'Плановый' : 'ДТП'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {step === 'photos' && (
        <View style={styles.fullScreen}>
          <Text style={[styles.label, { color: colors.text }]}>
            Обязательные фото ({completedPhotos}/{requiredPhotos.length})
          </Text>
          
          <View style={styles.photoGrid}>
            {requiredPhotos.map((photo) => (
              <TouchableOpacity
                key={photo.id}
                style={[
                  styles.photoItem,
                  { 
                    backgroundColor: photos[photo.id] ? colors.success : colors.inputBackground,
                    borderColor: colors.border
                  }
                ]}
                onPress={() => openCamera(photo.id)}
              >
                {photos[photo.id] ? (
                  <Text style={[styles.photoCheck, { color: colors.buttonText }]}>✓</Text>
                ) : (
                  <View style={styles.photoIcon}>
                    <Text style={styles.cameraEmoji}>📷</Text>
                    <Text style={[styles.photoLabel, { color: colors.mutedText }]}>
                      {photo.label}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.buttonRow}>
            {inspectionType === 'accident' && (
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.warning }]}
                onPress={() => setStep('damage')}
              >
                <Text style={[styles.buttonText, { color: colors.buttonText }]}>
                  Добавить повреждение
                </Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={() => setStep('odometer')}
              disabled={!canProceedFromPhotos}
            >
              <Text style={[styles.buttonText, { color: colors.buttonText }]}>
                Продолжить
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 'damage' && (
        <View style={styles.fullScreen}>
          <Text style={[styles.label, { color: colors.text }]}>Повреждение</Text>
          
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
            placeholder="Описание повреждения"
            placeholderTextColor={colors.mutedText}
            value={defects.length > 0 ? defects[defects.length - 1].title : ''}
            onChangeText={(text) => {
              const newDefects = [...defects]
              if (newDefects.length > 0) {
                newDefects[newDefects.length - 1].title = text
              } else {
                newDefects.push({ title: text, comment: '', photo: null })
              }
              setDefects(newDefects)
            }}
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => {
              setCameraTarget('damage_photo')
              setShowCamera(true)
            }}
          >
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>
              📷 Фото повреждения
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.success }]}
            onPress={() => setStep('odometer')}
          >
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>
              Добавить ещё
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => setStep('odometer')}
          >
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>
              Продолжить
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {showCamera && cameraTarget && (
        <Modal visible={showCamera} animationType="slide">
          <CameraCapture
            onCapture={handleCameraCapture}
            onClose={handleCameraClose}
            title={requiredPhotos.find(p => p.id === cameraTarget)?.label}
          />
        </Modal>
      )}

{step === 'odometer' && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.label, { color: colors.text }]}>Одометр</Text>
          <Text style={[styles.subtitle, { color: colors.mutedText }]}>
            Введите пробег в {company.distance_unit || 'км'}
          </Text>
          
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
            placeholder="0"
            placeholderTextColor={colors.mutedText}
            value={odometer}
            onChangeText={setOdometer}
            keyboardType="numeric"
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => odometer && setStep('checklist')}
            disabled={!odometer}
          >
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>
              Продолжить
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'checklist' && inspectionType === 'accident' && (
        <View style={styles.fullScreen}>
          <Text style={[styles.label, { color: colors.text }]}>Данные ДТП</Text>
          
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.sublabel, { color: colors.text }]}>Дата и время ДТП</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
              placeholder="Дата и время"
              placeholderTextColor={colors.mutedText}
              value={accidentOccurredAt}
              onChangeText={setAccidentOccurredAt}
            />
          </View>
          
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.sublabel, { color: colors.text }]}>Место ДТП</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
              placeholder="Адрес или описание места"
              placeholderTextColor={colors.mutedText}
              value={accidentLocation}
              onChangeText={setAccidentLocation}
            />
            {currentLocation && (
              <Text style={[styles.locationText, { color: colors.success }]}>
                📍 {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
              </Text>
            )}
          </View>
          
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={getCurrentLocation}
            disabled={locationLoading}
          >
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>
              {locationLoading ? 'Определение...' : '📍 Определить координаты'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.button, 
              { backgroundColor: accidentOccurredAt && accidentLocation ? colors.primary : colors.border }
            ]}
            onPress={() => accidentOccurredAt && accidentLocation && setStep('photos')}
            disabled={!accidentOccurredAt || !accidentLocation}
          >
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>
              Продолжить
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'checklist' && inspectionType !== 'accident' && (
        <View style={styles.fullScreen}>
          <Text style={[styles.label, { color: colors.text }]}>Чек-лист</Text>
          
          <View style={styles.checklistList}>
            {(inspectionType === 'quick' ? QUICK_CHECKLIST : 
              inspectionType === 'scheduled' ? SCHEDULED_CHECKLIST[0].items :
              ACCIDENT_CHECKLIST
            ).map((item, index) => (
              <View key={index} style={[styles.checklistItem, { borderColor: colors.border }]}>
                <Text style={[styles.checklistLabel, { color: colors.text }]}>{item}</Text>
                <View style={styles.checklistButtons}>
                  <TouchableOpacity
                    style={[
                      styles.yesNoButton,
                      { backgroundColor: checklist[item] === true ? colors.success : colors.inputBackground }
                    ]}
                    onPress={() => setChecklist(prev => ({ ...prev, [item]: true }))}
                  >
                    <Text style={{ color: checklist[item] === true ? colors.buttonText : colors.text }}>Да</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.yesNoButton,
                      { backgroundColor: checklist[item] === false ? colors.danger : colors.inputBackground }
                    ]}
                    onPress={() => setChecklist(prev => ({ ...prev, [item]: false }))}
                  >
                    <Text style={{ color: checklist[item] === false ? colors.buttonText : colors.text }}>Нет</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => setStep('complete')}
          >
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>
              Завершить осмотр
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'complete' && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.success }]}>Осмотр завершён</Text>
          <Text style={[styles.subtitle, { color: colors.mutedText }]}>
            {vehicle?.number} — {inspectionType}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedText }]}>
            Пробег: {odometer} {company.distance_unit || 'км'}
          </Text>
          
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => {
              setStep('home')
              setVehicle(null)
              setInspectionType(null)
              setPhotos({})
              setOdometer('')
              setChecklist({})
            }}
          >
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>
              Новый осмотр
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fullScreen: {
    flex: 1,
    width: '100%',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  sublabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  error: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  input: {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 16,
    borderWidth: 1,
  },
  button: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'column',
    gap: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  companyName: {
    fontSize: 18,
    fontWeight: '600',
  },
  typeButton: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  photoItem: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoCheck: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  photoIcon: {
    alignItems: 'center',
    padding: 8,
  },
  cameraEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  photoLabel: {
    fontSize: 12,
    textAlign: 'center',
    padding: 8,
  },
  checklistList: {
    flex: 1,
    marginBottom: 20,
  },
  checklistItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  checklistLabel: {
    fontSize: 14,
    flex: 1,
  },
  checklistButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  yesNoButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
})

export default App