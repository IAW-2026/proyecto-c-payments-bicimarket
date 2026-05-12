'use client'

import React from 'react'
import { useSettlement, useCreatePayout } from '@/hooks/use-settlements'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft } from 'lucide-react'

export default function SettlementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = React.useState<string>('')
  const { toast } = useToast()

  React.useEffect(() => {
    params.then(({ id }) => setId(id))
  }, [params])

  const settlementQuery = useSettlement(id)
  const settlement = settlementQuery.data
  const { mutate: createPayout, isPending } = useCreatePayout()

  if (settlementQuery.isLoading) {
    return <div className="text-center py-8">Loading settlement...</div>
  }

  if (!settlement) {
    return <div className="text-center py-8 text-gray-500">Settlement not found</div>
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'manual_review':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleCreatePayout = () => {
    createPayout(settlement.id, {
      onSuccess: () => {
        toast({
          title: 'Payout created',
          description: 'The payout has been scheduled successfully'
        })
      },
      onError: (err: any) => {
        toast({
          title: 'Payout failed',
          description: err?.response?.data?.error?.message || 'An error occurred',
          variant: 'destructive'
        })
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/settlements">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Settlement Details</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Main Info */}
        <Card className="p-6">
          <h2 className="font-bold mb-4">Settlement Information</h2>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-gray-600">Settlement ID</div>
              <div className="font-mono font-bold text-sm">{settlement.id}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Order ID</div>
              <div className="font-mono font-bold">{settlement.order_id}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Status</div>
              <Badge className={getStatusColor(settlement.status)}>{settlement.status}</Badge>
            </div>
            <div>
              <div className="text-sm text-gray-600">Created</div>
              <div>{new Date(settlement.created_at).toLocaleString()}</div>
            </div>
          </div>
        </Card>

        {/* Seller Info */}
        <Card className="p-6">
          <h2 className="font-bold mb-4">Seller Information</h2>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-gray-600">Seller Profile ID</div>
              <div className="font-mono text-sm">{settlement.seller_profile_id}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Order Seller Group ID</div>
              <div className="font-mono text-sm">{settlement.order_seller_group_id}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Currency</div>
              <div>{settlement.currency}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Amount Breakdown */}
      <Card className="p-6">
        <h2 className="font-bold mb-4">Amount Breakdown</h2>
        <div className="space-y-4">
          <div className="flex justify-between pb-3 border-b">
            <div>Gross Amount</div>
            <div className="font-bold">${(settlement.gross_amount_cents / 100).toFixed(2)}</div>
          </div>
          <div className="flex justify-between pb-3 border-b text-red-600">
            <div>Platform Fee</div>
            <div className="font-bold">-${(settlement.fee_amount_cents / 100).toFixed(2)}</div>
          </div>
          <div className="flex justify-between text-lg font-bold pt-3 bg-blue-50 p-3 rounded">
            <div>Net Amount (Seller receives)</div>
            <div>${(settlement.net_amount_cents / 100).toFixed(2)}</div>
          </div>
        </div>
      </Card>

      {/* Payouts */}
      {settlement.payouts && settlement.payouts.length > 0 && (
        <Card className="p-6">
          <h2 className="font-bold mb-4">Payouts</h2>
          <div className="space-y-2">
            {settlement.payouts.map((payout: any) => (
              <div key={payout.id} className="flex justify-between p-3 bg-gray-50 rounded">
                <div>
                  <div className="font-mono text-sm">{payout.id}</div>
                  <div className="text-xs text-gray-500">
                    Attempts: {payout.attempts}
                    {payout.last_error && ` - Error: ${payout.last_error}`}
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline">{payout.status}</Badge>
                  {payout.completed_at && (
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(payout.completed_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Actions */}
      {settlement.status === 'pending' && (
        <Card className="p-6">
          <h2 className="font-bold mb-4">Actions</h2>
          <p className="text-sm text-gray-600 mb-4">
            Create a payout to transfer the settlement amount to the seller's Mercado Pago account.
          </p>
          <Button onClick={handleCreatePayout} disabled={isPending}>
            {isPending ? 'Creating payout...' : 'Create Payout'}
          </Button>
        </Card>
      )}
    </div>
  )
}
