const ID_DOMAIN = 'players.max.invalid';

export function normalizeUsername(value) {
  const name = String(value).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{2,23}$/.test(name)) {
    throw new Error('Use 3–24 characters: a–z, numbers, hyphens or underscores. Start with a letter or number.');
  }
  return name;
}

export function credentials(username, password) {
  const name = normalizeUsername(username);
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new Error('Your password must contain 8–128 characters.');
  }
  return { email: `${name}@${ID_DOMAIN}`, password };
}

export function playerName(user) {
  const email = user?.email || '', local = email.split('@')[0] || '';
  if (user?.is_anonymous || local.startsWith('autoguest_')) return 'Guest';
  return email.endsWith(`@${ID_DOMAIN}`) ? local : 'Player';
}

export function accountError(error) {
  const code = error?.code;
  if (['invalid_credentials', 'user_not_found'].includes(code)) return 'The username or password is incorrect.';
  if (code === 'user_already_exists') return 'That username is taken. Try another, or sign in.';
  if (code === 'weak_password') return 'Choose a stronger password with at least 8 characters.';
  if (['over_request_rate_limit', 'over_email_send_rate_limit'].includes(code) || error?.status === 429) return 'Too many attempts. Wait a moment and try again.';
  if (['PT409', '40001', '23505'].includes(code)) return 'Another device has saved since your last check. Refresh the save status before choosing what to keep.';
  if (code === 'email_not_confirmed' || code === 'confirmation_enabled') return 'Sign-in is not ready yet. You can still play as a guest.';
  if (['PGRST205', 'PGRST202', '42P01'].includes(code)) return 'Cloud saves are not ready yet. Your game is still on this device.';
  if (error?.name === 'AuthRetryableFetchError' || error instanceof TypeError) return 'Could not connect. Check your connection and try again.';
  return 'That did not work. Try again; your game is still on this device.';
}
