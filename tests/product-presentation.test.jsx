import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ProductMarkdown } from '../src/pages/ProductDetailPage/ProductContent'
import ProductDetailPage from '../src/pages/ProductDetailPage/ProductDetailPage'
import useCatalogResource from '../src/hooks/useCatalogResource'

vi.mock('../src/hooks/useCatalogResource', () => ({ default: vi.fn() }))

test('renders imported bold text with trailing whitespace instead of visible delimiters', () => {
  render(
    <ProductMarkdown imported>
      {
        '**Disco Elysium - The Final Cut is a role playing game. ** You are a detective.\n\n** More choices **next paragraph.'
      }
    </ProductMarkdown>,
  )
  expect(
    screen.getByText('Disco Elysium - The Final Cut is a role playing game.', {
      selector: 'strong',
    }),
  ).toBeInTheDocument()
  expect(screen.getByText('More choices', { selector: 'strong' })).toBeInTheDocument()
  expect(document.querySelector('.product-markdown')).not.toHaveTextContent('**')
  expect(document.querySelector('.product-markdown')).toHaveTextContent(
    'More choices next paragraph.',
  )
})

test('keeps code, escaped asterisks and ordinary review text literal', () => {
  const { container, rerender } = render(
    <ProductMarkdown imported>
      {'`**code **`\n\n```md\n**fenced **\n```\n\n\\*\\*escaped \\*\\*\n\n**valid bold**'}
    </ProductMarkdown>,
  )
  expect(screen.getByText('**code **', { selector: 'code', exact: false })).toBeInTheDocument()
  expect(container.querySelector('pre code').textContent).toContain('**fenced **')
  expect(container).toHaveTextContent('**escaped **')
  expect(container.querySelectorAll('strong')).toHaveLength(1)
  rerender(<ProductMarkdown>{'**literal review **'}</ProductMarkdown>)
  expect(container).toHaveTextContent('**literal review **')
  expect(container.querySelector('strong')).toBeNull()
})

test('preserves lists and safe links while suppressing HTML and unsafe images', () => {
  const { container, rerender } = render(
    <ProductMarkdown imported>
      {
        '## Features\n\n- **Choices**\n- Consequences\n\n[Official site](https://example.com/game)\n\n[Unsafe](javascript:alert(1))\n\n<script>alert(1)</script>\n\n![Banner](/media/banner.webp)'
      }
    </ProductMarkdown>,
  )
  expect(screen.getByRole('heading', { name: 'Features' })).toBeInTheDocument()
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  expect(screen.getByRole('link', { name: 'Official site' })).toHaveAttribute('target', '_blank')
  expect(screen.getByRole('link', { name: 'Official site' })).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  )
  expect(container.querySelector('script')).toBeNull()
  expect(container.querySelector('a[href^="javascript:"]')).toBeNull()
  expect(screen.getByRole('img', { name: 'Banner' })).toHaveAttribute(
    'src',
    'http://localhost/media/banner.webp',
  )
  rerender(
    <ProductMarkdown imported allowImages={false}>
      {'![Banner](/media/banner.webp)'}
    </ProductMarkdown>,
  )
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})

test('a missing game has a 404 recovery page; network failures retain retry', async () => {
  const retry = vi.fn()
  useCatalogResource.mockReturnValue({ error: { status: 404, message: 'game not found' }, retry })
  const { rerender } = render(<ProductDetailPage id="missing" />)
  expect(screen.getByRole('heading', { name: 'Game not found' })).toBeInTheDocument()
  expect(screen.getByText('404')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to store' })).toHaveAttribute('href', '#/discover')
  expect(screen.queryByRole('button', { name: 'Retry game' })).not.toBeInTheDocument()
  useCatalogResource.mockReturnValue({
    error: { status: 503, message: 'Store temporarily unavailable' },
    retry,
  })
  rerender(<ProductDetailPage id="missing" />)
  expect(screen.queryByText('404')).not.toBeInTheDocument()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Retry game' }))
  expect(retry).toHaveBeenCalledOnce()
})
