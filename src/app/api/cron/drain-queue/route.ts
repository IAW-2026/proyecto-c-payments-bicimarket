import { NextResponse } from 'next/server'
import { processJobQueue } from '@/services/job-queue.service'
import { prisma } from '@/lib/prisma'

export const maxDuration = 60

export async function GET() {
  console.log('[Cron] drain-queue started')

  // Verify auth via VERCEL_CRON_TOKEN or CRON_SECRET
  // Vercel Cron doesn't support custom auth headers natively on Free/Hobby;
  // rely on the cron endpoint being invoked only by Vercel's internal scheduler.
  // For production, add a CRON_SECRET env var check.

  let processed = 0
  let hasMore = true
  while (hasMore) {
    const before = await prisma.webhookJob.count({ where: { status: 'pending', scheduled_at: { lte: new Date() } } })
    if (before === 0) {
      hasMore = false
      break
    }
    await processJobQueue()
    const after = await prisma.webhookJob.count({ where: { status: 'pending', scheduled_at: { lte: new Date() } } })
    if (after >= before) {
      hasMore = false
      break
    }
    processed += before - after
  }

  console.log(`[Cron] drain-queue finished, processed ${processed} jobs`)
  return NextResponse.json({ ok: true, processed })
}
