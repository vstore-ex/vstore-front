import arrow from '../../assets/product-arrow-right.svg'
import useCatalogResource from '../../hooks/useCatalogResource'
import { MediaImage } from '../../components/Catalog/Media'
import ResourceStatus from '../../components/Catalog/ResourceStatus'

export default function ProductAchievements({ id, onViewAll }) {
  const resource = useCatalogResource('achievements', JSON.stringify({ id, pageSize: 6 }))
  return <section className="detail-section product-achievements">
    <h2>Achievements</h2>
    <ResourceStatus resource={resource} label="achievements" />
    {resource.data && (resource.data.items.length ? <>
      <div className="achievement-grid">{resource.data.items.map(item => <article className="achievement-card" key={item.id}>
        <MediaImage src={item.icon} alt={item.title} />
        <h3 title={item.title}>{item.title}</h3>
        {item.completion !== null && <p>Completed by {item.completion}%</p>}
      </article>)}</div>
      <button className="product-text-button product-achievements__more" type="button" onClick={onViewAll}>Show more <img src={arrow} alt="" /></button>
    </> : <p className="product-empty">No achievements available yet.</p>)}
  </section>
}
