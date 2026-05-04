import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import type { PaymentResponse, PaymentCreateRequest } from '@/types/payments'

export function usePayments(opts?: any) {
  return useQuery({
    queryKey: ['payments', opts],
    queryFn: async () => {
      const res = await axios.get('/api/v1/payments')
      return res.data
    },
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