import apexHero from '../../assets/discover/apex-hero.png'
import apexPanel from '../../assets/discover/apex-panel.png'
import apexThumbOne from '../../assets/discover/apex-thumb-1.png'
import apexThumbTwo from '../../assets/discover/apex-thumb-2.png'
import assassinsCreed from '../../assets/discover-lists/assassins-creed-shadows.png'
import borderlands from '../../assets/discover-lists/borderlands-4.png'
import fortnite from '../../assets/discover-lists/fortnite.png'
import genshin from '../../assets/discover-lists/genshin-impact.png'
import gta from '../../assets/discover-lists/gta-v.png'
import honkai from '../../assets/discover-lists/honkai-star-rail.png'
import lastOfUs from '../../assets/discover-lists/the-last-of-us-2.png'
import redDead from '../../assets/discover-lists/red-dead-2.png'
import rocketLeague from '../../assets/discover-lists/rocket-league.png'
import valorant from '../../assets/discover-lists/valorant.png'
import externalLinkIcon from '../../assets/icon-external-link.svg'
import giftIcon from '../../assets/icon-gift.svg'
import DiscoverShowcase from '../../components/DiscoverShowcase/DiscoverShowcase'
import ProductCard from '../../components/ProductCard/ProductCard'
import { discoverShowcaseColumns } from '../../data/discoverLists'
import { discoverProducts } from '../../data/products'
import './DiscoverPage.css'

const featuredGame = {
  id: 'apex-legends',
  title: 'APEX LEGENDS',
  subtitle: 'NEW SEASON',
  price: 'FREE',
  cta: 'Learn more',
  heroImage: apexHero,
  panelImage: apexPanel,
  screenshots: [apexThumbOne, apexThumbTwo],
}

const editorialPromos = [
  {
    id: 'fortnite-mobile',
    title: 'Fortnite',
    description:
      "Feudal Gotham's Dark Night, Ninja Knight Batman, and the malicious wildcard Karuta Harley Quinn strike with a vengeance.",
    image: fortnite,
    cta: 'See In Shop',
  },
  {
    id: 'rocket-league-pass',
    title: 'Rocket League',
    description:
      'Jump into fast matches, climb the ranks, and collect new rewards with friends across every platform.',
    image: rocketLeague,
    cta: 'See In Shop',
  },
  {
    id: 'honkai-update',
    title: 'Honkai: Star Rail',
    description:
      'A new chapter opens with fresh characters, events, and rewards for returning players.',
    image: honkai,
    cta: 'See In Shop',
  },
]

const saleProducts = [
  { ...discoverProducts[0], originalPrice: 'UAH 1030', discount: '-60%', price: 'UAH 515' },
  { ...discoverProducts[1], originalPrice: 'UAH 1620', discount: '-50%', price: 'UAH 810' },
  { ...discoverProducts[6], originalPrice: 'UAH 2060', discount: '-50%', price: 'UAH 1030' },
  { ...discoverProducts[7], originalPrice: 'UAH 1950', discount: '-50%', price: 'UAH 975' },
  { ...discoverProducts[5], originalPrice: 'UAH 710', discount: '-50%', price: 'UAH 355' },
  { ...discoverProducts[4], originalPrice: 'UAH 650', discount: '-50%', price: 'UAH 325' },
]

const dealCards = [
  {
    id: 'tmnt-week',
    title: 'Teenage Mutant Ninja Turtles: Splintered Fate',
    image: redDead,
    label: 'Deals of the Week',
    discount: '-60%',
    originalPrice: 'UAH 1030',
    price: 'UAH 515',
  },
  {
    id: 'borderlands-week',
    title: 'Borderlands 4',
    image: borderlands,
    label: 'Deals of the Week',
    discount: '-40%',
    originalPrice: 'UAH 1480',
    price: 'UAH 890',
  },
  {
    id: 'assassins-week',
    title: 'Assassins Creed Shadows',
    image: assassinsCreed,
    label: 'Deals of the Week',
    discount: '-35%',
    originalPrice: 'UAH 1370',
    price: 'UAH 890',
  },
]

