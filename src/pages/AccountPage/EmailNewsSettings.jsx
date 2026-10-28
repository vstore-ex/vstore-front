import { useEffect, useState } from 'react'
import { getEmailNewsPreferences, updateEmailNewsPreferences } from '../../api/newsPreferences'

const initialPreferences = {
  email_news_notifications: false,
  email_owned_game_news_notifications: false,
}

export default function EmailNewsSettings() {
  const [preferences, setPreferences] = useState(null)
  const [draft, setDraft] = useState(initialPreferences)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    getEmailNewsPreferences({ signal: controller.signal })
      .then((response) => {
        if (!active) return
        setPreferences(response)
        setDraft(response)
      })
      .catch((reason) => {
        if (active && !controller.signal.aborted) setError(reason.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [loadAttempt])

  async function save(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const updated = await updateEmailNewsPreferences(draft)
      setPreferences(updated)
      setDraft(updated)
      setMessage('Email preferences saved.')
    } catch (reason) {
      setError(reason.message || 'Could not save email preferences.')
    } finally {
      setSaving(false)
    }
  }

  const changed =
    preferences &&
    (preferences.email_news_notifications !== draft.email_news_notifications ||
      preferences.email_owned_game_news_notifications !== draft.email_owned_game_news_notifications)

  return (
    <section className="account-section email-news-settings">
      <h2>Email notifications</h2>
      {loading ? (
        <p role="status">Loading email preferences...</p>
      ) : error && !preferences ? (
        <div role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              setError('')
              setLoadAttempt((attempt) => attempt + 1)
            }}
          >
            Retry
          </button>
        </div>
      ) : (
        <form className="store-form" onSubmit={save}>
          <p>
            Choose which VStore news to receive. Only verified email addresses are used; if both
            options apply, an article is emailed once.
          </p>
          <label className="email-news-setting">
            <input
              className="email-news-setting__checkbox"
              type="checkbox"
              checked={draft.email_news_notifications}
              disabled={saving}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  email_news_notifications: event.target.checked,
                }))
              }
            />
            <span>Email me about every published news article</span>
          </label>
          <label className="email-news-setting">
            <input
              className="email-news-setting__checkbox"
              type="checkbox"
              checked={draft.email_owned_game_news_notifications}
              disabled={saving}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  email_owned_game_news_notifications: event.target.checked,
                }))
              }
            />
            <span>Email me about news for games I own</span>
          </label>
          <button className="button button--accent" type="submit" disabled={saving || !changed}>
            {saving ? 'Saving...' : 'Save email preferences'}
          </button>
          {error && (
            <p className="store-form__error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="store-form__status" role="status">
              {message}
            </p>
          )}
        </form>
      )}
    </section>
  )
}
