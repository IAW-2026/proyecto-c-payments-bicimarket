export function ARS(cents: number, opts: { bare?: boolean } = {}) {
  const v = cents / 100
  const s = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)
  return opts.bare ? s : `ARS ${s}`
}

export function formatDate(value?: string | Date | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatDateShort(value?: string | Date | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(value))
}
