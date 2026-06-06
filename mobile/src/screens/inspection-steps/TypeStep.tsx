import { Card, Label, TypeButton } from '../../components'
import type { InspectionType } from '../../types'

const TYPE_LABELS: Record<InspectionType, string> = {
  quick: 'Быстрый',
  scheduled: 'Плановый',
  accident: 'ДТП',
}

const ALL_TYPES: InspectionType[] = ['quick', 'scheduled', 'accident']

export function TypeStep({
  selected,
  loading,
  onSelect,
}: {
  selected: InspectionType | null
  loading: boolean
  onSelect: (type: InspectionType) => void
}) {
  return (
    <Card>
      <Label>Выберите тип осмотра</Label>
      {ALL_TYPES.map((type) => (
        <TypeButton
          key={type}
          label={TYPE_LABELS[type]}
          selected={selected === type}
          disabled={loading}
          onPress={() => onSelect(type)}
        />
      ))}
    </Card>
  )
}
