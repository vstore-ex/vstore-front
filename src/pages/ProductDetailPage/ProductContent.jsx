import { useEffect, useId, useRef, useState } from 'react'
import Markdown, { defaultUrlTransform } from 'react-markdown'
import { MediaImage } from '../../components/Catalog/Media'
import { mediaUrl } from '../../api/catalog'
import { parseRequirements } from './requirements'
import chevron from '../../assets/product-chevron-down.svg'

function MarkdownLink({ href, children }) {
  let external = false
  try {
    const url = new URL(href, window.location.href)
    external = ['http:', 'https:'].includes(url.protocol) && url.origin !== window.location.origin
  } catch {
    /* Invalid destinations remain subject to Markdown's URL sanitizer. */
  }
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  )
}

const markdownComponents = {
  a: MarkdownLink,
  img: ({ src, alt }) => <MediaImage src={src} alt={alt} />,
}
export function ProductMarkdown({ children, allowImages = true }) {
  return (
    <div className="product-markdown">
      <Markdown
        disallowedElements={allowImages ? undefined : ['img']}
        components={markdownComponents}
        urlTransform={(url, key) => (key === 'src' ? mediaUrl(url) : defaultUrlTransform(url))}
      >
        {typeof children === 'string' ? children : ''}
      </Markdown>
    </div>
  )
}

export function ExpandableContent({ children, className = '', variant = 'review' }) {
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const content = useRef(null)
  const viewport = useRef(null)
  const contentId = useId()
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const limit = Number.parseFloat(
        getComputedStyle(viewport.current).getPropertyValue('--content-limit'),
      )
      setOverflows(entry.contentRect.height > limit)
    })
    observer.observe(content.current)
    return () => observer.disconnect()
  }, [variant])
  return (
    <div className={className}>
      <div
        ref={viewport}
        id={contentId}
        className={`product-content product-content--${variant}${overflows && !expanded ? ' product-content-collapsed' : ''}`}
      >
        <div ref={content}>{children}</div>
      </div>
      {overflows && (
        <button
          type="button"
          className="product-text-button product-expand"
          aria-controls={contentId}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : 'Show more'} <img src={chevron} alt="" />
        </button>
      )}
    </div>
  )
}

export function Requirements({ value }) {
  const parsed = parseRequirements(value)
  const markdown = parsed.markdown || ''
  const parts = markdown
    .split(/(?=^(?:#{1,6}\s+|\*\*)(?:minimum|recommended)\b)/im)
    .filter((part) => part.trim())
  return (
    <section className="detail-section product-requirements">
      <h2>System Requirements</h2>
      {parsed.sections.length ? (
        <div className="requirements-grid">
          {parsed.sections.map((section, index) => (
            <div key={index}>
              {section.title && <h3>{section.title}</h3>}
              <dl className="requirements-values">
                {section.rows.map((row, i) => (
                  <div key={i}>
                    {row.label && <dt>{row.label}:</dt>}
                    <dd>{row.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      ) : markdown ? (
        <div className={parts.length > 1 ? 'requirements-grid' : ''}>
          {parts.map((part, i) => (
            <ProductMarkdown key={i}>{part}</ProductMarkdown>
          ))}
        </div>
      ) : (
        <p className="product-empty">System requirements are not available yet.</p>
      )}
    </section>
  )
}
