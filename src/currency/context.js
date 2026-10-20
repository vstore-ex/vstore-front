import { createContext, useContext } from 'react'
export const CurrencyContext = createContext(null)
export const useCurrency = () => useContext(CurrencyContext)
