/**
 * Shared Storage & Auth Utilities for Catch the Stars
 * Supports GitHub as primary cloud database with Vercel Blob and local filesystem fallback.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { put, get, list } = require('@vercel/blob');
const { fetchFileFromGitHub, commitFileToGitHub, syncToGitHub } = require('./github');

const DEFAULT_BLOB_TOKEN = 'vercel_blob_rw_wTxcSbU6kJIYPPap_DDis7jlnDKMVxLFlqHlcucGFitThMn';
const localDataDir = path.join(process.cwd(), 'data');
const localPlayersDir = path.join(localDataDir, 'players');

function getBlobToken() {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return process.env.BLOB_READ_WRITE_TOKEN;
  }
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const m = content.match(/BLOB_READ_WRITE_TOKEN="?([^"\r\n]+)"?/);
      if (m) return m[1];
    }
  } catch (e) {}
  return DEFAULT_BLOB_TOKEN;
}

// In-memory cache for fast reads (<10ms response time)
let memoryCache = {
  players: null,
  timestamp: 0
};
const CACHE_TTL_MS = 2000;

function parseTimeToSeconds(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.trim().split(':');
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10) || 0;
    const secs = parseInt(parts[1], 10) || 0;
    return mins * 60 + secs;
  }
  return parseInt(timeStr, 10) || 0;
}

function sortPlayers(a, b) {
  const scoreDiff = (b.highestScore || 0) - (a.highestScore || 0);
  if (scoreDiff !== 0) return scoreDiff;

  // Higher survival time breaks ties
  const timeA = parseTimeToSeconds(a.timeSurvived);
  const timeB = parseTimeToSeconds(b.timeSurvived);
  const timeDiff = timeB - timeA;
  if (timeDiff !== 0) return timeDiff;

  // Earlier signup breaks ties
  const dateA = new Date(a.signupDate || 0).getTime();
  const dateB = new Date(b.signupDate || 0).getTime();
  return dateA - dateB;
}

function getLocalSeedPlayers() {
  const players = [];
  const dirs = [
    localPlayersDir,
    path.join(process.cwd(), 'data', 'players'),
    path.join('/tmp', 'falling-stars-data', 'players')
  ];

  for (const dir of dirs) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        for (const f of files) {
          if (f.endsWith('.json')) {
            try {
              const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
              if (p && p.email && p.ign && !players.some(x => x.email.toLowerCase() === p.email.toLowerCase())) {
                players.push(p);
              }
            } catch (e) {}
          }
        }
      } catch (e) {}
    }
  }
  return players;
}

function writeToLocalFilesystem(players) {
  try {
    if (!fs.existsSync(localDataDir)) fs.mkdirSync(localDataDir, { recursive: true });
    if (!fs.existsSync(localPlayersDir)) fs.mkdirSync(localPlayersDir, { recursive: true });

    for (const p of players) {
      const sanitized = (p.email || 'user').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const filePath = path.join(localPlayersDir, `${sanitized}.json`);
      fs.writeFileSync(filePath, JSON.stringify(p, null, 2), 'utf8');
    }

    const signupsSummary = {
      totalSignups: players.length,
      lastUpdated: new Date().toISOString(),
      players: players.map(p => ({
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
    fs.writeFileSync(path.join(localDataDir, 'signups.json'), JSON.stringify(signupsSummary, null, 2), 'utf8');
  } catch (e) {}
}

async function loadAllPlayers() {
  const now = Date.now();
  if (memoryCache.players && (now - memoryCache.timestamp < CACHE_TTL_MS)) {
    return memoryCache.players;
  }

  // 1. Primary Cloud Source: Read from GitHub
  try {
    const ghData = await fetchFileFromGitHub('data/signups.json');
    if (ghData && ghData.content) {
      const parsed = JSON.parse(ghData.content);
      if (parsed && Array.isArray(parsed.players) && parsed.players.length > 0) {
        memoryCache.players = parsed.players;
        memoryCache.timestamp = now;
        writeToLocalFilesystem(parsed.players);
        return parsed.players;
      }
    }
  } catch (ghErr) {
    // Fallback to raw githubusercontent if API rate limited
    try {
      const rawRes = await fetch(`https://raw.githubusercontent.com/trinobindu/Falling-Stars/main/data/signups.json?t=${now}`);
      if (rawRes.ok) {
        const rawJson = await rawRes.json();
        if (rawJson && Array.isArray(rawJson.players) && rawJson.players.length > 0) {
          memoryCache.players = rawJson.players;
          memoryCache.timestamp = now;
          writeToLocalFilesystem(rawJson.players);
          return rawJson.players;
        }
      }
    } catch (rawErr) {}
  }

  // 2. Secondary Cloud Fallback: Vercel Blob (if unblocked)
  const token = getBlobToken();
  if (token) {
    try {
      const res = await list({ token });
      const blobItem = res.blobs.find(b => b.pathname === 'players.json');
      if (blobItem) {
        const blob = await get(blobItem.url, { token, access: 'private' });
        const text = await new Response(blob.stream).text();
        const players = JSON.parse(text);
        if (Array.isArray(players) && players.length > 0) {
          memoryCache.players = players;
          memoryCache.timestamp = now;
          writeToLocalFilesystem(players);
          return players;
        }
      }
    } catch (blobErr) {}
  }

  // 3. Tertiary Local Filesystem Fallback
  const fallback = getLocalSeedPlayers();
  if (fallback && fallback.length > 0) {
    memoryCache.players = fallback;
    memoryCache.timestamp = now;
    return fallback;
  }

  return memoryCache.players || [];
}

async function saveAllPlayers(players) {
  memoryCache.players = players;
  memoryCache.timestamp = Date.now();

  writeToLocalFilesystem(players);

  // Commit signups.json to GitHub repository in background
  const signupsSummary = {
    totalSignups: players.length,
    lastUpdated: new Date().toISOString(),
    players: players.map(p => ({
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

  commitFileToGitHub('data/signups.json', JSON.stringify(signupsSummary, null, 2), `chore(signups): sync ${players.length} players`).catch(() => {});

  // Also attempt Blob if available
  const token = getBlobToken();
  if (token) {
    try {
      await put('players.json', JSON.stringify(players, null, 2), {
        access: 'private',
        token,
        addRandomSuffix: false,
        allowOverwrite: true
      });
    } catch (blobErr) {}
  }

  return players;
}

async function getPlayerByEmail(email) {
  const players = await loadAllPlayers();
  const normalized = (email || '').trim().toLowerCase();
  return players.find(p => p.email && p.email.toLowerCase() === normalized) || null;
}

async function savePlayer(player) {
  const players = await loadAllPlayers();
  const normalized = (player.email || '').trim().toLowerCase();
  const idx = players.findIndex(p => p.email && p.email.toLowerCase() === normalized);

  if (idx >= 0) {
    players[idx] = { ...players[idx], ...player };
  } else {
    players.push(player);
  }

  await saveAllPlayers(players);
  // Commit individual player file to GitHub in background
  syncToGitHub(player, players).catch(() => {});
  return player;
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

function sendJson(res, statusCode, data) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  if (typeof res.status === 'function' && typeof res.json === 'function') {
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(statusCode).json(data);
  }

  res.writeHead(statusCode, headers);
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
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    };
    if (typeof res.status === 'function') {
      Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
      res.status(204).end();
      return true;
    }
    res.writeHead(204, headers);
    res.end();
    return true;
  }
  return false;
}

module.exports = {
  loadAllPlayers,
  saveAllPlayers,
  getPlayerByEmail,
  savePlayer,
  hashPassword,
  verifyPassword,
  sendJson,
  parseBody,
  handleCors,
  writeToLocalFilesystem,
  parseTimeToSeconds,
  sortPlayers
};
