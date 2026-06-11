export function Skeleton({
  className = '',
  lines = 0,
}: {
  className?: string
  lines?: number
}) {
  if (lines > 0) {
    return (
      <div className={`ui-skeleton-stack ${className}`} aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => (
          <span key={index} className="ui-skeleton ui-skeleton--line" />
        ))}
      </div>
    )
  }

  return <span className={`ui-skeleton ${className}`} aria-hidden="true" />
}
