'use client'

import { FormEvent } from 'react'
import type { SaasOwner } from '@/lib/types'
import { ownerInviteMailto, setupStatusClass, setupStatusLabel } from '../_lib/companyDetail'
import type { OwnerForm } from '../_lib/companyDetail'

type Props = {
  owners: SaasOwner[]
  ownerForm: OwnerForm
  setOwnerForm: (updater: (prev: OwnerForm) => OwnerForm) => void
  ownerSetupLinks: Record<string, string>
  saving: boolean
  onCreateOwner: (event: FormEvent<HTMLFormElement>) => void
  onDeactivateOwner: (ownerId: string) => void
  onIssueSetupLink: (ownerId: string) => void
  onCopySetupLink: (url: string) => void
}

export default function OwnersSection({
  owners, ownerForm, setOwnerForm, ownerSetupLinks, saving,
  onCreateOwner, onDeactivateOwner, onIssueSetupLink, onCopySetupLink,
}: Props) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-gray-950">Владельцы</h2>
      <div className="mt-4 space-y-3">
        {owners.length ? owners.map((owner) => (
          <OwnerCard
            key={owner.id}
            owner={owner}
            setupUrl={ownerSetupLinks[owner.id]}
            saving={saving}
            onCopySetupLink={onCopySetupLink}
            onIssueSetupLink={onIssueSetupLink}
            onDeactivateOwner={onDeactivateOwner}
          />
        )) : (
          <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
            Владелец не назначен
          </div>
        )}
      </div>
      <form onSubmit={onCreateOwner} className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          type="email"
          value={ownerForm.email}
          onChange={(event) => setOwnerForm((prev) => ({ ...prev, email: event.target.value }))}
          placeholder="Email владельца"
          required
        />
        <input
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          value={ownerForm.name}
          onChange={(event) => setOwnerForm((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="Имя владельца"
          required
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 md:col-span-2"
        >
          Создать владельца
        </button>
      </form>
    </section>
  )
}

type OwnerCardProps = {
  owner: SaasOwner
  setupUrl: string | undefined
  saving: boolean
  onCopySetupLink: (url: string) => void
  onIssueSetupLink: (ownerId: string) => void
  onDeactivateOwner: (ownerId: string) => void
}

function OwnerCard({ owner, setupUrl, saving, onCopySetupLink, onIssueSetupLink, onDeactivateOwner }: OwnerCardProps) {
  return (
    <div key={owner.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <div className="font-medium text-gray-950">{owner.name}</div>
      <div className="mt-1 text-sm text-gray-500">{owner.email} · {owner.status}</div>
      <div className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${setupStatusClass(owner)}`}>
        {setupStatusLabel(owner)}
      </div>
      {setupUrl ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 p-2">
          <input
            className="min-w-0 flex-1 bg-transparent text-xs text-blue-900 outline-none"
            readOnly
            value={setupUrl}
          />
          <button
            type="button"
            className="text-xs font-semibold text-blue-700"
            onClick={() => void onCopySetupLink(setupUrl)}
          >
            Копировать
          </button>
          <a className="text-xs font-semibold text-blue-700" href={ownerInviteMailto(owner, setupUrl)}>
            Письмо
          </a>
        </div>
      ) : null}
      {owner.status !== 'inactive' ? (
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void onIssueSetupLink(owner.id)}
            className="text-xs font-semibold text-blue-600 disabled:opacity-50"
          >
            {owner.setup?.status === 'accepted' ? 'Создать новую ссылку' : 'Выдать setup-ссылку'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void onDeactivateOwner(owner.id)}
            className="text-xs font-semibold text-red-600 disabled:opacity-50"
          >
            Отключить
          </button>
        </div>
      ) : null}
    </div>
  )
}
