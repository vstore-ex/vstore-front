export function validateRegistration(form) {
  const errors = {}
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const phonePattern = /^\+?[0-9\s\-()]{7,20}$/

  if (form.username.trim().length < 3) {
    errors.username = 'Username must be at least 3 characters.'
  }

  if (!emailPattern.test(form.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }

  if (form.password.length < 6) {
    errors.password = 'Password must be at least 6 characters.'
  }

  if (form.full_name.trim().length < 2) {
    errors.full_name = 'Full name is required.'
  }

  if (!phonePattern.test(form.phone.trim())) {
    errors.phone = 'Enter a valid phone number.'
  }

  return errors
}

export function validateLogin(form) {
  const errors = {}

  if (form.username.trim().length < 3) {
    errors.username = 'Username must be at least 3 characters.'
  }

  if (!form.password) {
    errors.password = 'Password is required.'
  }

  return errors
}
