/**
 * CLI Tool: Sync all real players from Vercel Cloud directly into your local data/ folder!
 * Run anytime with: npm run sync  OR  node sync-players.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const VERCEL_URL = 'https://falling-stars-mu.vercel.app/api/sync';
const dataDir = path.join(__dirname, 'data');
const playersDir = path.join(dataDir, 'players');

console.log('🌐 Connecting to Vercel production to sync all real players...');

https.get(VERCEL_URL, (res) => {
  let raw = '';
  res.on('data', chunk => raw += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(raw);
      if (data.success && Array.isArray(data.rawPlayers)) {
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        if (!fs.existsSync(playersDir)) fs.mkdirSync(playersDir, { recursive: true });

        data.rawPlayers.forEach((p) => {
          const sanitized = p.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
          const filePath = path.join(playersDir, `${sanitized}.json`);
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
        fs.writeFileSync(path.join(dataDir, 'signups.json'), JSON.stringify(signupsSummary, null, 2), 'utf8');

        console.log(`✅ Successfully synced ${data.rawPlayers.length} real players into your folder!`);
        console.log('🏆 Leaderboard Rankings:');
        data.players.sort((a, b) => b.score - a.score).forEach((p, idx) => {
          console.log(`   #${idx + 1} ${p.ign} (${p.email}) - Score: ${p.score} pts (${p.games} games)`);
        });
        console.log('\n📁 Files saved in:');
        console.log('   ' + playersDir);
      } else {
        console.error('❌ Server error:', data.error);
      }
    } catch (e) {
      console.error('❌ Error parsing sync data:', e.message);
    }
  });
}).on('error', (err) => {
  console.error('❌ Network error syncing players:', err.message);
});
