const { loadAllPlayers, sendJson, handleCors, parseTimeToSeconds } = require('./_lib/storage');

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
      .sort((a, b) => {
        const scoreDiff = (b.score || 0) - (a.score || 0);
        if (scoreDiff !== 0) return scoreDiff;

        // Break ties with longer survival time
        const timeA = parseTimeToSeconds(a.time);
        const timeB = parseTimeToSeconds(b.time);
        const timeDiff = timeB - timeA;
        if (timeDiff !== 0) return timeDiff;

        // Break ties with earlier signup date
        const dateA = new Date(a.signupDate || 0).getTime();
        const dateB = new Date(b.signupDate || 0).getTime();
        return dateA - dateB;
      });

    return sendJson(res, 200, {
      totalRegistered: players.length,
      leaderboard: sorted
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return sendJson(res, 500, { error: 'Failed to load leaderboard' });
  }
};
