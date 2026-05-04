import React from 'react'

type Props = { params: { id: string } }

export default async function PaymentDetailPage({ params }: Props) {
  const { id } = params
  // Server-side fetch to internal API route
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/v1/payments/${id}`, { cache: 'no-store' })
  const json = await res.json()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Payment {id}</h1>
      <pre className="bg-gray-100 p-4 rounded">{JSON.stringify(json, null, 2)}</pre>
    </div>
  )
}
