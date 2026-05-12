'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { SettlementTableProps } from '@/types/ui'

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

export function SettlementTable({ settlements, isLoading }: SettlementTableProps) {
  if (isLoading) {
    return <div className="text-center py-8">Loading settlements...</div>
  }

  if (!settlements || settlements.length === 0) {
    return <div className="text-center py-8 text-gray-500">No settlements found</div>
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order ID</TableHead>
            <TableHead>Seller ID</TableHead>
            <TableHead>Gross Amount</TableHead>
            <TableHead>Fee</TableHead>
            <TableHead>Net Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {settlements.map((settlement) => (
            <TableRow key={settlement.id}>
              <TableCell className="font-mono text-sm">{settlement.order_id}</TableCell>
              <TableCell className="font-mono text-sm">{settlement.seller_profile_id}</TableCell>
              <TableCell>${(settlement.gross_amount_cents / 100).toFixed(2)}</TableCell>
              <TableCell>${(settlement.fee_amount_cents / 100).toFixed(2)}</TableCell>
              <TableCell className="font-semibold">${(settlement.net_amount_cents / 100).toFixed(2)}</TableCell>
              <TableCell>
                <Badge className={getStatusColor(settlement.status)}>
                  {settlement.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                {new Date(settlement.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <Link href={`/admin/settlements/${settlement.id}`}>
                  <Button variant="ghost" size="sm">View</Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
