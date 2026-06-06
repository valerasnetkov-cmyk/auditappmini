import { Card, Title, Subtitle, Button } from '../../components'
import type { Inspection } from '../../types'

export function CompleteStep({
  inspection,
  distanceUnit,
  onReset,
}: {
  inspection: Inspection
  distanceUnit: string
  onReset: () => void
}) {
  return (
    <Card>
      <Title color="#0a0">Осмотр завершён</Title>
      <Subtitle>
        {inspection.vehicle_number} — {inspection.type}
      </Subtitle>
      {inspection.odometer_value ? (
        <Subtitle>
          Пробег: {inspection.odometer_value} {inspection.odometer_unit || distanceUnit}
        </Subtitle>
      ) : null}
      <Button title="Новый осмотр" variant="primary" onPress={onReset} />
    </Card>
  )
}
