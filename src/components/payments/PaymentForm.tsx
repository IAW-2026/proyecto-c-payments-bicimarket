"use client"
import React, { useState } from 'react'
import { useCreatePayment } from '@/hooks/use-payments'
import { toast } from 'sonner'

interface PaymentFormProps {
  orderId?: string
  buyerProfileId?: string
  itemsSummary?: Array<{ seller_profile_id: string; subtotal_cents: number; shipping_cost_cents: number }>
}

export default function PaymentForm({ orderId, buyerProfileId, itemsSummary }: PaymentFormProps) {
  const [amount, setAmount] = useState(5000)
  const create = useCreatePayment()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || amount <= 0) {
      toast.error('Amount must be greater than zero')
      return
    }

    // Validate required fields
    if (!orderId) {
      toast.error('Order ID is required')
      return
    }
    
    if (!buyerProfileId) {
      toast.error('Buyer profile ID is required')
      return
    }

    try {
      const res = await create.mutateAsync({
        order_id: orderId,
        amount_cents: amount,
        buyer_profile_id: buyerProfileId,
        buyer_clerk_user_id: '', // Should come from Clerk auth context
        items_summary: itemsSummary || []
      })
      toast.success('Payment created')
      // If checkout_url returned, show it
      if (res?.data?.checkout_url) {
        toast('Open checkout', { description: res.data.checkout_url })
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to create payment')
    }
  }

  return (
    <form onSubmit={onSubmit} className="p-4 border rounded">
      <label className="block mb-2">Amount (cents)</label>
      <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="border p-2 w-full" />
      <button type="submit" className="mt-3 px-3 py-2 bg-green-600 text-white rounded">Create payment</button>
    </form>
  )
}
