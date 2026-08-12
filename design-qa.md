final result: passed

Reference:
- Figma node `428:3105`
- Figma node `428:3267`
- Figma node `428:4666`
- Figma node `428:1840`
- Figma node `428:1858`
- Figma node `428:2195`
- Figma node `428:3746`

Prototype screenshots:
- `qa-artifacts/cart-page-desktop.png`
- `qa-artifacts/cart-page-mobile.png`
- `qa-artifacts/cart-page-empty.png`
- `qa-artifacts/checkout-modal-desktop.png`
- `qa-artifacts/checkout-success-modal.png`
- `qa-artifacts/discover-expanded-top.png`
- `qa-artifacts/discover-expanded-bottom.png`
- `qa-artifacts/discover-expanded-mobile.png`
- `qa-discover-buttons-fixed.png`
- `qa-achievements-routed-desktop.png`
- `qa-achievements-routed-mobile.png`

Checks:
- Cart icon opens login for guests and opens My Cart after successful login.
- Auth state persists through browser refresh via localStorage.
- Cart state persists through browser refresh via localStorage.
- Product detail `Add to cart` adds the selected product and opens My Cart.
- Remove clears an item and shows the empty cart state.
- `Check Out` opens a centered payment modal over a dimmed and blurred cart page.
- Checkout supports Visa/Mastercard selection, editable card fields, save-payment checkbox, terms checkbox, and disabled/enabled `PLACE ORDER` state.
- Checkout validates card number with a basic length/Luhn check, validates future expiration date, CVV length, and cardholder name.
- Placing an order closes checkout and clears the cart.
- Successful purchase shows the Figma-style thank-you modal.
- Discover page implements the long Figma layout with featured hero, product rails, promo cards, sale/deal sections, free games, mobile banner, ranked lists, and pagination.
- Discover content is driven by reusable section arrays so a future admin panel/API can replace banners, products, promos, and rankings without rewriting JSX structure.
- Free games `View More` button matches the Figma outline style: transparent background, white border/text, 0.8 opacity, 4.098px radius.
- Promo cards use the Figma `See In Shop` CTA: #393e46 background, Roboto 16px semibold text, 4.1px radius, and the exported external-link SVG at 24x24.
- Product cards and Discover ranked items expose real hash links such as `#/products/longvinter`, while keeping SPA navigation.
- Product detail can be opened directly and remains correct after browser refresh.
- Achievements can be opened directly at `#/products/longvinter/achievements`.
- Achievements page matches the Figma row layout with 121px icons, bordered progress rows, 11 visible rows, green percentages, and real pagination based on `achievementsCount`.
- Desktop and mobile layouts render without horizontal overflow.
- Playwright protected-cart, persistence, remove, add-to-cart, checkout validation, successful payment, expanded Discover, product-click, and responsive overflow flows completed with no console or runtime errors.