const freeGames = [
  {
    id: 'garden-story',
    title: 'Garden Story',
    image: genshin,
    availability: 'Free Now - Feb 27 at 05:00 PM',
  },
  {
    id: 'valorant-free',
    title: 'VALORANT',
    image: valorant,
    availability: 'Free Now - Feb 27 at 05:00 PM',
  },
  {
    id: 'rocket-league-free',
    title: 'Rocket League',
    image: rocketLeague,
    availability: 'Free Now - Feb 27 at 05:00 PM',
  },
]

const mobileBanner = {
  id: 'vision-store-mobile',
  title: 'Vision Store Mobile',
  description:
    "Feudal Gotham's Dark Night, Ninja Knight Batman, and the malicious wildcard Karuta Harley Quinn strike with a vengeance.",
  image: lastOfUs,
  cta: 'Learn more',
}

const popularProducts = [
  { id: 'grand-theft-auto-v', type: 'Base Game', title: 'Grand Theft Auto V: Premium Edition', price: 'UAH 629', image: gta },
  { id: 'valorant', type: 'Base Game', title: 'VALORANT', price: 'Free', image: valorant },
  { id: 'werecleaner', type: 'Base Game', title: 'The WereCleaner', price: 'UAH 325', image: discoverProducts[4].image },
  { id: 'apex-legends', type: 'Base Game', title: 'Apex Legends', price: 'Free', image: discoverProducts[3].image },
  { id: 'kingdom-come', type: 'Base Game', title: 'Kingdom Come Deliverance II', price: 'UAH 1030', image: discoverProducts[6].image },
  { id: 'final-fantasy-vii', type: 'Base Game', title: 'Final Fantasy VII', price: 'UAH 975', image: discoverProducts[7].image },
]

const newProducts = [
  { id: 'honkai-star-rail', type: 'Base Game', title: 'Honkai: Star Rail', price: 'Free', image: honkai },
  { id: 'assassins-creed-shadows', type: 'Base Game', title: 'Assassins Creed Shadows', price: 'UAH 890', image: assassinsCreed },
  { id: 'borderlands-4', type: 'Base Game', title: 'Borderlands 4', price: 'Coming soon', image: borderlands },
  { id: 'longvinter', type: 'Base Game', title: 'Longvinter', price: 'UAH 279', image: discoverProducts[0].image },
  { id: 'farcry-5', type: 'Base Game', title: 'FARCRY 5', price: 'UAH 810', image: discoverProducts[1].image },
  { id: 'the-last-of-us-part-ii-remastered', type: 'Base Game', title: 'The Last of Us Part II Remastered', price: 'UAH 735', image: lastOfUs },
]

const storeSections = [
  { id: 'discover-new', title: 'Discover Something New', products: discoverProducts.slice(0, 6) },
  { id: 'winter-sale', title: 'Winter Sale Spotlight', products: saleProducts },
  { id: 'popular-games', title: 'Popular Games', products: popularProducts },
  { id: 'new-games', title: 'New Games', products: newProducts },
]

function FeaturedGame({ game, onProductSelect }) {
  function handleClick() {
    onProductSelect?.(game.id)
  }

  return (
    <section className="featured-game" aria-label={game.title}>
      <button className="featured-game__hero" type="button" onClick={handleClick}>
        <img src={game.heroImage} alt="" />
      </button>

      <aside className="featured-game__panel">
        <img className="featured-game__panel-bg" src={game.panelImage} alt="" aria-hidden="true" />
        <div className="featured-game__content">
          <h1>{game.title}</h1>
          <p className="featured-game__subtitle">{game.subtitle}</p>

          <div className="featured-game__screens">
            {game.screenshots.map((screenshot) => (
              <img src={screenshot} alt="" key={screenshot} />
            ))}
          </div>

          <div className="featured-game__footer">
            <span>{game.price}</span>
            <button className="discover-action-button" type="button" onClick={handleClick}>
              {game.cta}
            </button>
          </div>
        </div>
      </aside>
    </section>
  )
}

function ProductSection({ title, products, onProductSelect }) {
  return (
    <section className="product-section" aria-labelledby={`${title.replace(/\s+/g, '-').toLowerCase()}-title`}>
      <h2 id={`${title.replace(/\s+/g, '-').toLowerCase()}-title`}>{title}</h2>
      <div className="product-grid">
        {products.map((product) => (
          <ProductCard product={product} key={product.id} onSelect={onProductSelect} />
        ))}
      </div>
    </section>
  )
}

