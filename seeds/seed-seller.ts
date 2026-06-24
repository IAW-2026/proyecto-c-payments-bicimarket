// Seller App — BiciMarket
// Usage: npx tsx seeds/seed-seller.ts
// Adjust the import path to match your Prisma client output location.
// For Seller App: import { PrismaClient, ... } from '../src/generated/prisma/client';

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
  d.setHours(10 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60))
  return d
}

// ─── Seller Data ─────────────────────────────────────────────────────────────

const SELLERS = [
  { id: 'slp_seller_001', clerkUserId: 'user_seller_001', legalName: 'Bicicletería del Sur SRL', displayName: 'BiciSur', taxId: '30-71234567-8', taxCondition: 'responsable_inscripto' as const, bankRef: 'mp_collector_1001', verificationStatus: 'verified' as const, pickup: { street: 'Av. Rivadavia 9000', city: 'Caballito', province: 'Buenos Aires', postalCode: 'C1406', country: 'AR' } },
  { id: 'slp_seller_002', clerkUserId: 'user_seller_002', legalName: 'Rodados Buenos Aires SA', displayName: 'Rodados BA', taxId: '30-72345678-9', taxCondition: 'responsable_inscripto' as const, bankRef: 'mp_collector_1002', verificationStatus: 'verified' as const, pickup: { street: 'Av. Corrientes 5432', city: 'Almagro', province: 'Buenos Aires', postalCode: 'C1043', country: 'AR' } },
  { id: 'slp_seller_003', clerkUserId: 'user_seller_003', legalName: 'Martín Gutiérrez', displayName: 'Bikes MG', taxId: '20-23456789-0', taxCondition: 'monotributo' as const, bankRef: 'mp_collector_1003', verificationStatus: 'verified' as const, pickup: { street: 'Calle 12 3456', city: 'La Plata', province: 'Buenos Aires', postalCode: 'B1900', country: 'AR' } },
  { id: 'slp_seller_004', clerkUserId: 'user_seller_004', legalName: 'MTB Argentina SRL', displayName: 'MTB Arg', taxId: '30-74567890-1', taxCondition: 'responsable_inscripto' as const, bankRef: 'mp_collector_1004', verificationStatus: 'verified' as const, pickup: { street: 'Av. San Martín 2100', city: 'Córdoba', province: 'Córdoba', postalCode: 'X5000', country: 'AR' } },
  { id: 'slp_seller_005', clerkUserId: 'user_seller_005', legalName: 'Laura Fernández', displayName: 'Urban Ride', taxId: '27-25678901-2', taxCondition: 'monotributo' as const, bankRef: 'mp_collector_1005', verificationStatus: 'verified' as const, pickup: { street: 'Sarmiento 789', city: 'Rosario', province: 'Santa Fe', postalCode: 'S2000', country: 'AR' } },
  { id: 'slp_seller_006', clerkUserId: 'user_seller_006', legalName: 'Juan Pablo Martínez', displayName: 'JP Bikes', taxId: '20-27890123-4', taxCondition: 'monotributo' as const, bankRef: 'mp_collector_1006', verificationStatus: 'pending_review' as const, pickup: { street: 'Belgrano 456', city: 'Mendoza', province: 'Mendoza', postalCode: 'M5500', country: 'AR' } },
  { id: 'slp_seller_007', clerkUserId: 'user_seller_007', legalName: 'Accesorios en Bici SRL', displayName: 'Acc Bici', taxId: '30-75678901-2', taxCondition: 'responsable_inscripto' as const, bankRef: 'mp_collector_1007', verificationStatus: 'verified' as const, pickup: { street: 'Av. Libertador 15000', city: 'San Isidro', province: 'Buenos Aires', postalCode: 'B1642', country: 'AR' } },
  { id: 'slp_seller_008', clerkUserId: 'user_seller_008', legalName: 'Carlos Domínguez', displayName: 'Taller CD', taxId: '20-31234567-8', taxCondition: 'consumidor_final' as const, bankRef: 'mp_collector_1008', verificationStatus: 'verified' as const, pickup: { street: 'Mitre 3210', city: 'Quilmes', province: 'Buenos Aires', postalCode: 'B1878', country: 'AR' } },
  { id: 'slp_seller_009', clerkUserId: 'user_seller_009', legalName: 'Pedalear SRL', displayName: 'Pedalear', taxId: '30-76789012-3', taxCondition: 'responsable_inscripto' as const, bankRef: 'mp_collector_1009', verificationStatus: 'suspended' as const, pickup: { street: 'Av. Colón 567', city: 'Mar del Plata', province: 'Buenos Aires', postalCode: 'B7600', country: 'AR' } },
  { id: 'slp_seller_010', clerkUserId: 'user_seller_010', legalName: 'Elena Rivas', displayName: 'Elena Cycles', taxId: '27-33456789-0', taxCondition: 'monotributo' as const, bankRef: 'mp_collector_1010', verificationStatus: 'verified' as const, pickup: { street: 'Alvear 890', city: 'Zárate', province: 'Buenos Aires', postalCode: 'B2800', country: 'AR' } },
]

