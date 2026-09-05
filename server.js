const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;

// Storage directories
const DATA_DIR = path.join(__dirname, 'data');
const PLAYERS_DIR = path.join(DATA_DIR, 'players');

// Ensure storage directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(PLAYERS_DIR)) {
  fs.mkdirSync(PLAYERS_DIR, { recursive: true });
}

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

/* ==========================================================================
   PASSWORD HASHING & SECURITY (Native Node.js Crypto)
   ========================================================================== */

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, storedHash, storedSalt) {
  try {
    const hash = crypto.scryptSync(password, storedSalt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch (e) {
    return false;
  }
}

function getSafeFilename(email) {
  return email.toLowerCase().trim().replace(/[^a-z0-9]/g, '_') + '.json';
}

function getPlayerFilePath(email) {
  return path.join(PLAYERS_DIR, getSafeFilename(email));
}

/* ==========================================================================
   DATABASE & FOLDER STORAGE HELPERS
   ========================================================================== */

function loadAllPlayers() {
  if (!fs.existsSync(PLAYERS_DIR)) return [];
  const files = fs.readdirSync(PLAYERS_DIR).filter((f) => f.endsWith('.json'));
  const players = [];
  for (const f of files) {
    try {
      const raw = fs.readFileSync(path.join(PLAYERS_DIR, f), 'utf8');
      const p = JSON.parse(raw);
      if (p && p.email && p.ign) {
        players.push(p);
      }
    } catch (e) {
      console.warn(`Error reading player file ${f}:`, e);
    }
  }
  return players;
}

function updateSignupsIndex() {
  const players = loadAllPlayers();
  const summary = {
    totalSignups: players.length,
    lastUpdated: new Date().toISOString(),
    players: players.map((p) => ({
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

  try {
    fs.writeFileSync(path.join(DATA_DIR, 'signups.json'), JSON.stringify(summary, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing signups.json:', err);
  }
  return summary;
}

// Initial index creation on startup
updateSignupsIndex();

/* ==========================================================================
   HTTP REQUEST & RESPONSE HELPERS
   ========================================================================== */

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function readJsonBody(req, callback) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 1e6) {
      req.connection.destroy(); // 1MB limit
    }
  });
  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {};
      callback(null, data);
    } catch (err) {
      callback(err, null);
    }
  });
}

/* ==========================================================================
   MAIN HTTP SERVER DISPATCHER
   ========================================================================== */

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

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
     API ROUTES: /api/auth/*, /api/leaderboard, /api/score, /api/signups
     ========================================================================== */

  // POST /api/auth/signup
  if (req.method === 'POST' && pathname === '/api/auth/signup') {
    readJsonBody(req, (err, data) => {
      if (err) {
        return sendJson(res, 400, { error: 'Invalid JSON request payload' });
      }

      const email = (data.email || '').trim().toLowerCase();
      const password = (data.password || '').trim();
      const ign = (data.ign || '').trim();

      // Validation
      if (!email || !email.includes('@')) {
        return sendJson(res, 400, { error: 'Please enter a valid Gmail address.' });
      }
      if (!password || password.length < 4) {
        return sendJson(res, 400, { error: 'Password must be at least 4 characters long.' });
      }
      if (!ign || ign.length < 2 || ign.length > 16) {
        return sendJson(res, 400, { error: 'In-Game Name (IGN) must be between 2 and 16 characters.' });
      }

      const filePath = getPlayerFilePath(email);
      if (fs.existsSync(filePath)) {
        return sendJson(res, 409, {
          error: 'An account with this Gmail already exists. Please log in with your password instead!'
        });
      }

      // Check if IGN is already taken by another registered player
      const existingPlayers = loadAllPlayers();
      const ignTaken = existingPlayers.some((p) => p.ign.toLowerCase() === ign.toLowerCase());
      if (ignTaken) {
        return sendJson(res, 409, {
          error: `The In-Game Name "${ign}" is already taken. Please choose a unique name!`
        });
      }

      // Hash password securely with random salt
      const { salt, hash } = hashPassword(password);
      const newPlayer = {
        id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        email,
        ign,
        salt,
        hash,
        signupDate: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        highestScore: 0,
        timeSurvived: '0:00',
        gamesPlayed: 0
      };

      try {
        fs.writeFileSync(filePath, JSON.stringify(newPlayer, null, 2), 'utf8');
        updateSignupsIndex();

        return sendJson(res, 201, {
          success: true,
          message: 'Account registered successfully! Welcome to Catch the Stars.',
          user: {
            id: newPlayer.id,
            email: newPlayer.email,
            ign: newPlayer.ign,
            highestScore: 0,
            timeSurvived: '0:00',
            gamesPlayed: 0
          }
        });
      } catch (saveErr) {
        console.error('Error saving new player file:', saveErr);
        return sendJson(res, 500, { error: 'Server error saving account data.' });
      }
    });
    return;
  }

  // POST /api/auth/login
  if (req.method === 'POST' && pathname === '/api/auth/login') {
    readJsonBody(req, (err, data) => {
      if (err) {
        return sendJson(res, 400, { error: 'Invalid JSON request payload' });
      }

      const email = (data.email || '').trim().toLowerCase();
      const password = (data.password || '').trim();

      if (!email || !password) {
        return sendJson(res, 400, { error: 'Please enter both your Gmail and password.' });
      }

      const filePath = getPlayerFilePath(email);
      if (!fs.existsSync(filePath)) {
        return sendJson(res, 404, {
          error: 'No account found with this Gmail. Please sign up to create your account!'
        });
      }

      let player;
      try {
        player = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (readErr) {
        return sendJson(res, 500, { error: 'Failed to read account data.' });
      }

      // Verify password
      const isMatch = verifyPassword(password, player.hash, player.salt);
      if (!isMatch) {
        return sendJson(res, 401, { error: 'Incorrect password. Please check your password and try again.' });
      }

      // Update lastLogin timestamp
      player.lastLogin = new Date().toISOString();
      try {
        fs.writeFileSync(filePath, JSON.stringify(player, null, 2), 'utf8');
        updateSignupsIndex();
      } catch (updateErr) {
        console.warn('Could not update lastLogin:', updateErr);
      }

      return sendJson(res, 200, {
        success: true,
        message: `Welcome back, ${player.ign}!`,
        user: {
          id: player.id,
          email: player.email,
          ign: player.ign,
          highestScore: player.highestScore || 0,
          timeSurvived: player.timeSurvived || '0:00',
          gamesPlayed: player.gamesPlayed || 0
        }
      });
    });
    return;
  }

  // GET /api/leaderboard (Strictly Real Registered Players)
  if (req.method === 'GET' && pathname === '/api/leaderboard') {
    const players = loadAllPlayers();

    // Sort descending by highest score, then time
    const sorted = players
      .map((p) => ({
        ign: p.ign,
        email: p.email,
        score: p.highestScore || 0,
        time: p.timeSurvived || '0:00',
        gamesPlayed: p.gamesPlayed || 0,
        signupDate: p.signupDate
      }))
      .sort((a, b) => b.score - a.score);

    return sendJson(res, 200, {
      totalRegistered: players.length,
      leaderboard: sorted
    });
  }

  // POST /api/score
  if (req.method === 'POST' && pathname === '/api/score') {
    readJsonBody(req, (err, data) => {
      if (err) {
        return sendJson(res, 400, { error: 'Invalid JSON request payload' });
      }

      const email = (data.email || '').trim().toLowerCase();
      const score = parseInt(data.score, 10) || 0;
      const timeSurvived = (data.timeSurvived || '0:00').trim();

      if (!email) {
        return sendJson(res, 400, { error: 'Email is required to record score.' });
      }

      const filePath = getPlayerFilePath(email);
      if (!fs.existsSync(filePath)) {
        return sendJson(res, 404, { error: 'Player account not found.' });
      }

      try {
        const player = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        player.gamesPlayed = (player.gamesPlayed || 0) + 1;
        player.lastActive = new Date().toISOString();

        let isNewHigh = false;
        if (score > (player.highestScore || 0)) {
          player.highestScore = score;
          player.timeSurvived = timeSurvived;
          isNewHigh = true;
        }

        fs.writeFileSync(filePath, JSON.stringify(player, null, 2), 'utf8');
        updateSignupsIndex();

        // Calculate current rank among all real players
        const all = loadAllPlayers().sort((a, b) => (b.highestScore || 0) - (a.highestScore || 0));
        const rankIndex = all.findIndex((p) => p.email.toLowerCase() === email);
        const rank = rankIndex >= 0 ? rankIndex + 1 : '-';

        return sendJson(res, 200, {
          success: true,
          isNewHigh,
          highestScore: player.highestScore,
          timeSurvived: player.timeSurvived,
          rank,
          totalPlayers: all.length
        });
      } catch (scoreErr) {
        console.error('Error recording score:', scoreErr);
        return sendJson(res, 500, { error: 'Failed to record score on server.' });
      }
    });
    return;
  }

  // GET /api/signups (View count and details of registered players)
  if (req.method === 'GET' && pathname === '/api/signups') {
    const summary = updateSignupsIndex();
    return sendJson(res, 200, summary);
  }

  /* ==========================================================================
     STATIC FILE SERVING (HTML, CSS, JS, Assets)
     ========================================================================== */
  let reqPath = pathname;
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  // Prevent directory traversal
  const safeRelPath = reqPath.replace(/^\/+/, '');
  let filePath = path.resolve(__dirname, safeRelPath);

  // Reject paths resolving outside workspace
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
  console.log(`Registered player records stored in: ${PLAYERS_DIR}`);
});