function PromoGrid({ promos }) {
  return (
    <section className="promo-grid" aria-label="Featured updates">
      {promos.map((promo) => (
        <article className="promo-card" key={promo.id}>
          <img className="promo-card__image" src={promo.image} alt="" />
          <h2>{promo.title}</h2>
          <p>{promo.description}</p>
          <button className="discover-shop-button" type="button">
            <span>{promo.cta}</span>
            <img src={externalLinkIcon} alt="" aria-hidden="true" />
          </button>
        </article>
      ))}
    </section>
  )
}

function DealStrip({ deals }) {
  return (
    <section className="deal-strip" aria-label="Deals of the week">
      {deals.map((deal) => (
        <article className="deal-card" key={deal.id}>
          <div className="deal-card__media">
            <img src={deal.image} alt="" />
            <span>{deal.label}</span>
          </div>
          <h2>{deal.title}</h2>
          <div className="deal-card__price">
            <span>{deal.discount}</span>
            <del>{deal.originalPrice}</del>
            <strong>{deal.price}</strong>
          </div>
        </article>
      ))}
    </section>
  )
}

function FreeGames({ games }) {
  return (
    <section className="free-games" aria-labelledby="free-games-title">
      <div className="free-games__inner">
        <div className="free-games__header">
          <h2 id="free-games-title">
            <img className="free-games__icon" src={giftIcon} alt="" aria-hidden="true" />
            Free games!
          </h2>
          <button className="discover-outline-button" type="button">
            View More
          </button>
        </div>

        <div className="free-games__grid">
          {games.map((game) => (
            <article className="free-game-card" key={game.id}>
              <div className="free-game-card__media">
                <img src={game.image} alt="" />
                <span>FREE NOW</span>
              </div>
              <h3>{game.title}</h3>
              <p>{game.availability}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function MobileBanner({ banner }) {
  return (
    <section className="mobile-banner" aria-label={banner.title}>
      <img src={banner.image} alt="" />
      <div>
        <h2>{banner.title}</h2>
        <p>{banner.description}</p>
        <button className="discover-action-button" type="button">
          {banner.cta}
        </button>
      </div>
    </section>
  )
}

function createPagination(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const nearbyPages = [currentPage - 1, currentPage, currentPage + 1].filter(
    (page) => page > 1 && page < totalPages,
  )

  return [1, ...new Set(nearbyPages), 'end-gap', totalPages]
}

function StorePagination({ currentPage = 1, totalItems, pageSize = 24 }) {
  const totalPages = Math.ceil(totalItems / pageSize)

  if (totalPages <= 1) {
    return null
  }

  const pages = createPagination(currentPage, totalPages)

  return (
    <nav className="store-pagination" aria-label="Discover pages">
      <button type="button" disabled={currentPage === 1}>
        Previous
      </button>
      {pages.map((page) =>
        typeof page === 'number' ? (
          <button
            className={page === currentPage ? 'store-pagination__active' : ''}
            type="button"
            key={page}
          >
            {page}
          </button>
        ) : (
          <span aria-hidden="true" key={page}>
            ...
          </span>
        ),
      )}
      <button type="button" disabled={currentPage === totalPages}>
        Next
      </button>
    </nav>
  )
}

function DiscoverPage({ onProductSelect }) {
  const sectionProductCount = storeSections.reduce((count, section) => count + section.products.length, 0)

  return (
    <div className="discover-page">
      <div className="discover-page__inner">
        <FeaturedGame game={featuredGame} onProductSelect={onProductSelect} />
        <ProductSection {...storeSections[0]} onProductSelect={onProductSelect} />
        <PromoGrid promos={editorialPromos} />
        <ProductSection {...storeSections[1]} onProductSelect={onProductSelect} />
        <DealStrip deals={dealCards} />
        <FreeGames games={freeGames} />
        <MobileBanner banner={mobileBanner} />
        <DiscoverShowcase columns={discoverShowcaseColumns} onItemSelect={onProductSelect} />
        <ProductSection {...storeSections[2]} onProductSelect={onProductSelect} />
        <ProductSection {...storeSections[3]} onProductSelect={onProductSelect} />
        <StorePagination totalItems={sectionProductCount} />
      </div>
    </div>
  )
}

export default DiscoverPage