const UPLOAD_BASE = 'https://images.unsplash.com'

const BIKE_IMAGES = [
  `${UPLOAD_BASE}/photo-1485965120184-e220f721d03e?w=800&q=80`,
  `${UPLOAD_BASE}/photo-1532298229144-0ec0c57515c7?w=800&q=80`,
  `${UPLOAD_BASE}/photo-1507035895480-2b3156c31fc8?w=800&q=80`,
  `${UPLOAD_BASE}/photo-1511994298241-608e28f14fde?w=800&q=80`,
  `${UPLOAD_BASE}/photo-1576188973526-0e5d7047f0bd?w=800&q=80`,
  `${UPLOAD_BASE}/photo-1560343776-97e7d202ff0e?w=800&q=80`,
  `${UPLOAD_BASE}/photo-1541625602330-2277a4c46182?w=800&q=80`,
  `${UPLOAD_BASE}/photo-1593642632559-0c6d3fc62b89?w=800&q=80`,
  `${UPLOAD_BASE}/photo-1608236451475-7848d5e10e5c?w=800&q=80`,
  `${UPLOAD_BASE}/photo-1580674285054-bed31e145f59?w=800&q=80`,
  `${UPLOAD_BASE}/photo-1559348349-86f1f6582a42?w=800&q=80`,
  `${UPLOAD_BASE}/photo-1608236451078-c3e4ef7b338c?w=800&q=80`,
  `${UPLOAD_BASE}/photo-1576435728678-68d0fbf94e5a?w=800&q=80`,
  `${UPLOAD_BASE}/photo-1517649763962-0c623066013b?w=800&q=80`,
  `${UPLOAD_BASE}/photo-1533327235821-7028e521ecc2?w=800&q=80`,
  `${UPLOAD_BASE}/photo-1534787238916-9ba6764efd3c?w=800&q=80`,
  `${UPLOAD_BASE}/photo-1549109786-eb80da56e1b0?w=800&q=80`,
  `${UPLOAD_BASE}/photo-1571068316344-75bc76f77890?w=800&q=80`,
  `${UPLOAD_BASE}/photo-1599409822662-7e7e3c8e0e5a?w=800&q=80`,
  `${UPLOAD_BASE}/photo-1517649763962-0c623066013b?w=800&q=80`,
]

const CATEGORIES = ['mtb', 'road', 'urban', 'kids', 'bmx', 'parts', 'accessories', 'indumentaria'] as const
const CONDITIONS = ['new', 'used_like_new', 'used_good', 'used_fair'] as const
const PRODUCT_STATUSES = ['active', 'draft', 'paused', 'archived'] as const

interface ProductDef {
  title: string
  description: string
  brand: string
  model: string
  category: typeof CATEGORIES[number]
  condition: typeof CONDITIONS[number]
  priceCents: number
  weightGrams: number
  lengthCm: number
  widthCm: number
  heightCm: number
  status: typeof PRODUCT_STATUSES[number]
  imgIdx: number
}

