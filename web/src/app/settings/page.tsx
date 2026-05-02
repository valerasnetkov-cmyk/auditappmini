"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import LocaleSwitcher from '@/components/LocaleSwitcher'
import api from '@/lib/api/client'
import { getAuthToken } from '@/lib/auth'

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      router.push('/login')
      return
    }
    setLoading(false)
  }, [router])

  if (loading) {
    return <Layout>Загрузка...</Layout>
  }

  return (
    <Layout currentPage="settings">
      <div className="p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Настройки</h1>
        
        <div className="card p-4 mb-4">
          <h2 className="text-lg font-semibold mb-4">Внешний вид</h2>
          <ThemeSwitcher />
        </div>

        <div className="card p-4 mb-4">
          <h2 className="text-lg font-semibold mb-4">Язык интерфейса</h2>
          <LocaleSwitcher />
        </div>

        <div className="card p-4">
          <h2 className="text-lg font-semibold mb-4">О системе</h2>
          <p className="text-gray-600">Аудит Техники v0.1.0</p>
          <p className="text-gray-500 text-sm mt-1">Система независимой фотофиксации состояния техники</p>
        </div>
      </div>
    </Layout>
  )
}