import chevronRight from '../../assets/icon-chevron-right.svg'
import { MediaImage } from '../Catalog/Media'
import './DiscoverShowcase.css'

function ShowcasePrice({ item }) {
  if (item.discount) {
    return (
      <span className="showcase-item__deal">
        <span className="showcase-item__discount">{item.discount}</span>
        <span className="showcase-item__old-price">{item.originalPrice}</span>
        <span className="showcase-item__price">{item.price}</span>
      </span>
    )
  }

  return <span className="showcase-item__price">{item.price}</span>
}

function ShowcaseItem({ item, onSelect }) {
  function handleClick(event) {
    event.preventDefault()
    onSelect?.(item.id)
  }

  return (
    <article className="showcase-item">
      <a className="showcase-item__button" href={`#/products/${item.id}`} onClick={handleClick}>
        <MediaImage className="showcase-item__image" src={item.image} alt={item.title} />
        <span className="showcase-item__body">
          <span className="showcase-item__title">{item.title}</span>
          <ShowcasePrice item={item} />
        </span>
      </a>
    </article>
  )
}

function ShowcaseColumn({ column, onItemSelect }) {
  return (
    <section className="showcase-column" id={column.id} aria-labelledby={`${column.id}-title`}>
      <h2 className="showcase-column__title">
        <span id={`${column.id}-title`}>{column.title}</span>
        <img src={chevronRight} alt="" />
      </h2>

      <div className="showcase-column__items">
        {column.items.map((item) => (
          <ShowcaseItem item={item} key={item.id} onSelect={onItemSelect} />
        ))}
      </div>
    </section>
  )
}

function DiscoverShowcase({ columns, onItemSelect }) {
  return (
    <section className="discover-showcase" aria-label="Discover ranked games">
      {columns.map((column) => (
        <ShowcaseColumn column={column} key={column.id} onItemSelect={onItemSelect} />
      ))}
    </section>
  )
}

export default DiscoverShowcase
