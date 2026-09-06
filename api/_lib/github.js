/**
 * Direct GitHub Repository Sync for Catch the Stars
 * Automatically commits player profiles & signups to GitHub.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const GITHUB_REPO = 'trinobindu/Falling-Stars';
const GITHUB_BRANCH = 'main';
const DEFAULT_GITHUB_TOKEN = '';

function getGitHubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const m = content.match(/GITHUB_TOKEN="?([^"\r\n]+)"?/);
      if (m) return m[1];
    }
  } catch (e) {}
  return DEFAULT_GITHUB_TOKEN;
}

function githubRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const ghToken = getGitHubToken();
    if (!ghToken) return resolve({ skipped: true, error: 'No token' });

    const options = {
      hostname: 'api.github.com',
      path: endpoint,
      method: method,
      headers: {
        'User-Agent': 'FallingStars-Vercel-Sync',
        'Authorization': `Bearer ${ghToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    };

    if (data) {
      options.headers['Content-Type'] = 'application/json';
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (err) => {
      console.error('GitHub API request error:', err.message);
      resolve({ error: err.message });
    });
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

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

/**
 * Fetch file content directly from GitHub repository
 */
async function fetchFileFromGitHub(repoFilePath) {
  const res = await githubRequest('GET', `/repos/${GITHUB_REPO}/contents/${repoFilePath}?ref=${GITHUB_BRANCH}&t=${Date.now()}`);
  if (res.status === 200 && res.data && res.data.content) {
    const content = Buffer.from(res.data.content, 'base64').toString('utf8');
    return { content, sha: res.data.sha };
  }
  return null;
}

/**
 * Commit a file directly to the GitHub repository with automatic retry on 409 Conflict
 */
