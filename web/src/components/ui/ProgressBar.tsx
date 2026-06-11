import type { UiTone } from './Badge'

export function ProgressBar({
  value,
  max = 100,
  label,
  detail,
  tone = 'info',
}: {
  value: number
  max?: number
  label?: string
  detail?: string
  tone?: UiTone
}) {
  const safeMax = Math.max(1, max)
  const safeValue = Math.min(Math.max(0, value), safeMax)

  return (
    <div className={`ui-progress ui-progress--${tone}`}>
      {label || detail ? (
        <div className="ui-progress__header">
          {label ? <span>{label}</span> : <span />}
          {detail ? <strong>{detail}</strong> : null}
        </div>
      ) : null}
      <progress aria-label={label} max={safeMax} value={safeValue} />
    </div>
  )
}
