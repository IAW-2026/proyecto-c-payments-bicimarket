import { PrismaClient } from "../src/generated/prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Resetting database — deleting all rows, keeping tables …")

  await prisma.$connect()

  const cleanOrder = [
    'outboundCallLog', 'mpWebhookEvent', 'refundStatusHistory', 'refund',
    'payout', 'settlementStatusHistory', 'settlement', 'receipt',
    'paymentAttempt', 'paymentStatusHistory', 'payment',
  ] as const

  const modelMap: Record<string, any> = {
    outboundCallLog: prisma.outboundCallLog,
    mpWebhookEvent: prisma.mpWebhookEvent,
    refundStatusHistory: prisma.refundStatusHistory,
    refund: prisma.refund,
    payout: prisma.payout,
    settlementStatusHistory: prisma.settlementStatusHistory,
    settlement: prisma.settlement,
    receipt: prisma.receipt,
    paymentAttempt: prisma.paymentAttempt,
    paymentStatusHistory: prisma.paymentStatusHistory,
    payment: prisma.payment,
  }

  for (const m of cleanOrder) {
    const { count } = await (modelMap[m] as any).deleteMany()
    console.log(`  cleaned ${m}: ${count} rows deleted`)
  }

  console.log("\nDatabase reset complete — all tables are empty.")
}

main()
  .catch((e) => {
    console.error("Reset failed:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
