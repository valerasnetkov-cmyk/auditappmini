import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../../theme'
import { Button, Label, PhotoThumb, componentStyles } from '../../components'
import type { PhotoRequirementsResponse } from '../../types'
import type { InspectionPhotoPreview } from '../../hooks/useInspectionFlow'

export function PhotosStep({
  photoRequirements,
  inspectionPhotos,
  loading,
  onOpenCamera,
  onContinue,
}: {
  photoRequirements: PhotoRequirementsResponse
  inspectionPhotos: Record<string, InspectionPhotoPreview>
  loading: boolean
  onOpenCamera: (photoType: string) => void
  onContinue: () => void
}) {
  const { colors } = useTheme()
  const required = photoRequirements.requirements.required
  const completed = required.filter((type) => inspectionPhotos[type]).length
  const canProceed = required.length > 0 && completed === required.length

  return (
    <View style={styles.fullScreen}>
      <Label>Обязательные фото ({completed}/{required.length})</Label>
      <View style={componentStyles.photoGrid}>
        {required.map((photoType) => {
          const preview = inspectionPhotos[photoType]
          if (preview) {
            return (
              <PhotoThumb
                key={photoType}
                uri={preview.localUri}
                label={photoRequirements.labels[photoType]}
                onPress={() => onOpenCamera(photoType)}
              />
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
                  {photoRequirements.labels[photoType]}
                </Text>
              </View>
            </Pressable>
          )
        })}
      </View>
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
})
