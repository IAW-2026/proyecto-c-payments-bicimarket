"use client"
import React from 'react'
import { usePayments } from '@/hooks/use-payments'
import { toast } from 'sonner'

export default function PaymentsTable() {
  const { data, isLoading, isError } = usePayments()

  if (isError) {
    toast.error('Failed to load payments')
  }

  return (
    <div className="border rounded">
      <table className="w-full text-left">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2">ID</th>
            <th className="p-2">Amount</th>
            <th className="p-2">Currency</th>
            <th className="p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr><td colSpan={4} className="p-4">Loading...</td></tr>
          )}
          {!isLoading && data?.data?.length === 0 && (
            <tr><td colSpan={4} className="p-4">No payments</td></tr>
          )}
          {!isLoading && data?.data?.map((p: any) => (
            <tr key={p.id} className="border-t">
              <td className="p-2">{p.id}</td>
              <td className="p-2">{p.amount_cents}</td>
              <td className="p-2">{p.currency}</td>
              <td className="p-2">{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
