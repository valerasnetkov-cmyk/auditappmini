import type { CompanyServiceAlert } from '@/lib/types'

export function ServiceMessagesCard({ messages }: { messages: CompanyServiceAlert[] }) {
  if (!messages.length) return null
  return (
    <section className="card mb-6 p-6">
      <h2 className="text-lg font-bold text-foreground">Сообщения сервиса</h2>
      <div className="mt-4 space-y-3">
        {messages.map((message) => (
          <article key={message.id} className="rounded-card border border-line bg-muted-surface p-4">
            <h3 className="font-semibold text-foreground">{message.title}</h3>
            {message.message ? <p className="mt-2 text-sm leading-6 text-foreground-secondary">{message.message}</p> : null}
            {message.createdAt ? <time className="mt-2 block text-xs text-foreground-muted">{new Date(message.createdAt).toLocaleString('ru-RU')}</time> : null}
          </article>
        ))}
      </div>
    </section>
  )
}
