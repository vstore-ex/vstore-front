import { notificationKind } from './format'

const PATHS = {
  message: <path d="M4 5h16v11H8l-4 3V5z" strokeLinejoin="round" />,
  friend: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
      <path d="M17 8v6M14 11h6" />
    </>
  ),
  support: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.4M12 16.8v.2" />
    </>
  ),
  news: (
    <>
      <path d="M5 5h11v14H7a2 2 0 0 1-2-2V5z" />
      <path d="M16 9h3v8a2 2 0 0 1-2 2M8 9h5M8 12h5M8 15h3" />
    </>
  ),
  game: (
    <>
      <path d="M7 9h10a4 4 0 0 1 3.9 4.8l-.6 2.7a2 2 0 0 1-3.4.9L15 15H9l-1.9 2.4a2 2 0 0 1-3.4-.9l-.6-2.7A4 4 0 0 1 7 9z" />
      <path d="M8 11.5v3M6.5 13h3M15.5 12.5h.1M17.5 13.5h.1" />
    </>
  ),
  general: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />,
}

/** Round category icon shown next to each notification. */
export default function NotificationIcon({ type }) {
  const kind = notificationKind(type)
  return (
    <span className={'notification-icon notification-icon--' + kind} aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        focusable="false"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {PATHS[kind]}
      </svg>
    </span>
  )
}
