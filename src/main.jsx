import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AuthProvider from './auth/AuthProvider'
import CartProvider from './cart/CartProvider'
import OrdersProvider from './orders/OrdersProvider'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider><CartProvider><OrdersProvider><App /></OrdersProvider></CartProvider></AuthProvider>
  </StrictMode>,
)
