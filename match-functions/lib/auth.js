// Every /api route except /api/config needs a Firebase Auth ID token from the project's existing Auth.
// Any signed-in user with an account is allowed (no role check yet). Review Page link-only guests
// (anonymous sign-in) are refused.
import { getAuth } from 'firebase-admin/auth';

// Local testing only: MATCH_AUTH_DISABLED=1 in .env. Ignored when running in Cloud Functions (K_SERVICE is set).
export const authDisabled = () => process.env.MATCH_AUTH_DISABLED === '1' && !process.env.K_SERVICE;

export async function requireAuth(req, res, next) {
  if (authDisabled()) return next();
  const m = /^Bearer (.+)$/.exec(req.get('Authorization') || '');
  if (!m) return res.status(401).json({ error: 'Sign in required' });
  try {
    const user = await getAuth().verifyIdToken(m[1]);
    if (user.firebase?.sign_in_provider === 'anonymous') return res.status(403).json({ error: 'Guests cannot use Match' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Sign in required' });
  }
}
