// Buyer App — BiciMarket
// Usage: npx tsx seeds/seed-buyer.ts
// Adjust the import path to match your Prisma client output location.
// For Buyer App: import { PrismaClient, ... } from '../src/generated/prisma/client';

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Helpers ─────────────────────────────────────────────────────────────────
const START = new Date('2026-04-01T00:00:00Z')
const END = new Date('2026-06-24T23:59:59Z')

function randomDate(): Date {
  return new Date(START.getTime() + Math.random() * (END.getTime() - START.getTime()))
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function daysBefore(days: number): Date {
  const d = new Date(END)
  d.setDate(d.getDate() - days)
  d.setHours(8 + Math.floor(Math.random() * 14), Math.floor(Math.random() * 60))
  return d
}

// ─── Buyer Data ──────────────────────────────────────────────────────────────

const BUYERS = [
  { id: 'byp_buyer_001', clerkUserId: 'user_buyer_001', fullName: 'Camila Rojas Fritz', email: 'camila.rojas@example.com', phone: '+5491134567890' },
  { id: 'byp_buyer_002', clerkUserId: 'user_buyer_002', fullName: 'Tomás Martínez', email: 'tomas.martinez@example.com', phone: '+5491145678901' },
  { id: 'byp_buyer_003', clerkUserId: 'user_buyer_003', fullName: 'Sofía López', email: 'sofia.lopez@example.com', phone: '+5491156789012' },
  { id: 'byp_buyer_004', clerkUserId: 'user_buyer_004', fullName: 'Mateo García', email: 'mateo.garcia@example.com', phone: '+5491167890123' },
  { id: 'byp_buyer_005', clerkUserId: 'user_buyer_005', fullName: 'Valentina Rodríguez', email: 'valentina.rodriguez@example.com', phone: '+5491178901234' },
  { id: 'byp_buyer_006', clerkUserId: 'user_buyer_006', fullName: 'Benjamín Fernández', email: 'benjamin.fernandez@example.com', phone: '+5491189012345' },
  { id: 'byp_buyer_007', clerkUserId: 'user_buyer_007', fullName: 'Isabella González', email: 'isabella.gonzalez@example.com', phone: '+5491190123456' },
  { id: 'byp_buyer_008', clerkUserId: 'user_buyer_008', fullName: 'Santiago Pérez', email: 'santiago.perez@example.com', phone: '+5492201234567' },
  { id: 'byp_buyer_009', clerkUserId: 'user_buyer_009', fullName: 'Emilia Díaz', email: 'emilia.diaz@example.com', phone: '+5492212345678' },
  { id: 'byp_buyer_010', clerkUserId: 'user_buyer_010', fullName: 'Lucas Álvarez', email: 'lucas.alvarez@example.com', phone: '+5492223456789' },
  { id: 'byp_buyer_011', clerkUserId: 'user_buyer_011', fullName: 'Martina Torres', email: 'martina.torres@example.com', phone: '+5492234567890' },
  { id: 'byp_buyer_012', clerkUserId: 'user_buyer_012', fullName: 'Julián Ramírez', email: 'julian.ramirez@example.com', phone: '+5492245678901' },
  { id: 'byp_buyer_013', clerkUserId: 'user_buyer_013', fullName: 'Catalina Castillo', email: 'catalina.castillo@example.com', phone: '+5492256789012' },
  { id: 'byp_buyer_014', clerkUserId: 'user_buyer_014', fullName: 'Nicolás Morales', email: 'nicolas.morales@example.com', phone: '+5492267890123' },
  { id: 'byp_buyer_015', clerkUserId: 'user_buyer_015', fullName: 'Luciana Ortiz', email: 'luciana.ortiz@example.com', phone: '+5492278901234' },
  { id: 'byp_buyer_016', clerkUserId: 'user_buyer_016', fullName: 'Facundo Medina', email: 'facundo.medina@example.com', phone: '+5492289012345' },
  { id: 'byp_buyer_017', clerkUserId: 'user_buyer_017', fullName: 'Agustina Castro', email: 'agustina.castro@example.com', phone: '+5492290123456' },
  { id: 'byp_buyer_018', clerkUserId: 'user_buyer_018', fullName: 'Ignacio Herrera', email: 'ignacio.herrera@example.com', phone: '+5493411234567' },
  { id: 'byp_buyer_019', clerkUserId: 'user_buyer_019', fullName: 'Victoria Ríos', email: 'victoria.rios@example.com', phone: '+5493412345678' },
  { id: 'byp_buyer_020', clerkUserId: 'user_buyer_020', fullName: 'Franco Campos', email: 'franco.campos@example.com', phone: '+5493413456789' },
  { id: 'byp_buyer_021', clerkUserId: 'user_buyer_021', fullName: 'Julieta Paz', email: 'julieta.paz@example.com', phone: '+5493511234567' },
  { id: 'byp_buyer_022', clerkUserId: 'user_buyer_022', fullName: 'Diego Vega', email: 'diego.vega@example.com', phone: '+5493512345678' },
  { id: 'byp_buyer_023', clerkUserId: 'user_buyer_023', fullName: 'Florencia Ruiz', email: 'florencia.ruiz@example.com', phone: '+5493513456789' },
  { id: 'byp_buyer_024', clerkUserId: 'user_buyer_024', fullName: 'Manuel Acosta', email: 'manuel.acosta@example.com', phone: '+5493811234567' },
  { id: 'byp_buyer_025', clerkUserId: 'user_buyer_025', fullName: 'Bruno Silva', email: 'bruno.silva@example.com', phone: '+5493812345678' },
]

const ADDRESS_TEMPLATES = [
  { alias: 'Casa', street: 'Av. Corrientes', number: '1234', apartment: '5B', city: 'CABA', province: 'Buenos Aires', postalCode: 'C1043', country: 'AR' },
  { alias: 'Trabajo', street: 'Av. del Libertador', number: '5000', apartment: 'PB', city: 'CABA', province: 'Buenos Aires', postalCode: 'C1426', country: 'AR' },
  { alias: 'Casa', street: 'Av. Santa Fe', number: '2500', apartment: '3A', city: 'CABA', province: 'Buenos Aires', postalCode: 'C1425', country: 'AR' },
  { alias: 'Departamento', street: 'Sarmiento', number: '1500', apartment: '12C', city: 'CABA', province: 'Buenos Aires', postalCode: 'C1042', country: 'AR' },
  { alias: 'Casa', street: 'Av. Rivadavia', number: '7800', city: 'Flores', province: 'Buenos Aires', postalCode: 'C1406', country: 'AR' },
  { alias: 'Oficina', street: 'Maipú', number: '850', apartment: '7', city: 'CABA', province: 'Buenos Aires', postalCode: 'C1006', country: 'AR' },
  { alias: 'Casa', street: 'Belgrano', number: '3200', city: 'La Plata', province: 'Buenos Aires', postalCode: 'B1900', country: 'AR' },
  { alias: 'Trabajo', street: 'San Martín', number: '450', apartment: '2', city: 'Córdoba', province: 'Córdoba', postalCode: 'X5000', country: 'AR' },
  { alias: 'Casa', street: 'Mitre', number: '1200', city: 'Rosario', province: 'Santa Fe', postalCode: 'S2000', country: 'AR' },
  { alias: 'Quinta', street: 'Ruta 8', number: 'Km 45', city: 'Pilar', province: 'Buenos Aires', postalCode: 'B1629', country: 'AR' },
]

const SELLER_IDS = [
  'slp_seller_001', 'slp_seller_002', 'slp_seller_003', 'slp_seller_004',
  'slp_seller_005', 'slp_seller_006', 'slp_seller_007', 'slp_seller_008',
  'slp_seller_009', 'slp_seller_010',
]

const PRODUCT_REF = [
  { pid: 'prd_slp_seller_001_1', name: 'Bicicleta Trek Marlin 5', price: 57000000, weight: 14500, seller: 'slp_seller_001' },
  { pid: 'prd_slp_seller_001_2', name: 'Specialized Rockhopper', price: 98000000, weight: 13800, seller: 'slp_seller_001' },
  { pid: 'prd_slp_seller_001_3', name: 'Venzo R35 Ruta', price: 91000000, weight: 8500, seller: 'slp_seller_001' },
  { pid: 'prd_slp_seller_001_4', name: 'Raleigh P20 Plegable', price: 57000000, weight: 12000, seller: 'slp_seller_001' },
  { pid: 'prd_slp_seller_002_1', name: 'Cubierta Continental 29"', price: 2300000, weight: 750, seller: 'slp_seller_002' },
  { pid: 'prd_slp_seller_002_2', name: 'Casilla Shimano Deore', price: 3100000, weight: 450, seller: 'slp_seller_002' },
  { pid: 'prd_slp_seller_002_3', name: 'Casco Specialized Align II', price: 4200000, weight: 350, seller: 'slp_seller_002' },
  { pid: 'prd_slp_seller_002_4', name: 'Guantes Fox Ranger Gel', price: 8300000, weight: 120, seller: 'slp_seller_002' },
  { pid: 'prd_slp_seller_003_1', name: 'KTM XC 200 Usada', price: 83000000, weight: 12800, seller: 'slp_seller_003' },
  { pid: 'prd_slp_seller_003_2', name: 'Pedales Shimano PD-M520', price: 8600000, weight: 380, seller: 'slp_seller_003' },
  { pid: 'prd_slp_seller_003_3', name: 'Firebird 20" Infantil', price: 54000000, weight: 10500, seller: 'slp_seller_003' },
  { pid: 'prd_slp_seller_003_4', name: 'BMX GT Performer', price: 69000000, weight: 11800, seller: 'slp_seller_003' },
  { pid: 'prd_slp_seller_004_1', name: 'Amortiguador Fox 36', price: 9900000, weight: 2100, seller: 'slp_seller_004' },
  { pid: 'prd_slp_seller_004_2', name: 'Sillín Fizik Antares', price: 5800000, weight: 150, seller: 'slp_seller_004' },
  { pid: 'prd_slp_seller_004_3', name: 'Rodado SRAM XG-1295', price: 7300000, weight: 420, seller: 'slp_seller_004' },
  { pid: 'prd_slp_seller_004_4', name: 'Zapatillas Shimano XC501', price: 6600000, weight: 800, seller: 'slp_seller_004' },
  { pid: 'prd_slp_seller_005_1', name: 'Candado ABUS Bordo 6000', price: 7000000, weight: 560, seller: 'slp_seller_005' },
  { pid: 'prd_slp_seller_005_2', name: 'Vairo XR 3.0', price: 99000000, weight: 14200, seller: 'slp_seller_005' },
  { pid: 'prd_slp_seller_005_3', name: 'Olmo Road Master', price: 74000000, weight: 10200, seller: 'slp_seller_005' },
  { pid: 'prd_slp_seller_005_4', name: 'Sillín infantil LED', price: 67000000, weight: 250, seller: 'slp_seller_005' },
  { pid: 'prd_slp_seller_006_1', name: 'Cadena Shimano CN-HG701', price: 4300000, weight: 280, seller: 'slp_seller_006' },
  { pid: 'prd_slp_seller_006_2', name: 'Luz Lezyne 1200+', price: 5000000, weight: 180, seller: 'slp_seller_006' },
  { pid: 'prd_slp_seller_006_3', name: 'Remera Fox Head Pro', price: 8100000, weight: 200, seller: 'slp_seller_006' },
  { pid: 'prd_slp_seller_006_4', name: 'GW Tracker Urbana', price: 85000000, weight: 13500, seller: 'slp_seller_006' },
  { pid: 'prd_slp_seller_007_1', name: 'Freno Shimano MT200', price: 8100000, weight: 380, seller: 'slp_seller_007' },
  { pid: 'prd_slp_seller_007_2', name: 'Top Mega R29 Carbon', price: 69000000, weight: 11500, seller: 'slp_seller_007' },
  { pid: 'prd_slp_seller_007_3', name: 'Cubierta Pirelli 27.5', price: 8500000, weight: 820, seller: 'slp_seller_007' },
  { pid: 'prd_slp_seller_007_4', name: 'Vairo Kids 16"', price: 77000000, weight: 9500, seller: 'slp_seller_007' },
  { pid: 'prd_slp_seller_008_1', name: 'Kit Park Tool', price: 5700000, weight: 1500, seller: 'slp_seller_008' },
  { pid: 'prd_slp_seller_008_2', name: 'Calas Shimano SM-SH56', price: 8100000, weight: 80, seller: 'slp_seller_008' },
  { pid: 'prd_slp_seller_008_3', name: 'BMX Sunday EX', price: 51000000, weight: 11500, seller: 'slp_seller_008' },
  { pid: 'prd_slp_seller_008_4', name: 'Mochila CamelBak MULE', price: 9000000, weight: 650, seller: 'slp_seller_008' },
  { pid: 'prd_slp_seller_009_1', name: 'Endurance SL Disc', price: 84000000, weight: 7900, seller: 'slp_seller_009' },
  { pid: 'prd_slp_seller_009_2', name: 'Puño Ergon GP5', price: 6900000, weight: 200, seller: 'slp_seller_009' },
  { pid: 'prd_slp_seller_009_3', name: 'Short Fox Flexair', price: 9000000, weight: 300, seller: 'slp_seller_009' },
  { pid: 'prd_slp_seller_009_4', name: 'Benotto R29', price: 91000000, weight: 14000, seller: 'slp_seller_009' },
  { pid: 'prd_slp_seller_010_1', name: 'Bomba Topeak JoeBlow', price: 6200000, weight: 900, seller: 'slp_seller_010' },
  { pid: 'prd_slp_seller_010_2', name: 'Culote Castelli Rosso', price: 5200000, weight: 250, seller: 'slp_seller_010' },
  { pid: 'prd_slp_seller_010_3', name: 'KTM Commuter P20', price: 85000000, weight: 11500, seller: 'slp_seller_010' },
  { pid: 'prd_slp_seller_010_4', name: 'Rodado Shimano 105', price: 2300000, weight: 320, seller: 'slp_seller_010' },
]

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding Buyer App...\n')

  // ── 1. Buyer Profiles ───────────────────────────────────────────────────
  console.log('Creating buyer profiles...')
  for (const b of BUYERS) {
    const addr1 = { ...ADDRESS_TEMPLATES[b.id === 'byp_buyer_025' ? 9 : BUYERS.indexOf(b) % 10], isDefault: true }
    const addr2 = { ...ADDRESS_TEMPLATES[(BUYERS.indexOf(b) + 3) % 10], alias: 'Trabajo', isDefault: false }

    const addr1Id = `adr_${b.id}_1`
    const addr2Id = `adr_${b.id}_2`

    await prisma.buyerProfile.create({
      data: {
        id: b.id,
        clerkUserId: b.clerkUserId,
        fullName: b.fullName,
        email: b.email,
        phone: b.phone,
        defaultShippingAddressId: addr1Id,
        createdAt: daysBefore(84 - BUYERS.indexOf(b) * 3),
        addresses: {
          create: [
            {
              id: addr1Id,
              buyerProfileId: b.id,
              alias: addr1.alias,
              street: addr1.street,
              number: addr1.number,
              apartment: addr1.apartment ?? null,
              city: addr1.city,
              province: addr1.province,
              postalCode: addr1.postalCode,
              country: addr1.country,
              isDefault: true,
            },
            {
              id: addr2Id,
              buyerProfileId: b.id,
              alias: addr2.alias,
              street: addr2.street,
              number: addr2.number,
              apartment: addr2.apartment ?? null,
              city: addr2.city,
              province: addr2.province,
              postalCode: addr2.postalCode,
              country: addr2.country,
              isDefault: false,
            },
          ],
        },
      },
    })
  }
  console.log(`  ✓ ${BUYERS.length} buyer profiles with 2 addresses each`)

  // ── 2. Carts ─────────────────────────────────────────────────────────────
  console.log('Creating carts...')
  let cartItemCount = 0
  for (const b of BUYERS) {
    const cartDate = daysBefore(82 - BUYERS.indexOf(b) * 3)
    const isConverted = BUYERS.indexOf(b) < 5 // first 5 have converted carts
    await prisma.cart.create({
      data: {
        id: `crt_${b.id}`,
        buyerProfileId: b.id,
        status: isConverted ? 'CONVERTED' : 'ACTIVE',
        createdAt: cartDate,
      },
    })

    // Add 4 items per cart from different sellers
    const usedSellers = new Set<string>()
    for (let j = 0; j < 4; j++) {
      let ref: typeof PRODUCT_REF[number]
      let attempts = 0
      do {
        ref = PRODUCT_REF[Math.floor(Math.random() * PRODUCT_REF.length)]
        attempts++
      } while (usedSellers.has(ref.seller) && attempts < 20)
      usedSellers.add(ref.seller)

      const snapshots: Record<string, any> = {
        productId: ref.pid,
        sellerProfileId: ref.seller,
        productNameSnapshot: ref.name,
        unitPriceCents: ref.price,
        currency: 'ARS',
        quantity: 1 + Math.floor(Math.random() * 2),
        weightGramsSnapshot: ref.weight,
      }

      // The Buyer schema stores snapshots alongside cart items
      // But the prisma schema for buyer has cart_items with only: id, cartId, productId, sellerProfileId, quantity, addedAt
      // The snapshots are stored as product_name_snapshot, unit_price_cents, currency, weight_grams_snapshot
      // Wait, looking at the schema, only basic fields + addedAt. Snapshots aren't in the Prisma model.
      // Let me check... The schema says:
      //   id, cartId, productId, sellerProfileId, quantity, addedAt
      // But the docs say it has product_name_snapshot, unit_price_cents, currency, weight_grams_snapshot
      // The prisma-schemas reference shows the simpler model. Let me use what the schema actually has.
      // Hmm, the reference schema_buyer.prisma shows CartItem with only:
      //   id, cartId, productId, sellerProfileId, quantity, addedAt
      // No snapshots. But the docs describe snapshots. Let me follow the actual Prisma schema.

      await prisma.cartItem.create({
        data: {
          id: `cit_${b.id}_${j + 1}`,
          cartId: `crt_${b.id}`,
          productId: ref.pid,
          sellerProfileId: ref.seller,
          quantity: 1 + Math.floor(Math.random() * 2),
          addedAt: cartDate,
        },
      })
      cartItemCount++
    }
  }
  console.log(`  ✓ ${BUYERS.length} carts with ${cartItemCount} cart items`)

  // ── 3. Favorites ─────────────────────────────────────────────────────────
  console.log('Creating favorites...')
  let favCount = 0
  for (const b of BUYERS) {
    const favProducts = new Set<string>()
    const numFavs = 3 + Math.floor(Math.random() * 3) // 3-5 favorites
    for (let j = 0; j < numFavs; j++) {
      let ref: typeof PRODUCT_REF[number]
      let attempts = 0
      do {
        ref = PRODUCT_REF[Math.floor(Math.random() * PRODUCT_REF.length)]
        attempts++
      } while (favProducts.has(ref.pid) && attempts < 30)
      favProducts.add(ref.pid)

      await prisma.favoriteItem.create({
        data: {
          id: `fav_${b.id}_${j + 1}`,
          buyerProfileId: b.id,
          productId: ref.pid,
          addedAt: daysBefore(5 + Math.floor(Math.random() * 78)),
        },
      })
      favCount++
    }
  }
  console.log(`  ✓ ${favCount} favorite items`)

  // ── 4. Orders ────────────────────────────────────────────────────────────
  console.log('Creating orders...')
  let orderCount = 0
  let sellerGroupCount = 0
  let orderItemCount = 0

  const ORDER_STATUSES = ['PENDING_PAYMENT', 'PAID', 'PREPARING', 'PARTIALLY_SHIPPED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED'] as const
  const GROUP_STATUSES = ['PENDING', 'PREPARING', 'READY_TO_SHIP', 'IN_TRANSIT', 'DELIVERED', 'SETTLED', 'CANCELLED', 'REFUNDED'] as const
  const SHIP_STATUSES = ['CREATED', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED_DELIVERY', 'RETURNED'] as const

  // 30 orders spanning the 3 months
  for (let i = 1; i <= 30; i++) {
    const ordId = `ord_buyer_${String(i).padStart(3, '0')}`
    const buyer = BUYERS[(i - 1) % BUYERS.length]
    const ordDate = daysBefore(84 - Math.floor((i - 1) * 2.7))

    // Determine order status based on position to get variety
    let orderStatus: typeof ORDER_STATUSES[number]
    if (i <= 4) orderStatus = 'DELIVERED'
    else if (i <= 7) orderStatus = 'SHIPPED'
    else if (i <= 10) orderStatus = 'PAID'
    else if (i <= 13) orderStatus = 'PREPARING'
    else if (i <= 16) orderStatus = 'PENDING_PAYMENT'
    else if (i <= 19) orderStatus = 'COMPLETED'
    else if (i <= 22) orderStatus = 'PARTIALLY_SHIPPED'
    else if (i <= 25) orderStatus = 'CANCELLED'
    else if (i <= 27) orderStatus = 'REFUNDED'
    else orderStatus = 'PAID'

    // Pick 1-2 sellers for this order (multi-vendor for some)
    const isMultiVendor = i >= 18 && i <= 24
    const sellerCount = isMultiVendor ? 2 : 1
    const orderSellers = SELLER_IDS.slice((i - 1) % 8, (i - 1) % 8 + sellerCount)

    // Calculate items for each seller group
    const sellerItems: Array<{ seller: string; items: typeof PRODUCT_REF; subtotal: number; weight: number }> = []
    let itemsTotal = 0
    let shippingTotal = 0

    for (const sellerId of orderSellers) {
      const sellerProducts = PRODUCT_REF.filter(p => p.seller === sellerId)
      const numItems = Math.min(2 + Math.floor(Math.random() * 2), sellerProducts.length)
      const selectedItems = sellerProducts.slice(0, numItems)
      const subtotal = selectedItems.reduce((sum, p) => sum + p.price * 1, 0)
      const weight = selectedItems.reduce((sum, p) => sum + p.weight, 0)
      sellerItems.push({ seller: sellerId, items: selectedItems, subtotal, weight })
      itemsTotal += subtotal
      shippingTotal += 5000000 + Math.floor(Math.random() * 10000000)
    }

    const totalCents = itemsTotal + shippingTotal

    await prisma.order.create({
      data: {
        id: ordId,
        buyerProfileId: buyer.id,
        paymentId: `pay_payment_${String(i).padStart(3, '0')}`,
        status: orderStatus,
        itemsTotalCents: itemsTotal,
        shippingTotalCents: shippingTotal,
        totalCents,
        currency: 'ARS',
        shippingAddressSnapshot: {
          street: buyer.id === 'byp_buyer_025' ? 'Ruta 8 Km 45' : 'Av. Corrientes 1234',
          apartment: '5B',
          city: 'CABA',
          province: 'Buenos Aires',
          postalCode: 'C1043',
          country: 'AR',
        },
        notes: buyer.id === 'byp_buyer_025' ? 'Dejar en portería' : null,
        createdAt: ordDate,
      },
    })

    // Seller groups + items
    let groupIdx = 0
    for (const si of sellerItems) {
      groupIdx++
      const sgId = `osg_${ordId}_${si.seller}`

      // Determine group status based on order status
      let groupStatus: typeof GROUP_STATUSES[number]
      let shipStatus: typeof SHIP_STATUSES[number]
      if (orderStatus === 'COMPLETED' || orderStatus === 'DELIVERED') {
        groupStatus = 'DELIVERED'; shipStatus = 'DELIVERED'
      } else if (orderStatus === 'SHIPPED') {
        groupStatus = 'IN_TRANSIT'; shipStatus = 'IN_TRANSIT'
      } else if (orderStatus === 'PARTIALLY_SHIPPED') {
        groupStatus = groupIdx === 1 ? 'DELIVERED' : 'IN_TRANSIT'
        shipStatus = groupIdx === 1 ? 'DELIVERED' : 'IN_TRANSIT'
      } else if (orderStatus === 'PREPARING') {
        groupStatus = 'PREPARING'; shipStatus = 'READY_FOR_PICKUP'
      } else if (orderStatus === 'PAID') {
        groupStatus = 'PENDING'; shipStatus = 'CREATED'
      } else if (orderStatus === 'CANCELLED') {
        groupStatus = 'CANCELLED'; shipStatus = 'CREATED'
      } else if (orderStatus === 'REFUNDED') {
        groupStatus = 'REFUNDED'; shipStatus = 'CREATED'
      } else {
        groupStatus = 'PENDING'; shipStatus = 'CREATED'
      }

      await prisma.orderSellerGroup.create({
        data: {
          id: sgId,
          orderId: ordId,
          sellerProfileId: si.seller,
          itemsSubtotalCents: si.subtotal,
          shippingCostCents: 5000000 + Math.floor(Math.random() * 10000000),
          weightGramsTotal: si.weight,
          status: groupStatus,
          shippingStatus: shipStatus,
          shippingQuoteId: `qte_${ordId}_${si.seller}`,
          shipmentId: `shp_${ordId}_${si.seller}`,
          trackingNumber: `TRK-AR-${String(1000 + i * 2 + groupIdx)}`,
          createdAt: ordDate,
        },
      })

      // Order items for this group
      for (let j = 0; j < si.items.length; j++) {
        const item = si.items[j]
        await prisma.orderItem.create({
          data: {
            id: `oit_${sgId}_${j + 1}`,
            orderId: ordId,
            sellerGroupId: sgId,
            productId: item.pid,
            productNameSnapshot: item.name,
            unitPriceCents: item.price,
            quantity: 1,
            weightGramsSnapshot: item.weight,
          },
        })
        orderItemCount++
      }

      sellerGroupCount++
    }

    // Order status history
    const transitions: [string, string][] = [['PENDING_PAYMENT', orderStatus]]
    if (orderStatus !== 'PENDING_PAYMENT') {
      transitions.push(['PENDING_PAYMENT', 'PAID'])
      if (['PARTIALLY_SHIPPED', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(orderStatus)) {
        transitions.push(['PAID', 'PARTIALLY_SHIPPED'])
      }
      if (['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(orderStatus)) {
        transitions.push(['PARTIALLY_SHIPPED', 'SHIPPED'])
      }
      if (['DELIVERED', 'COMPLETED'].includes(orderStatus)) {
        transitions.push(['SHIPPED', 'DELIVERED'])
      }
      if (orderStatus === 'COMPLETED') {
        transitions.push(['DELIVERED', 'COMPLETED'])
      }
      if (orderStatus === 'CANCELLED') {
        transitions.push(['PENDING_PAYMENT', 'CANCELLED'])
      }
      if (orderStatus === 'REFUNDED') {
        transitions.push(['PAID', 'REFUNDED'])
      }
    }

    for (const [from, to] of transitions) {
      if (from === to) continue
      await prisma.orderStatusHistory.create({
        data: {
          id: `osh_${ordId}_${from}_${to}`,
          orderId: ordId,
          fromStatus: from,
          toStatus: to,
          source: 'system',
          occurredAt: ordDate,
        },
      })
    }

    orderCount++
  }

  console.log(`  ✓ ${orderCount} orders`)
  console.log(`  ✓ ${sellerGroupCount} seller groups`)
  console.log(`  ✓ ${orderItemCount} order items`)

  console.log(`\n✅ Buyer App seed complete.`)
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