const PRODUCT_TEMPLATES: ProductDef[] = [
  { title: 'Bicicleta Trek Marlin 5', description: 'MTB rodado 29, 24 velocidades, frenos hidráulicos. Cuadro de aluminio serie Alpha Gold.', brand: 'Trek', model: 'Marlin 5', category: 'mtb', condition: 'new', priceCents: 57000000, weightGrams: 14500, lengthCm: 180, widthCm: 60, heightCm: 110, status: 'active', imgIdx: 0 },
  { title: 'Bicicleta Specialized Rockhopper', description: 'Bicicleta mountain bike con suspensión Sr Suntour XCE 100mm, grupo Shimano Altus.', brand: 'Specialized', model: 'Rockhopper', category: 'mtb', condition: 'new', priceCents: 98000000, weightGrams: 13800, lengthCm: 178, widthCm: 58, heightCm: 108, status: 'active', imgIdx: 1 },
  { title: 'Bicicleta Venzo R35', description: 'Bicicleta de ruta en fibra de carbono, grupo Shimano 105, ruedas Mavic Aksium.', brand: 'Venzo', model: 'R35', category: 'road', condition: 'new', priceCents: 91000000, weightGrams: 8500, lengthCm: 175, widthCm: 55, heightCm: 100, status: 'active', imgIdx: 2 },
  { title: 'Bicicleta urbana Raleigh P20', description: 'Bicicleta plegable 20", 7 velocidades, cuadro de acero cromoly, ideal para ciudad.', brand: 'Raleigh', model: 'P20', category: 'urban', condition: 'used_like_new', priceCents: 57000000, weightGrams: 12000, lengthCm: 150, widthCm: 40, heightCm: 90, status: 'active', imgIdx: 3 },
  { title: 'Cubierta Continental 29" x 2.2', description: 'Cubierta MTB rodado 29, compuesto PureGrip, protección RaceSport.', brand: 'Continental', model: 'Race King', category: 'parts', condition: 'new', priceCents: 2300000, weightGrams: 750, lengthCm: 70, widthCm: 70, heightCm: 10, status: 'active', imgIdx: 4 },
  { title: 'Casilla de cambios Shimano Deore', description: 'Casette Shimano Deore M6100, 12 velocidades, rango 10-51T.', brand: 'Shimano', model: 'Deore M6100', category: 'parts', condition: 'new', priceCents: 3100000, weightGrams: 450, lengthCm: 15, widthCm: 15, heightCm: 5, status: 'active', imgIdx: 5 },
  { title: 'Casco Specialized Align II', description: 'Casco MTB con visera, sistema MIPS, talla única ajustable.', brand: 'Specialized', model: 'Align II MIPS', category: 'accessories', condition: 'new', priceCents: 4200000, weightGrams: 350, lengthCm: 28, widthCm: 22, heightCm: 18, status: 'active', imgIdx: 14 },
  { title: 'Guantes Fox Ranger Gel', description: 'Guantes MTB con gel de amortiguación, dedos largos, tallas S-XL.', brand: 'Fox', model: 'Ranger Gel', category: 'indumentaria', condition: 'new', priceCents: 8300000, weightGrams: 120, lengthCm: 25, widthCm: 15, heightCm: 5, status: 'active', imgIdx: 12 },
  { title: 'Bicicleta BMW KTM XC', description: 'Bicicleta MTB usada en excelente estado, rodado 29, cuadro carbono.', brand: 'KTM', model: 'XC 200', category: 'mtb', condition: 'used_good', priceCents: 83000000, weightGrams: 12800, lengthCm: 178, widthCm: 58, heightCm: 108, status: 'active', imgIdx: 6 },
  { title: 'Pedales automáticos Shimano PD-M520', description: 'Pedales MTB de doble cara, entrada fácil, ajuste de tensión.', brand: 'Shimano', model: 'PD-M520', category: 'parts', condition: 'used_like_new', priceCents: 8600000, weightGrams: 380, lengthCm: 10, widthCm: 10, heightCm: 8, status: 'active', imgIdx: 7 },
  { title: 'Bicicleta infantil Firebird 20"', description: 'Bici kids rodado 20, ruedas auxiliares removibles, freno contrapedal y de mano.', brand: 'Firebird', model: 'Explorer 20', category: 'kids', condition: 'new', priceCents: 54000000, weightGrams: 10500, lengthCm: 140, widthCm: 38, heightCm: 80, status: 'active', imgIdx: 15 },
  { title: 'Bicicleta BMX GT Performer', description: 'BMX 20", cuadro cromoly 4130, freno U-brake, ideal para freestyle.', brand: 'GT', model: 'Performer 22', category: 'bmx', condition: 'used_like_new', priceCents: 69000000, weightGrams: 11800, lengthCm: 155, widthCm: 42, heightCm: 85, status: 'active', imgIdx: 17 },
  { title: 'Amortiguador Fox 36 Float Factory', description: 'Horquilla de suspensión Fox 36, 160mm, boost, ajuste GRIP2.', brand: 'Fox', model: '36 Float Factory', category: 'parts', condition: 'new', priceCents: 9900000, weightGrams: 2100, lengthCm: 60, widthCm: 15, heightCm: 15, status: 'draft', imgIdx: 8 },
  { title: 'Sillín Fizik Antares Versus Evo', description: 'Sillín de carbono, rails carbono, 150g, para ruta.', brand: 'Fizik', model: 'Antares R1', category: 'parts', condition: 'new', priceCents: 5800000, weightGrams: 150, lengthCm: 28, widthCm: 15, heightCm: 8, status: 'active', imgIdx: 9 },
  { title: 'Rodado libre SRAM XG-1295', description: 'Rodado SRAM Eagle XG-1295, 12 velocidades, rango 10-52T, para montaña.', brand: 'SRAM', model: 'XG-1295 Eagle', category: 'parts', condition: 'used_good', priceCents: 7300000, weightGrams: 420, lengthCm: 16, widthCm: 16, heightCm: 5, status: 'active', imgIdx: 5 },
  { title: 'Zapatillas Shimano SH-XC501', description: 'Zapatillas MTB con cala, suela rígida, cierre con velcro y microajuste.', brand: 'Shimano', model: 'SH-XC501', category: 'indumentaria', condition: 'new', priceCents: 6600000, weightGrams: 800, lengthCm: 35, widthCm: 25, heightCm: 15, status: 'active', imgIdx: 12 },
  { title: 'Candado ABUS Bordo 6000', description: 'Candado plegable de 85cm, nivel de seguridad 10/15, incluye soporte.', brand: 'ABUS', model: 'Bordo 6000', category: 'accessories', condition: 'new', priceCents: 7000000, weightGrams: 560, lengthCm: 22, widthCm: 18, heightCm: 10, status: 'active', imgIdx: 9 },
  { title: 'Bicicleta Vairo XR 3.0', description: 'MTB rodado 29, grupo Shimano Deore, horquilla Rockshox Recon 120mm.', brand: 'Vairo', model: 'XR 3.0', category: 'mtb', condition: 'new', priceCents: 99000000, weightGrams: 14200, lengthCm: 180, widthCm: 60, heightCm: 110, status: 'active', imgIdx: 1 },
  { title: 'Bicicleta Olmo Road Master', description: 'Bicicleta de ruta Olmo, cuadro acero Reynolds 525, grupo Campagnolo.', brand: 'Olmo', model: 'Road Master', category: 'road', condition: 'used_good', priceCents: 74000000, weightGrams: 10200, lengthCm: 172, widthCm: 54, heightCm: 98, status: 'active', imgIdx: 2 },
  { title: 'Sillín infantil con luz LED', description: 'Sillín para niños con luz integrada, ajustable, color rojo/negro.', brand: 'BBB', model: 'KidSafe LED', category: 'kids', condition: 'new', priceCents: 67000000, weightGrams: 250, lengthCm: 24, widthCm: 14, heightCm: 8, status: 'active', imgIdx: 15 },
  { title: 'Cadena Shimano CN-HG701', description: 'Cadena 11 velocidades, 116 eslabones, con enlace rápido.', brand: 'Shimano', model: 'CN-HG701', category: 'parts', condition: 'new', priceCents: 4300000, weightGrams: 280, lengthCm: 30, widthCm: 5, heightCm: 3, status: 'active', imgIdx: 5 },
  { title: 'Luz delantera Lezyne 1200+', description: 'Luz LED 1200 lúmenes, batería USB-C, 4 modos, soporte integrado.', brand: 'Lezyne', model: 'Macro Drive 1200+', category: 'accessories', condition: 'new', priceCents: 5000000, weightGrams: 180, lengthCm: 10, widthCm: 5, heightCm: 5, status: 'active', imgIdx: 11 },
  { title: 'Remera Fox Head Pro', description: 'Remera MTB manga corta, tejido transpirable, ajuste regular.', brand: 'Fox', model: 'Head Pro', category: 'indumentaria', condition: 'new', priceCents: 8100000, weightGrams: 200, lengthCm: 30, widthCm: 20, heightCm: 3, status: 'active', imgIdx: 12 },
  { title: 'Bicicleta GW Tracker', description: 'Bici urbana rodado 26, cuadro de acero, cambios Shimano Nexus 7v.', brand: 'GW', model: 'Tracker', category: 'urban', condition: 'used_good', priceCents: 85000000, weightGrams: 13500, lengthCm: 170, widthCm: 45, heightCm: 95, status: 'active', imgIdx: 3 },
  { title: 'Freno de disco Shimano MT200', description: 'Kit de freno hidráulico de disco, incluye palanca, pinza y cable.', brand: 'Shimano', model: 'MT200', category: 'parts', condition: 'new', priceCents: 8100000, weightGrams: 380, lengthCm: 25, widthCm: 12, heightCm: 8, status: 'active', imgIdx: 7 },
  { title: 'Bicicleta Top Mega R29 Carbon', description: 'MTB carbono rodado 29, SRAM GX Eagle 12v, Fox 36 Factory.', brand: 'Top Mega', model: 'R29 Carbon', category: 'mtb', condition: 'new', priceCents: 69000000, weightGrams: 11500, lengthCm: 180, widthCm: 60, heightCm: 110, status: 'draft', imgIdx: 10 },
  { title: 'Cubierta Pirelli Scorpion 27.5', description: 'Cubierta MTB rodado 27.5, compuesto SmartGrip, protección antillantas.', brand: 'Pirelli', model: 'Scorpion XC RC', category: 'parts', condition: 'new', priceCents: 8500000, weightGrams: 820, lengthCm: 72, widthCm: 72, heightCm: 10, status: 'active', imgIdx: 4 },
  { title: 'Bicicleta infantil Vairo 16"', description: 'Bici para niños de 4-7 años, ruedas entrenadoras, color azul.', brand: 'Vairo', model: 'Kids 16', category: 'kids', condition: 'used_like_new', priceCents: 77000000, weightGrams: 9500, lengthCm: 130, widthCm: 35, heightCm: 75, status: 'active', imgIdx: 15 },
  { title: 'Kit de herramientas Park Tool', description: 'Set de 12 herramientas básicas para mantenimiento de bicicletas.', brand: 'Park Tool', model: 'P-KIT12', category: 'accessories', condition: 'new', priceCents: 5700000, weightGrams: 1500, lengthCm: 30, widthCm: 20, heightCm: 8, status: 'active', imgIdx: 9 },
  { title: 'Calas Shimano SM-SH56', description: 'Calas para pedales automáticos SPD, liberación multidireccional.', brand: 'Shimano', model: 'SM-SH56', category: 'parts', condition: 'new', priceCents: 8100000, weightGrams: 80, lengthCm: 6, widthCm: 4, heightCm: 3, status: 'active', imgIdx: 7 },
  { title: 'Bicicleta BMX Sunday EX', description: 'BMX completa 20.75", cuadro cromoly, horquilla y barra Sunday.', brand: 'Sunday', model: 'EX Complete', category: 'bmx', condition: 'new', priceCents: 51000000, weightGrams: 11500, lengthCm: 155, widthCm: 42, heightCm: 85, status: 'paused', imgIdx: 17 },
  { title: 'Mochila CamelBak M.U.L.E.', description: 'Mochila hidratación 3L, compartimento para herramientas, 12L total.', brand: 'CamelBak', model: 'M.U.L.E.', category: 'accessories', condition: 'used_like_new', priceCents: 9000000, weightGrams: 650, lengthCm: 45, widthCm: 20, heightCm: 12, status: 'active', imgIdx: 11 },
  { title: 'Bicicleta de ruta Endurance SL', description: 'Bici de ruta carbono Endurance, Shimano Ultegra Di2, ruedas DT Swiss.', brand: 'Endurance', model: 'SL Disc', category: 'road', condition: 'new', priceCents: 84000000, weightGrams: 7900, lengthCm: 172, widthCm: 54, heightCm: 98, status: 'draft', imgIdx: 2 },
  { title: 'Puño Ergon GP5', description: 'Puños ergonómicos con soporte para palma, ideal para touring.', brand: 'Ergon', model: 'GP5', category: 'parts', condition: 'new', priceCents: 6900000, weightGrams: 200, lengthCm: 14, widthCm: 10, heightCm: 6, status: 'active', imgIdx: 7 },
  { title: 'Short Fox Flexair', description: 'Short MTB de tejido ligero, estirable, con forro interior removible.', brand: 'Fox', model: 'Flexair', category: 'indumentaria', condition: 'new', priceCents: 9000000, weightGrams: 300, lengthCm: 35, widthCm: 25, heightCm: 5, status: 'active', imgIdx: 12 },
  { title: 'Bicicleta Benotto R29', description: 'MTB Benotto rodado 29, grupo Shimano Alivio, frenos hidráulicos.', brand: 'Benotto', model: 'R29', category: 'mtb', condition: 'used_good', priceCents: 91000000, weightGrams: 14000, lengthCm: 180, widthCm: 60, heightCm: 110, status: 'archived', imgIdx: 0 },
  { title: 'Bomba de pie Topeak JoeBlow', description: 'Bomba de pie con manómetro, hasta 160 PSI, válvula Presta/Schrader.', brand: 'Topeak', model: 'JoeBlow Sport III', category: 'accessories', condition: 'new', priceCents: 6200000, weightGrams: 900, lengthCm: 65, widthCm: 15, heightCm: 15, status: 'active', imgIdx: 9 },
  { title: 'Culote Castelli Rosso Corsa', description: 'Culote de ruta con badana C3, costuras planas, tirantes.', brand: 'Castelli', model: 'Rosso Corsa', category: 'indumentaria', condition: 'used_like_new', priceCents: 5200000, weightGrams: 250, lengthCm: 30, widthCm: 22, heightCm: 5, status: 'active', imgIdx: 12 },
  { title: 'Bicicleta urbana KTM Commuter', description: 'Bici plegable KTM, 20", 8 velocidades, cuadro aluminio 6061, freno disco.', brand: 'KTM', model: 'Commuter P20', category: 'urban', condition: 'new', priceCents: 85000000, weightGrams: 11500, lengthCm: 148, widthCm: 38, heightCm: 88, status: 'active', imgIdx: 3 },
  { title: 'Rodado Shimano 105 R7000', description: 'Rodado Shimano 105 R7000, 11-28T, 11 velocidades, para ruta.', brand: 'Shimano', model: '105 R7000', category: 'parts', condition: 'new', priceCents: 2300000, weightGrams: 320, lengthCm: 14, widthCm: 14, heightCm: 4, status: 'active', imgIdx: 5 },
]

