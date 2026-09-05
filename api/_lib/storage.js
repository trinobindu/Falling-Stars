/**
 * Shared Storage & Auth Utilities for Catch the Stars
 * Supports both local environment and Vercel serverless functions.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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
      console.warn('Seeding /tmp data warning:', seedErr.message);
    }
  }

  return { dataDir: tmpDataDir, playersDir: tmpPlayersDir };
}

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

function getPlayerFilePath(email, playersDir) {
  const sanitized = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return path.join(playersDir, sanitized + '.json');
}

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
      } catch (err) {}
    }
  }
  return players;
}

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

function handleCors(req, res) {
  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.status(204).end();
      return true;
    }
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return true;
  }
  return false;
}

module.exports = {
  getStorageDirs,
  hashPassword,
  verifyPassword,
  getPlayerFilePath,
  loadAllPlayers,
  updateSignupsIndex,
  sendJson,
  parseBody,
  handleCors
};
