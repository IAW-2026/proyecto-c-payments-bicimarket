'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import type { Refund } from '@/types/payments'

export interface RefundFilters {
  paymentId?: string
  status?: string
  reason?: string
  from?: string
  to?: string
  q?: string
  page?: number
  limit?: number
  sort?: string
}

export function useRefunds(filters: RefundFilters = {}) {
  return useQuery({
    queryKey: ['refunds', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.paymentId) params.append('paymentId', filters.paymentId)
      if (filters.status) params.append('status', filters.status)
      if (filters.reason) params.append('reason', filters.reason)
      if (filters.from) params.append('from', filters.from)
      if (filters.to) params.append('to', filters.to)
      if (filters.q) params.append('q', filters.q)
      params.append('page', String(filters.page || 1))
      params.append('limit', String(filters.limit || 20))
      if (filters.sort) params.append('sort', filters.sort)

      const { data } = await axios.get(`/api/v1/refunds?${params.toString()}`)
      return data
    }
  })
}

export function useRefund(refundId: string) {
  return useQuery({
    queryKey: ['refund', refundId],
    queryFn: async () => {
      const { data } = await axios.get(`/api/v1/refunds/${refundId}`)
      return data.data
    },
    enabled: !!refundId
  })
}

export function useCreateRefund() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      payment_id,
      amount_cents,
      reason,
      seller_profile_id
    }: {
      payment_id: string
      amount_cents: number
      reason: string
      seller_profile_id?: string
    }) => {
      const { data } = await axios.post('/api/v1/refunds', {
        payment_id,
        amount_cents,
        reason,
        seller_profile_id
      })
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['refunds'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
    }
  })
}

export function useUpdateRefundStatus() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      refundId,
      status,
      reason
    }: {
      refundId: string
      status: string
      reason?: string
    }) => {
      const { data } = await axios.patch(`/api/v1/refunds/${refundId}`, {
        status,
        reason
      })
      return data.data
    },
    onSuccess: (_, { refundId }) => {
      qc.invalidateQueries({ queryKey: ['refunds'] })
      qc.invalidateQueries({ queryKey: ['refund', refundId] })
    }
  })
}
