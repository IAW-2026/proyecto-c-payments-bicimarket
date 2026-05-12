'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import type { PaymentFiltersProps } from '@/types/ui'

export function PaymentFilters({ onFilterChange }: PaymentFiltersProps) {
  const [orderId, setOrderId] = useState('')
  const [buyerId, setBuyerId] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const handleApply = () => {
    onFilterChange({
      orderId: orderId || undefined,
      buyerId: buyerId || undefined,
      status: status || undefined,
      from: from || undefined,
      to: to || undefined,
      page: 1
    })
  }

  const handleReset = () => {
    setOrderId('')
    setBuyerId('')
    setStatus(null)
    setFrom('')
    setTo('')
    onFilterChange({})
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Order ID</label>
          <Input
            placeholder="Filter by order ID"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Buyer ID</label>
          <Input
            placeholder="Filter by buyer ID"
            value={buyerId}
            onChange={(e) => setBuyerId(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Status</label>
          <Select value={status ?? ''} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">From Date</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">To Date</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={handleReset}>Reset</Button>
        <Button onClick={handleApply}>Apply Filters</Button>
      </div>
    </Card>
  )
}
