import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import teenArtwork from '../src/assets/ratings/esrb-T.svg'
import ProductAgeRating from '../src/pages/ProductDetailPage/ProductAgeRating'

test.each([
  ['M', '17+', 'Mature · ESRB', 'esrb-M.svg'],
  ['ESRB M', '17+', 'Mature · ESRB', 'esrb-M.svg'],
  ['e', 'Everyone', 'ESRB', 'esrb-E.svg'],
  ['E10+', '10+', 'Everyone 10+ · ESRB', 'esrb-E10plus.svg'],
  ['T', '13+', 'Teen · ESRB', 'esrb-T.svg'],
  ['AO', '18+', 'Adults Only · ESRB', 'esrb-AO.svg'],
  ['RP', 'Rating pending', 'ESRB', 'esrb-RP.svg'],
  ['PEGI 3', '3+', 'PEGI', 'pegi-3.png'],
  ['PEGI 7', '7+', 'PEGI', 'pegi-7.png'],
  ['PEGI 12', '12+', 'PEGI', 'pegi-12.png'],
  ['PEGI 16', '16+', 'PEGI', 'rating-16.png'],
  ['pegi 18', '18+', 'PEGI', 'pegi-18.png'],
])(
  'presents backend rating %s with the matching artwork and age',
  (value, label, caption, asset) => {
    render(<ProductAgeRating value={value} />)
    expect(screen.getByRole('region', { name: 'Age rating' })).toBeInTheDocument()
    expect(screen.getByText(label, { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText(caption, { selector: 'span' })).toBeInTheDocument()
    if (asset === 'esrb-T.svg') expect(screen.getByRole('img')).toHaveAttribute('src', teenArtwork)
    else expect(screen.getByRole('img').getAttribute('src')).toContain(asset)
    expect(screen.queryByText('Mild Violence')).not.toBeInTheDocument()
  },
)

test('uses backend content descriptors and artwork, falling back to matching artwork if the image fails', () => {
  const { rerender } = render(
    <ProductAgeRating
      value="PEGI 16"
      image="/media/pegi-16-custom.png"
      description="Mild Violence"
    />,
  )
  expect(screen.getByText('Mild Violence')).toBeInTheDocument()
  expect(screen.getByRole('img').getAttribute('src')).toContain('/media/pegi-16-custom.png')
  fireEvent.error(screen.getByRole('img'))
  expect(screen.getByRole('img').getAttribute('src')).toContain('rating-16.png')
  fireEvent.error(screen.getByRole('img'))
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getByText('16+')).toBeInTheDocument()
  expect(screen.queryByText('Image unavailable')).not.toBeInTheDocument()
  rerender(<ProductAgeRating value="M" image="/media/mature.png" description="Strong Language" />)
  expect(screen.getByRole('img').getAttribute('src')).toContain('/media/mature.png')
  expect(screen.getByText('17+')).toBeInTheDocument()
  expect(screen.queryByText('16+')).not.toBeInTheDocument()
  expect(screen.getByText('Strong Language')).toBeInTheDocument()
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
