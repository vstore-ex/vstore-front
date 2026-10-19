import { apiRequest } from './client'
import { validateWallet } from './wallet'
import { currencySymbol, isCurrencyCode } from '../utils/money'

export async function getCurrencies(signal) {
  const data = await apiRequest('/currencies', { signal, auth: false, credentials: 'omit' })
  // Support both the deployed envelope and the list contract.
  const rows = Array.isArray(data) ? data : data?.currencies
  if (!Array.isArray(rows)) throw new Error('Could not read the available currencies.')
  const names = new Intl.DisplayNames(['en-US'], { type: 'currency' })
  const currencies = rows
    .filter((item) => item?.is_active !== false)
    .map((item) => {
      const code = typeof item === 'string' ? item : item?.code
      if (!isCurrencyCode(code)) throw new Error('The server returned an invalid currency.')
      const rate =
        typeof item === 'object'
          ? item.rate
          : code === data.base_currency
            ? '1'
            : data.rates?.find(
                (row) => row.base_currency === data.base_currency && row.target_currency === code,
              )?.rate
      return {
        code,
        name: item?.name || names.of(code),
        symbol: item?.symbol || currencySymbol(code),
        rate,
      }
    })
  if (!currencies.length) throw new Error('No active currencies are available.')
  return [...new Map(currencies.map((item) => [item.code, item])).values()]
}

export function changeCurrency(currencyCode, signal) {
  if (!isCurrencyCode(currencyCode)) throw new Error('Choose a valid currency.')
  return apiRequest('/me/wallet/currency', {
    method: 'PATCH',
    body: { currency: currencyCode },
    signal,
  }).then((data) => {
    const wallet = validateWallet(data)
    if (wallet.currency !== currencyCode)
      throw new Error(
        'The server did not confirm the requested currency. Refresh your wallet before trying again.',
      )
    return wallet
  })
}
