import Image from 'next/image'
import Link from 'next/link'
import LoginForm from './LoginForm'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-8 shadow-popover">
        <Image className="mx-auto h-auto w-48" src="/brand/auditavto-logo-horizontal.svg" alt="AuditAvto" width={244} height={48} priority />
        <h1 className="mt-8 text-center text-2xl font-semibold text-foreground">Вход в систему</h1>
        <p className="mt-2 text-center text-foreground-secondary">Войдите в аккаунт вашей компании</p>
        <LoginForm defaultNextPath="/dashboard" showAccessAction variant="standalone" />
        <div className="mt-5 text-center">
          <Link href="/" className="text-sm font-semibold text-primary hover:text-primary-hover">
            На главную
          </Link>
        </div>
      </div>
    </div>
  )
}
