export const TYPE_LABELS = {
  STOCK: 'Stocks', MUTUAL_FUND: 'Mutual funds', CRYPTO: 'Crypto', FD: 'Fixed deposits',
  REAL_ESTATE: 'Real estate', GOLD: 'Gold', BOND: 'Bonds', PPF: 'PPF', EPF: 'EPF',
  NPS: 'NPS', RD: 'Recurring deposits', SGB: 'Sovereign gold bonds', OTHER: 'Other',
}
export const TYPE_COLORS = {
  STOCK: '#6657B7', MUTUAL_FUND: '#9682D4', CRYPTO: '#D0808E', FD: '#63A799',
  REAL_ESTATE: '#B481AD', GOLD: '#D6A453', BOND: '#7A9BCB', PPF: '#7FAA8A',
  EPF: '#4F9C8F', NPS: '#8E92C6', RD: '#D59B78', SGB: '#C8AA67', OTHER: '#9B98AA',
}
const currency = import.meta.env?.VITE_CURRENCY || 'INR'
export const money = value => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(value || 0))
export const formatCurrency = value => {
  const amount = Number(value || 0)
  if (currency !== 'INR') return money(amount)
  const magnitude = Math.abs(amount)
  if (magnitude >= 1e7) return `${amount < 0 ? '−' : ''}₹${(magnitude / 1e7).toFixed(1)} Cr`
  if (magnitude >= 1e5) return `${amount < 0 ? '−' : ''}₹${(magnitude / 1e5).toFixed(1)} L`
  return money(amount)
}
export const compactMoney = formatCurrency
export const percent = value => {
  const amount = Number(value || 0)
  if (amount > 10000) return '>10,000%'
  if (amount < -10000) return '<-10,000%'
  return `${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}%`
}
export const dateLabel = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
