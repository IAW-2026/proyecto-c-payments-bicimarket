// Shipping App — BiciMarket
// Usage: npx tsx seeds/seed-shipping.ts
// Adjust the import path to match your Prisma client output location.
// For Shipping App: import { PrismaClient, ... } from '../src/generated/prisma/client';

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Helpers ─────────────────────────────────────────────────────────────────
const START = new Date('2026-04-01T00:00:00Z')
const END = new Date('2026-06-24T23:59:59Z')

function daysBefore(days: number): Date {
  const d = new Date(END)
  d.setDate(d.getDate() - days)
  d.setHours(6 + Math.floor(Math.random() * 16), Math.floor(Math.random() * 60))
  return d
}

function addHours(date: Date, hours: number): Date {
  const d = new Date(date)
  d.setHours(d.getHours() + hours)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// ─── Data ────────────────────────────────────────────────────────────────────

const OPERATORS = [
  { id: 'lop_operator_001', clerkUserId: 'user_logistics_001', fullName: 'Juan Pérez', email: 'juan.perez@logistica.com', phone: '+5491122221111', documentId: '30123456', vehicleType: 'van' as const, licensePlate: 'AB123CD', status: 'active' as const },
  { id: 'lop_operator_002', clerkUserId: 'user_logistics_002', fullName: 'María Gómez', email: 'maria.gomez@logistica.com', phone: '+5491122222222', documentId: '31234567', vehicleType: 'motorcycle' as const, licensePlate: 'CD456EF', status: 'active' as const },
  { id: 'lop_operator_003', clerkUserId: 'user_logistics_003', fullName: 'Carlos Sánchez', email: 'carlos.sanchez@logistica.com', phone: '+5491122223333', documentId: '32345678', vehicleType: 'truck' as const, licensePlate: 'EF789GH', status: 'active' as const },
  { id: 'lop_operator_004', clerkUserId: 'user_logistics_004', fullName: 'Lucía Díaz', email: 'lucia.diaz@logistica.com', phone: '+5491122224444', documentId: '33456789', vehicleType: 'car' as const, licensePlate: 'GH012IJ', status: 'active' as const },
  { id: 'lop_operator_005', clerkUserId: 'user_logistics_005', fullName: 'Pedro Martínez', email: 'pedro.martinez@logistica.com', phone: '+5491122225555', documentId: '34567890', vehicleType: 'van' as const, licensePlate: 'IJ345KL', status: 'active' as const },
  { id: 'lop_operator_006', clerkUserId: 'user_logistics_006', fullName: 'Ana Rodríguez', email: 'ana.rodriguez@logistica.com', phone: '+5491122226666', documentId: '35678901', vehicleType: 'motorcycle' as const, licensePlate: 'KL678MN', status: 'active' as const },
  { id: 'lop_operator_007', clerkUserId: 'user_logistics_007', fullName: 'Diego Fernández', email: 'diego.fernandez@logistica.com', phone: '+5491122227777', documentId: '36789012', vehicleType: 'van' as const, licensePlate: 'MN901OP', status: 'inactive' as const },
  { id: 'lop_operator_008', clerkUserId: 'user_logistics_008', fullName: 'Valentina Torres', email: 'valentina.torres@logistica.com', phone: '+5491122228888', documentId: '37890123', vehicleType: 'truck' as const, licensePlate: 'OP234QR', status: 'active' as const },
]

// ─── 150 Shipping Rates ──────────────────────────────────────────────────────
// 5 distance ranges × 10 weight ranges × 3 service levels
// Some same_day rates inactive for long distances.

function generateRates(): Array<{
  id: string
  carrier: string
  serviceLevel: 'standard' | 'express' | 'same_day'
  distanceKmMin: number
  distanceKmMax: number
  weightGramsMin: number
  weightGramsMax: number
  costCents: number
  estimatedDaysMin: number
  estimatedDaysMax: number
  active: boolean
}> {
  const rates: ReturnType<typeof generateRates> = []
  const carriers = ['andreani', 'oca', 'propio']
  const distances = [
    { min: 0, max: 10 },
    { min: 10, max: 50 },
    { min: 50, max: 200 },
    { min: 200, max: 500 },
    { min: 500, max: 3000 },
  ]
  const weights = [
    { min: 0, max: 500 },
    { min: 500, max: 1000 },
    { min: 1000, max: 3000 },
    { min: 3000, max: 5000 },
    { min: 5000, max: 8000 },
    { min: 8000, max: 12000 },
    { min: 12000, max: 15000 },
    { min: 15000, max: 20000 },
    { min: 20000, max: 30000 },
    { min: 30000, max: 50000 },
  ]

  let idx = 0
  for (const dist of distances) {
    for (const w of weights) {
      for (let sl = 0; sl < 3; sl++) {
        const serviceLevel = ['standard', 'express', 'same_day'][sl] as 'standard' | 'express' | 'same_day'
        const carrier = sl === 0 ? 'andreani' : sl === 1 ? 'oca' : 'propio'
        // same_day not available for long distances
        const active = !(serviceLevel === 'same_day' && dist.min >= 500)
        // Cost logic: base + distance factor + weight factor
        const baseCost = serviceLevel === 'same_day' ? 3000000 : serviceLevel === 'express' ? 1500000 : 800000
        const distFactor = Math.ceil(dist.max / 10) * 50000
        const weightFactor = Math.ceil(w.max / 1000) * 20000
        const costCents = baseCost + distFactor + weightFactor
        const daysMin = serviceLevel === 'same_day' ? 0 : serviceLevel === 'express' ? 1 : 2
        const daysMax = serviceLevel === 'same_day' ? 1 : serviceLevel === 'express' ? 3 : 6
        idx++

        rates.push({
          id: `rat_rate_${String(idx).padStart(3, '0')}`,
          carrier,
          serviceLevel,
          distanceKmMin: dist.min,
          distanceKmMax: dist.max,
          weightGramsMin: w.min,
          weightGramsMax: w.max,
          costCents,
          estimatedDaysMin: daysMin + Math.floor(dist.max / 100),
          estimatedDaysMax: daysMax + Math.floor(dist.max / 80),
          active,
        })
      }
    }
  }
  return rates
}

const SHIPPING_RATES = generateRates()

// ─── Order & Seller references (matching buyer + seller seeds) ──────────────

const ORDERS = Array.from({ length: 30 }, (_, i) => ({
  orderId: `ord_buyer_${String(i + 1).padStart(3, '0')}`,
  buyerProfileId: `byp_buyer_${String(i % 25 + 1).padStart(3, '0')}`,
}))

const SELLER_GROUPS = [
  // Order 1: single seller
  { orderId: 'ord_buyer_001', sellerProfileId: 'slp_seller_001', osgId: 'osg_ord_buyer_001_slp_seller_001', salesOrderId: 'sor_slp_seller_001_001' },
  // Order 2: single seller
  { orderId: 'ord_buyer_002', sellerProfileId: 'slp_seller_002', osgId: 'osg_ord_buyer_002_slp_seller_002', salesOrderId: 'sor_slp_seller_002_002' },
  // Order 3: single
  { orderId: 'ord_buyer_003', sellerProfileId: 'slp_seller_003', osgId: 'osg_ord_buyer_003_slp_seller_003', salesOrderId: 'sor_slp_seller_003_003' },
  // Order 4: single
  { orderId: 'ord_buyer_004', sellerProfileId: 'slp_seller_004', osgId: 'osg_ord_buyer_004_slp_seller_004', salesOrderId: 'sor_slp_seller_004_004' },
  // Order 5: single
  { orderId: 'ord_buyer_005', sellerProfileId: 'slp_seller_005', osgId: 'osg_ord_buyer_005_slp_seller_005', salesOrderId: 'sor_slp_seller_005_005' },
  // Order 6: single
  { orderId: 'ord_buyer_006', sellerProfileId: 'slp_seller_001', osgId: 'osg_ord_buyer_006_slp_seller_001', salesOrderId: 'sor_slp_seller_001_006' },
  // Order 7: single
  { orderId: 'ord_buyer_007', sellerProfileId: 'slp_seller_002', osgId: 'osg_ord_buyer_007_slp_seller_002', salesOrderId: 'sor_slp_seller_002_007' },
  // Order 8: single
  { orderId: 'ord_buyer_008', sellerProfileId: 'slp_seller_003', osgId: 'osg_ord_buyer_008_slp_seller_003', salesOrderId: 'sor_slp_seller_003_008' },
  // Order 9: single
  { orderId: 'ord_buyer_009', sellerProfileId: 'slp_seller_004', osgId: 'osg_ord_buyer_009_slp_seller_004', salesOrderId: 'sor_slp_seller_004_009' },
  // Order 10: single
  { orderId: 'ord_buyer_010', sellerProfileId: 'slp_seller_005', osgId: 'osg_ord_buyer_010_slp_seller_005', salesOrderId: 'sor_slp_seller_005_010' },
  // Order 11: single
  { orderId: 'ord_buyer_011', sellerProfileId: 'slp_seller_001', osgId: 'osg_ord_buyer_011_slp_seller_001', salesOrderId: 'sor_slp_seller_001_011' },
  // Order 12: single
  { orderId: 'ord_buyer_012', sellerProfileId: 'slp_seller_002', osgId: 'osg_ord_buyer_012_slp_seller_002', salesOrderId: 'sor_slp_seller_002_012' },
  // Order 13: single
  { orderId: 'ord_buyer_013', sellerProfileId: 'slp_seller_003', osgId: 'osg_ord_buyer_013_slp_seller_003', salesOrderId: 'sor_slp_seller_003_013' },
  // Order 14: single
  { orderId: 'ord_buyer_014', sellerProfileId: 'slp_seller_004', osgId: 'osg_ord_buyer_014_slp_seller_004', salesOrderId: 'sor_slp_seller_004_014' },
  // Order 15: single
  { orderId: 'ord_buyer_015', sellerProfileId: 'slp_seller_005', osgId: 'osg_ord_buyer_015_slp_seller_005', salesOrderId: 'sor_slp_seller_005_015' },
  // Order 16: single
  { orderId: 'ord_buyer_016', sellerProfileId: 'slp_seller_007', osgId: 'osg_ord_buyer_016_slp_seller_007', salesOrderId: 'sor_slp_seller_007_016' },
  // Order 17: single
  { orderId: 'ord_buyer_017', sellerProfileId: 'slp_seller_008', osgId: 'osg_ord_buyer_017_slp_seller_008', salesOrderId: 'sor_slp_seller_008_017' },
  // Order 18: multi-vendor (2 sellers)
  { orderId: 'ord_buyer_018', sellerProfileId: 'slp_seller_001', osgId: 'osg_ord_buyer_018_slp_seller_001', salesOrderId: 'sor_slp_seller_001_018' },
  { orderId: 'ord_buyer_018', sellerProfileId: 'slp_seller_002', osgId: 'osg_ord_buyer_018_slp_seller_002', salesOrderId: 'sor_slp_seller_002_018' },
  // Order 19: multi-vendor
  { orderId: 'ord_buyer_019', sellerProfileId: 'slp_seller_003', osgId: 'osg_ord_buyer_019_slp_seller_003', salesOrderId: 'sor_slp_seller_003_019' },
  { orderId: 'ord_buyer_019', sellerProfileId: 'slp_seller_004', osgId: 'osg_ord_buyer_019_slp_seller_004', salesOrderId: 'sor_slp_seller_004_019' },
  // Order 20: multi-vendor
  { orderId: 'ord_buyer_020', sellerProfileId: 'slp_seller_005', osgId: 'osg_ord_buyer_020_slp_seller_005', salesOrderId: 'sor_slp_seller_005_020' },
  { orderId: 'ord_buyer_020', sellerProfileId: 'slp_seller_007', osgId: 'osg_ord_buyer_020_slp_seller_007', salesOrderId: 'sor_slp_seller_007_020' },
  // Order 21: multi-vendor
  { orderId: 'ord_buyer_021', sellerProfileId: 'slp_seller_008', osgId: 'osg_ord_buyer_021_slp_seller_008', salesOrderId: 'sor_slp_seller_008_021' },
  { orderId: 'ord_buyer_021', sellerProfileId: 'slp_seller_010', osgId: 'osg_ord_buyer_021_slp_seller_010', salesOrderId: 'sor_slp_seller_010_021' },
  // Order 22: multi-vendor (3 sellers)
  { orderId: 'ord_buyer_022', sellerProfileId: 'slp_seller_001', osgId: 'osg_ord_buyer_022_slp_seller_001', salesOrderId: 'sor_slp_seller_001_022' },
  { orderId: 'ord_buyer_022', sellerProfileId: 'slp_seller_003', osgId: 'osg_ord_buyer_022_slp_seller_003', salesOrderId: 'sor_slp_seller_003_022' },
  { orderId: 'ord_buyer_022', sellerProfileId: 'slp_seller_005', osgId: 'osg_ord_buyer_022_slp_seller_005', salesOrderId: 'sor_slp_seller_005_022' },
  // Order 23: multi-vendor
  { orderId: 'ord_buyer_023', sellerProfileId: 'slp_seller_002', osgId: 'osg_ord_buyer_023_slp_seller_002', salesOrderId: 'sor_slp_seller_002_023' },
  { orderId: 'ord_buyer_023', sellerProfileId: 'slp_seller_004', osgId: 'osg_ord_buyer_023_slp_seller_004', salesOrderId: 'sor_slp_seller_004_023' },
  // Order 24: multi-vendor
  { orderId: 'ord_buyer_024', sellerProfileId: 'slp_seller_007', osgId: 'osg_ord_buyer_024_slp_seller_007', salesOrderId: 'sor_slp_seller_007_024' },
  { orderId: 'ord_buyer_024', sellerProfileId: 'slp_seller_008', osgId: 'osg_ord_buyer_024_slp_seller_008', salesOrderId: 'sor_slp_seller_008_024' },
  // Order 25-30: single seller
  { orderId: 'ord_buyer_025', sellerProfileId: 'slp_seller_010', osgId: 'osg_ord_buyer_025_slp_seller_010', salesOrderId: 'sor_slp_seller_010_025' },
  { orderId: 'ord_buyer_026', sellerProfileId: 'slp_seller_001', osgId: 'osg_ord_buyer_026_slp_seller_001', salesOrderId: 'sor_slp_seller_001_026' },
  { orderId: 'ord_buyer_027', sellerProfileId: 'slp_seller_002', osgId: 'osg_ord_buyer_027_slp_seller_002', salesOrderId: 'sor_slp_seller_002_027' },
  { orderId: 'ord_buyer_028', sellerProfileId: 'slp_seller_003', osgId: 'osg_ord_buyer_028_slp_seller_003', salesOrderId: 'sor_slp_seller_003_028' },
  { orderId: 'ord_buyer_029', sellerProfileId: 'slp_seller_004', osgId: 'osg_ord_buyer_029_slp_seller_004', salesOrderId: 'sor_slp_seller_004_029' },
  { orderId: 'ord_buyer_030', sellerProfileId: 'slp_seller_005', osgId: 'osg_ord_buyer_030_slp_seller_005', salesOrderId: 'sor_slp_seller_005_030' },
]

const SHIPPING_ADDRESS = {
  street: 'Av. Corrientes 1234',
  apartment: '5B',
  city: 'CABA',
  province: 'Buenos Aires',
  postalCode: 'C1043',
  country: 'AR',
}

const SELLER_PICKUPS: Record<string, any> = {
  'slp_seller_001': { street: 'Av. Rivadavia 9000', city: 'Caballito', province: 'Buenos Aires', postalCode: 'C1406', country: 'AR' },
  'slp_seller_002': { street: 'Av. Corrientes 5432', city: 'Almagro', province: 'Buenos Aires', postalCode: 'C1043', country: 'AR' },
  'slp_seller_003': { street: 'Calle 12 3456', city: 'La Plata', province: 'Buenos Aires', postalCode: 'B1900', country: 'AR' },
  'slp_seller_004': { street: 'Av. San Martín 2100', city: 'Córdoba', province: 'Córdoba', postalCode: 'X5000', country: 'AR' },
  'slp_seller_005': { street: 'Sarmiento 789', city: 'Rosario', province: 'Santa Fe', postalCode: 'S2000', country: 'AR' },
  'slp_seller_007': { street: 'Av. Libertador 15000', city: 'San Isidro', province: 'Buenos Aires', postalCode: 'B1642', country: 'AR' },
  'slp_seller_008': { street: 'Mitre 3210', city: 'Quilmes', province: 'Buenos Aires', postalCode: 'B1878', country: 'AR' },
  'slp_seller_010': { street: 'Alvear 890', city: 'Zárate', province: 'Buenos Aires', postalCode: 'B2800', country: 'AR' },
}

const TRACKING_EVENT_TYPES = ['created', 'ready_for_pickup', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed_delivery', 'returned'] as const

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding Shipping App...\n')

  // ── 1. Logistics Operators ───────────────────────────────────────────────
  console.log('Creating logistics operators...')
  for (const op of OPERATORS) {
    const idx = OPERATORS.indexOf(op)
    await prisma.logisticsOperator.create({
      data: {
        id: op.id,
        clerkUserId: op.clerkUserId,
        fullName: op.fullName,
        email: op.email,
        phone: op.phone,
        documentId: op.documentId,
        vehicleType: op.vehicleType,
        licensePlate: op.licensePlate,
        status: op.status,
        createdAt: daysBefore(84 - idx * 10),
      },
    })
  }
  console.log(`  ✓ ${OPERATORS.length} logistics operators`)

  // ── 2. Shipping Rates ────────────────────────────────────────────────────
  console.log('Creating shipping rates...')
  await prisma.shippingRate.createMany({ data: SHIPPING_RATES })
  console.log(`  ✓ ${SHIPPING_RATES.length} shipping rates`)

  // ── 3. Shipping Quotes + Shipment Groups + Shipments + Everything ────────
  console.log('Creating quotes, groups, shipments, packages, events...')

  let quoteCount = 0
  let groupCount = 0
  let shipmentCount = 0
  let packageCount = 0
  let eventCount = 0
  let assignmentCount = 0
  let proofCount = 0

  const usedOrders = new Set<string>()

  for (const sg of SELLER_GROUPS) {
    const orderInfo = ORDERS.find(o => o.orderId === sg.orderId)!
    const pickupAddr = SELLER_PICKUPS[sg.sellerProfileId] || SELLER_PICKUPS['slp_seller_001']
    const isMulti = usedOrders.has(sg.orderId)
    usedOrders.add(sg.orderId)

    // Create group ID once per order
    const groupId = `grp_${sg.orderId}`
    const shipDate = daysBefore(Math.floor(Math.random() * 82))

    // Quote
    const quoteId = `qte_${sg.orderId}_${sg.sellerProfileId}`
    const weightTotal = 3000 + Math.floor(Math.random() * 15000)
    const packagesCount = 1 + Math.floor(Math.random() * 2)
    const costCents = 500000 + Math.floor(Math.random() * 3000000)

    if (!isMulti) {
      await prisma.shippingQuote.create({
        data: {
          id: quoteId,
          sellerProfileId: sg.sellerProfileId,
          fromAddressSnapshot: pickupAddr,
          toAddressSnapshot: SHIPPING_ADDRESS,
          serviceLevel: 'standard',
          carrier: 'andreani',
          costCents,
          currency: 'ARS',
          weightGramsTotal: weightTotal,
          packagesCount,
          packagesSnapshot: Array.from({ length: packagesCount }, (_, i) => ({
            weightGrams: Math.floor(weightTotal / packagesCount),
            lengthCm: 50 + Math.floor(Math.random() * 100),
            widthCm: 30 + Math.floor(Math.random() * 40),
            heightCm: 10 + Math.floor(Math.random() * 60),
          })),
          estimatedDaysMin: 3,
          estimatedDaysMax: 6,
          expiresAt: addHours(shipDate, 1),
          createdAt: shipDate,
        },
      })
      quoteCount++
    }

    // Shipment group (one per order, created on first seller group)
    if (!isMulti) {
      await prisma.shipmentGroup.create({
        data: {
          id: groupId,
          orderId: sg.orderId,
          buyerProfileId: orderInfo.buyerProfileId,
          trackingNumber: `BMK-${String(10000 + Math.floor(Math.random() * 90000))}`,
          status: 'created',
          serviceLevel: 'standard',
          shippingAddressSnapshot: SHIPPING_ADDRESS,
          originsCount: SELLER_GROUPS.filter(g => g.orderId === sg.orderId).length,
          createdAt: shipDate,
        },
      })
      groupCount++
    }

    // Shipment
    const shipId = `shp_${sg.orderId}_${sg.sellerProfileId}`
    const trackingNumber = `TRK-AR-${String(1000 + shipmentCount + 1)}`

    let shipmentStatus: string
    if (shipmentCount < 10) shipmentStatus = 'delivered'
    else if (shipmentCount < 18) shipmentStatus = 'in_transit'
    else if (shipmentCount < 25) shipmentStatus = 'ready_for_pickup'
    else if (shipmentCount < 30) shipmentStatus = 'picked_up'
    else if (shipmentCount < 32) shipmentStatus = 'failed_delivery'
    else if (shipmentCount < 34) shipmentStatus = 'returned'
    else shipmentStatus = 'created'

    await prisma.shipment.create({
      data: {
        id: shipId,
        orderId: sg.orderId,
        orderSellerGroupId: sg.osgId,
        salesOrderId: sg.salesOrderId,
        sellerProfileId: sg.sellerProfileId,
        buyerProfileId: orderInfo.buyerProfileId,
        shipmentGroupId: groupId,
        shippingQuoteId: quoteId,
        carrier: 'andreani',
        serviceLevel: 'standard',
        trackingNumber,
        labelUrl: `https://cdn.bicimarket.com/labels/${shipId}.pdf`,
        status: shipmentStatus as any,
        weightGramsTotal: weightTotal,
        costCents,
        currency: 'ARS',
        shippingAddressSnapshot: SHIPPING_ADDRESS,
        pickupAddressSnapshot: pickupAddr,
        shippedAt: ['in_transit', 'delivered', 'failed_delivery'].includes(shipmentStatus) ? addDays(shipDate, 1) : null,
        deliveredAt: shipmentStatus === 'delivered' ? addDays(shipDate, 3 + Math.floor(Math.random() * 3)) : null,
        createdAt: shipDate,
      },
    })
    shipmentCount++

    // Packages
    for (let p = 0; p < packagesCount; p++) {
      await prisma.package.create({
        data: {
          id: `pkg_${shipId}_${p + 1}`,
          shipmentId: shipId,
          weightGrams: Math.floor(weightTotal / packagesCount),
          lengthCm: 50 + Math.floor(Math.random() * 100),
          widthCm: 30 + Math.floor(Math.random() * 40),
          heightCm: 10 + Math.floor(Math.random() * 60),
          description: p === 0 ? 'Paquete principal' : 'Paquete secundario',
          labelUrl: shipmentStatus !== 'created' ? `https://cdn.bicimarket.com/labels/${shipId}_pkg${p + 1}.pdf` : null,
          createdAt: shipDate,
        },
      })
      packageCount++
    }

    // Tracking events (depending on shipment status)
    const events: Array<{ type: string; location: string; note: string; offsetHours: number }> = []

    if (shipmentStatus !== 'created') {
      events.push({ type: 'created', location: '', note: 'Etiqueta generada', offsetHours: 0 })
    }
    if (['ready_for_pickup', 'picked_up', 'in_transit', 'delivered', 'failed_delivery', 'returned'].includes(shipmentStatus)) {
      events.push({ type: 'ready_for_pickup', location: pickupAddr.city || 'Caballito', note: 'Listo para retirar', offsetHours: 4 })
    }
    if (['picked_up', 'in_transit', 'delivered', 'failed_delivery'].includes(shipmentStatus)) {
      events.push({ type: 'picked_up', location: pickupAddr.city || 'Caballito, CABA', note: 'Retiro OK', offsetHours: 24 })
    }
    if (['in_transit', 'delivered', 'failed_delivery'].includes(shipmentStatus)) {
      events.push({ type: 'in_transit', location: 'Centro de distribución Avellaneda', note: 'En tránsito hacia destino', offsetHours: 36 })
    }
    if (['in_transit', 'delivered', 'failed_delivery'].includes(shipmentStatus)) {
      events.push({ type: 'out_for_delivery', location: 'Sucursal destino', note: 'En reparto', offsetHours: 60 })
    }
    if (shipmentStatus === 'delivered') {
      events.push({ type: 'delivered', location: SHIPPING_ADDRESS.street, note: 'Entregado al cliente', offsetHours: 72 })
    }
    if (shipmentStatus === 'failed_delivery') {
      events.push({ type: 'failed_delivery', location: SHIPPING_ADDRESS.street, note: 'Destinatario ausente', offsetHours: 72 })
    }
    if (shipmentStatus === 'returned') {
      events.push({ type: 'failed_delivery', location: SHIPPING_ADDRESS.street, note: 'Destinatario ausente', offsetHours: 72 })
      events.push({ type: 'returned', location: pickupAddr.city || 'Caballito, CABA', note: 'Devuelto al remitente', offsetHours: 120 })
    }

    for (let e = 0; e < events.length; e++) {
      const ev = events[e]
      await prisma.trackingEvent.create({
        data: {
          id: `evt_${shipId}_${e + 1}`,
          shipmentId: shipId,
          eventType: ev.type as any,
          location: ev.location || null,
          note: ev.note,
          occurredAt: addHours(shipDate, ev.offsetHours),
          createdAt: addHours(shipDate, ev.offsetHours),
        },
      })
      eventCount++
    }

    // Status history
    const statusTransitions: string[][] = []
    if (shipmentStatus !== 'created') {
      statusTransitions.push(['created', 'ready_for_pickup'])
      if (['picked_up', 'in_transit', 'delivered', 'failed_delivery', 'returned'].includes(shipmentStatus)) {
        statusTransitions.push(['ready_for_pickup', 'picked_up'])
      }
      if (['in_transit', 'delivered', 'failed_delivery'].includes(shipmentStatus)) {
        statusTransitions.push(['picked_up', 'in_transit'])
      }
      if (shipmentStatus === 'delivered') {
        statusTransitions.push(['in_transit', 'delivered'])
      }
      if (shipmentStatus === 'failed_delivery') {
        statusTransitions.push(['in_transit', 'failed_delivery'])
      }
      if (shipmentStatus === 'returned') {
        statusTransitions.push(['in_transit', 'failed_delivery'])
        statusTransitions.push(['failed_delivery', 'returned'])
      }
    }

    for (let t = 0; t < statusTransitions.length; t++) {
      const [from, to] = statusTransitions[t]
      await prisma.shipmentStatusHistory.create({
        data: {
          id: `ssh_${shipId}_${t + 1}`,
          shipmentId: shipId,
          fromStatus: from as any,
          toStatus: to as any,
          source: 'system',
          occurredAt: addHours(shipDate, events[t]?.offsetHours || 0),
        },
      })
    }

    // Delivery assignment
    const operatorIndex = shipmentCount % OPERATORS.length
    const operator = OPERATORS[operatorIndex]
    if (operator.status === 'active') {
      await prisma.deliveryAssignment.create({
        data: {
          id: `dla_${shipId}`,
          shipmentGroupId: groupId,
          shipmentId: shipId,
          operatorClerkUserId: operator.clerkUserId,
          status: shipmentStatus === 'delivered' ? 'delivered' : shipmentStatus === 'picked_up' ? 'picked_up' : 'assigned',
          assignedAt: addHours(shipDate, 2),
          completedAt: shipmentStatus === 'delivered' ? addDays(shipDate, 4) : null,
          createdAt: addHours(shipDate, 2),
        },
      })
      assignmentCount++
    }

    // Delivery proof
    if (shipmentStatus === 'delivered') {
      await prisma.deliveryProof.create({
        data: {
          id: `prf_${shipId}`,
          shipmentId: shipId,
          proofPhotoUrl: `https://cdn.bicimarket.com/proofs/${shipId}.jpg`,
          signatureImageUrl: `https://cdn.bicimarket.com/proofs/sign_${shipId}.png`,
          note: 'Entregado al cliente',
          deliveredAt: addHours(shipDate, 72),
          createdAt: addHours(shipDate, 72),
        },
      })
      proofCount++
    }
  }

  console.log(`  ✓ ${quoteCount} shipping quotes`)
  console.log(`  ✓ ${groupCount} shipment groups`)
  console.log(`  ✓ ${shipmentCount} shipments`)
  console.log(`  ✓ ${packageCount} packages`)
  console.log(`  ✓ ${eventCount} tracking events`)
  console.log(`  ✓ ${assignmentCount} delivery assignments`)
  console.log(`  ✓ ${proofCount} delivery proofs`)

  console.log(`\n✅ Shipping App seed complete.`)
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
