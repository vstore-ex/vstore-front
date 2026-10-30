import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AuthProvider from './auth/AuthProvider'
import PresenceHeartbeat from './friends/PresenceHeartbeat'
import CartProvider from './cart/CartProvider'
import WishlistProvider from './wishlist/WishlistProvider'
import OrdersProvider from './orders/OrdersProvider'
import WalletProvider from './wallet/WalletProvider'
import CurrencyProvider from './currency/CurrencyProvider'
import NotificationsProvider from './notifications/NotificationsProvider'
import './styles/controls.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <NotificationsProvider>
        <PresenceHeartbeat />
        <WalletProvider>
          <CurrencyProvider>
            <CartProvider>
              <OrdersProvider>
                <WishlistProvider>
                  <App />
                </WishlistProvider>
              </OrdersProvider>
            </CartProvider>
          </CurrencyProvider>
        </WalletProvider>
      </NotificationsProvider>
    </AuthProvider>
  </StrictMode>,
)
