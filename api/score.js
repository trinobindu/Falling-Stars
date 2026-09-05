const { getPlayerByEmail, loadAllPlayers, savePlayer, sendJson, parseBody, handleCors } = require('./_lib/storage');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  let data;
  try {
    data = await parseBody(req);
  } catch (err) {
    return sendJson(res, 400, { error: 'Invalid JSON request payload' });
  }

  const email = (data.email || '').trim().toLowerCase();
  const score = parseInt(data.score, 10) || 0;
  const timeSurvived = (data.timeSurvived || '0:00').trim();

  if (!email) {
    return sendJson(res, 400, { error: 'Email is required to record score.' });
  }

  try {
    const player = await getPlayerByEmail(email);
    if (!player) {
      return sendJson(res, 404, { error: 'Player account not found.' });
    }

    player.gamesPlayed = (player.gamesPlayed || 0) + 1;
    player.lastActive = new Date().toISOString();

    let isNewHigh = false;
    if (score > (player.highestScore || 0)) {
      player.highestScore = score;
      player.timeSurvived = timeSurvived;
      isNewHigh = true;
    }

    await savePlayer(player);

    const all = (await loadAllPlayers()).sort((a, b) => (b.highestScore || 0) - (a.highestScore || 0));
    const rankIndex = all.findIndex((p) => p.email.toLowerCase() === email);
    const rank = rankIndex >= 0 ? rankIndex + 1 : '-';

    return sendJson(res, 200, {
      success: true,
      highestScore: player.highestScore,
      timeSurvived: player.timeSurvived,
      gamesPlayed: player.gamesPlayed,
      rank,
      isNewHigh
    });
  } catch (saveErr) {
    console.error('Save score error:', saveErr);
    return sendJson(res, 500, { error: 'Server error saving score.' });
  }
};
