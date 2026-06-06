'use client'

export default function WarningsBanner({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null

  return (
    <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
      <strong className="font-medium">Неполные данные:</strong>
      <ul className="mt-1 list-inside list-disc">
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </div>
  )
}
