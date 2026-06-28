import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useTheme } from '../theme'
import { api } from '../api'
import type { Company } from '../types'
import CameraCapture from '../CameraCapture'
import { useAccidentLocation, formatCoordinates } from '../hooks/useAccidentLocation'
import { useCameraFlow } from '../hooks/useCameraFlow'
import { useInspectionFlow, getChecklistTitles } from '../hooks/useInspectionFlow'
import { HomeStep } from './inspection-steps/HomeStep'
import { NumberStep } from './inspection-steps/NumberStep'
import { TypeStep } from './inspection-steps/TypeStep'
import { AccidentStep } from './inspection-steps/AccidentStep'
import { PhotosStep } from './inspection-steps/PhotosStep'
import { OdometerStep } from './inspection-steps/OdometerStep'
import { ChecklistStep } from './inspection-steps/ChecklistStep'
import { CompleteStep } from './inspection-steps/CompleteStep'

export function InspectionFlowScreen({ company }: { company: Company }) {
  const { colors } = useTheme()
  const flow = useInspectionFlow()
  const camera = useCameraFlow()
  const accident = useAccidentLocation()

  const {
    state: {
      step,
      vehicleNumber,
      inspectionType,
      inspectionId,
      photoRequirements,
      inspectionPhotos,
      odometer,
      odometerUnavailableReason,
      checklist,
      completedInspection,
      loading,
      accidentOccurredAt,
      accidentLocation,
    },
    actions,
  } = flow

  const checklistTitles = inspectionType ? getChecklistTitles(inspectionType) : []
  const showFlowControls = step !== 'home' && step !== 'complete'

  const confirmDiscardInspection = () => {
    Alert.alert(
      'Сбросить осмотр?',
      'Данные текущего осмотра, черновик и загруженные фото будут удалены. Это действие нельзя отменить.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Сбросить',
          style: 'destructive',
          onPress: () => void actions.discardInspection(),
        },
      ],
    )
  }

  const handleCameraCapture = async (photo: { base64: string; uri: string }) => {
    const target = camera.cameraTarget
    camera.closeCamera()
    if (!target) return

    if (target === 'plate_ocr') {
      try {
        const result = await api.recognizeVehicleNumber(photo.uri)
        if (result.candidates[0]) {
          actions.setVehicleNumber(result.candidates[0])
        } else {
          Alert.alert('Номер не распознан', result.message || 'Введите номер вручную')
        }
      } catch (error: unknown) {
        const err = error as { message?: string }
        Alert.alert('Ошибка', err.message || 'Не удалось распознать номер')
      }
      return
    }

    if (target === 'odometer_ocr') {
      try {
        const result = await api.recognizeOdometer(photo.uri)
        if (result.value !== null) {
          actions.setOdometer(String(result.value))
          if (result.requires_manual_confirmation) {
            Alert.alert('Пробег распознан', 'Проверьте значение и подтвердите вручную.')
          }
        } else {
          Alert.alert('Пробег не распознан', result.message || 'Введите показание одометра вручную')
        }
      } catch (error: unknown) {
        const err = error as { message?: string }
        Alert.alert('Ошибка', err.message || 'Не удалось распознать пробег')
      }
      return
    }

    if (target.kind === 'inspection') {
      if (!inspectionId) return
      try {
        const coordinates = accident.currentLocation || await accident.getCurrentLocation(undefined, { silent: true })
        await actions.enqueueInspectionPhoto(target.photoType, photo.uri, coordinates)
      } catch (error: unknown) {
        const err = error as { message?: string }
        Alert.alert('Ошибка', err.message || 'Не удалось загрузить фото осмотра')
      }
      return
    }

    if (target.kind === 'defect') {
      const coordinates = accident.currentLocation || await accident.getCurrentLocation(undefined, { silent: true })
      await actions.setDefectPhoto(target.title, photo.uri, coordinates)
    }
  }

  const cameraTitle = (() => {
    const target = camera.cameraTarget
    if (!target) return undefined
    if (target === 'plate_ocr') return 'Распознавание номера'
    if (target === 'odometer_ocr') return 'Распознавание одометра'
    if (target.kind === 'inspection') return photoRequirements?.labels[target.photoType]
    return target.title
  })()

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {showFlowControls ? (
        <View style={styles.flowControls}>
          <TouchableOpacity
            style={[styles.backButton, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={actions.goBack}
            disabled={loading}
          >
            <Text style={[styles.backButtonText, { color: loading ? colors.mutedText : colors.text }]}>← Назад</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.resetButton, { borderColor: colors.danger }]}
            onPress={confirmDiscardInspection}
            disabled={loading}
          >
            <Text style={[styles.resetButtonText, { color: loading ? colors.mutedText : colors.danger }]}>Сбросить осмотр</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {step === 'home' && (
        <HomeStep companyName={company.name} onStart={() => actions.setStep('number')} />
      )}

      {step === 'number' && (
        <NumberStep
          vehicleNumber={vehicleNumber}
          loading={loading}
          onChangeNumber={actions.setVehicleNumber}
          onSubmit={actions.handleNumberSubmit}
          onOpenOcr={() => camera.openCamera('plate_ocr')}
        />
      )}

      {step === 'type' && (
        <TypeStep
          selected={inspectionType}
          loading={loading}
          onSelect={actions.handleTypeSelect}
        />
      )}

      {step === 'accident' && (
        <AccidentStep
          accidentOccurredAt={accidentOccurredAt}
          accidentLocation={accidentLocation}
          currentLocation={accident.currentLocation}
          locationLoading={accident.locationLoading}
          loading={loading}
          onChangeOccurredAt={actions.setAccidentOccurredAt}
          onChangeLocation={(value) => {
            actions.setAccidentLocation(value)
            if (!value.trim()) accident.setCurrentLocation(null)
          }}
          onGetLocation={() =>
            accident.getCurrentLocation((coords) => {
              if (!accidentLocation.trim()) {
                actions.setAccidentLocation(formatCoordinates(coords))
              }
            })
          }
          onSubmit={() =>
            actions.createInspection('accident', {
              occurredAt: accidentOccurredAt,
              location: accidentLocation,
            })
          }
        />
      )}

      {step === 'photos' && photoRequirements && (
        <PhotosStep
          photoRequirements={photoRequirements}
          inspectionPhotos={inspectionPhotos}
          loading={loading}
          onOpenCamera={(photoType) => camera.openCamera({ kind: 'inspection', photoType })}
          onRetry={actions.retryInspectionPhoto}
          onRetryAll={actions.retryFailedUploads}
          onContinue={() => actions.setStep('odometer')}
        />
      )}

      {step === 'odometer' && (
        <OdometerStep
          odometer={odometer}
          distanceUnit={company.distance_unit || 'км'}
          unavailableReason={odometerUnavailableReason}
          allowUnavailable={inspectionType === 'accident'}
          onChange={actions.setOdometer}
          onChangeUnavailableReason={actions.setOdometerUnavailableReason}
          onOpenOcr={() => camera.openCamera('odometer_ocr')}
          onContinue={() => actions.setStep('checklist')}
        />
      )}

      {step === 'checklist' && inspectionType && (
        <ChecklistStep
          checklist={checklist}
          checklistTitles={checklistTitles}
          loading={loading}
          onSetResult={actions.setChecklistResult}
          onSetComment={actions.setChecklistComment}
          onOpenDefectCamera={(title) => camera.openCamera({ kind: 'defect', title })}
          onRetryDefectPhoto={actions.retryDefectPhoto}
          onFinish={() => actions.finishInspection(company.distance_unit)}
        />
      )}

      {step === 'complete' && completedInspection && (
        <CompleteStep
          inspection={completedInspection}
          distanceUnit={company.distance_unit || 'км'}
          onReset={actions.resetFlow}
        />
      )}

      {camera.showCamera && camera.cameraTarget && (
        <Modal visible={camera.showCamera} animationType="slide">
          <CameraCapture
            onCapture={handleCameraCapture}
            onClose={camera.closeCamera}
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
    alignItems: 'center',
    padding: 20,
  },
  flowControls: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  backButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  resetButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
})
