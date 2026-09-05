/**
 * Catch the Stars - Local HTTP Server & Static File Host
 * Routes API endpoints to dedicated handlers in ./api/ with 100% parity to Vercel.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;

// Route dispatch map
const API_ROUTES = {
  '/api/leaderboard': require('./api/leaderboard.js'),
  '/api/score': require('./api/score.js'),
  '/api/signups': require('./api/signups.js'),
  '/api/auth/signup': require('./api/auth/signup.js'),
  '/api/auth/login': require('./api/auth/login.js'),
  '/api/player/change-ign': require('./api/player/change-ign.js'),
  '/api/sync': require('./api/sync.js')
};

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname.replace(/\/+$/, '') || '/';

  // Check API route
  if (API_ROUTES[pathname]) {
    API_ROUTES[pathname](req, res);
    return;
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  /* ==========================================================================
     STATIC FILE SERVING (HTML, CSS, JS, Assets)
     ========================================================================== */
  let reqPath = urlObj.pathname;
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const safeRelPath = reqPath.replace(/^\/+/, '');

  // Look in public/ directory first, then root fallback
  let filePath = path.resolve(__dirname, 'public', safeRelPath);
  if (!fs.existsSync(filePath)) {
    filePath = path.resolve(__dirname, safeRelPath);
  }

  // Reject paths outside workspace
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + reqPath);
      return;
    }

    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*'
        });
        res.end(content);
      }
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Catch the Stars server running at http://localhost:${PORT}/`);
});

// Auto-sync player files from Vercel Cloud into local folder every 30s
function autoSyncFromCloud() {
  const https = require('https');
  const syncDataDir = path.join(__dirname, 'data');
  const syncPlayersDir = path.join(syncDataDir, 'players');

  https.get('https://falling-stars-mu.vercel.app/api/sync', (res) => {
    let raw = '';
    res.on('data', c => raw += c);
    res.on('end', () => {
      try {
        const data = JSON.parse(raw);
        if (data && data.success && Array.isArray(data.rawPlayers)) {
          if (!fs.existsSync(syncDataDir)) fs.mkdirSync(syncDataDir, { recursive: true });
          if (!fs.existsSync(syncPlayersDir)) fs.mkdirSync(syncPlayersDir, { recursive: true });

          data.rawPlayers.forEach((p) => {
            const sanitized = p.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
            const filePath = path.join(syncPlayersDir, `${sanitized}.json`);
            fs.writeFileSync(filePath, JSON.stringify(p, null, 2), 'utf8');
          });

          const signupsSummary = {
            totalSignups: data.rawPlayers.length,
            lastUpdated: new Date().toISOString(),
            players: data.rawPlayers.map(p => ({
              id: p.id,
              email: p.email,
              ign: p.ign,
              signupDate: p.signupDate,
              highestScore: p.highestScore || 0,
              timeSurvived: p.timeSurvived || '0:00',
              gamesPlayed: p.gamesPlayed || 0,
              lastLogin: p.lastLogin || p.signupDate
            }))
          };
          fs.writeFileSync(path.join(syncDataDir, 'signups.json'), JSON.stringify(signupsSummary, null, 2), 'utf8');
        }
      } catch (e) {}
    });
  }).on('error', () => {});
}

autoSyncFromCloud();
setInterval(autoSyncFromCloud, 30000);
