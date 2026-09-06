const ALLOWED = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const target = String(req.query.url || '');
  try {
    const u = new URL(target);
    if (!ALLOWED.includes(u.hostname)) return res.status(403).json({ error: 'host not allowed' });
    const r = await fetch(target, {
      headers: { 'User-Agent': UA, Accept: 'application/json,text/plain,*/*' },
    });
    const text = await r.text();
    res.setHeader('Content-Type', r.headers.get('content-type') || 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(r.status).send(text);
  } catch {
    return res.status(400).json({ error: 'invalid url' });
  }
}