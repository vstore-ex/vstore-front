export const MIN_PASSWORD_CHARACTERS = 12
export const MAX_PASSWORD_BYTES = 72

export function passwordValidationError(password) {
  if ([...password].length < MIN_PASSWORD_CHARACTERS) {
    return `Password must be at least ${MIN_PASSWORD_CHARACTERS} characters.`
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return `Password must be no more than ${MAX_PASSWORD_BYTES} bytes when encoded as UTF-8.`
  }
  return ''
}
