import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import Header from '../src/components/Header/Header'
import { CurrencyContext } from '../src/currency/context'
import { WalletContext } from '../src/wallet/context'

let media, changeWidth
beforeEach(() => {
  const events = new EventTarget()
  media = {
    matches: false,
    media: '(max-width: 680px)',
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  }
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  )
  changeWidth = (compact) =>
    act(() => {
      media.matches = compact
      const event = new Event('change')
      Object.defineProperty(event, 'matches', { value: compact })
      events.dispatchEvent(event)
    })
})

function Store() {
  return (
    <WalletContext.Provider value={{ data: null }}>
      <CurrencyContext.Provider
        value={{
          code: 'USD',
          currencies: [{ code: 'USD', name: 'US Dollar', symbol: '$' }],
        }}
      >
        <Header />
        <input aria-label="Page field" />
      </CurrencyContext.Provider>
    </WalletContext.Provider>
  )
}
const toggle = () => screen.getByRole('button', { name: /^(Menu|Close menu)$/ })
const discover = () =>
  within(screen.getByRole('navigation', { name: 'Primary navigation' })).getByRole('link', {
    name: 'Discover',
  })

test('moves focus from desktop search to the visible menu toggle on narrow screens', () => {
  render(<Store />)
  screen.getByRole('searchbox').focus()
  changeWidth(true)
  expect(toggle()).toHaveFocus()
  expect(toggle()).toHaveAttribute('aria-expanded', 'false')
})

test('moves focus from the disappearing menu toggle into desktop navigation', () => {
  media.matches = true
  render(<Store />)
  toggle().focus()
  changeWidth(false)
  expect(discover()).toHaveFocus()
  expect(toggle()).toHaveAttribute('aria-expanded', 'false')
})

test('recovers focus when the browser blurs hidden search before the breakpoint event', () => {
  render(<Store />)
  const search = screen.getByRole('searchbox')
  search.focus()
  // jsdom has no layout; an empty rect list models the just-hidden input.
  search.blur()
  expect(document.body).toHaveFocus()
  changeWidth(true)
  expect(toggle()).toHaveFocus()
})

test('recovers focus when the browser blurs the hidden toggle before the breakpoint event', () => {
  media.matches = true
  render(<Store />)
  toggle().focus()
  toggle().blur()
  changeWidth(false)
  expect(discover()).toHaveFocus()
})

test('does not restore intentionally cleared focus from a visible header field', () => {
  render(<Store />)
  const search = screen.getByRole('searchbox')
  vi.spyOn(search, 'getClientRects').mockReturnValue([{ width: 200, height: 44 }])
  search.focus()
  search.blur()
  changeWidth(true)
  expect(document.body).toHaveFocus()
})

test('keeps focus and a typed query when the expanded mobile search becomes desktop search', async () => {
  media.matches = true
  const user = userEvent.setup()
  render(<Store />)
  await user.click(toggle())
  const search = screen.getByRole('searchbox')
  await user.type(search, 'Orbit')
  changeWidth(false)
  expect(search).toHaveFocus()
  expect(search).toHaveValue('Orbit')
  expect(toggle()).toHaveAttribute('aria-expanded', 'false')
})

test('returns to a collapsed mobile menu after a desktop round trip', async () => {
  media.matches = true
  const user = userEvent.setup()
  render(<Store />)
  await user.click(toggle())
  changeWidth(false)
  changeWidth(true)
  expect(toggle()).toHaveAttribute('aria-expanded', 'false')
  expect(toggle()).toHaveFocus()
})

test('does not steal focus from page content when either breakpoint is crossed', () => {
  render(<Store />)
  const field = screen.getByRole('textbox', { name: 'Page field' })
  field.focus()
  changeWidth(true)
  expect(field).toHaveFocus()
  changeWidth(false)
  expect(field).toHaveFocus()
})

test('does not move focus out of a modal when the header switches layout', () => {
  render(
    <>
      <Store />
      <dialog open aria-label="Confirmation">
        <button>Cancel confirmation</button>
      </dialog>
    </>,
  )
  const cancel = screen.getByRole('button', { name: 'Cancel confirmation' })
  cancel.focus()
  changeWidth(true)
  expect(cancel).toHaveFocus()
  changeWidth(false)
  expect(cancel).toHaveFocus()
})

test('Escape dismisses the currency panel before dismissing the mobile menu', async () => {
  media.matches = true
  const user = userEvent.setup()
  render(<Store />)
  await user.click(toggle())
  const currency = screen.getByRole('button', { name: 'Choose currency' })
  await user.click(currency)
  screen.getByRole('combobox', { name: 'Store currency' }).focus()
  await user.keyboard('{Escape}')
  expect(currency).toHaveFocus()
  expect(currency).toHaveAttribute('aria-expanded', 'false')
  expect(toggle()).toHaveAttribute('aria-expanded', 'true')
  await user.keyboard('{Escape}')
  expect(toggle()).toHaveFocus()
  expect(toggle()).toHaveAttribute('aria-expanded', 'false')
})