const FULFILLMENT_STATUSES = ['pending', 'accepted', 'preparing', 'ready_to_ship', 'handed_over', 'delivered', 'rejected', 'cancelled'] as const
const PAYMENT_STATUSES = ['pending', 'paid', 'refunded', 'settled'] as const
const SHIPPING_STATUSES = ['pending', 'created', 'ready_for_pickup', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed_delivery', 'returned'] as const

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding Seller App...\n')

  // ── 1. Seller Profiles ──────────────────────────────────────────────────
  console.log('Creating seller profiles...')
  for (const s of SELLERS) {
    await prisma.sellerProfile.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        clerkUserId: s.clerkUserId,
        legalName: s.legalName,
        displayName: s.displayName,
        taxId: s.taxId,
        taxCondition: s.taxCondition,
        bankAccountReference: s.bankRef,
        pickupAddress: s.pickup,
        verificationStatus: s.verificationStatus,
        createdAt: daysBefore(84 - SELLERS.indexOf(s) * 8),
      },
    })
  }
  console.log(`  ✓ ${SELLERS.length} seller profiles`)

  // ── 2. Products ─────────────────────────────────────────────────────────
  console.log('Creating products...')
  let productIdx = 0
  for (const seller of SELLERS) {
    for (let p = 0; p < 4; p++) {
      const tmpl = PRODUCT_TEMPLATES[productIdx % PRODUCT_TEMPLATES.length]
      const prodDate = daysBefore(80 - productIdx * 2)
      await prisma.product.create({
        data: {
          id: `prd_${seller.id}_${p + 1}`,
          sellerProfileId: seller.id,
          title: tmpl.title,
          description: tmpl.description,
          brand: tmpl.brand,
          model: tmpl.model,
          category: tmpl.category,
          condition: tmpl.condition,
          priceCents: tmpl.priceCents,
          currency: 'ARS',
          weightGrams: tmpl.weightGrams,
          lengthCm: tmpl.lengthCm,
          widthCm: tmpl.widthCm,
          heightCm: tmpl.heightCm,
          status: tmpl.status,
          createdAt: prodDate,
          updatedAt: prodDate,
        },
      })

      // 2 images per product
      const imgIdx1 = (productIdx * 2) % BIKE_IMAGES.length
      const imgIdx2 = (productIdx * 2 + 1) % BIKE_IMAGES.length
      await prisma.productImage.createMany({
        data: [
          { id: `img_${seller.id}_${p + 1}_1`, productId: `prd_${seller.id}_${p + 1}`, url: BIKE_IMAGES[imgIdx1], position: 0 },
          { id: `img_${seller.id}_${p + 1}_2`, productId: `prd_${seller.id}_${p + 1}`, url: BIKE_IMAGES[imgIdx2], position: 1 },
        ],
      })

      productIdx++
    }
  }
  console.log(`  ✓ ${productIdx} products with ${productIdx * 2} images`)

  // ── 3. User records (legacy Clerk sync) ─────────────────────────────────
  console.log('Creating user records...')
  for (const s of SELLERS) {
    await prisma.user.upsert({
      where: { email: `${s.displayName.toLowerCase().replace(/\s+/g, '')}@example.com` },
      update: {},
      create: {
        id: `usr_${s.id}`,
        email: `${s.displayName.toLowerCase().replace(/\s+/g, '')}@example.com`,
        firstName: s.displayName.split(' ')[0],
        lastName: s.displayName.split(' ').slice(1).join(' '),
        role: 'ADMIN',
      },
    })
  }
  console.log('  ✓ 10 user records')

  // ── 4. Sales Orders ─────────────────────────────────────────────────────
  console.log('Creating sales orders...')
  const orderIds: string[] = []
  for (let i = 1; i <= 30; i++) {
    orderIds.push(`ord_buyer_${String(i).padStart(3, '0')}`)
  }

  const allProducts = await prisma.product.findMany({ where: { status: 'active' } })
  const verifiedSellers = SELLERS.filter(s => s.verificationStatus === 'verified')

  let salesOrderCount = 0
  let salesOrderItemCount = 0

  for (let i = 0; i < orderIds.length; i++) {
    const seller = verifiedSellers[i % verifiedSellers.length]
    const sellerProducts = allProducts.filter(p => p.sellerProfileId === seller.id)
    if (sellerProducts.length === 0) continue

    const ordDate = daysBefore(84 - Math.floor(i * 2.7))
    const fulfillmentRoll = Math.random()
    let fulfillmentStatus: typeof FULFILLMENT_STATUSES[number]
    let paymentStatus: typeof PAYMENT_STATUSES[number]
    let shippingStatus: typeof SHIPPING_STATUSES[number]

    if (i < 5) {
      fulfillmentStatus = 'delivered'; paymentStatus = 'settled'; shippingStatus = 'delivered'
    } else if (i < 10) {
      fulfillmentStatus = 'handed_over'; paymentStatus = 'paid'; shippingStatus = 'in_transit'
    } else if (i < 15) {
      fulfillmentStatus = 'ready_to_ship'; paymentStatus = 'paid'; shippingStatus = 'pending'
    } else if (i < 20) {
      fulfillmentStatus = 'accepted'; paymentStatus = 'paid'; shippingStatus = 'pending'
    } else if (i < 22) {
      fulfillmentStatus = 'pending'; paymentStatus = 'pending'; shippingStatus = 'pending'
    } else if (i < 25) {
      fulfillmentStatus = 'rejected'; paymentStatus = 'refunded'; shippingStatus = 'pending'
    } else if (i < 28) {
      fulfillmentStatus = 'cancelled'; paymentStatus = 'refunded'; shippingStatus = 'pending'
    } else {
      fulfillmentStatus = 'preparing'; paymentStatus = 'paid'; shippingStatus = 'ready_for_pickup'
    }

    const soId = `sor_${seller.id}_${String(i + 1).padStart(3, '0')}`
    const subtotal = sellerProducts.slice(0, 3).reduce((sum, p) => sum + p.priceCents * 1, 0)
    const shippingCost = Math.round(subtotal * 0.1)
    const total = subtotal + shippingCost

    await prisma.salesOrder.create({
      data: {
        id: soId,
        orderId: orderIds[i],
        orderSellerGroupId: `osg_${orderIds[i]}_${seller.id}`,
        sellerProfileId: seller.id,
        buyerProfileId: `byp_buyer_${String(i % 25 + 1).padStart(3, '0')}`,
        buyerClerkUserId: `user_buyer_${String(i % 25 + 1).padStart(3, '0')}`,
        paymentId: `pay_payment_${String(i + 1).padStart(3, '0')}`,
        paymentStatus,
        fulfillmentStatus,
        shippingStatus,
        itemsSubtotalCents: subtotal,
        shippingCostCents: shippingCost,
        totalCents: total,
        currency: 'ARS',
        shippingAddressSnapshot: {
          street: 'Av. Corrientes 1234',
          apartment: '5B',
          city: 'CABA',
          province: 'Buenos Aires',
          postalCode: 'C1043',
          country: 'AR',
        },
        createdAt: ordDate,
        updatedAt: ordDate,
      },
    })

    // Items
    for (let j = 0; j < Math.min(3, sellerProducts.length); j++) {
      const p = sellerProducts[j]
      await prisma.salesOrderItem.create({
        data: {
          id: `soi_${soId}_${j + 1}`,
          salesOrderId: soId,
          productId: p.id,
          productNameSnapshot: p.title,
          unitPriceCents: p.priceCents,
          quantity: 1,
        },
      })
      salesOrderItemCount++
    }

    // Status history
    const historyEntries: { from: string; to: string }[] = []
    if (fulfillmentStatus !== 'pending') {
      historyEntries.push({ from: 'pending', to: 'accepted' })
    }
    if (['preparing', 'ready_to_ship', 'handed_over', 'delivered'].includes(fulfillmentStatus)) {
      historyEntries.push({ from: 'accepted', to: 'preparing' })
    }
    if (['ready_to_ship', 'handed_over', 'delivered'].includes(fulfillmentStatus)) {
      historyEntries.push({ from: 'preparing', to: 'ready_to_ship' })
    }
    if (['handed_over', 'delivered'].includes(fulfillmentStatus)) {
      historyEntries.push({ from: 'ready_to_ship', to: 'handed_over' })
    }
    if (fulfillmentStatus === 'delivered') {
      historyEntries.push({ from: 'handed_over', to: 'delivered' })
    }
    if (fulfillmentStatus === 'rejected') {
      historyEntries.push({ from: 'pending', to: 'rejected' })
    }
    if (fulfillmentStatus === 'cancelled') {
      historyEntries.push({ from: 'accepted', to: 'cancelled' })
    }

    for (const h of historyEntries) {
      await prisma.salesOrderStatusHistory.create({
        data: {
          id: `soh_${soId}_${h.from}_${h.to}`,
          salesOrderId: soId,
          fromStatus: h.from,
          toStatus: h.to,
          source: 'system',
          occurredAt: ordDate,
        },
      })
    }

    salesOrderCount++
  }

  console.log(`  ✓ ${salesOrderCount} sales orders`)
  console.log(`  ✓ ${salesOrderItemCount} sales order items`)
  console.log(`\n✅ Seller App seed complete.`)
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
