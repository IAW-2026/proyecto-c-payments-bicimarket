'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import type { Settlement as SettlementType } from '@/types/payments'
import type { SettlementsResponse, PayoutsResponse } from '@/types/api'
import type { SettlementFilters, PayoutFilters } from '@/types/filters'

export function useSettlements(filters: SettlementFilters = {}) {
  return useQuery({
    queryKey: ['settlements', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.paymentId) params.append('paymentId', filters.paymentId)
      if (filters.sellerId) params.append('sellerId', filters.sellerId)
      if (filters.status) params.append('status', filters.status)
      if (filters.from) params.append('from', filters.from)
      if (filters.to) params.append('to', filters.to)
      params.append('page', String(filters.page || 1))
      params.append('limit', String(filters.limit || 20))

      const { data } = await axios.get<SettlementsResponse>(`/api/v1/settlements?${params.toString()}`)
      return data
    }
  })
}

export function useSettlement(settlementId: string) {
  return useQuery({
    queryKey: ['settlement', settlementId],
    queryFn: async () => {
      const { data } = await axios.get<{ data: SettlementType }>(`/api/v1/settlements/${settlementId}`)
      return data.data
    },
    enabled: !!settlementId
  })
}

export function useCreatePayout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (settlementId: string) => {
      const { data } = await axios.post('/api/v1/payouts', { settlement_id: settlementId })
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlements'] })
      queryClient.invalidateQueries({ queryKey: ['payouts'] })
    }
  })
}

export function useRetryPayouts() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { data } = await axios.post('/api/v1/payouts/retry', { ids })
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payouts'] })
      queryClient.invalidateQueries({ queryKey: ['settlements'] })
    }
  })
}

export function useMarkSettlementsPaid() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { data } = await axios.patch('/api/v1/settlements/mark_paid', { ids })
      return data.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlements'] })
      queryClient.invalidateQueries({ queryKey: ['payouts'] })
    }
  })
}

export function usePayouts(filters: PayoutFilters = {}) {
  return useQuery({
    queryKey: ['payouts', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.settlementId) params.append('settlementId', filters.settlementId)
      if (filters.status) params.append('status', filters.status)
      params.append('page', String(filters.page || 1))
      params.append('limit', String(filters.limit || 20))

      const { data } = await axios.get<PayoutsResponse>(`/api/v1/payouts?${params.toString()}`)
      return data
    }
  })
}
