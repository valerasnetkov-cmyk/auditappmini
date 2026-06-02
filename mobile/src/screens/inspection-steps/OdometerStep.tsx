import { Card, FormField, Label, Subtitle, Button } from '../../components'

export function OdometerStep({
  odometer,
  distanceUnit,
  onChange,
  onContinue,
}: {
  odometer: string
  distanceUnit: string
  onChange: (value: string) => void
  onContinue: () => void
}) {
  return (
    <Card>
      <Label>Одометр</Label>
      <Subtitle>Введите пробег в {distanceUnit}</Subtitle>
      <FormField placeholder="0" value={odometer} onChangeText={onChange} keyboardType="numeric" />
      <Button title="Продолжить" variant="primary" onPress={onContinue} disabled={!odometer} />
    </Card>
  )
}
