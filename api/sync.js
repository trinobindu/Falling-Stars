const { loadAllPlayers, sendJson, handleCors } = require('./_lib/storage');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  try {
    const players = await loadAllPlayers();
    return sendJson(res, 200, {
      success: true,
      totalPlayers: players.length,
      players: players.map(p => ({
        ign: p.ign,
        email: p.email,
        score: p.highestScore || 0,
        time: p.timeSurvived || '0:00',
        games: p.gamesPlayed || 0
      })),
      rawPlayers: players
    });
  } catch (err) {
    console.error('Sync error:', err);
    return sendJson(res, 500, { error: 'Sync failed: ' + err.message });
  }
};
