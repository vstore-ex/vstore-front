import { createContext, useContext } from 'react'

/** Page index of the surrounding Carousel, for slides that adapt to being visible. */
export const CarouselPageContext = createContext(-1)

export function useCarouselPage() {
  return useContext(CarouselPageContext)
}
