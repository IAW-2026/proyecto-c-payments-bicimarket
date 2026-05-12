'use client'

import { useState } from 'react'
import { useSettlements } from '@/hooks/use-settlements'
import { SettlementTable } from '@/components/admin/SettlementTable'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Pagination } from '@/types/api'

export default function SettlementsPage() {
  const [filters, setFilters] = useState({})
  const [page, setPage] = useState(1)
  const [sellerId, setSellerId] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const settlementsQuery = useSettlements({ ...filters, page, limit: 20 })

  const settlements = settlementsQuery.data?.data || []
  const pagination: Pagination = settlementsQuery.data?.pagination || { page: 1, limit: 20, total: 0, has_more: false }

  const handleApplyFilters = () => {
    setFilters({
      sellerId: sellerId || undefined,
      status: status || undefined,
      from: from || undefined,
      to: to || undefined
    })
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settlements Management</h1>

      {/* Filters */}
      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Seller ID</label>
            <Input
              placeholder="Filter by seller ID"
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
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
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="manual_review">Manual Review</SelectItem>
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
          <Button
            variant="outline"
              onClick={() => {
              setSellerId('')
              setStatus(null)
              setFrom('')
              setTo('')
              setFilters({})
            }}
          >
            Reset
          </Button>
          <Button onClick={handleApplyFilters}>Apply Filters</Button>
        </div>
      </Card>

      {/* Settlements Table */}
      <SettlementTable settlements={settlements} isLoading={settlementsQuery.isLoading} />

      {/* Pagination */}
      <Card className="p-6">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Showing {settlements.length} of {pagination.total} settlements
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled>
              Page {page}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.has_more}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
