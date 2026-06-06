import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../../theme'
import { Button, FormField, Label, PhotoThumb, YesNoButton, componentStyles } from '../../components'
import type { ChecklistEntry } from '../../hooks/useInspectionFlow'

export function ChecklistStep({
  checklist,
  checklistTitles,
  loading,
  onSetResult,
  onSetComment,
  onOpenDefectCamera,
  onFinish,
}: {
  checklist: Record<string, ChecklistEntry>
  checklistTitles: string[]
  loading: boolean
  onSetResult: (title: string, result: boolean | null) => void
  onSetComment: (title: string, comment: string) => void
  onOpenDefectCamera: (title: string) => void
  onFinish: () => void
}) {
  const { colors } = useTheme()
  const canFinish = checklistTitles.length > 0
    && checklistTitles.every((title) => checklist[title]?.result !== null)
    && checklistTitles.every((title) => checklist[title]?.result !== false || Boolean(checklist[title]?.photo))

  return (
    <View style={styles.fullScreen}>
      <Label>Чек-лист</Label>
      <ScrollView style={componentStyles.scrollArea} contentContainerStyle={componentStyles.scrollContent}>
        {checklistTitles.map((title) => {
          const entry = checklist[title] || { result: null, comment: '', photo: null }
          return (
            <View key={title} style={[componentStyles.checklistCard, { borderColor: colors.border }]}>
              <View style={componentStyles.checklistHeader}>
                <Text style={[componentStyles.checklistLabel, { color: colors.text }]}>{title}</Text>
                <View style={componentStyles.checklistButtons}>
                  <YesNoButton
                    label="Да"
                    selected={entry.result === true}
                    tone="positive"
                    onPress={() => onSetResult(title, true)}
                  />
                  <YesNoButton
                    label="Нет"
                    selected={entry.result === false}
                    tone="negative"
                    onPress={() => onSetResult(title, false)}
                  />
                </View>
              </View>
              {entry.result === false ? (
                <View>
                  <FormField
                    variant="comment"
                    placeholder="Комментарий к дефекту"
                    value={entry.comment}
                    onChangeText={(comment) => onSetComment(title, comment)}
                  />
                  {entry.photo ? (
                    <PhotoThumb
                      uri={entry.photo}
                      label="Фото дефекта выбрано"
                      onPress={() => onOpenDefectCamera(title)}
                    />
                  ) : null}
                  <Button
                    title={entry.photo ? 'Заменить фото дефекта' : '📷 Добавить фото дефекта'}
                    variant="secondary"
                    onPress={() => onOpenDefectCamera(title)}
                  />
                </View>
              ) : null}
            </View>
          )
        })}
      </ScrollView>
      <Button
        title={loading ? 'Сохранение…' : 'Завершить осмотр'}
        variant="primary"
        loading={loading}
        onPress={onFinish}
        disabled={!canFinish || loading}
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
