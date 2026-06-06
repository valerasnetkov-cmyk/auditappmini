import LoginForm from './LoginForm'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-10">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h1 className="text-center text-2xl font-bold">Аудит техники</h1>
        <p className="mt-2 text-center text-gray-600">Войдите в систему, чтобы продолжить</p>
        <LoginForm defaultNextPath="/dashboard" showAccessAction variant="standalone" />
      </div>
    </div>
  )
}