async function commitFileToGitHub(repoFilePath, fileContentString, commitMessage, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      let existingSha = null;
      const checkRes = await githubRequest('GET', `/repos/${GITHUB_REPO}/contents/${repoFilePath}?ref=${GITHUB_BRANCH}&t=${Date.now()}`);
      if (checkRes.status === 200 && checkRes.data && checkRes.data.sha) {
        existingSha = checkRes.data.sha;
      }

      const base64Content = Buffer.from(fileContentString, 'utf8').toString('base64');
      const payload = {
        message: commitMessage,
        content: base64Content,
        branch: GITHUB_BRANCH
      };
      if (existingSha) {
        payload.sha = existingSha;
      }

      const putRes = await githubRequest('PUT', `/repos/${GITHUB_REPO}/contents/${repoFilePath}`, payload);
      if (putRes.status === 200 || putRes.status === 201) {
        return putRes;
      }

      if (putRes.status === 409 && attempt < maxRetries) {
        const delay = 150 * Math.pow(2, attempt) + Math.floor(Math.random() * 100);
        console.warn(`[GitHub] 409 Conflict committing ${repoFilePath}, retrying attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      return putRes;
    } catch (err) {
      console.error(`[GitHub] Commit error on ${repoFilePath} (attempt ${attempt}):`, err.message);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
        continue;
      }
      return { error: err.message };
    }
  }
}

/**
 * Atomically merge a player's latest score into data/signups.json on GitHub
 * Uses Math.max to prevent score regression and retries on 409 Conflict.
 */
async function commitSignupsWithMerge(updatedPlayer, maxRetries = 4) {
  if (!updatedPlayer || !updatedPlayer.email) return null;
  const targetEmail = updatedPlayer.email.trim().toLowerCase();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      let existingSha = null;
      let signups = { totalSignups: 0, lastUpdated: new Date().toISOString(), players: [] };

      // 1. Fetch latest signups.json directly from GitHub API
      const checkRes = await githubRequest('GET', `/repos/${GITHUB_REPO}/contents/data/signups.json?ref=${GITHUB_BRANCH}&t=${Date.now()}`);
      if (checkRes.status === 200 && checkRes.data) {
        existingSha = checkRes.data.sha;
        if (checkRes.data.content) {
          try {
            const raw = Buffer.from(checkRes.data.content, 'base64').toString('utf8');
            signups = JSON.parse(raw);
            if (!Array.isArray(signups.players)) signups.players = [];
          } catch (e) {}
        }
      }

      // 2. Find and merge the updated player record
      const idx = signups.players.findIndex(p => p.email && p.email.trim().toLowerCase() === targetEmail);
      const newScore = updatedPlayer.highestScore || 0;
      const newTime = updatedPlayer.timeSurvived || '0:00';
      const newGames = updatedPlayer.gamesPlayed || 1;
      const newIgn = (updatedPlayer.ign || (idx >= 0 ? signups.players[idx].ign : targetEmail.split('@')[0])).trim();

      if (idx >= 0) {
        const p = signups.players[idx];
        const oldScore = p.highestScore || 0;
        if (newScore > oldScore) {
          p.highestScore = newScore;
          p.timeSurvived = newTime;
        } else if (newScore === oldScore && oldScore > 0) {
          const oldSecs = parseTimeToSeconds(p.timeSurvived);
          const newSecs = parseTimeToSeconds(newTime);
          if (newSecs > oldSecs) {
            p.timeSurvived = newTime;
          }
        }
        p.gamesPlayed = Math.max(p.gamesPlayed || 0, newGames);
        p.ign = newIgn;
        p.lastLogin = updatedPlayer.lastLogin || new Date().toISOString();
        if (updatedPlayer.lastActive) p.lastActive = updatedPlayer.lastActive;
      } else {
        signups.players.push({
          id: updatedPlayer.id || 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          email: updatedPlayer.email,
          ign: newIgn,
          signupDate: updatedPlayer.signupDate || new Date().toISOString(),
          highestScore: newScore,
          timeSurvived: newTime,
          gamesPlayed: newGames,
          lastLogin: updatedPlayer.lastLogin || new Date().toISOString()
        });
      }

      // Deterministic sort: score desc, time desc, date asc
      signups.players.sort(sortPlayers);
      signups.totalSignups = signups.players.length;
      signups.lastUpdated = new Date().toISOString();

      const base64Content = Buffer.from(JSON.stringify(signups, null, 2), 'utf8').toString('base64');
      const payload = {
        message: `chore(signups): sync ${newIgn} score ${newScore} pts`,
        content: base64Content,
        branch: GITHUB_BRANCH
      };
      if (existingSha) payload.sha = existingSha;

      const putRes = await githubRequest('PUT', `/repos/${GITHUB_REPO}/contents/data/signups.json`, payload);
      if (putRes.status === 200 || putRes.status === 201) {
        return { success: true, signups: signups.players };
      }

      if (putRes.status === 409 && attempt < maxRetries) {
        const delay = 150 * Math.pow(2, attempt) + Math.floor(Math.random() * 100);
        console.warn(`[GitHub] 409 Conflict on signups.json merge, retrying attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      return putRes;
    } catch (err) {
      console.error(`[GitHub] Merge signups error (attempt ${attempt}):`, err.message);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
        continue;
      }
      return { error: err.message };
    }
  }
}

/**
 * Sync player data to GitHub asynchronously
 * Commits individual player file and merges signups.json with automatic retry.
 */
async function syncToGitHub(player) {
  if (!player || !player.email) return;
  try {
    const sanitized = (player.email || 'user').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const playerJson = JSON.stringify(player, null, 2);

    // 1. Commit individual player file to data/players/<sanitized>.json with retry
    await commitFileToGitHub(
      `data/players/${sanitized}.json`,
      playerJson,
      `chore(players): update ${player.ign} score ${player.highestScore || 0} pts`
    );

    // 2. Atomically merge into data/signups.json with retry on 409
    await commitSignupsWithMerge(player);
  } catch (e) {
    console.error('syncToGitHub error:', e);
  }
}

module.exports = {
  commitFileToGitHub,
  commitSignupsWithMerge,
  fetchFileFromGitHub,
  syncToGitHub,
  getGitHubToken,
  parseTimeToSeconds,
  sortPlayers
};
