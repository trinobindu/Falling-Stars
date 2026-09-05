/**
 * CLI Tool: Sync all real players from Vercel Cloud directly into your local data/ folder!
 * Run anytime with: npm run sync  OR  node sync-players.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const VERCEL_URL = 'https://falling-stars-mu.vercel.app/api/sync?t=' + Date.now();
const dataDir = path.join(__dirname, 'data');
const playersDir = path.join(dataDir, 'players');

function saveLocally(players) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(playersDir)) fs.mkdirSync(playersDir, { recursive: true });

  players.forEach((p) => {
    const sanitized = (p.email || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filePath = path.join(playersDir, `${sanitized}.json`);
    fs.writeFileSync(filePath, JSON.stringify(p, null, 2), 'utf8');
  });

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
  fs.writeFileSync(path.join(dataDir, 'signups.json'), JSON.stringify(signupsSummary, null, 2), 'utf8');

  console.log(`\n✅ Successfully synced ${players.length} real players into your folder!`);
  console.log('🏆 Real Players Global Leaderboard:');
  players
    .slice()
    .sort((a, b) => (b.highestScore || 0) - (a.highestScore || 0))
    .forEach((p, idx) => {
      console.log(`   #${idx + 1} ${p.ign} (${p.email}) - High Score: ${p.highestScore || 0} pts (${p.gamesPlayed || 0} games played)`);
    });
  console.log('\n📁 Player files stored at:');
  console.log('   ' + playersDir);
  console.log('📋 Signups summary stored at:');
  console.log('   ' + path.join(dataDir, 'signups.json'));
}

async function fallbackBlobSync() {
  try {
    const { loadAllPlayers } = require('./api/_lib/storage');
    const players = await loadAllPlayers();
    saveLocally(players);
  } catch (err) {
    console.error('❌ Direct Blob fallback failed:', err.message);
  }
}

console.log('🌐 Connecting to Vercel production to sync all real players...');

const req = https.get(VERCEL_URL, (res) => {
  let raw = '';
  res.on('data', chunk => raw += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(raw);
      if (data.success && Array.isArray(data.rawPlayers)) {
        saveLocally(data.rawPlayers);
      } else {
        console.warn('⚠️ HTTP sync response not ready, falling back to direct cloud blob read...');
        fallbackBlobSync();
      }
    } catch (e) {
      console.warn('⚠️ Sync parse error, falling back to direct cloud blob read...');
      fallbackBlobSync();
    }
  });
});

req.on('error', (err) => {
  console.warn('⚠️ Network error contacting Vercel, falling back to direct cloud blob read...');
  fallbackBlobSync();
});
