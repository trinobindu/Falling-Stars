/**
 * Catch the Stars - Serverless API Function
 * Compatible with Vercel Serverless Functions and local Node.js server.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Determine writable data directory (local or /tmp for Vercel serverless)
function getStorageDirs() {
  const localDataDir = path.join(process.cwd(), 'data');
  const isVercel = Boolean(process.env.VERCEL);

  let isLocalWritable = false;
  if (!isVercel) {
    try {
      if (!fs.existsSync(localDataDir)) {
        fs.mkdirSync(localDataDir, { recursive: true });
      }
      const testFile = path.join(localDataDir, '.test_write');
      fs.writeFileSync(testFile, 'test', 'utf8');
      fs.unlinkSync(testFile);
      isLocalWritable = true;
    } catch (e) {
      isLocalWritable = false;
    }
  }

  if (isLocalWritable) {
    const playersDir = path.join(localDataDir, 'players');
    if (!fs.existsSync(playersDir)) {
      fs.mkdirSync(playersDir, { recursive: true });
    }
    return { dataDir: localDataDir, playersDir };
  }

  // Serverless / read-only fallback: use /tmp
  const tmpDataDir = path.join('/tmp', 'falling-stars-data');
  const tmpPlayersDir = path.join(tmpDataDir, 'players');

  if (!fs.existsSync(tmpPlayersDir)) {
    fs.mkdirSync(tmpPlayersDir, { recursive: true });
    // Seed from committed data files
    try {
      const seedPlayersDir = path.join(process.cwd(), 'data', 'players');
      if (fs.existsSync(seedPlayersDir)) {
        const files = fs.readdirSync(seedPlayersDir);
        files.forEach((f) => {
          if (f.endsWith('.json')) {
            fs.copyFileSync(path.join(seedPlayersDir, f), path.join(tmpPlayersDir, f));
          }
        });
      }
      const seedSignups = path.join(process.cwd(), 'data', 'signups.json');
      if (fs.existsSync(seedSignups)) {
        fs.copyFileSync(seedSignups, path.join(tmpDataDir, 'signups.json'));
      }
    } catch (seedErr) {
      console.warn('Notice: Seeding /tmp data:', seedErr.message);
    }
  }

  return { dataDir: tmpDataDir, playersDir: tmpPlayersDir };
}

// Password cryptography
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, storedHash, salt) {
  try {
    const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
    const a = Buffer.from(testHash, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (err) {
    return false;
  }
}

// File path helper
function getPlayerFilePath(email, playersDir) {
  const sanitized = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return path.join(playersDir, sanitized + '.json');
}

// Load all players
function loadAllPlayers(playersDir) {
  const players = [];
  if (!fs.existsSync(playersDir)) return players;
  const files = fs.readdirSync(playersDir);
  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const content = fs.readFileSync(path.join(playersDir, file), 'utf8');
        const p = JSON.parse(content);
        if (p && p.email && p.ign) {
          players.push(p);
        }
      } catch (err) {
        // Skip invalid file
      }
    }
  }
  return players;
}

// Update signups index
function updateSignupsIndex(dataDir, playersDir) {
  const players = loadAllPlayers(playersDir);
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
    fs.writeFileSync(path.join(dataDir, 'signups.json'), JSON.stringify(summary, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing signups.json:', err);
  }
  return summary;
}

// Response helper
function sendJson(res, statusCode, data) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(statusCode).json(data);
  }

  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

// Request body reader (supports pre-parsed Vercel body & raw Node streams)
function parseBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      return resolve(req.body);
    }
    if (typeof req.body === 'string') {
      try {
        return resolve(JSON.parse(req.body));
      } catch (e) {
        return reject(new Error('Invalid JSON'));
      }
    }

    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        req.connection.destroy();
      }
    });
    req.on('end', () => {
      try {
        const data = raw ? JSON.parse(raw) : {};
        resolve(data);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// Main Serverless Handler
module.exports = async function handler(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(204).end();
    }
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  const { dataDir, playersDir } = getStorageDirs();
  const host = req.headers.host || 'localhost';
  const urlObj = new URL(req.url, 'http://' + host);
  const pathname = urlObj.pathname.replace(/\/+$/, '') || '/';

  // POST /api/auth/signup
  if (req.method === 'POST' && pathname === '/api/auth/signup') {
    let data;
    try {
      data = await parseBody(req);
    } catch (err) {
      return sendJson(res, 400, { error: 'Invalid JSON request payload' });
    }

    const email = (data.email || '').trim().toLowerCase();
    const password = (data.password || '').trim();
    const ign = (data.ign || '').trim();

    if (!email || !email.includes('@')) {
      return sendJson(res, 400, { error: 'Please enter a valid Gmail address.' });
    }
    if (!password || password.length < 4) {
      return sendJson(res, 400, { error: 'Password must be at least 4 characters long.' });
    }
    if (!ign || ign.length < 2 || ign.length > 16) {
      return sendJson(res, 400, { error: 'In-Game Name (IGN) must be between 2 and 16 characters.' });
    }

    const filePath = getPlayerFilePath(email, playersDir);
    if (fs.existsSync(filePath)) {
      return sendJson(res, 409, {
        error: 'An account with this Gmail already exists. Please log in with your password instead!'
      });
    }

    const existingPlayers = loadAllPlayers(playersDir);
    const ignTaken = existingPlayers.some((p) => p.ign.toLowerCase() === ign.toLowerCase());
    if (ignTaken) {
      return sendJson(res, 409, {
        error: 'The In-Game Name "' + ign + '" is already taken. Please choose a unique name!'
      });
    }

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
      updateSignupsIndex(dataDir, playersDir);

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
  }

  // POST /api/auth/login
  if (req.method === 'POST' && pathname === '/api/auth/login') {
    let data;
    try {
      data = await parseBody(req);
    } catch (err) {
      return sendJson(res, 400, { error: 'Invalid JSON request payload' });
    }

    const email = (data.email || '').trim().toLowerCase();
    const password = (data.password || '').trim();

    if (!email || !password) {
      return sendJson(res, 400, { error: 'Please enter both your Gmail and password.' });
    }

    const filePath = getPlayerFilePath(email, playersDir);
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

    const isMatch = verifyPassword(password, player.hash, player.salt);
    if (!isMatch) {
      return sendJson(res, 401, { error: 'Incorrect password. Please check your password and try again.' });
    }

    player.lastLogin = new Date().toISOString();
    try {
      fs.writeFileSync(filePath, JSON.stringify(player, null, 2), 'utf8');
      updateSignupsIndex(dataDir, playersDir);
    } catch (updateErr) {}

    return sendJson(res, 200, {
      success: true,
      message: 'Welcome back, ' + player.ign + '!',
      user: {
        id: player.id,
        email: player.email,
        ign: player.ign,
        highestScore: player.highestScore || 0,
        timeSurvived: player.timeSurvived || '0:00',
        gamesPlayed: player.gamesPlayed || 0
      }
    });
  }

  // GET /api/leaderboard
  if (req.method === 'GET' && pathname === '/api/leaderboard') {
    const players = loadAllPlayers(playersDir);
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
    let data;
    try {
      data = await parseBody(req);
    } catch (err) {
      return sendJson(res, 400, { error: 'Invalid JSON request payload' });
    }

    const email = (data.email || '').trim().toLowerCase();
    const score = parseInt(data.score, 10) || 0;
    const timeSurvived = (data.timeSurvived || '0:00').trim();

    if (!email) {
      return sendJson(res, 400, { error: 'Email is required to record score.' });
    }

    const filePath = getPlayerFilePath(email, playersDir);
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
      updateSignupsIndex(dataDir, playersDir);

      const all = loadAllPlayers(playersDir).sort((a, b) => (b.highestScore || 0) - (a.highestScore || 0));
      const rankIndex = all.findIndex((p) => p.email.toLowerCase() === email);
      const rank = rankIndex >= 0 ? rankIndex + 1 : '-';

      return sendJson(res, 200, {
        success: true,
        highestScore: player.highestScore,
        timeSurvived: player.timeSurvived,
        gamesPlayed: player.gamesPlayed,
        rank,
        isNewHigh
      });
    } catch (saveErr) {
      return sendJson(res, 500, { error: 'Server error saving score.' });
    }
  }

  // POST /api/player/change-ign
  if (req.method === 'POST' && pathname === '/api/player/change-ign') {
    let data;
    try {
      data = await parseBody(req);
    } catch (err) {
      return sendJson(res, 400, { error: 'Invalid JSON request payload' });
    }

    const email = (data.email || '').trim().toLowerCase();
    const newIgn = (data.newIgn || '').trim();

    if (!email) {
      return sendJson(res, 400, { error: 'Email is required to change In-Game Name.' });
    }
    if (!newIgn || newIgn.length < 2 || newIgn.length > 16) {
      return sendJson(res, 400, { error: 'In-Game Name must be between 2 and 16 characters.' });
    }

    const filePath = getPlayerFilePath(email, playersDir);
    if (!fs.existsSync(filePath)) {
      return sendJson(res, 404, { error: 'Player account not found.' });
    }

    let player;
    try {
      player = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (readErr) {
      return sendJson(res, 500, { error: 'Failed to read account data.' });
    }

    if (player.ign.toLowerCase() === newIgn.toLowerCase() && player.ign === newIgn) {
      return sendJson(res, 200, {
        success: true,
        message: 'Your In-Game Name is already set to this!',
        user: {
          id: player.id,
          email: player.email,
          ign: player.ign,
          highestScore: player.highestScore || 0,
          timeSurvived: player.timeSurvived || '0:00',
          gamesPlayed: player.gamesPlayed || 0
        }
      });
    }

    const existingPlayers = loadAllPlayers(playersDir);
    const ignTaken = existingPlayers.some(
      (p) => p.ign.toLowerCase() === newIgn.toLowerCase() && p.email.toLowerCase() !== email
    );
    if (ignTaken) {
      return sendJson(res, 409, {
        error: 'The In-Game Name "' + newIgn + '" is already taken. Please choose a different name!'
      });
    }

    player.ign = newIgn;
    player.lastActive = new Date().toISOString();

    try {
      fs.writeFileSync(filePath, JSON.stringify(player, null, 2), 'utf8');
      updateSignupsIndex(dataDir, playersDir);

      return sendJson(res, 200, {
        success: true,
        message: 'In-Game Name updated to "' + newIgn + '"!',
        user: {
          id: player.id,
          email: player.email,
          ign: player.ign,
          highestScore: player.highestScore || 0,
          timeSurvived: player.timeSurvived || '0:00',
          gamesPlayed: player.gamesPlayed || 0
        }
      });
    } catch (saveErr) {
      return sendJson(res, 500, { error: 'Failed to save updated player name.' });
    }
  }

  // GET /api/signups
  if (req.method === 'GET' && pathname === '/api/signups') {
    const summary = updateSignupsIndex(dataDir, playersDir);
    return sendJson(res, 200, summary);
  }

  // Unknown API route
  return sendJson(res, 404, { error: 'API route not found: ' + pathname });
};
