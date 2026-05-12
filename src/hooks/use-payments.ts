import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import type { PaymentResponse, PaymentCreateRequest } from '@/types/payments'
import type { PaymentFilters } from '@/types/filters'

export function usePayments(filters: PaymentFilters = {}) {
  return useQuery({
    queryKey: ['payments', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.orderId) params.append('orderId', filters.orderId)
      if (filters.buyerId) params.append('buyerId', filters.buyerId)
      if (filters.status) params.append('status', filters.status)
      if (filters.from) params.append('from', filters.from)
      if (filters.to) params.append('to', filters.to)
      params.append('page', String(filters.page || 1))
      params.append('limit', String(filters.limit || 20))

      const { data } = await axios.get(`/api/v1/payments?${params.toString()}`)
      return data
    }
  })
}

export function usePayment(paymentId: string) {
  return useQuery({
    queryKey: ['payment', paymentId],
    queryFn: async () => {
      const { data } = await axios.get(`/api/v1/payments/${paymentId}`)
      return data.data
    },
    enabled: !!paymentId
  })
}

export function useCreatePayment() {
  const qc = useQueryClient()

  return useMutation<PaymentResponse, Error, PaymentCreateRequest>({
    mutationFn: async (payload) => {
      const res = await axios.post('/api/v1/payments', payload)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payments'] }),
  })
}

export function useRefundPayment() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ paymentId, amount_cents, reason }: { paymentId: string; amount_cents: number; reason: string }) => {
      const { data } = await axios.post(`/api/v1/payments/${paymentId}/refund`, {
        amount_cents,
        reason
      })
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['payment'] })
    }
  })
}