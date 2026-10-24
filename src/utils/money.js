const symbols = {
  USD: '$',
  EUR: '\u20ac',
  GBP: '\u00a3',
  PLN: 'z\u0142',
  KZT: '\u20b8',
  TRY: '\u20ba',
  UAH: '\u20b4',
  JPY: '\u00a5',
}
export const isCurrencyCode = (value) => typeof value === 'string' && /^[A-Z]{3}$/.test(value)
export const isMoneyAmount = (value) =>
  (typeof value === 'string' || typeof value === 'number') &&
  String(value).trim() !== '' &&
  Number.isFinite(Number(value))
export function currencySymbol(code) {
  if (!isCurrencyCode(code)) return ''
  return (
    symbols[code] ||
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ||
    code
  )
}
export function formatMoney(amount, currency) {
  if (!isCurrencyCode(currency) || !isMoneyAmount(amount)) return 'Price unavailable'
  // Preserve server precision, including fractional JPY amounts, without inventing a denomination.
  const fraction = Number.isInteger(Number(amount)) && currency === 'JPY' ? 0 : 2
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: fraction,
    maximumFractionDigits: 2,
  })
    .formatToParts(Number(amount))
    .map((part) => (part.type === 'currency' ? currencySymbol(currency) : part.value))
    .join('')
}
