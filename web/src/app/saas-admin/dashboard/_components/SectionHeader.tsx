'use client'

export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-gray-950">{title}</h2>
      {description ? <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p> : null}
    </div>
  )
}
