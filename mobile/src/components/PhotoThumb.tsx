import { Image, TouchableOpacity, View, Text } from 'react-native'
import { useTheme } from '../theme'
import { styles, spacing } from '../styles'
import type { PhotoUploadStatus } from '../types'

export function PhotoThumb({
  uri,
  label,
  onPress,
  withRemoveButton,
  onRemove,
  status = 'uploaded',
}: {
  uri: string
  label?: string
  onPress: () => void
  withRemoveButton?: boolean
  onRemove?: () => void
  status?: PhotoUploadStatus
}) {
  const { colors } = useTheme()
  const statusColor = status === 'uploaded'
    ? colors.success
    : status === 'failed'
      ? colors.danger
      : colors.primary
  const statusSymbol = status === 'uploaded' ? '✓' : status === 'failed' ? '!' : '…'
  return (
    <View style={styles.defectPhotoPreview}>
      <TouchableOpacity onPress={onPress}>
        <Image source={{ uri }} style={styles.photoPreview} />
        <View style={[styles.photoPreviewOverlay, { backgroundColor: statusColor }]}>
          <Text style={[styles.photoCheck, { color: colors.buttonText }]}>{statusSymbol}</Text>
        </View>
        {label ? (
          <View style={styles.photoPreviewLabel}>
            <Text
              numberOfLines={2}
              style={[styles.photoPreviewLabelText, { color: colors.buttonText }]}
            >
              {label}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>
      {withRemoveButton && onRemove ? (
        <TouchableOpacity
          onPress={onRemove}
          style={[
            styles.photoPreviewOverlay,
            {
              backgroundColor: colors.danger,
              top: undefined as unknown as number,
              bottom: spacing.sm,
            },
          ]}
        >
          <Text style={[styles.photoCheck, { color: colors.buttonText }]}>×</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}
