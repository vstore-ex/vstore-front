import { MediaImage } from '../Catalog/Media'
import './News.css'
export function NewsDate({ value }) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return null
  return <time dateTime={date.toISOString()}>{date.toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
}
function excerpt(markdown = '') {
  return markdown.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<[^>]*>/g, '')
    .replace(/[#*_~>`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 220)
}
export default function NewsCard({ item }) {
  return <article className="news-card"><a href={'#/news/' + encodeURIComponent(item.id)}>
    <MediaImage className="news-card__banner" src={item.banner_url} alt="" />
    <div className="news-card__content"><NewsDate value={item.published_at} />
      <h3>{item.title}</h3><p>{excerpt(item.content_md)}</p><span className="news-card__more">Read more</span>
    </div>
  </a></article>
}
