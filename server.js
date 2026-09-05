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
  '/api/player/change-ign': require('./api/player/change-ign.js')
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
