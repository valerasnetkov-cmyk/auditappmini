'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import api from '@/lib/api/client'
import type { CompanyRecord } from '@/lib/types'

type CompanyFormData = {
  slug: string
  name: string
  region_code: string
  data_residency: string
}

type MessageTone = 'success' | 'error'

const EMPTY_FORM: CompanyFormData = {
  slug: '',
  name: '',
  region_code: '',
  data_residency: '',
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<CompanyFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<MessageTone>('success')

  useEffect(() => {
    void loadCompanies()
  }, [])

  const loadCompanies = async () => {
    setLoading(true)
    try {
      const result = await api.getCompanies()
      if (result.error) {
        setMessage(result.error)
        setMessageTone('error')
        return
      }
      const data = result.data
      if (data) {
        setCompanies(data)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.slug || !formData.name) {
      setMessage('Заполните обязательные поля: slug и название')
      setMessageTone('error')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      if (editingId) {
        const result = await api.updateCompany(editingId, {
          name: formData.name,
          region_code: formData.region_code || undefined,
          data_residency: formData.data_residency || undefined,
        })
        if (result.error) {
          setMessage(result.error)
          setMessageTone('error')
          return
        }
        setMessage('Компания обновлена')
      } else {
        const result = await api.createCompany({
          slug: formData.slug,
          name: formData.name,
          region_code: formData.region_code || undefined,
          data_residency: formData.data_residency || undefined,
        })
        if (result.error) {
          setMessage(result.error)
          setMessageTone('error')
          return
        }
        setMessage('Компания создана')
      }
      setMessageTone('success')
      setFormData(EMPTY_FORM)
      setShowForm(false)
      setEditingId(null)
      await loadCompanies()
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (company: CompanyRecord) => {
    setFormData({
      slug: company.slug,
      name: company.name,
      region_code: company.region_code || '',
      data_residency: company.data_residency || '',
    })
    setEditingId(company.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить компанию?')) return

    try {
      const result = await api.deleteCompany(id)
      if (result.error) {
        setMessage(result.error)
        setMessageTone('error')
        return
      }
      await loadCompanies()
      setMessage('Компания удалена')
      setMessageTone('success')
    } catch {
      setMessage('Ошибка удаления')
      setMessageTone('error')
    }
  }

  const handleCancel = () => {
    setFormData(EMPTY_FORM)
    setShowForm(false)
    setEditingId(null)
    setMessage('')
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru')
  }

  if (loading) {
    return <Layout><div className="p-8 text-center text-slate-500">Загрузка...</div></Layout>
  }

  return (
    <Layout>
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Компании</h1>
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Добавить компанию
          </button>
        </div>

        {message && (
          <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${messageTone === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message}
          </div>
        )}

        {showForm && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">
              {editingId ? 'Редактировать' : 'Новая компания'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Slug *</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="my-company"
                  disabled={!!editingId}
                  className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Название *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ООО Ромашка"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Код региона</label>
                <input
                  type="text"
                  value={formData.region_code}
                  onChange={(e) => setFormData({ ...formData, region_code: e.target.value })}
                  placeholder="RU-MOW"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Data Residency</label>
                <input
                  type="text"
                  value={formData.data_residency}
                  onChange={(e) => setFormData({ ...formData, data_residency: e.target.value })}
                  placeholder="RU"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Slug</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Название</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Регион</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Статус</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Создана</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Нет компаний
                  </td>
                </tr>
              ) : (
                companies.map((company) => (
                  <tr key={company.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-slate-900">
                      {company.slug}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900">
                      {company.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {company.region_code || '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                        company.status === 'active' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {company.status === 'active' ? 'Активна' : 'Неактивна'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">
                      {formatDate(company.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        onClick={() => handleEdit(company)}
                        className="mr-2 text-sm text-blue-600 hover:underline"
                      >
                        Изменить
                      </button>
                      <button
                        onClick={() => handleDelete(company.id)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}