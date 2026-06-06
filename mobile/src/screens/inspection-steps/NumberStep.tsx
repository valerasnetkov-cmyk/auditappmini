import { StyleSheet, View } from 'react-native'
import { Button, Card, FormField, Label } from '../../components'
import { useTheme } from '../../theme'

export function NumberStep({
  vehicleNumber,
  loading,
  onChangeNumber,
  onSubmit,
  onOpenOcr,
}: {
  vehicleNumber: string
  loading: boolean
  onChangeNumber: (value: string) => void
  onSubmit: () => void
  onOpenOcr: () => void
}) {
  const { colors } = useTheme()
  return (
    <Card>
      <Label>Введите номер техники</Label>
      <FormField
        placeholder="А123БС77"
        value={vehicleNumber}
        onChangeText={onChangeNumber}
        autoCapitalize="characters"
        maxLength={10}
      />
      <View style={styles.row}>
        <Button title="📷 Распознать номер по фото" variant="secondary" onPress={onOpenOcr} />
      </View>
      <Button
        title={loading ? 'Загрузка…' : 'Продолжить'}
        variant="primary"
        inactiveColor={colors.mutedText}
        loading={loading}
        onPress={onSubmit}
        disabled={!vehicleNumber.trim() || loading}
      />
    </Card>
  )
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 12,
  },
})
