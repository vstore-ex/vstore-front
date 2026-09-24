import { useContext } from 'react'
import { OrdersContext } from '../orders/context'
export default function useOrders() { return useContext(OrdersContext) }
