import { useEffect, useState } from 'react'
import iconMac from '../../assets/cart/icon-mac.svg'
import iconWindows from '../../assets/cart/icon-windows.svg'
import logoMark from '../../assets/logo-mark.svg'
import './CartPage.css'

const TAX_RATE = 0.04
const CHECKOUT_TAX_RATE = 0.05

function parsePrice(price) {
  if (!price || price.toLowerCase() === 'free') {
    return 0
  }

  return Number(price.replace(/[^\d.]/g, '')) || 0
}

function formatPrice(value) {
  return `${value.toFixed(2)} UAH`
}

function formatCheckoutPrice(value) {
  return `UAH ${value.toFixed(2)}`
}

function getCardDigits(value) {
  return value.replace(/\D/g, '')
}

function passesLuhnCheck(value) {
  const digits = getCardDigits(value)
  let sum = 0
  let shouldDouble = false

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index])

    if (shouldDouble) {
      digit *= 2

      if (digit > 9) {
        digit -= 9
      }
    }

    sum += digit
    shouldDouble = !shouldDouble
  }

  return digits.length > 0 && sum % 10 === 0
}

function isFutureExpiration(value) {
  const match = value.trim().match(/^(\d{2})\/(\d{2}|\d{4})$/)

  if (!match) {
    return false
  }

  const month = Number(match[1])
  const year = Number(match[2].length === 2 ? `20${match[2]}` : match[2])

  if (month < 1 || month > 12) {
    return false
  }

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  return year > currentYear || (year === currentYear && month >= currentMonth)
}

function getCardValidationErrors(values) {
  const cardDigits = getCardDigits(values.cardNumber)
  const cvvDigits = getCardDigits(values.cvv)
  const errors = {}

  if (cardDigits.length < 13 || cardDigits.length > 19 || !passesLuhnCheck(values.cardNumber)) {
    errors.cardNumber = 'Enter a valid card number.'
  }

  if (values.cardName.trim().length < 2) {
    errors.cardName = 'Enter the name from your card.'
  }

  if (!isFutureExpiration(values.expiration)) {
    errors.expiration = 'Use MM/YY and a future date.'
  }

  if (!/^\d{3,4}$/.test(cvvDigits)) {
    errors.cvv = 'CVV must be 3 or 4 digits.'
  }

  return errors
}

