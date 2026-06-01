-- Drop the separate IdempotencyKey table; idempotency is now stored per-resource
DROP TABLE "IdempotencyKey" CASCADE;

-- Add MP checkout metadata to Payment
ALTER TABLE "Payment" ADD COLUMN "checkout_url" TEXT;
ALTER TABLE "Payment" ADD COLUMN "preference_id" TEXT;

-- Add idempotency_key columns with unique constraints (permanent idempotency)
ALTER TABLE "Payout" ADD COLUMN "idempotency_key" TEXT;
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_idempotency_key_key" UNIQUE ("idempotency_key");

ALTER TABLE "Receipt" ADD COLUMN "idempotency_key" TEXT;
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_idempotency_key_key" UNIQUE ("idempotency_key");

ALTER TABLE "Refund" ADD COLUMN "idempotency_key" TEXT;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_idempotency_key_key" UNIQUE ("idempotency_key");
