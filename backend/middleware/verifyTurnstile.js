const https = require('https');

function verifyTurnstile(token) {
  return new Promise((resolve) => {
    const data = `secret=${process.env.TURNSTILE_SECRET}&response=${token}`;
    const req = https.request({
      hostname: 'challenges.cloudflare.com',
      path: '/turnstile/v0/siteverify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve(result.success === true);
        } catch { resolve(false); }
      });
    });
    req.on('error', () => resolve(false));
    req.write(data);
    req.end();
  });
}

module.exports = async function (req, res, next) {
  const token = req.body.turnstileToken;
  if (!token) {
    return res.status(400).json({ error: 'Turnstile verification required' });
  }
  const valid = await verifyTurnstile(token);
  if (!valid) {
    return res.status(400).json({ error: 'Turnstile verification failed' });
  }
  next();
};
