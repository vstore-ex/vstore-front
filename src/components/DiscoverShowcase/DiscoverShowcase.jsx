import chevronRight from '../../assets/icon-chevron-right.svg'
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
        <img className="showcase-item__image" src={item.image} alt={item.title} />
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
    <section className="showcase-column" aria-labelledby={`${column.id}-title`}>
      <a className="showcase-column__title" href={`#${column.id}`}>
        <span id={`${column.id}-title`}>{column.title}</span>
        <img src={chevronRight} alt="" />
      </a>

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
