import { Card, Title, Subtitle, Button } from '../../components'

export function HomeStep({ companyName, onStart }: { companyName: string; onStart: () => void }) {
  return (
    <Card>
      <Title>Осмотр техники</Title>
      <Subtitle>{companyName}</Subtitle>
      <Button title="Начать осмотр" variant="primary" onPress={onStart} />
    </Card>
  )
}
