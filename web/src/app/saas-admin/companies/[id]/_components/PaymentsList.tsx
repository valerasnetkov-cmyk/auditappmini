'use client'

import Link from 'next/link'
import type { SaasPayment } from '@/lib/types'
import { formatCurrency, formatDate } from '../_lib/companyDetail'

type Props = {
  payments: SaasPayment[]
}

export default function PaymentsList({ payments }: Props) {
  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4">
        <h2 className="text-base font-semibold text-gray-950">Платежи</h2>
        <Link href="/saas-admin/payments" className="text-sm font-medium text-blue-700">Добавить платеж</Link>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Дата</th>
              <th className="px-4 py-3">Период</th>
              <th className="px-4 py-3">Сумма</th>
              <th className="px-4 py-3">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {payments.slice(0, 8).map((payment) => (
              <tr key={payment.id}>
                <td className="px-4 py-3">{formatDate(payment.paymentDate)}</td>
                <td className="px-4 py-3">{formatDate(payment.periodStart)} - {formatDate(payment.periodEnd)}</td>
                <td className="px-4 py-3">{formatCurrency(payment.amount, payment.currency)}</td>
                <td className="px-4 py-3">{payment.status}</td>
              </tr>
            ))}
            {!payments.length ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={4}>Платежей пока нет</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
