// GET /api/status : indique si le mode « données réelles » est disponible (aucun secret renvoyé).
import { configured } from './_lib/config.js';

export default function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  res.status(200).json({ liveAvailable: Boolean(process.env.DASHBOARD_PASSWORD), sources: configured() });
}
