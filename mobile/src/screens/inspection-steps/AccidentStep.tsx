import { StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../../theme'
import { Button, Card, FormField, Label, SubLabel, componentStyles } from '../../components'
import { formatCoordinates, type AccidentLocation } from '../../hooks/useAccidentLocation'

export function AccidentStep({
  accidentOccurredAt,
  accidentLocation,
  currentLocation,
  locationLoading,
  loading,
  onChangeOccurredAt,
  onChangeLocation,
  onGetLocation,
  onSubmit,
}: {
  accidentOccurredAt: string
  accidentLocation: string
  currentLocation: AccidentLocation
  locationLoading: boolean
  loading: boolean
  onChangeOccurredAt: (value: string) => void
  onChangeLocation: (value: string) => void
  onGetLocation: () => void
  onSubmit: () => void
}) {
  const { colors } = useTheme()
  const canSubmit = Boolean(accidentOccurredAt.trim() && accidentLocation.trim()) && !loading

  return (
    <View style={styles.fullScreen}>
      <Label>Данные ДТП</Label>
      <Card>
        <SubLabel>Дата и время ДТП</SubLabel>
        <FormField
          placeholder="Дата и время"
          value={accidentOccurredAt}
          onChangeText={onChangeOccurredAt}
        />
      </Card>
      <Card>
        <SubLabel>Место ДТП</SubLabel>
        <FormField
          placeholder="Адрес или описание места"
          value={accidentLocation}
          onChangeText={onChangeLocation}
        />
        {currentLocation ? (
          <Text style={[componentStyles.locationText, { color: colors.success }]}>
            📍 {formatCoordinates(currentLocation)}
          </Text>
        ) : null}
      </Card>
      <Button
        title={locationLoading ? 'Определение…' : '📍 Определить координаты'}
        variant="primary"
        loading={locationLoading}
        onPress={onGetLocation}
      />
      <Button
        title="Продолжить"
        variant="primary"
        onPress={onSubmit}
        disabled={!canSubmit}
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
