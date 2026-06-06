import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme'
import { Title } from '../components'
import type { Company } from '../types'

export function CompanySelectScreen({
  companies,
  onSelect,
}: {
  companies: Company[]
  onSelect: (c: Company) => void
}) {
  const { colors } = useTheme()
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Title>Выберите компанию</Title>
      </View>
      {companies.map((company) => (
        <Pressable
          key={company.id}
          style={[styles.card, { backgroundColor: colors.card }]}
          onPress={() => onSelect(company)}
        >
          <Text style={[styles.companyName, { color: colors.text }]}>{company.name}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
  },
  header: {
    width: '100%',
    maxWidth: 340,
    marginBottom: 8,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
  },
  companyName: {
    fontSize: 18,
    fontWeight: '600',
  },
})
