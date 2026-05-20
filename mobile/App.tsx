import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Alert, ScrollView, Image } from 'react-native'
import * as Location from 'expo-location'
import { ThemeProvider, useTheme } from './src/theme'
import { api, isAuthSessionError, setAuthSessionHandler } from './src/api'
import type { User, Vehicle, Company, Inspection, PhotoRequirementsResponse } from './src/types'
import { InspectionType, QUICK_CHECKLIST, SCHEDULED_CHECKLIST, ACCIDENT_CHECKLIST } from './src/types'
import CameraCapture from './src/CameraCapture'

type InspectionPhotoPreview = {
  localUri: string
  serverUrl: string
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
  const [sessionMessage, setSessionMessage] = useState('')

  const resetSessionState = () => {
    setUser(null)
    setCompanies([])
    setSelectedCompany(null)
  }

  const checkAuth = async () => {
    try {
      const u = await api.getMe()
      setUser(u)
      const comps = await api.getCompanies()
      setCompanies(comps)
      if (comps.length === 1 && comps[0]) {
        setSelectedCompany(comps[0])
      }
      setSessionMessage('')
    } catch (e: any) {
      console.log('Auth check failed:', e.message)
      resetSessionState()
      setSessionMessage(isAuthSessionError(e) ? e.message : '')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setAuthSessionHandler((error) => {
      setSessionMessage(error.message)
      resetSessionState()
      setLoading(false)
    })
    checkAuth()
    return () => setAuthSessionHandler(null)
  }, [])

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (!user) {
    return <LoginScreen onLogin={checkAuth} initialMessage={sessionMessage} />
  }

  if (companies.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.error, { color: colors.danger }]}>
          Нет доступных компаний
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={async () => {
            await api.logout()
            setSessionMessage('')
            resetSessionState()
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

function LoginScreen({ onLogin, initialMessage = '' }: { onLogin: () => void; initialMessage?: string }) {
  const { colors } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initialMessage)

  useEffect(() => {
    setError(initialMessage)
  }, [initialMessage])

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Заполните email и пароль')
      return
    }

    setLoading(true)
    setError('')

    try {
      await api.login(email, password)
      setError('')
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
  const [step, setStep] = useState<'home' | 'number' | 'type' | 'accident' | 'photos' | 'odometer' | 'checklist' | 'complete'>('home')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [inspectionType, setInspectionType] = useState<InspectionType | null>(null)
  const [inspectionId, setInspectionId] = useState<string | null>(null)
  const [photoRequirements, setPhotoRequirements] = useState<PhotoRequirementsResponse | null>(null)
  const [inspectionPhotos, setInspectionPhotos] = useState<Record<string, InspectionPhotoPreview>>({})
  const [odometer, setOdometer] = useState('')
  const [checklist, setChecklist] = useState<Record<string, { result: boolean | null; comment: string; photo: string | null }>>({})
  const [completedInspection, setCompletedInspection] = useState<Inspection | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [cameraTarget, setCameraTarget] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [accidentOccurredAt, setAccidentOccurredAt] = useState('')
  const [accidentLocation, setAccidentLocation] = useState('')
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)

  const getChecklistTitles = (type: InspectionType) => {
    if (type === 'quick') return QUICK_CHECKLIST
    if (type === 'scheduled') return SCHEDULED_CHECKLIST.flatMap((section) => section.items)
    return ACCIDENT_CHECKLIST
  }

  const resetChecklist = (type: InspectionType) => {
    const nextChecklist = Object.fromEntries(
      getChecklistTitles(type).map((title) => [title, { result: null, comment: '', photo: null }]),
    )
    setChecklist(nextChecklist)
  }

  const requiredPhotoTypes = photoRequirements?.requirements.required ?? []
  const completedPhotos = requiredPhotoTypes.filter((photoType) => inspectionPhotos[photoType]).length
  const canProceedFromPhotos = requiredPhotoTypes.length > 0 && completedPhotos === requiredPhotoTypes.length
  const checklistTitles = inspectionType ? getChecklistTitles(inspectionType) : []
  const canFinishChecklist = checklistTitles.length > 0
    && checklistTitles.every((title) => checklist[title]?.result !== null)
    && checklistTitles.every((title) => checklist[title]?.result !== false || Boolean(checklist[title]?.photo))

  const getCurrentLocation = async () => {
    setLocationLoading(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Ошибка', 'Нет доступа к геолокации')
        return
      }
      const location = await Location.getCurrentPositionAsync({})
      const coordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      }
      setCurrentLocation(coordinates)
      if (!accidentLocation.trim()) {
        setAccidentLocation(`${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`)
      }
    } catch {
      Alert.alert('Ошибка', 'Не удалось получить координаты')
    } finally {
      setLocationLoading(false)
    }
  }

  const handleNumberSubmit = async () => {
    if (!vehicleNumber.trim()) return

    setLoading(true)
    try {
      const normalized = vehicleNumber.toUpperCase().replace(/[^A-ZА-Я0-9]/g, '')
      const resolvedVehicle = await api.resolveVehicleNumber(normalized)
      if (!resolvedVehicle) {
        Alert.alert('Техника не найдена', 'Проверьте номер и попробуйте снова')
        return
      }

      setVehicle(resolvedVehicle)
      setStep('type')
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Не удалось найти технику')
    } finally {
      setLoading(false)
    }
  }

  const createInspection = async (type: InspectionType) => {
    if (!vehicle) return

    setLoading(true)
    try {
      const requirements = await api.getPhotoRequirements(type)
      const createdInspection = await api.createInspection({
        vehicle_id: vehicle.id,
        type,
        checklist: [],
        ...(type === 'accident'
          ? {
              accident_occurred_at: accidentOccurredAt.trim(),
              accident_location: accidentLocation.trim(),
            }
          : {}),
      })

      setInspectionId(createdInspection.id)
      setPhotoRequirements(requirements)
      setInspectionPhotos({})
      setStep('photos')
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Не удалось создать осмотр')
    } finally {
      setLoading(false)
    }
  }

  const handleTypeSelect = async (type: InspectionType) => {
    setInspectionType(type)
    setCompletedInspection(null)
    resetChecklist(type)

    if (type === 'accident') {
      setStep('accident')
      return
    }

    await createInspection(type)
  }

  const openCamera = (target: string) => {
    setCameraTarget(target)
    setShowCamera(true)
  }

  const handleCameraCapture = async (photo: { base64: string; uri: string }) => {
    const target = cameraTarget
    setShowCamera(false)
    setCameraTarget(null)

    if (!target) return

    if (target === 'plate_ocr') {
      setLoading(true)
      try {
        const result = await api.recognizeVehicleNumber(photo.uri)
        if (result.candidates[0]) {
          setVehicleNumber(result.candidates[0])
        } else {
          Alert.alert('Номер не распознан', result.message || 'Введите номер вручную')
        }
      } catch (error: any) {
        Alert.alert('Ошибка', error.message || 'Не удалось распознать номер')
      } finally {
        setLoading(false)
      }
      return
    }

    if (target.startsWith('inspection:')) {
      if (!inspectionId) return
      const photoType = target.slice('inspection:'.length)
      setLoading(true)
      try {
        const uploadedPhoto = await api.uploadPhoto(inspectionId, photoType, photo.uri)
        setInspectionPhotos((prev) => ({
          ...prev,
          [photoType]: {
            localUri: photo.uri,
            serverUrl: uploadedPhoto.thumb_url || uploadedPhoto.webp_url || uploadedPhoto.url,
          },
        }))
      } catch (error: any) {
        Alert.alert('Ошибка', error.message || 'Не удалось загрузить фото осмотра')
      } finally {
        setLoading(false)
      }
      return
    }

    if (target.startsWith('defect:')) {
      const title = target.slice('defect:'.length)
      setChecklist((prev) => ({
        ...prev,
        [title]: {
          ...(prev[title] || { result: false, comment: '', photo: null }),
          result: false,
          photo: photo.uri,
        },
      }))
    }
  }

  const handleCameraClose = () => {
    setShowCamera(false)
    setCameraTarget(null)
  }

  const handleContinueAfterPhotos = () => {
    if (!canProceedFromPhotos) return
    setStep(inspectionType === 'accident' ? 'checklist' : 'odometer')
  }

  const handleFinishInspection = async () => {
    if (!inspectionId || !inspectionType) return

    if (!canFinishChecklist) {
      Alert.alert('Чек-лист не завершён', 'Ответьте на все пункты и добавьте фото к каждому дефекту')
      return
    }

    setLoading(true)
    try {
      const checklistPayload = checklistTitles.map((title) => ({
        title,
        result: checklist[title]?.result ?? null,
        comment: checklist[title]?.comment || '',
      }))

      const updatedInspection = await api.updateInspection(inspectionId, {
        checklist: checklistPayload,
        ...(inspectionType === 'accident'
          ? {
              accident_occurred_at: accidentOccurredAt.trim(),
              accident_location: accidentLocation.trim(),
            }
          : {
              odometer_value: Number(odometer),
              odometer_unit: company.distance_unit || 'km',
            }),
      })

      for (const checklistItem of updatedInspection.checklist_items) {
        if (checklistItem.result !== false && checklistItem.result !== 0) continue
        const draft = checklist[checklistItem.title]
        const defect = updatedInspection.defects?.find((item) => (
          item.checklist_item_id === checklistItem.id || item.title === checklistItem.title
        ))

        if (defect && draft?.photo && defect.photos.length === 0) {
          await api.uploadDefectPhoto(defect.id, draft.photo)
        }
      }

      const completed = await api.completeInspection(inspectionId)
      setCompletedInspection(completed)
      setStep('complete')
    } catch (error: any) {
      Alert.alert('Ошибка', error.message || 'Не удалось завершить осмотр')
    } finally {
      setLoading(false)
    }
  }

  const resetFlow = () => {
    setStep('home')
    setVehicleNumber('')
    setVehicle(null)
    setInspectionType(null)
    setInspectionId(null)
    setPhotoRequirements(null)
    setInspectionPhotos({})
    setOdometer('')
    setChecklist({})
    setCompletedInspection(null)
    setAccidentOccurredAt('')
    setAccidentLocation('')
    setCurrentLocation(null)
  }

  const cameraTitle = cameraTarget === 'plate_ocr'
    ? 'Распознавание номера'
    : cameraTarget?.startsWith('inspection:')
      ? photoRequirements?.labels[cameraTarget.slice('inspection:'.length)]
      : cameraTarget?.startsWith('defect:')
        ? cameraTarget.slice('defect:'.length)
        : undefined

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      {step === 'home' && (
        <View style={[styles.card, { backgroundColor: colors.card }]}> 
          <Text style={[styles.title, { color: colors.text }]}>Осмотр техники</Text>
          <Text style={[styles.subtitle, { color: colors.mutedText }]}>{company.name}</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => setStep('number')}
          >
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>Начать осмотр</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'number' && (
        <View style={[styles.card, { backgroundColor: colors.card }]}> 
          <Text style={[styles.label, { color: colors.text }]}>Введите номер техники</Text>
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
            onPress={() => openCamera('plate_ocr')}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>📷 Распознать номер по фото</Text>
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
          <Text style={[styles.label, { color: colors.text }]}>Выберите тип осмотра</Text>
          {(['quick', 'scheduled', 'accident'] as InspectionType[]).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.typeButton,
                { backgroundColor: inspectionType === type ? colors.primary : colors.inputBackground },
              ]}
              onPress={() => handleTypeSelect(type)}
              disabled={loading}
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

      {step === 'accident' && (
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
              <Text style={[styles.locationText, { color: colors.success }]}>📍 {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}</Text>
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
            style={[styles.button, { backgroundColor: accidentOccurredAt.trim() && accidentLocation.trim() ? colors.primary : colors.border }]}
            onPress={() => createInspection('accident')}
            disabled={!accidentOccurredAt.trim() || !accidentLocation.trim() || loading}
          >
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>Продолжить</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'photos' && photoRequirements && (
        <View style={styles.fullScreen}>
          <Text style={[styles.label, { color: colors.text }]}>Обязательные фото ({completedPhotos}/{requiredPhotoTypes.length})</Text>
          <View style={styles.photoGrid}>
            {requiredPhotoTypes.map((photoType) => (
              <TouchableOpacity
                key={photoType}
                style={[
                  styles.photoItem,
                  {
                    backgroundColor: inspectionPhotos[photoType] ? colors.card : colors.inputBackground,
                    borderColor: inspectionPhotos[photoType] ? colors.success : colors.border,
                  },
                ]}
                onPress={() => openCamera(`inspection:${photoType}`)}
                disabled={loading}
              >
                {inspectionPhotos[photoType] ? (
                  <>
                    <Image source={{ uri: inspectionPhotos[photoType].localUri }} style={styles.photoPreview} />
                    <View style={[styles.photoPreviewOverlay, { backgroundColor: colors.success }]}>
                      <Text style={[styles.photoCheck, { color: colors.buttonText }]}>✓</Text>
                    </View>
                    <View style={styles.photoPreviewLabel}>
                      <Text numberOfLines={2} style={[styles.photoPreviewLabelText, { color: colors.buttonText }]}>
                        {photoRequirements.labels[photoType]}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.photoIcon}>
                    <Text style={styles.cameraEmoji}>📷</Text>
                    <Text style={[styles.photoLabel, { color: colors.mutedText }]}>{photoRequirements.labels[photoType]}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: canProceedFromPhotos ? colors.primary : colors.border }]}
            onPress={handleContinueAfterPhotos}
            disabled={!canProceedFromPhotos || loading}
          >
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>Продолжить</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'odometer' && (
        <View style={[styles.card, { backgroundColor: colors.card }]}> 
          <Text style={[styles.label, { color: colors.text }]}>Одометр</Text>
          <Text style={[styles.subtitle, { color: colors.mutedText }]}>Введите пробег в {company.distance_unit || 'км'}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
            placeholder="0"
            placeholderTextColor={colors.mutedText}
            value={odometer}
            onChangeText={setOdometer}
            keyboardType="numeric"
          />
          <TouchableOpacity
            style={[styles.button, { backgroundColor: odometer ? colors.primary : colors.border }]}
            onPress={() => odometer && setStep('checklist')}
            disabled={!odometer}
          >
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>Продолжить</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'checklist' && inspectionType && (
        <View style={styles.fullScreen}>
          <Text style={[styles.label, { color: colors.text }]}>Чек-лист</Text>
          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            {checklistTitles.map((item) => {
              const entry = checklist[item] || { result: null, comment: '', photo: null }
              return (
                <View key={item} style={[styles.checklistCard, { borderColor: colors.border }]}> 
                  <View style={styles.checklistHeader}>
                    <Text style={[styles.checklistLabel, { color: colors.text }]}>{item}</Text>
                    <View style={styles.checklistButtons}>
                      <TouchableOpacity
                        style={[
                          styles.yesNoButton,
                          { backgroundColor: entry.result === true ? colors.success : colors.inputBackground },
                        ]}
                        onPress={() => setChecklist((prev) => ({
                          ...prev,
                          [item]: { ...(prev[item] || { result: null, comment: '', photo: null }), result: true, comment: '', photo: null },
                        }))}
                      >
                        <Text style={{ color: entry.result === true ? colors.buttonText : colors.text }}>Да</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.yesNoButton,
                          { backgroundColor: entry.result === false ? colors.danger : colors.inputBackground },
                        ]}
                        onPress={() => setChecklist((prev) => ({
                          ...prev,
                          [item]: { ...(prev[item] || { result: null, comment: '', photo: null }), result: false },
                        }))}
                      >
                        <Text style={{ color: entry.result === false ? colors.buttonText : colors.text }}>Нет</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {entry.result === false && (
                    <View>
                      <TextInput
                        style={[styles.commentInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border }]}
                        placeholder="Комментарий к дефекту"
                        placeholderTextColor={colors.mutedText}
                        value={entry.comment}
                        onChangeText={(comment) => setChecklist((prev) => ({
                          ...prev,
                          [item]: { ...(prev[item] || { result: false, comment: '', photo: null }), result: false, comment },
                        }))}
                      />
                      {entry.photo ? (
                        <TouchableOpacity
                          style={[styles.defectPhotoPreview, { borderColor: colors.success }]}
                          onPress={() => openCamera(`defect:${item}`)}
                        >
                          <Image source={{ uri: entry.photo }} style={styles.photoPreview} />
                          <View style={[styles.photoPreviewOverlay, { backgroundColor: colors.success }]}>
                            <Text style={[styles.photoCheck, { color: colors.buttonText }]}>✓</Text>
                          </View>
                          <View style={styles.photoPreviewLabel}>
                            <Text numberOfLines={2} style={[styles.photoPreviewLabelText, { color: colors.buttonText }]}>
                              Фото дефекта выбрано
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity
                        style={[styles.secondaryButton, { backgroundColor: entry.photo ? colors.success : colors.inputBackground, borderColor: colors.border }]}
                        onPress={() => openCamera(`defect:${item}`)}
                      >
                        <Text style={[styles.secondaryButtonText, { color: entry.photo ? colors.buttonText : colors.text }]}> 
                          {entry.photo ? 'Заменить фото дефекта' : '📷 Добавить фото дефекта'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )
            })}
          </ScrollView>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: canFinishChecklist && !loading ? colors.primary : colors.border }]}
            onPress={handleFinishInspection}
            disabled={!canFinishChecklist || loading}
          >
            <Text style={[styles.buttonText, { color: colors.buttonText }]}> 
              {loading ? 'Сохранение...' : 'Завершить осмотр'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'complete' && completedInspection && (
        <View style={[styles.card, { backgroundColor: colors.card }]}> 
          <Text style={[styles.title, { color: colors.success }]}>Осмотр завершён</Text>
          <Text style={[styles.subtitle, { color: colors.mutedText }]}>{completedInspection.vehicle_number} — {completedInspection.type}</Text>
          {completedInspection.odometer_value ? (
            <Text style={[styles.subtitle, { color: colors.mutedText }]}>Пробег: {completedInspection.odometer_value} {completedInspection.odometer_unit || company.distance_unit || 'км'}</Text>
          ) : null}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={resetFlow}
          >
            <Text style={[styles.buttonText, { color: colors.buttonText }]}>Новый осмотр</Text>
          </TouchableOpacity>
        </View>
      )}

      {showCamera && cameraTarget && (
        <Modal visible={showCamera} animationType="slide">
          <CameraCapture
            onCapture={handleCameraCapture}
            onClose={handleCameraClose}
            title={cameraTitle}
          />
        </Modal>
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
    overflow: 'hidden',
  },
  photoCheck: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoPreviewOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPreviewLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  photoPreviewLabelText: {
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
  },
  defectPhotoPreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
    marginBottom: 12,
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
  scrollArea: {
    flex: 1,
    width: '100%',
    marginBottom: 20,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  checklistCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  checklistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checklistLabel: {
    fontSize: 14,
    flex: 1,
    marginRight: 12,
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
  commentInput: {
    width: '100%',
    padding: 12,
    borderRadius: 12,
    fontSize: 14,
    marginTop: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
})

export default App
