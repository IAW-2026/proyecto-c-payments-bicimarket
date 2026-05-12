'use client'

import { usePayments } from '@/hooks/use-payments'
import { useSettlements } from '@/hooks/use-settlements'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import type { Payment, Settlement } from '@/types/payments'

export default function AdminDashboard() {
  const paymentsQuery = usePayments({ limit: 5 })
  const settlementsQuery = useSettlements({ limit: 5 })

  const payments: Payment[] = paymentsQuery.data?.data || []
  const settlements: Settlement[] = settlementsQuery.data?.data || []
  const totalPayments = paymentsQuery.data?.pagination?.total || 0
  const totalSettlements = settlementsQuery.data?.pagination?.total || 0

  // Calculate stats
  const approvedPayments = payments.filter((p) => p.status === 'approved')
  const pendingSettlements = settlements.filter((s) => s.status === 'pending')
  const totalAmount = approvedPayments.reduce((sum, p) => sum + p.amount_cents, 0)

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Payments Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="text-sm font-medium text-gray-600">Total Payments</div>
          <div className="text-2xl font-bold mt-2">{totalPayments}</div>
          <div className="text-xs text-gray-500 mt-2">{approvedPayments.length} approved</div>
        </Card>

        <Card className="p-6">
          <div className="text-sm font-medium text-gray-600">Total Amount</div>
          <div className="text-2xl font-bold mt-2">${(totalAmount / 100).toFixed(2)}</div>
          <div className="text-xs text-gray-500 mt-2">ARS</div>
        </Card>

        <Card className="p-6">
          <div className="text-sm font-medium text-gray-600">Pending Settlements</div>
          <div className="text-2xl font-bold mt-2">{pendingSettlements.length}</div>
          <div className="text-xs text-gray-500 mt-2">Awaiting payout</div>
        </Card>

        <Card className="p-6">
          <div className="text-sm font-medium text-gray-600">Total Settlements</div>
          <div className="text-2xl font-bold mt-2">{totalSettlements}</div>
          <div className="text-xs text-gray-500 mt-2">Created</div>
        </Card>
      </div>

      {/* Recent Payments */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Recent Payments</h2>
          <Link href="/admin/payments">
            <Button variant="ghost" size="sm">
              View All <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

        <div className="space-y-3">
          {payments.length === 0 ? (
            <p className="text-gray-500 text-sm">No payments yet</p>
          ) : (
            payments.map((payment) => (
              <div key={payment.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <div className="font-mono text-sm font-medium">{payment.order_id}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(payment.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">${(payment.amount_cents / 100).toFixed(2)}</div>
                  <Badge variant="outline">{payment.status}</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Recent Settlements */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Recent Settlements</h2>
          <Link href="/admin/settlements">
            <Button variant="ghost" size="sm">
              View All <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

        <div className="space-y-3">
          {settlements.length === 0 ? (
            <p className="text-gray-500 text-sm">No settlements yet</p>
          ) : (
            settlements.map((settlement) => (
              <div key={settlement.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <div className="font-mono text-sm font-medium">{settlement.order_id}</div>
                  <div className="text-xs text-gray-500">
                    Seller: {settlement.seller_profile_id.substring(0, 8)}...
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold">${(settlement.net_amount_cents / 100).toFixed(2)}</div>
                  <Badge variant="outline">{settlement.status}</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
