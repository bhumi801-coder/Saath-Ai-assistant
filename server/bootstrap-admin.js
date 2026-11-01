// Creates (or updates) the administrator account at start-up from two environment variables,
// so a host without a shell (for example Render's free plan) can still get an admin:
//   ADMIN_EMAIL=you@example.com
//   ADMIN_PASSWORD=a-long-password-of-10-or-more-characters
//   ADMIN_NAME=Your Name            (optional)
// Without both variables nothing happens. The password is stored hashed and never printed.
// Runs on every start, so it also restores the admin if the database was rebuilt.
import bcrypt from 'bcryptjs';
import { db } from './db.js';

export function bootstrapAdmin(env = process.env) {
  const email = String(env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(env.ADMIN_PASSWORD || '');
  if (!email && !password) return false;
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 10) {
    console.warn('[saath] ADMIN_EMAIL / ADMIN_PASSWORD ignored: use a valid email and a password of at least 10 characters.');
    return false;
  }
  const name = String(env.ADMIN_NAME || '').trim().slice(0, 80) || 'Saath admin';
  const hash = bcrypt.hashSync(password, 10);
  const existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(email);
  if (existing) {
    db.prepare('UPDATE admins SET password_hash = ?, name = ? WHERE id = ?').run(hash, name, existing.id);
    console.log(`[saath] Admin ${email} is ready (password updated from ADMIN_PASSWORD).`);
  } else {
    db.prepare('INSERT INTO admins (name, email, password_hash) VALUES (?,?,?)').run(name, email, hash);
    console.log(`[saath] Admin ${email} created. Log in at /admin/login.`);
  }
  return true;
}
