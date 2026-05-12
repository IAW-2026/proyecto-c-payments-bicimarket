import axios from 'axios'
import { prisma } from '@/lib/prisma'

const RETRY_DELAYS = [1000, 3000, 9000] // 1s, 3s, 9s backoff

export async function notifyBuyerOrderStatus(orderId: string, status: string) {
  const buyerBaseUrl = process.env.BUYER_APP_URL
  const serviceToken = process.env.PAYMENTS_TO_BUYER_SERVICE_TOKEN

  const callId = `buyer-order-${orderId}-${Date.now()}`
  
  return retryableCall(callId, {
    method: 'PATCH',
    url: `${buyerBaseUrl}/api/v1/orders/${orderId}/status`,
    data: { status },
    headers: { 'X-Service-Token': serviceToken, 'Content-Type': 'application/json' }
  })
}

export async function createSellerSalesOrder(sellerId: string, payload: any) {
  const sellerBaseUrl = process.env.SELLER_APP_URL
  const serviceToken = process.env.PAYMENTS_TO_SELLER_SERVICE_TOKEN

  const callId = `seller-sales-order-${sellerId}-${Date.now()}`

  return retryableCall(callId, {
    method: 'POST',
    url: `${sellerBaseUrl}/api/v1/sales-orders`,
    data: { ...payload, seller_profile_id: sellerId },
    headers: { 'X-Service-Token': serviceToken, 'Content-Type': 'application/json' }
  })
}

async function retryableCall(callId: string, config: any, attemptNumber = 1) {
  try {
    const res = await axios(config)
    
    // Log success
    await logOutboundCall({
      call_id: callId,
      target_app: extractTargetApp(config.url),
      method: config.method,
      path: extractPath(config.url),
      request_body: config.data,
      response_status: res.status,
      response_body: res.data,
      attempts: attemptNumber,
      succeeded_at: new Date()
    })

    return res.data
  } catch (err: any) {
    const errorMsg = err?.response?.data?.error?.message || err?.message || 'Unknown error'
    const isLastRetry = attemptNumber > RETRY_DELAYS.length

    // Log failure
    await logOutboundCall({
      call_id: callId,
      target_app: extractTargetApp(config.url),
      method: config.method,
      path: extractPath(config.url),
      request_body: config.data,
      response_status: err?.response?.status,
      attempts: attemptNumber,
      last_error: errorMsg
    })

    if (isLastRetry) {
      throw new Error(`Outbound call failed after ${attemptNumber - 1} retries: ${errorMsg}`)
    }

    // Retry with backoff
    const delay = RETRY_DELAYS[attemptNumber - 1]
    await new Promise(resolve => setTimeout(resolve, delay))
    return retryableCall(callId, config, attemptNumber + 1)
  }
}

async function logOutboundCall(data: any) {
  try {
    await prisma.outboundCallLog.create({ data })
  } catch (err) {
    console.error('Failed to log outbound call:', err)
  }
}

function extractTargetApp(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname || 'unknown'
  } catch {
    return 'unknown'
  }
}

function extractPath(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.pathname + urlObj.search
  } catch {
    return url
  }
}
