import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>
}

test('renders JSX and processes keyboard interaction without a browser server', async () => {
  const user = userEvent.setup()
  render(<Counter />)
  await user.tab()
  expect(screen.getByRole('button', { name: 'Count: 0' })).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(screen.getByRole('button', { name: 'Count: 1' })).toBeEnabled()
})
