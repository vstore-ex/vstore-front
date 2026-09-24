import useCatalogResource from '../../hooks/useCatalogResource'
import { MediaImage } from '../../components/Catalog/Media'
import { formatMoney } from '../../api/cart'

export default function CartItem({ item, currency, disabled, onRemove, onMove, owned }) {
  const game = useCatalogResource('game', String(item.product_id))
  return <article className="cart-item server-cart-item">
    <a href={`#/products/${item.product_id}`}><MediaImage className="server-cart-cover" src={game.data?.image} alt={item.title} /></a>
    <div className="cart-item__info"><h2><a href={`#/products/${item.product_id}`}>{item.title}</a></h2>
      {game.error && <button type="button" onClick={game.retry}>Retry game details</button>}
    </div>
    <div className="cart-item__side"><strong>{formatMoney(item.price, currency)}</strong>
      <div className="cart-item__actions"><button type="button" disabled={disabled} onClick={onRemove}>Remove</button>
      {!owned && <button type="button" disabled={disabled} onClick={onMove}>Move to wishlist</button>}</div>
    </div>
  </article>
}
