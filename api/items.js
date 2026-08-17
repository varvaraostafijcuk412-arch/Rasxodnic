export default async function handler(req, res) {
  const { APPS_SCRIPT_URL } = process.env;

  if (!APPS_SCRIPT_URL) {
    return res.status(500).json({ ok: false, error: 'missing_apps_script_url_env' });
  }

  try {
    if (req.method === 'GET') {
      const resp = await fetch(APPS_SCRIPT_URL);
      const data = await resp.json();
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const bodyText = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const resp = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: bodyText
      });
      const data = await resp.json();
      return res.status(200).json(data);
    }

    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
