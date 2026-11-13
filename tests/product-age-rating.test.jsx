import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import ProductAgeRating from '../src/pages/ProductDetailPage/ProductAgeRating'

test.each([
  ['M', '17+', 'Mature · ESRB'],
  ['ESRB M', '17+', 'Mature · ESRB'],
  ['e', 'Everyone', 'ESRB'],
  ['E10+', '10+', 'Everyone 10+ · ESRB'],
  ['T', '13+', 'Teen · ESRB'],
  ['AO', '18+', 'Adults Only · ESRB'],
  ['RP', 'Rating pending', 'ESRB'],
  ['PEGI 3', '3+', 'PEGI'],
  ['PEGI 7', '7+', 'PEGI'],
  ['PEGI 12', '12+', 'PEGI'],
  ['PEGI 16', '16+', 'PEGI'],
  ['pegi 18', '18+', 'PEGI'],
])('presents backend rating %s as text with the correct age', (value, label, caption) => {
  const { container } = render(<ProductAgeRating value={value} />)
  expect(screen.getByRole('region', { name: 'Age rating' })).toBeInTheDocument()
  expect(screen.getByText(label, { selector: 'strong' })).toBeInTheDocument()
  expect(screen.getByText(caption, { selector: 'span' })).toBeInTheDocument()
  expect(container.querySelector('img, svg')).toBeNull()
  expect(screen.queryByText('Mild Violence')).not.toBeInTheDocument()
})

test('keeps backend descriptions as text and updates when the game changes', () => {
  const { rerender, container } = render(
    <ProductAgeRating
      value="PEGI 16"
      image="/media/legacy-rating.png"
      description="Mild Violence"
    />,
  )
  expect(screen.getByText('Mild Violence')).toBeInTheDocument()
  expect(screen.getByText('16+')).toBeInTheDocument()
  expect(container.querySelector('img, svg')).toBeNull()
  rerender(<ProductAgeRating value="M" description="Strong Language" />)
  expect(screen.getByText('17+')).toBeInTheDocument()
  expect(screen.queryByText('16+')).not.toBeInTheDocument()
  expect(screen.getByText('Strong Language')).toBeInTheDocument()
  expect(screen.queryByText('Mild Violence')).not.toBeInTheDocument()
})

test.each([null, undefined, '', '   ', 16, {}])(
  'does not invent a rating for invalid or absent data: %j',
  (value) => {
    const { container } = render(<ProductAgeRating value={value} />)
    expect(container).toBeEmptyDOMElement()
  },
)

test.each(['16+', 'USK 16', 'Unclassified'])(
  'preserves an unfamiliar rating without assigning another authority: %s',
  (value) => {
    render(<ProductAgeRating value={value} description={null} />)
    expect(screen.getAllByText(value)).toHaveLength(1)
    expect(screen.getByText('Age rating')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  },
)
