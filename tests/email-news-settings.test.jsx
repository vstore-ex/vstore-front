import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import EmailNewsSettings from '../src/pages/AccountPage/EmailNewsSettings'
import * as newsPreferences from '../src/api/newsPreferences'

vi.mock('../src/api/newsPreferences', () => ({
  getEmailNewsPreferences: vi.fn(),
  updateEmailNewsPreferences: vi.fn(),
}))

beforeEach(() => {
  newsPreferences.getEmailNewsPreferences.mockReset().mockResolvedValue({
    email_news_notifications: false,
    email_owned_game_news_notifications: false,
  })
  newsPreferences.updateEmailNewsPreferences.mockReset().mockImplementation(async (value) => value)
})

test('saves separate opt-in preferences for all news and owned games', async () => {
  const user = userEvent.setup()
  render(<EmailNewsSettings />)

  const allNews = await screen.findByRole('checkbox', {
    name: 'Email me about every published news article',
  })
  const ownedGames = screen.getByRole('checkbox', {
    name: 'Email me about news for games I own',
  })
  expect(allNews).not.toBeChecked()
  expect(ownedGames).not.toBeChecked()

  await user.click(allNews)
  await user.click(ownedGames)
  await user.click(screen.getByRole('button', { name: 'Save email preferences' }))

  await waitFor(() => expect(newsPreferences.updateEmailNewsPreferences).toHaveBeenCalled())
  expect(newsPreferences.updateEmailNewsPreferences).toHaveBeenCalledWith({
    email_news_notifications: true,
    email_owned_game_news_notifications: true,
  })
  expect(await screen.findByRole('status')).toHaveTextContent('Email preferences saved.')
})
