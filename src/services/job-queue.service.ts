import { prisma } from '@/lib/prisma'
import * as handlers from './webhook-job-handlers'

const BACKOFF_BASE_MS = 30_000

function computeBackoff(attempts: number): Date {
  const delay = BACKOFF_BASE_MS * Math.pow(2, attempts - 1)
  return new Date(Date.now() + delay)
}

export async function enqueueJob(
  mpEventId: string,
  jobType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const active = await prisma.webhookJob.findFirst({
    where: {
      mp_event_id: mpEventId,
      job_type: jobType,
      status: { in: ['pending', 'processing'] },
    },
  })
  if (active) {
    console.log(`[JobQueue] Active job exists for ${mpEventId}/${jobType} (status=${active.status}), skipping enqueue`)
    return
  }

  await prisma.webhookJob.create({
    data: {
      mp_event_id: mpEventId,
      job_type: jobType,
      payload: payload as any,
      status: 'pending',
      scheduled_at: new Date(),
    },
  })
  console.log(`[JobQueue] Enqueued ${jobType} job for mpEventId=${mpEventId}`)
}

export async function dequeueJobs(limit = 5) {
  const now = new Date()
  const jobs = await prisma.webhookJob.findMany({
    where: {
      status: 'pending',
      scheduled_at: { lte: now },
    },
    orderBy: [{ attempts: 'asc' }, { scheduled_at: 'asc' }],
    take: limit,
  })
  if (jobs.length === 0) return []

  const ids = jobs.map((j) => j.id)
  await prisma.webhookJob.updateMany({
    where: { id: { in: ids }, status: 'pending', scheduled_at: { lte: now } },
    data: { status: 'processing' },
  })

  return jobs
}

export async function completeJob(jobId: string): Promise<void> {
  await prisma.webhookJob.update({
    where: { id: jobId },
    data: { status: 'completed' },
  })
}

export async function failJob(jobId: string, error: string): Promise<void> {
  const job = await prisma.webhookJob.findUnique({ where: { id: jobId } })
  if (!job) return

  const attempts = job.attempts + 1
  if (attempts >= job.max_attempts) {
    console.warn(`[JobQueue] Job ${jobId} failed after ${attempts} attempts, final: ${error}`)
    await prisma.webhookJob.update({
      where: { id: jobId },
      data: { status: 'failed', attempts, last_error: error },
    })
    return
  }

  const scheduledAt = computeBackoff(attempts)
  console.warn(`[JobQueue] Job ${jobId} attempt ${attempts}/${job.max_attempts} failed, retry at ${scheduledAt.toISOString()}: ${error}`)
  await prisma.webhookJob.update({
    where: { id: jobId },
    data: { status: 'pending', attempts, last_error: error, scheduled_at: scheduledAt },
  })
}

export async function processJobQueue(): Promise<void> {
  const jobs = await dequeueJobs()
  if (jobs.length === 0) return

  console.log(`[JobQueue] Processing ${jobs.length} jobs from queue`)

  for (const job of jobs) {
    try {
      const handler = job.job_type === 'process_webhook'
        ? handlers.handleProcessWebhook
        : job.job_type === 'send_notification'
          ? handlers.handleSendNotification
          : null

      if (!handler) {
        console.error(`[JobQueue] Unknown job type: ${job.job_type} for job ${job.id}`)
        await failJob(job.id, `Unknown job type: ${job.job_type}`)
        continue
      }

      const result = await handler(job)
      if (result.success) {
        await completeJob(job.id)
      } else {
        await failJob(job.id, result.error || 'Unknown error')
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      await failJob(job.id, errMsg)
    }
  }
}
