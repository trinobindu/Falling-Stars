const { loadAllPlayers, sendJson, handleCors } = require('./_lib/storage');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  try {
    const players = await loadAllPlayers();
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
  } catch (err) {
    console.error('Leaderboard error:', err);
    return sendJson(res, 500, { error: 'Failed to load leaderboard' });
  }
};
