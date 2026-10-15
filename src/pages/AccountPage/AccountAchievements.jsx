import ResourceStatus from '../../components/Catalog/ResourceStatus'
import { MediaImage } from '../../components/Catalog/Media'
function UnlockDate({ value }) {
  const date = new Date(value)
  return value && !Number.isNaN(date.getTime()) ? <p>Unlocked <time dateTime={value}>{date.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })}</time></p> : null
}
export default function AccountAchievements({ resource, userId }) {
  return <section className="account-section account-unlocked" aria-labelledby="account-achievements-title">
    <div className="account-section__header"><h2 id="account-achievements-title">Recent achievements</h2>
      {resource.data?.length > 6 && <a href={'#/users/' + encodeURIComponent(userId)} className="account-show-more">View all ({resource.data.length})</a>}</div>
    <ResourceStatus resource={resource} label="your achievements" />
    {resource.data?.length === 0 && <p>No achievements unlocked yet.</p>}
    <div className="account-unlocked__grid">{resource.data?.slice(0, 6).map(item => <article className="account-unlocked__card" key={item.id}>
      <MediaImage src={item.icon} alt="" className="account-unlocked__icon" />
      <div><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}<UnlockDate value={item.unlocked_at} />
        {item.game_id != null && <a href={'#/games/' + encodeURIComponent(item.game_id) + '/achievements'}>View game achievements</a>}</div>
    </article>)}</div>
  </section>
}
