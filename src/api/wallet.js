import { apiRequest } from './client'

// Work in integer cents for comparisons; do not round invalid user input.
export function moneyCents(value) {
  if (!['string', 'number'].includes(typeof value) || !/^-?\d+(\.\d{1,2})?$/.test(String(value))) return null
  const [whole, fraction = ''] = String(value).replace('-', '').split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) ? (String(value).startsWith('-') ? -cents : cents) : null
}

export function topUpAmount(value) {
  const cents = moneyCents(String(value).trim())
  if (cents == null || cents <= 0 || cents > 1000000) throw new Error('Enter an amount between 0.01 and 10,000 with up to two decimal places.')
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

export function validateWallet(data) {
  const balance = moneyCents(data?.balance)
  if (balance == null || balance < 0 || !/^[A-Z]{3}$/.test(data?.currency) || typeof data?.is_frozen !== 'boolean') {
    throw new Error('The server returned an invalid wallet. Please refresh your balance.')
  }
  return data
}

export const getWallet = signal => apiRequest('/me/wallet', { signal }).then(validateWallet)
export const topUpWallet = (amount, signal) => apiRequest('/me/wallet/top-up', {
  method: 'POST', body: { amount: topUpAmount(amount) }, signal,
}).then(validateWallet)

export async function getWalletTransactions({ page = 1, per_page = 10 } = {}, signal) {
  // The backend route names this parameter page_size; keep the public UI API per_page.
  const query = new URLSearchParams({ page, page_size: per_page })
  const data = await apiRequest(`/me/wallet/transactions?${query}`, { signal })
  const size = data?.page_size ?? data?.per_page
  if (!Array.isArray(data?.items) || !Number.isInteger(data.total) || data.total < 0
    || !Number.isInteger(data.page) || data.page < 1 || !Number.isInteger(size) || size < 1
    || !Number.isInteger(data.total_pages) || data.total_pages < 0
    || data.items.some(item => !item || item.id == null || moneyCents(item.amount) == null
      || moneyCents(item.balance_after) == null || !/^[A-Z]{3}$/.test(item.currency)
      || typeof item.transaction_type !== 'string' || !Number.isFinite(Date.parse(item.created_at)))) {
    throw new Error('The server returned an invalid transaction history.')
  }
  return { ...data, per_page: size }
}

export function walletError(error) {
  if (/insufficient wallet (funds|balance)/i.test(error.message)) return 'Insufficient wallet funds. Top up your wallet or choose a bank card.'
  if (/frozen/i.test(error.message)) return 'Your wallet is frozen. Contact support to restore access.'
  if (/external payment settlement|demo opt-in|top.?up.*disabled/i.test(error.message)) return 'Direct top-ups are unavailable on this server. A supported payment service is required.'
  if (error.status === 401) return 'Please sign in again to access your wallet.'
  if (error.status >= 500) return 'The wallet service is temporarily unavailable. Please refresh your balance.'
  return error.message || 'Could not connect to your wallet. Please try again.'
}
