import { useState } from 'react'
import Pagination from '../../components/Pagination/Pagination'
import './AchievementsPage.css'

const ACHIEVEMENTS_PER_PAGE = 11
const FALLBACK_ACHIEVEMENT_TEMPLATES = [
  ['First steps', 'Launch the game for the first time', 95],
  ['Getting started', 'Complete the opening challenge', 88],
  ['Explorer', 'Visit every major area', 76],
  ['Collector', 'Find a rare item', 64],
  ['Perfect run', 'Finish a stage without mistakes', 52],
  ['Team player', 'Help another player complete a task', 43],
  ['Secret found', 'Discover a hidden objective', 35],
  ['Halfway there', 'Complete half of the available goals', 28],
  ['Sharpshooter', 'Win a difficult encounter', 20],
  ['No fear', 'Survive a dangerous situation', 15],
  ['Completionist', 'Finish every core objective', 10],
]

function normalizeAchievement(achievement, index, fallbackImage) {
  if (typeof achievement === 'string') {
    return {
      id: achievement,
      title: achievement,
      description: '',
      completion: Math.max(10, 95 - index * 8),
      icon: fallbackImage,
    }
  }

  return {
    icon: fallbackImage,
    completion: Math.max(10, 95 - index * 8),
    description: '',
    ...achievement,
  }
}

function AchievementRow({ achievement }) {
  const progress = Math.max(0, Math.min(100, achievement.completion))

  return (
    <article className="achievement-row">
      <img className="achievement-row__icon" src={achievement.icon} alt="" />

      <div className="achievement-row__content">
        <div className="achievement-row__fill" style={{ width: `${progress}%` }} aria-hidden="true" />
        <div className="achievement-row__text">
          <h2>{achievement.title}</h2>
          {achievement.description && <p>{achievement.description}</p>}
        </div>
        <span className="achievement-row__percent">{progress}%</span>
      </div>
    </article>
  )
}

function buildAchievementList(product, detail) {
  const sourceAchievements = detail.achievements?.length
    ? detail.achievements
    : FALLBACK_ACHIEVEMENT_TEMPLATES.map(([title, description, completion]) => ({
        id: `${product.id}-${title.toLowerCase().replace(/\s+/g, '-')}`,
        title,
        description,
        completion,
        icon: product.iconImage || product.image,
      }))
  const baseAchievements = sourceAchievements.map((achievement, index) =>
    normalizeAchievement(achievement, index, product.iconImage || product.image),
  )
  const amount = detail.achievementsCount ?? (detail.achievements?.length ? baseAchievements.length : 11)

  if (!baseAchievements.length || amount <= baseAchievements.length) {
    return baseAchievements
  }

  return Array.from({ length: amount }, (_, index) => {
    const source = baseAchievements[index % baseAchievements.length]
    const pageIndex = Math.floor(index / baseAchievements.length)

    return {
      ...source,
      id: `${source.id ?? source.title}-${index}`,
      completion: Math.max(1, source.completion - pageIndex * 4),
    }
  })
}

function AchievementsPage({ product }) {
  const [currentPage, setCurrentPage] = useState(1)
  const detail = product.detail ?? {}
  const achievements = buildAchievementList(product, detail)
  const amount = detail.achievementsCount ?? achievements.length
  const totalPages = Math.max(1, Math.ceil(achievements.length / ACHIEVEMENTS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const firstAchievementIndex = (safeCurrentPage - 1) * ACHIEVEMENTS_PER_PAGE
  const currentAchievements = achievements.slice(
    firstAchievementIndex,
    firstAchievementIndex + ACHIEVEMENTS_PER_PAGE,
  )

  return (
    <div className="achievements-page">
      <div className="achievements-page__inner">
        <h1>Achievements</h1>
        <p className="achievements-page__count">Amount of achievements: {amount}</p>

        <div className="achievements-list">
          {currentAchievements.map((achievement) => (
            <AchievementRow achievement={achievement} key={achievement.id ?? achievement.title} />
          ))}
        </div>

        <Pagination
          activeClassName="achievement-pagination__active"
          ariaLabel="Achievements pages"
          className="achievement-pagination"
          currentPage={safeCurrentPage}
          disabledClassName="achievement-pagination__muted"
          maxVisiblePages={6}
          onPageChange={setCurrentPage}
          pageSize={ACHIEVEMENTS_PER_PAGE}
          totalItems={achievements.length}
        />
      </div>
    </div>
  )
}

export default AchievementsPage
