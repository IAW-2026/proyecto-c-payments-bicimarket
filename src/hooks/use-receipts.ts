'use client'

import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

export function useReceipt(receiptId: string) {
  return useQuery({
    queryKey: ['receipt', receiptId],
    queryFn: async () => {
      const { data } = await axios.get(`/api/v1/receipts/${receiptId}`)
      return data.data as {
        id: string
        payment_id: string
        receipt_number: string
        amount_cents: number
        issued_at: string
        created_at: string
        deleted_at: string | null
      }
    },
    enabled: !!receiptId,
  })
}
