import { useState } from 'react'
import Pagination from '../../components/Pagination/Pagination'
import ResourceStatus from '../../components/Catalog/ResourceStatus'
import { MediaImage } from '../../components/Catalog/Media'
import useCatalogResource from '../../hooks/useCatalogResource'
import './AchievementsPage.css'

const PAGE_SIZE = 11
export default function AchievementsPage({ product }) {
  const [page, setPage] = useState(1)
  const resource = useCatalogResource(
    'achievements',
    JSON.stringify({ id: product.id, page, pageSize: PAGE_SIZE }),
    String(product.id),
  )
  return (
    <div className="achievements-page">
      <div className="achievements-page__inner">
        <a className="catalog-back" href={'#/games/' + encodeURIComponent(product.id)}>
          Back to {product.title}
        </a>
        <h1>Achievements</h1>
        <ResourceStatus resource={resource} label="achievements" />
        {resource.data && (
          <>
            <p className="achievements-page__count">
              Amount of achievements: {resource.data.total}
            </p>
            {!resource.data.items.length && <p>This game has no achievements.</p>}
            <div className="achievements-list">
              {resource.data.items.map((achievement) => (
                <article className="achievement-row" key={achievement.id}>
                  <MediaImage
                    className="achievement-row__icon"
                    src={achievement.icon}
                    alt={achievement.title}
                  />
                  <div className="achievement-row__content">
                    {achievement.completion !== null && (
                      <progress
                        className="achievement-row__fill"
                        value={achievement.completion}
                        max={100}
                        aria-hidden="true"
                      />
                    )}
                    <div className="achievement-row__text">
                      <h2>{achievement.title}</h2>
                      {achievement.description && <p>{achievement.description}</p>}
                    </div>
                    {achievement.completion !== null && (
                      <span className="achievement-row__percent">{achievement.completion}%</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <Pagination
              activeClassName="achievement-pagination__active"
              ariaLabel="Achievements pages"
              className="achievement-pagination"
              currentPage={resource.data.page}
              disabledClassName="achievement-pagination__muted"
              maxVisiblePages={6}
              onPageChange={(value) => {
                if (!resource.loading) setPage(value)
              }}
              pageSize={PAGE_SIZE}
              totalItems={resource.data.total}
            />
          </>
        )}
      </div>
    </div>
  )
}
