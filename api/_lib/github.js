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
 * Commit a file directly to the GitHub repository
 */
async function commitFileToGitHub(repoFilePath, fileContentString, commitMessage) {
  try {
    let existingSha = null;
    const checkRes = await githubRequest('GET', `/repos/${GITHUB_REPO}/contents/${repoFilePath}?ref=${GITHUB_BRANCH}`);
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
    return putRes;
  } catch (err) {
    console.error('GitHub commit error:', err.message);
    return { error: err.message };
  }
}

/**
 * Sync player data to GitHub asynchronously
 */
async function syncToGitHub(player, allPlayers) {
  try {
    const sanitized = (player.email || 'user').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const playerJson = JSON.stringify(player, null, 2);

    // 1. Commit individual player file to data/players/<sanitized>.json
    await commitFileToGitHub(
      `data/players/${sanitized}.json`,
      playerJson,
      `chore(players): update ${player.ign} score ${player.highestScore || 0} pts`
    );

    // 2. Commit signups.json
    if (Array.isArray(allPlayers) && allPlayers.length > 0) {
      const signupsSummary = {
        totalSignups: allPlayers.length,
        lastUpdated: new Date().toISOString(),
        players: allPlayers.map(p => ({
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
      await commitFileToGitHub(
        'data/signups.json',
        JSON.stringify(signupsSummary, null, 2),
        `chore(signups): sync ${allPlayers.length} real players`
      );
    }
  } catch (e) {
    console.error('syncToGitHub error:', e);
  }
}

module.exports = {
  commitFileToGitHub,
  fetchFileFromGitHub,
  syncToGitHub,
  getGitHubToken
};
