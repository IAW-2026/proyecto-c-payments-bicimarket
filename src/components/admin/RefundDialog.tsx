'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useRefundPayment } from '@/hooks/use-payments'
import { useToast } from '@/hooks/use-toast'
import type { RefundDialogProps } from '@/types/ui'

export function RefundDialog({ paymentId, maxAmount, trigger }: RefundDialogProps) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('manual')
  const { toast } = useToast()
  const { mutate: refund, isPending } = useRefundPayment()

  const handleRefund = () => {
    if (!amount || Number(amount) <= 0 || Number(amount) > maxAmount) {
      toast({
        title: 'Invalid amount',
        description: `Amount must be between 0 and ${maxAmount}`,
        variant: 'destructive'
      })
      return
    }

    refund(
      {
        paymentId,
        amount_cents: Number(amount),
        reason
      },
      {
        onSuccess: () => {
          toast({
            title: 'Refund successful',
            description: 'The refund has been processed'
          })
          setOpen(false)
          setAmount('')
          setReason('manual')
        },
        onError: (err: any) => {
          toast({
            title: 'Refund failed',
            description: err?.response?.data?.error?.message || 'An error occurred',
            variant: 'destructive'
          })
        }
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        {trigger ? <>{trigger}</> : <Button variant="outline">Refund</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Process Refund</DialogTitle>
          <DialogDescription>
            Maximum refundable amount: ${(maxAmount / 100).toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Amount (cents)</label>
            <Input
              type="number"
              placeholder={String(maxAmount)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Reason</label>
            <select
              className="w-full px-3 py-2 border rounded-md"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="manual">Manual Refund</option>
              <option value="seller_rejected">Seller Rejected</option>
              <option value="buyer_cancelled">Buyer Cancelled</option>
              <option value="not_delivered">Not Delivered</option>
            </select>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleRefund} disabled={isPending}>
              {isPending ? 'Processing...' : 'Refund'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
