import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../../theme'
import { Button, Label, PhotoThumb, componentStyles } from '../../components'
import type { PhotoRequirementsResponse } from '../../types'
import type { InspectionPhotoPreview } from '../../hooks/useInspectionFlow'

const ACCIDENT_PHOTO_GUIDE = [
  'Общие планы: 3-4 ракурса с взаимным расположением авто, знаками, разметкой, светофорами и направлением движения.',
  'Средний план: госномера всех участников и автомобили с четырёх сторон на расстоянии нескольких метров.',
  'Крупный план: каждая царапина, вмятина, трещина или разбитая фара; повреждение должно быть в центре кадра.',
  'Идентификация и следы: снимите повреждённую деталь вместе с частью авто, а также осколки фар или отвалившиеся детали.',
  'Документы: водительские удостоверения участников с обеих сторон и СТС. Фото должны быть чёткими, без бликов.',
]

export function PhotosStep({
  photoRequirements,
  inspectionPhotos,
  loading,
  onOpenCamera,
  onContinue,
  onRetry,
  onRetryAll,
}: {
  photoRequirements: PhotoRequirementsResponse
  inspectionPhotos: Record<string, InspectionPhotoPreview>
  loading: boolean
  onOpenCamera: (photoType: string) => void
  onContinue: () => void
  onRetry: (photoType: string) => void
  onRetryAll: () => void
}) {
  const { colors } = useTheme()
  const required = photoRequirements.requirements.required
  const completed = required.filter((type) => inspectionPhotos[type]).length
  const canProceed = required.length > 0 && completed === required.length
  const isAccident = photoRequirements.type === 'accident'
  const displayed = isAccident && photoRequirements.requirements.optional.includes('odometer')
    ? [...required, 'odometer']
    : required
  const hasFailures = Object.values(inspectionPhotos).some((photo) => photo.status === 'failed')

  return (
    <View style={styles.fullScreen}>
      <Label>Обязательные фото ({completed}/{required.length})</Label>
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {isAccident ? (
          <View style={[styles.guideCard, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
            <Text style={[styles.guideTitle, { color: colors.text }]}>Памятка фотофиксации ДТП</Text>
            {ACCIDENT_PHOTO_GUIDE.map((item, index) => (
              <Text key={item} style={[styles.guideItem, { color: colors.mutedText }]}>
                {index + 1}. {item}
              </Text>
            ))}
          </View>
        ) : null}
        <View style={componentStyles.photoGrid}>
          {displayed.map((photoType) => {
            const preview = inspectionPhotos[photoType]
            if (preview) {
              return (
                <View key={photoType}>
                  <PhotoThumb
                    uri={preview.localUri}
                    label={photoRequirements.labels[photoType]}
                    status={preview.status}
                    onPress={() => onOpenCamera(photoType)}
                  />
                  <Text style={[styles.uploadStatus, { color: preview.status === 'failed' ? colors.danger : colors.mutedText }]}>
                    {preview.status === 'uploaded'
                      ? 'Загружено'
                      : preview.status === 'uploading'
                        ? 'Загружается…'
                        : preview.status === 'failed'
                          ? preview.error || 'Ошибка загрузки'
                          : 'Ожидает загрузки'}
                  </Text>
                  {preview.status === 'failed' ? (
                    <Button title="Повторить" variant="secondary" onPress={() => onRetry(photoType)} />
                  ) : null}
                </View>
              )
            }
            return (
              <Pressable
                key={photoType}
                style={[
                  componentStyles.photoItem,
                  { backgroundColor: colors.inputBackground, borderColor: colors.border },
                ]}
                onPress={() => onOpenCamera(photoType)}
                disabled={loading}
              >
                <View style={componentStyles.photoIcon}>
                  <Text style={componentStyles.cameraEmoji}>📷</Text>
                  <Text style={[componentStyles.photoLabel, { color: colors.mutedText }]}>
                    {photoRequirements.labels[photoType] || photoType}
                  </Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
      {hasFailures ? (
        <Button title="Повторить неотправленные" variant="secondary" onPress={onRetryAll} />
      ) : null}
      <Button
        title="Продолжить"
        variant="primary"
        onPress={onContinue}
        disabled={!canProceed || loading}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  fullScreen: {
    width: '100%',
    flex: 1,
  },
  scrollArea: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingBottom: 16,
  },
  guideCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  guideTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  guideItem: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  uploadStatus: {
    maxWidth: 150,
    marginTop: 4,
    marginBottom: 8,
    fontSize: 12,
  },
})
