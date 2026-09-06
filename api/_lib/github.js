/**
 * Direct GitHub Repository Sync for Catch the Stars
 * Automatically commits player profiles & signups to GitHub if GITHUB_TOKEN is provided.
 */

const https = require('https');

const GITHUB_REPO = 'trinobindu/Falling-Stars';
const GITHUB_BRANCH = 'main';

function getGitHubToken() {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null;
}

function githubRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const token = getGitHubToken();
    if (!token) return resolve({ skipped: true });

    const options = {
      hostname: 'api.github.com',
      path: endpoint,
      method: method,
      headers: {
        'User-Agent': 'FallingStars-Vercel-Sync',
        'Authorization': `Bearer ${token}`,
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

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

/**
 * Commit a file directly to the GitHub repository
 */
async function commitFileToGitHub(repoFilePath, fileContentString, commitMessage) {
  const token = getGitHubToken();
  if (!token) return { skipped: true, reason: 'No GITHUB_TOKEN configured' };

  try {
    // 1. Check if file already exists to get its SHA
    let existingSha = null;
    const checkRes = await githubRequest('GET', `/repos/${GITHUB_REPO}/contents/${repoFilePath}?ref=${GITHUB_BRANCH}`);
    if (checkRes.status === 200 && checkRes.data && checkRes.data.sha) {
      existingSha = checkRes.data.sha;
    }

    // 2. Put file contents (Base64 encoded)
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
    console.error('GitHub direct commit error:', err.message);
    return { error: err.message };
  }
}

/**
 * Sync player data to GitHub asynchronously (fire & forget in serverless)
 */
async function syncToGitHub(player, allPlayers) {
  const token = getGitHubToken();
  if (!token) return;

  try {
    const sanitized = (player.email || 'user').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const playerJson = JSON.stringify(player, null, 2);
    await commitFileToGitHub(
      `data/players/${sanitized}.json`,
      playerJson,
      `chore(players): update player ${player.ign} (${player.email})`
    );

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
  syncToGitHub,
  getGitHubToken
};
