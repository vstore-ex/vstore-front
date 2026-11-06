import { useEffect } from 'react'

export const STORE_NAME = 'VStore'

/** Sets the browser tab title, e.g. "Factorio on VStore" or "Wishlist · VStore". */
export default function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title || STORE_NAME
  }, [title])
}

export function pageTitle(name) {
  return name ? `${name} · ${STORE_NAME}` : STORE_NAME
}
