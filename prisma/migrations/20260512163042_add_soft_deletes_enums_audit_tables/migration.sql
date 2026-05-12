/*
  Warnings:

  - The `status` column on the `Payment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Refund` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Settlement` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('pending', 'paid', 'failed', 'manual_review');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "deleted_at" TIMESTAMP(3),
DROP COLUMN "status",
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "deleted_at" TIMESTAMP(3),
DROP COLUMN "status",
ADD COLUMN     "status" "RefundStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN     "deleted_at" TIMESTAMP(3),
DROP COLUMN "status",
ADD COLUMN     "status" "SettlementStatus" NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE "PaymentStatusHistory" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "from_status" "PaymentStatus",
    "to_status" "PaymentStatus" NOT NULL,
    "changed_by" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementStatusHistory" (
    "id" TEXT NOT NULL,
    "settlement_id" TEXT NOT NULL,
    "from_status" "SettlementStatus",
    "to_status" "SettlementStatus" NOT NULL,
    "changed_by" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundStatusHistory" (
    "id" TEXT NOT NULL,
    "refund_id" TEXT NOT NULL,
    "from_status" "RefundStatus",
    "to_status" "RefundStatus" NOT NULL,
    "changed_by" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentStatusHistory_payment_id_idx" ON "PaymentStatusHistory"("payment_id");

-- CreateIndex
CREATE INDEX "SettlementStatusHistory_settlement_id_idx" ON "SettlementStatusHistory"("settlement_id");

-- CreateIndex
CREATE INDEX "RefundStatusHistory_refund_id_idx" ON "RefundStatusHistory"("refund_id");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Settlement_status_idx" ON "Settlement"("status");

-- AddForeignKey
ALTER TABLE "PaymentStatusHistory" ADD CONSTRAINT "PaymentStatusHistory_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementStatusHistory" ADD CONSTRAINT "SettlementStatusHistory_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundStatusHistory" ADD CONSTRAINT "RefundStatusHistory_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "Refund"("id") ON DELETE CASCADE ON UPDATE CASCADE;
