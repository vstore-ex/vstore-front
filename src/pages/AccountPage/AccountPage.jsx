import { useState } from 'react'
import Pagination from '../../components/Pagination/Pagination'
import addFriendIcon from '../../assets/account/icon-add-friend.svg'
import blockIcon from '../../assets/account/icon-block.svg'
import { accountAchievements, accountGames, accountProfile } from '../../data/account'
import './AccountPage.css'

const GAMES_PER_PAGE = 6

function CompletionBar({ value }) {
  return (
    <div className="account-progress" aria-label={`Completed ${value}%`}>
      <span style={{ width: `${value}%` }} />
    </div>
  )
}

function AchievementStrip({ achievements }) {
  return (
    <section className="account-section account-section--achievements" aria-labelledby="account-achievements-title">
      <div className="account-section__header">
        <h2 id="account-achievements-title">Achievements</h2>
        <button className="account-show-more" type="button">
          Show more
        </button>
      </div>

      <div className="account-achievements">
        {achievements.map((achievement) => (
          <article className="account-achievement" key={achievement.id}>
            <img src={achievement.icon} alt="" />
            <h3>{achievement.title}</h3>
            <p>Completed by {achievement.completion}%</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function GameCollectionCard({ game }) {
  return (
    <article className="account-game-card">
      <img className="account-game-card__cover" src={game.cover} alt="" />

      <div className="account-game-card__content">
        <div className="account-game-card__main">
          <h3>{game.title}</h3>
          <div className="account-game-card__badges" aria-label={`${game.title} achievements`}>
            {game.achievements.map((achievement, index) => (
              <img src={achievement} alt="" key={`${game.id}-achievement-${index}`} />
            ))}
          </div>
        </div>

        <div className="account-game-card__meta">
          <p>{game.hoursPlayed} hours played on record</p>
          <p>Last played: {game.lastPlayed}</p>
        </div>

        <div className="account-game-card__progress">
          <p>Completed: {game.completion}%</p>
          <CompletionBar value={game.completion} />
        </div>
      </div>
    </article>
  )
}

function AccountPage({
  profile = accountProfile,
  achievements = accountAchievements,
  games = accountGames,
}) {
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(games.length / GAMES_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const firstGameIndex = (safeCurrentPage - 1) * GAMES_PER_PAGE
  const currentGames = games.slice(firstGameIndex, firstGameIndex + GAMES_PER_PAGE)

  return (
    <div className="account-page">
      <div className="account-page__inner">
        <div className="account-actions">
          <button className="account-action-button" type="button" aria-label="Add friend">
            <img src={addFriendIcon} alt="" />
          </button>
          <button className="account-action-button" type="button" aria-label="Block user">
            <img src={blockIcon} alt="" />
          </button>
        </div>

        <section className="account-hero" aria-label="Account profile">
          <img className="account-hero__avatar" src={profile.avatar} alt="" />

          <div className="account-hero__identity">
            <p>
              Level <span>{profile.level}</span>
            </p>
            <h1>{profile.nickname}</h1>
          </div>

          <div className="account-hero__stats">
            {profile.stats.map((stat) => (
              <div className="account-stat" key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <AchievementStrip achievements={achievements} />

        <section className="account-section account-section--games" aria-labelledby="account-games-title">
          <h2 id="account-games-title">Game collection</h2>
          <div className="account-games-grid">
            {currentGames.map((game) => (
              <GameCollectionCard game={game} key={game.id} />
            ))}
          </div>
        </section>

        <Pagination
          activeClassName="account-pagination__active"
          ariaLabel="Game collection pages"
          className="account-pagination"
          currentPage={safeCurrentPage}
          onPageChange={setCurrentPage}
          pageSize={GAMES_PER_PAGE}
          totalItems={games.length}
        />
      </div>
    </div>
  )
}

export default AccountPage
