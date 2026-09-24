import Markdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import { mediaUrl } from '../../api/client'
import './MarkdownView.css'

function safeUrl(value, key) {
  if (key === 'src') return mediaUrl(value)
  try {
    const url = new URL(value, window.location.href)
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : ''
  } catch { return '' }
}
const components = {
  a: ({ href, title, children }) => href
    ? <a href={href} title={title} target="_blank" rel="noopener noreferrer">{children}</a>
    : <span>{children}</span>,
  img: ({ src, alt, title }) => src
    ? <img src={src} alt={alt || ''} title={title} loading="lazy" decoding="async" />
    : <span>{alt || 'Image unavailable'}</span>,
}
export default function MarkdownView({ children, className = '' }) {
  return <div className={`markdown-view ${className}`}>
    <Markdown skipHtml rehypePlugins={[rehypeSanitize]} urlTransform={safeUrl} components={components}>
      {typeof children === 'string' ? children : ''}
    </Markdown>
  </div>
}
