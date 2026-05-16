/*
  Warnings:

  - The values [rejected] on the enum `RefundStatus` will be removed. If these variants are still used in the database, this will fail.
  - The `status` column on the `MpWebhookEvent` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `PaymentAttempt` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Payout` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `reason` column on the `Refund` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `method` on the `OutboundCallLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('credit_card', 'debit_card', 'account_money', 'pix', 'bank_transfer');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'manual_review');

-- CreateEnum
CREATE TYPE "RefundReason" AS ENUM ('seller_rejected', 'buyer_cancelled', 'not_delivered', 'manual');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('received', 'processed', 'failed');

-- CreateEnum
CREATE TYPE "HttpMethod" AS ENUM ('GET', 'POST', 'PUT', 'PATCH', 'DELETE');

-- AlterEnum
BEGIN;
CREATE TYPE "RefundStatus_new" AS ENUM ('pending', 'approved', 'failed');
ALTER TABLE "public"."Refund" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Refund" ALTER COLUMN "status" TYPE "RefundStatus_new" USING ("status"::text::"RefundStatus_new");
ALTER TABLE "RefundStatusHistory" ALTER COLUMN "from_status" TYPE "RefundStatus_new" USING ("from_status"::text::"RefundStatus_new");
ALTER TABLE "RefundStatusHistory" ALTER COLUMN "to_status" TYPE "RefundStatus_new" USING ("to_status"::text::"RefundStatus_new");
ALTER TYPE "RefundStatus" RENAME TO "RefundStatus_old";
ALTER TYPE "RefundStatus_new" RENAME TO "RefundStatus";
DROP TYPE "public"."RefundStatus_old";
ALTER TABLE "Refund" ALTER COLUMN "status" SET DEFAULT 'pending';
COMMIT;

-- AlterTable
ALTER TABLE "MpWebhookEvent" DROP COLUMN "status",
ADD COLUMN     "status" "WebhookEventStatus" NOT NULL DEFAULT 'received';

-- AlterTable
ALTER TABLE "OutboundCallLog" DROP COLUMN "method",
ADD COLUMN     "method" "HttpMethod" NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "card_last4" TEXT,
ADD COLUMN     "items_summary" JSONB,
ADD COLUMN     "method" "PaymentMethod";

-- AlterTable
ALTER TABLE "PaymentAttempt" ADD COLUMN     "request_payload" JSONB,
ADD COLUMN     "response_payload" JSONB,
DROP COLUMN "status",
ADD COLUMN     "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "deleted_at" TIMESTAMP(3),
DROP COLUMN "status",
ADD COLUMN     "status" "PayoutStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'ARS',
DROP COLUMN "reason",
ADD COLUMN     "reason" "RefundReason" NOT NULL DEFAULT 'manual';

-- CreateIndex
CREATE INDEX "MpWebhookEvent_status_idx" ON "MpWebhookEvent"("status");
