"use client"
import React from 'react'
import PaymentForm from '@/components/payments/PaymentForm'
import PaymentsTable from '@/components/payments/PaymentsTable'

export default function PaymentsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Payments</h1>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold mb-2">Create payment</h2>
          <PaymentForm />
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-2">Recent payments</h2>
          <PaymentsTable />
        </div>
      </div>
    </div>
  )
}
