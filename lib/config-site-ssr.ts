import { getAdminDb } from './firebase-admin';
import { DEFAULTS } from './config-site';
import type { SiteConfig } from './config-site';

export async function getConfigSSR(): Promise<SiteConfig> {
  try {
    const db = getAdminDb();
    if (!db) return { ...DEFAULTS };
    const snap = await db.collection('config').doc('site').get();
    return snap.exists ? { ...DEFAULTS, ...snap.data() } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}
