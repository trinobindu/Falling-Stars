const { loadAllPlayers, sendJson, handleCors } = require('./_lib/storage');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  try {
    const players = await loadAllPlayers();
    return sendJson(res, 200, {
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
    });
  } catch (err) {
    console.error('Signups error:', err);
    return sendJson(res, 500, { error: 'Failed to load signups' });
  }
};
