import { useEffect, useId, useRef, useState } from 'react'
import Markdown, { defaultUrlTransform } from 'react-markdown'
import { MediaImage } from '../../components/Catalog/Media'
import { mediaUrl } from '../../api/catalog'
import chevron from '../../assets/product-chevron-down.svg'

function MarkdownLink({ href, children }) {
  let external = false
  try {
    const url = new URL(href, window.location.href)
    external = ['http:', 'https:'].includes(url.protocol) && url.origin !== window.location.origin
  } catch { /* Invalid destinations remain subject to Markdown's URL sanitizer. */ }
  return <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>{children}</a>
}

const markdownComponents = {
  a: MarkdownLink,
  img: ({ src, alt }) => <MediaImage src={src} alt={alt} />,
}
export function ProductMarkdown({ children }) {
  return <div className="product-markdown"><Markdown components={markdownComponents}
    urlTransform={(url, key) => key === 'src' ? mediaUrl(url) : defaultUrlTransform(url)}>{typeof children === 'string' ? children : ''}</Markdown></div>
}

export function ExpandableContent({ children, className = '', limit = 250 }) {
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const content = useRef(null)
  const contentId = useId()
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setOverflows(entry.contentRect.height > limit))
    observer.observe(content.current)
    return () => observer.disconnect()
  }, [limit])
  return <div className={className}>
    <div id={contentId} className={overflows && !expanded ? 'product-content-collapsed' : ''} style={{ '--content-limit': limit + 'px' }}>
      <div ref={content}>{children}</div>
    </div>
    {overflows && <button type="button" className="product-text-button product-expand" aria-controls={contentId} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
      {expanded ? 'Show less' : 'Show more'} <img src={chevron} alt="" style={{ transform: expanded ? 'rotate(180deg)' : undefined }} />
    </button>}
  </div>
}

export function Requirements({ value }) {
  // GameOut.requirements is Markdown; two headed sections become Figma's columns.
  const markdown = typeof value === 'string' ? value.trim() : ''
  const sections = markdown.split(/(?=^(?:#{1,6}\s+|\*\*)(?:minimum|recommended)\b)/im).filter(part => part.trim()) || []
  return <section className="detail-section product-requirements"><h2>System Requirements</h2>
    {markdown ? <div className={sections.length > 1 ? 'requirements-grid' : ''}>
      {sections.map((section, i) => <ProductMarkdown key={i}>{section}</ProductMarkdown>)}
    </div> : <p className="product-empty">System requirements are not available yet.</p>}
  </section>
}
