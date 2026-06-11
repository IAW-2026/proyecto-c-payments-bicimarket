import axios, { AxiosInstance } from 'axios'
import { prisma } from '@/lib/prisma'
import { generateRequestId } from '@/lib/request-id'
import type { HttpMethod } from '@/generated/prisma/client'

const RETRY_DELAYS = [1000, 3000, 9000]

function createInterAppClient(baseUrl: string, serviceToken: string): AxiosInstance {
  const client = axios.create({
    baseURL: baseUrl,
    timeout: 5000,
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Token': serviceToken,
      'User-Agent': 'bicimarket-payments/1.0',
    },
  })

  client.interceptors.request.use((config) => {
    config.headers.set('X-Request-Id', generateRequestId())
    return config
  })

  return client
}

interface OutboundCallRecord {
  target_app: string
  method: string
  path: string
  request_body: unknown
  response_status?: number
  response_body?: unknown
  attempts: number
  last_error?: string
  succeeded_at?: Date
}

async function logOutboundCall(data: OutboundCallRecord) {
  try {
    const method = data.method as HttpMethod
    await prisma.outboundCallLog.create({ data: { ...data, method } as any })
  } catch (err) {
    console.error('Failed to log outbound call:', err)
  }
}

async function retryableCall(
  callId: string,
  client: AxiosInstance,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  data?: unknown,
  attemptNumber = 1,
) {
  try {
    console.log(`[InterApp] → ${method} ${path} (attempt ${attemptNumber})`)
    console.log(`[InterApp] Request payload:`, JSON.stringify(data).slice(0, 1000))

    const res = await client.request({ method, url: path, data })

    console.log(`[InterApp] ← ${method} ${path} → ${res.status} (attempt ${attemptNumber})`)
    console.log(`[InterApp] Response data:`, JSON.stringify(res.data).slice(0, 1000))

    await logOutboundCall({
      target_app: client.defaults.baseURL || 'unknown',
      method,
      path,
      request_body: data,
      response_status: res.status,
      response_body: res.data,
      attempts: attemptNumber,
      succeeded_at: new Date(),
    })

    return res.data
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: { error?: { message?: string } }; status?: number }; message?: string }
    const errorMsg = axiosErr?.response?.data?.error?.message || axiosErr?.message || 'Unknown error'
    const statusCode = axiosErr?.response?.status
    const isLastRetry = attemptNumber > RETRY_DELAYS.length

    console.error(`[InterApp] ✗ ${method} ${path} failed (attempt ${attemptNumber}/${RETRY_DELAYS.length + 1}): status=${statusCode} error="${errorMsg}"`)

    await logOutboundCall({
      target_app: client.defaults.baseURL || 'unknown',
      method,
      path,
      request_body: data,
      response_status: statusCode,
      attempts: attemptNumber,
      last_error: errorMsg,
    })

    if (isLastRetry) {
      console.error(`[InterApp] ✗ ${method} ${path} exhausted all retries, giving up`)
      throw new Error(`Outbound call failed after ${attemptNumber - 1} retries: ${errorMsg}`)
    }

    const delay = RETRY_DELAYS[attemptNumber - 1]
    console.log(`[InterApp] Retrying ${method} ${path} in ${delay}ms (attempt ${attemptNumber} → ${attemptNumber + 1})`)
    await new Promise(resolve => setTimeout(resolve, delay))
    return retryableCall(callId, client, method, path, data, attemptNumber + 1)
  }
}

export async function notifyBuyerOrderStatus(orderId: string, status: string, paymentId: string) {
  const baseUrl = process.env.BUYER_APP_URL
  const serviceToken = process.env.PAYMENTS_TO_BUYER_SERVICE_TOKEN
  if (!baseUrl || !serviceToken) {
    console.error(`[Payments→Buyer] Cannot notify: BUYER_APP_URL or PAYMENTS_TO_BUYER_SERVICE_TOKEN not configured`)
    throw new Error('Buyer app URL or service token not configured')
  }

  console.log(`[Payments→Buyer] Notifying order status: order=${orderId} status=${status} payment=${paymentId}`)
  const client = createInterAppClient(baseUrl, serviceToken)
  const path = `/api/v1/orders/${orderId}/status`
  return retryableCall(`buyer-order-${orderId}`, client, 'PATCH', path, {
    status,
    source: 'payments',
    payment_id: paymentId,
    occurred_at: new Date().toISOString(),
  })
}

export async function createSellerSalesOrder(sellerProfileId: string, payload: {
  order_id: string
  order_seller_group_id: string
  buyer_profile_id: string
  buyer_clerk_user_id: string
  items: Array<{ product_id: string; product_name_snapshot: string; unit_price_cents: number; quantity: number }>
  items_subtotal_cents: number
  shipping_cost_cents: number
  total_cents: number
  currency: string
  shipping_address_snapshot: Record<string, unknown>
  payment_id: string
}) {
  const baseUrl = process.env.SELLER_APP_URL
  const serviceToken = process.env.PAYMENTS_TO_SELLER_SERVICE_TOKEN
  if (!baseUrl || !serviceToken) {
    console.error(`[Payments→Seller] Cannot create sales order: SELLER_APP_URL or PAYMENTS_TO_SELLER_SERVICE_TOKEN not configured`)
    throw new Error('Seller app URL or service token not configured')
  }

  console.log(`[Payments→Seller] Creating sales order for seller=${sellerProfileId} order=${payload.order_id} group=${payload.order_seller_group_id}`)
  console.log(`[Payments→Seller] Payload:`, JSON.stringify(payload))

  const client = createInterAppClient(baseUrl, serviceToken)
  return retryableCall(`seller-sales-order-${sellerProfileId}`, client, 'POST', '/api/v1/sales-orders', {
    ...payload,
    seller_profile_id: sellerProfileId,
  })
}

export async function notifySellerPaymentStatus(salesOrderId: string, paymentStatus: string, settlementId?: string) {
  const baseUrl = process.env.SELLER_APP_URL
  const serviceToken = process.env.PAYMENTS_TO_SELLER_SERVICE_TOKEN
  if (!baseUrl || !serviceToken) {
    console.error(`[Payments→Seller] Cannot notify payment status: SELLER_APP_URL or PAYMENTS_TO_SELLER_SERVICE_TOKEN not configured`)
    throw new Error('Seller app URL or service token not configured')
  }

  console.log(`[Payments→Seller] Notifying payment status: salesOrder=${salesOrderId} status=${paymentStatus} settlement=${settlementId}`)
  const client = createInterAppClient(baseUrl, serviceToken)
  const path = `/api/v1/sales-orders/${salesOrderId}/payment-status`
  return retryableCall(`seller-payment-status-${salesOrderId}`, client, 'PATCH', path, {
    payment_status: paymentStatus,
    settlement_id: settlementId,
    occurred_at: new Date().toISOString(),
  })
}


