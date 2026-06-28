import { Card, FormField, Label, Subtitle, Button } from '../../components'

export function OdometerStep({
  odometer,
  distanceUnit,
  unavailableReason,
  allowUnavailable = false,
  onChange,
  onChangeUnavailableReason,
  onOpenOcr,
  onContinue,
}: {
  odometer: string
  distanceUnit: string
  unavailableReason?: string
  allowUnavailable?: boolean
  onChange: (value: string) => void
  onChangeUnavailableReason?: (value: string) => void
  onOpenOcr?: () => void
  onContinue: () => void
}) {
  return (
    <Card>
      <Label>Одометр</Label>
      <Subtitle>Введите пробег в {distanceUnit}</Subtitle>
      <FormField placeholder="0" value={odometer} onChangeText={onChange} keyboardType="numeric" />
      {onOpenOcr ? (
        <Button
          title="Распознать по фото"
          variant="secondary"
          onPress={onOpenOcr}
        />
      ) : null}
      {allowUnavailable ? (
        <>
          <Subtitle>Если одометр недоступен, укажите причину</Subtitle>
          <FormField
            placeholder="Например: нет доступа в салон"
            value={unavailableReason || ''}
            onChangeText={(value) => onChangeUnavailableReason?.(value)}
          />
        </>
      ) : null}
      <Button
        title="Продолжить"
        variant="primary"
        onPress={onContinue}
        disabled={!odometer && !(allowUnavailable && unavailableReason?.trim())}
      />
    </Card>
  )
}
