'use client'

import React from 'react'
import { usePayment } from '@/hooks/use-payments'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { RefundDialog } from '@/components/admin/RefundDialog'
import { ArrowLeft } from 'lucide-react'

export default function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = React.useState<string>('')

  React.useEffect(() => {
    params.then(({ id }) => setId(id))
  }, [params])

  const paymentQuery = usePayment(id)
  const payment = paymentQuery.data

  if (paymentQuery.isLoading) {
    return <div className="text-center py-8">Loading payment...</div>
  }

  if (!payment) {
    return <div className="text-center py-8 text-gray-500">Payment not found</div>
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/payments">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Payment Details</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Main Info */}
        <Card className="p-6">
          <h2 className="font-bold mb-4">Payment Information</h2>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-gray-600">Payment ID</div>
              <div className="font-mono font-bold">{payment.id}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Order ID</div>
              <div className="font-mono font-bold">{payment.order_id}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Amount</div>
              <div className="text-2xl font-bold">${(payment.amount_cents / 100).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Status</div>
              <Badge className={getStatusColor(payment.status)}>{payment.status}</Badge>
            </div>
            <div>
              <div className="text-sm text-gray-600">Created</div>
              <div>{new Date(payment.created_at).toLocaleString()}</div>
            </div>
          </div>
        </Card>

        {/* Buyer Info */}
        <Card className="p-6">
          <h2 className="font-bold mb-4">Buyer Information</h2>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-gray-600">Buyer Profile ID</div>
              <div className="font-mono text-sm">{payment.buyer_profile_id}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Buyer Clerk ID</div>
              <div className="font-mono text-sm">{payment.buyer_clerk_user_id}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Currency</div>
              <div>{payment.currency}</div>
            </div>
            {payment.gateway_reference && (
              <div>
                <div className="text-sm text-gray-600">Gateway Reference</div>
                <div className="font-mono text-sm">{payment.gateway_reference}</div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Refunds */}
      {payment.refunds && payment.refunds.length > 0 && (
        <Card className="p-6">
          <h2 className="font-bold mb-4">Refunds</h2>
          <div className="space-y-2">
            {payment.refunds.map((refund: any) => (
              <div key={refund.id} className="flex justify-between p-3 bg-gray-50 rounded">
                <div>
                  <div className="font-mono text-sm">{refund.id}</div>
                  <div className="text-xs text-gray-500">{refund.reason}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold">${(refund.amount_cents / 100).toFixed(2)}</div>
                  <Badge variant="outline">{refund.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Settlements */}
      {payment.settlements && payment.settlements.length > 0 && (
        <Card className="p-6">
          <h2 className="font-bold mb-4">Settlements</h2>
          <div className="space-y-2">
            {payment.settlements.map((settlement: any) => (
              <div key={settlement.id} className="flex justify-between p-3 bg-gray-50 rounded">
                <div>
                  <Link href={`/admin/settlements/${settlement.id}`}>
                    <Button variant="ghost" size="sm" className="h-auto p-0">
                      <div className="font-mono text-sm">{settlement.id}</div>
                      <div className="text-xs text-gray-500">Seller: {settlement.seller_profile_id.substring(0, 8)}...</div>
                    </Button>
                  </Link>
                </div>
                <div className="text-right">
                  <div className="font-bold">${(settlement.net_amount_cents / 100).toFixed(2)}</div>
                  <Badge variant="outline">{settlement.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Actions */}
      {payment.status === 'approved' && (
        <Card className="p-6">
          <h2 className="font-bold mb-4">Actions</h2>
          <RefundDialog
            paymentId={payment.id}
            maxAmount={payment.amount_cents}
            trigger={<Button>Process Refund</Button>}
          />
        </Card>
      )}
    </div>
  )
}
