'use client'

export default function OdometerCard({
  odometerValue,
  setOdometerValue,
  odometerUnit,
  setOdometerUnit,
  disabled,
}: {
  odometerValue: string
  setOdometerValue: (value: string) => void
  odometerUnit: string
  setOdometerUnit: (value: string) => void
  disabled: boolean
}) {
  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h2 className="mb-3 text-base font-semibold text-slate-900">Одометр</h2>
      <div className="flex items-center gap-3">
        <input
          type="number"
          value={odometerValue}
          onChange={(event) => setOdometerValue(event.target.value)}
          disabled={disabled}
          placeholder="Пробег"
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
        <select
          value={odometerUnit}
          onChange={(event) => setOdometerUnit(event.target.value)}
          disabled={disabled}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="km">км</option>
          <option value="mi">мили</option>
        </select>
      </div>
    </div>
  )
}
