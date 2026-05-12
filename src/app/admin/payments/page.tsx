'use client'

import { useState } from 'react'
import { usePayments } from '@/hooks/use-payments'
import { PaymentFilters } from '@/components/admin/PaymentFilters'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Payment } from '@/types/payments'
import type { Pagination } from '@/types/api'

export default function PaymentsPage() {
  const [filters, setFilters] = useState({})
  const [page, setPage] = useState(1)
  const paymentsQuery = usePayments({ ...filters, page, limit: 20 })

  const payments: Payment[] = paymentsQuery.data?.data || []
  const pagination: Pagination = paymentsQuery.data?.pagination || { page: 1, limit: 20, total: 0, has_more: false }

  function getStatusColor(status: string) {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Payments Management</h1>

      <PaymentFilters onFilterChange={(newFilters) => {
        setFilters(newFilters)
        setPage(1)
      }} />

      <Card className="p-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Buyer ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No payments found
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono text-sm">{payment.order_id}</TableCell>
                    <TableCell>${(payment.amount_cents / 100).toFixed(2)}</TableCell>
                    <TableCell className="text-sm">{payment.buyer_profile_id.substring(0, 8)}...</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(payment.status)}>
                        {payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(payment.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/payments/${payment.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center mt-6 pt-6 border-t">
          <div className="text-sm text-gray-600">
            Showing {payments.length} of {pagination.total} payments
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