function CheckoutCheckbox({ checked, onChange, label, className = '' }) {
  return (
    <label className={`checkout-check ${className}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span aria-hidden="true" />
      <span>{label}</span>
    </label>
  )
}

function PaymentMethod({ active, brand, logo, onSelect }) {
  return (
    <button
      className={`payment-method${active ? ' payment-method--active' : ''}`}
      type="button"
      onClick={onSelect}
    >
      <span className="payment-method__check" aria-hidden="true" />
      <span className={`payment-method__logo payment-method__logo--${logo}`}>{logo}</span>
      <span>{brand}</span>
    </button>
  )
}

function CheckoutField({ autoComplete, error, inputMode, label, name, onBlur, onChange, placeholder, value }) {
  return (
    <label className={error ? 'checkout-field checkout-field--error' : 'checkout-field'}>
      <span>{label}</span>
      <input
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onBlur={() => onBlur(name)}
        onChange={(event) => onChange(name, event.target.value)}
      />
      {error && <small id={`${name}-error`}>{error}</small>}
    </label>
  )
}

function CheckoutCardDetails({
  errors,
  formValues,
  savePayment,
  touchedFields,
  onFieldBlur,
  onFieldChange,
  onSavePaymentChange,
}) {
  return (
    <div className="checkout-card">
      <h3>CARD DETAILS</h3>

      <CheckoutField
        autoComplete="cc-number"
        error={touchedFields.cardNumber ? errors.cardNumber : ''}
        inputMode="numeric"
        label="Card number"
        name="cardNumber"
        value={formValues.cardNumber}
        onBlur={onFieldBlur}
        onChange={onFieldChange}
      />

      <CheckoutField
        autoComplete="cc-name"
        error={touchedFields.cardName ? errors.cardName : ''}
        label="Name on card"
        name="cardName"
        value={formValues.cardName}
        onBlur={onFieldBlur}
        onChange={onFieldChange}
      />

      <div className="checkout-card__split">
        <CheckoutField
          autoComplete="cc-exp"
          error={touchedFields.expiration ? errors.expiration : ''}
          label="Expiration"
          name="expiration"
          placeholder="MM/YY"
          value={formValues.expiration}
          onBlur={onFieldBlur}
          onChange={onFieldChange}
        />
        <CheckoutField
          autoComplete="cc-csc"
          error={touchedFields.cvv ? errors.cvv : ''}
          inputMode="numeric"
          label="CVV"
          name="cvv"
          value={formValues.cvv}
          onBlur={onFieldBlur}
          onChange={onFieldChange}
        />
      </div>

      <CheckoutCheckbox
        checked={savePayment}
        label="Save this payment method for future purchase?"
        onChange={onSavePaymentChange}
      />

      <p>
        By choosing to save your payment information, this payment method will be selected as the
        default for all purchases made using Epic Games payment, including purchases in Fortnite,
        Rocket League, Fall Guys and the Epic Games Store. You can delete your saved payment
        information anytime on this payment screen or by logging in to your Epic Games account, and
        selecting payment management in your account settings
      </p>
    </div>
  )
}

function CheckoutModal({ items, onClose, onPlaceOrder }) {
  const paymentMethods = [
    { id: 'visa', brand: 'Visa', logo: 'visa' },
    { id: 'mastercard', brand: 'Master card', logo: 'card' },
  ]
  const [paymentMethod, setPaymentMethod] = useState(null)
  const [savePayment, setSavePayment] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(true)
  const [touchedFields, setTouchedFields] = useState({})
  const [formValues, setFormValues] = useState({
    cardNumber: '',
    cardName: '',
    expiration: '',
    cvv: '',
  })

  const subtotal = items.reduce((sum, item) => sum + parsePrice(item.price), 0)
  const tax = subtotal * CHECKOUT_TAX_RATE
  const validationErrors = getCardValidationErrors(formValues)
  const formIsValid = Object.keys(validationErrors).length === 0
  const canPlaceOrder = Boolean(
    paymentMethod &&
    termsAccepted &&
    formIsValid,
  )

  function updateField(field, value) {
    setFormValues((currentValues) => ({ ...currentValues, [field]: value }))
  }

  function markFieldTouched(field) {
    setTouchedFields((currentFields) => ({ ...currentFields, [field]: true }))
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (!canPlaceOrder) {
      setTouchedFields({
        cardNumber: true,
        cardName: true,
        expiration: true,
        cvv: true,
      })
      return
    }

    onPlaceOrder()
  }

  return (
    <div className="checkout-overlay" role="presentation">
      <form className="checkout-modal" aria-label="Checkout" onSubmit={handleSubmit}>
        <section className="checkout-payment" aria-label="Payment details">
          <h2>CHECKOUT</h2>

          <div
            className={`checkout-payment__methods${
              paymentMethod ? ' checkout-payment__methods--selected' : ''
            }`}
          >
            {paymentMethods.map((method) =>
              paymentMethod === method.id ? (
                <div className="checkout-payment__box" key={method.id}>
                  <PaymentMethod
                    active
                    brand={method.brand}
                    logo={method.logo}
                    onSelect={() => setPaymentMethod(method.id)}
                  />
                  <CheckoutCardDetails
                    errors={validationErrors}
                    formValues={formValues}
                    savePayment={savePayment}
                    touchedFields={touchedFields}
                    onFieldBlur={markFieldTouched}
                    onFieldChange={updateField}
                    onSavePaymentChange={setSavePayment}
                  />
                </div>
              ) : (
                <PaymentMethod
                  active={false}
                  brand={method.brand}
                  logo={method.logo}
                  onSelect={() => setPaymentMethod(method.id)}
                  key={method.id}
                />
              ),
            )}
          </div>
        </section>

        <aside className="checkout-order" aria-label="Order summary">
          <div className="checkout-order__header">
            <h2>ORDER SUMMARY</h2>
            <button type="button" aria-label="Close checkout" onClick={onClose}>
              x
            </button>
          </div>

          <div className="checkout-order__body">
            {items.map((item) => (
              <article className="checkout-product" key={item.id}>
                <img src={item.image} alt="" />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.detail?.meta?.find(([label]) => label === 'Developer')?.[1] ?? 'ZA/UM'}</p>
                  <span>{formatCheckoutPrice(parsePrice(item.price))}</span>
                </div>
              </article>
            ))}

            <dl className="checkout-totals">
              <div>
                <dt>Price</dt>
                <dd>{formatCheckoutPrice(subtotal)}</dd>
              </div>
              <div>
                <dt>Taxed(5%)</dt>
                <dd>{formatCheckoutPrice(tax)}</dd>
              </div>
            </dl>

            <div className="checkout-divider" />

            <div className="checkout-total-row">
              <span>Taxed(5%)</span>
              <strong>{formatCheckoutPrice(tax)}</strong>
            </div>

            <CheckoutCheckbox
              checked={termsAccepted}
              className="checkout-check--terms"
              label="I am 13 years of age or older and agree to the terms of the Steam Subscriber Agreement and the Valve Privacy Policy."
              onChange={setTermsAccepted}
            />

            <div className="checkout-divider" />

            <p className="checkout-license">
              You are purchasing a digital license for this product. For full terms, see purchase
              policy.
              <br />
              <br />
              By clicking "Place Order" below, I represent that I am over 18 and an authorized user
              of this payment method, I agree to the End User License Agreement.
            </p>

            <button className="checkout-place-order" type="submit" disabled={!canPlaceOrder}>
              PLACE ORDER
            </button>
          </div>
        </aside>
      </form>
    </div>
  )
}

function CheckoutSuccessModal({ onClose }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="checkout-overlay" role="presentation" onClick={onClose}>
      <section
        className="checkout-success"
        aria-label="Purchase completed"
        onClick={(event) => event.stopPropagation()}
      >
        <img className="checkout-success__logo" src={logoMark} alt="" />
        <h2>Thank you for buying our games!</h2>
        <p>An email receipt has been sent to you.</p>
        <span>If there is anything else you need, feel free to browse our shop!</span>
      </section>
    </div>
  )
}

function CartItem({ item, onMoveToWishlist, onRemove }) {
  const releaseDate =
    item.detail?.meta?.find(([label]) => label.toLowerCase() === 'release date')?.[1] ?? '20.05.2025'
  const reviewScore = item.detail?.reviews?.length ? 'Mostly Positive' : 'Mostly Positive'

  return (
    <article className="cart-item">
      <img className="cart-item__cover" src={item.image} alt="" />

      <div className="cart-item__info">
        <span className="cart-item__type">{item.type}</span>
        <h2>{item.title}</h2>

        <dl className="cart-item__meta">
          <div>
            <dt>All Reviews:</dt>
            <dd className="cart-item__review">{reviewScore}</dd>
          </div>
          <div>
            <dt>Release Date</dt>
            <dd>{releaseDate}</dd>
          </div>
        </dl>

        <div className="cart-item__platforms" aria-label="Available platforms">
          <img src={iconWindows} alt="Windows" />
          <img src={iconMac} alt="Mac" />
        </div>
      </div>

      <div className="cart-item__side">
        <strong>{formatPrice(parsePrice(item.price))}</strong>
        <div className="cart-item__actions">
          <button type="button" onClick={() => onRemove(item.id)}>
            Remove
          </button>
          <button type="button" onClick={() => onMoveToWishlist(item.id)}>
            Move to wishlist
          </button>
        </div>
      </div>
    </article>
  )
}

function CartPage({ items, onCheckout, onMoveToWishlist, onRemove }) {
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)
  const subtotal = items.reduce((sum, item) => sum + parsePrice(item.price), 0)
  const total = subtotal
  const tax = subtotal * TAX_RATE

  function handleOpenCheckout() {
    setSuccessOpen(false)
    setCheckoutOpen(true)
  }

  function handlePlaceOrder() {
    onCheckout()
    setCheckoutOpen(false)
    setSuccessOpen(true)
  }

  return (
    <div className="cart-page">
      <div className="cart-page__inner">
        <div className="cart-page__header">
          <h1>My Cart</h1>
          <span>{formatPrice(total)}</span>
        </div>

        {items.length > 0 ? (
          <div className="cart-layout">
            <section className="cart-items" aria-label="Cart items">
              {items.map((item) => (
                <CartItem
                  item={item}
                  onMoveToWishlist={onMoveToWishlist}
                  onRemove={onRemove}
                  key={item.id}
                />
              ))}
            </section>

            <aside className="cart-summary" aria-label="Cart summary">
              <div className="cart-summary__row cart-summary__row--total">
                <span>Total:</span>
                <strong>{formatPrice(total)}</strong>
              </div>
              <div className="cart-summary__row">
                <span>Tax:</span>
                <strong>{TAX_RATE * 100}%</strong>
              </div>
              <p>
                Of their respective owners in the US and other countries. VAT included in all prices
                where applicable
              </p>
              <button type="button" onClick={handleOpenCheckout}>
                Check Out
              </button>
              <small>Estimated tax: {formatPrice(tax)}</small>
            </aside>
          </div>
        ) : (
          <section className="cart-empty" aria-label="Empty cart">
            <h2>Your cart is empty</h2>
            <p>Add games from the store and they will appear here.</p>
          </section>
        )}
      </div>
      {checkoutOpen && items.length > 0 && (
        <CheckoutModal
          items={items}
          onClose={() => setCheckoutOpen(false)}
          onPlaceOrder={handlePlaceOrder}
        />
      )}
      {successOpen && <CheckoutSuccessModal onClose={() => setSuccessOpen(false)} />}
    </div>
  )
}

export default CartPage
