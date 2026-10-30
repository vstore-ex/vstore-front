import { apiRequest } from './client'

const path = '/users/me/email-news-preferences'

export function getEmailNewsPreferences(options = {}) {
  return apiRequest(path, options)
}

export function updateEmailNewsPreferences(preferences) {
  return apiRequest(path, { method: 'PATCH', body: preferences })
}
