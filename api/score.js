const { getPlayerByEmail, loadAllPlayers, savePlayer, sendJson, parseBody, handleCors, parseTimeToSeconds, sortPlayers } = require('./_lib/storage');

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
  const rawScore = parseInt(data.score, 10) || 0;
  const rawHighScore = parseInt(data.highScore, 10) || 0;
  const score = Math.max(rawScore, rawHighScore);
  const timeSurvived = (data.timeSurvived || '0:00').trim();
  const ign = (data.ign || '').trim();

  if (!email) {
    return sendJson(res, 400, { error: 'Email is required to record score.' });
  }

  try {
    let player = await getPlayerByEmail(email);
    if (!player) {
      // Auto-create player so scores and signups are NEVER rejected or lost
      const fallbackIgn = ign || email.split('@')[0] || 'Star Pilot';
      player = {
        id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        email,
        ign: fallbackIgn,
        signupDate: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        highestScore: 0,
        timeSurvived: '0:00',
        gamesPlayed: 0
      };
    }

    player.gamesPlayed = (player.gamesPlayed || 0) + 1;
    player.lastLogin = new Date().toISOString();
    player.lastActive = new Date().toISOString();

    if (ign && (!player.ign || player.ign === email.split('@')[0])) {
      player.ign = ign;
    }

    let isNewHigh = false;
    const currentHigh = player.highestScore || 0;
    if (score > currentHigh) {
      player.highestScore = score;
      player.timeSurvived = timeSurvived;
      isNewHigh = true;
    } else if (score === currentHigh && currentHigh > 0) {
      // If same score achieved with better survival time, update timeSurvived
      const oldSecs = parseTimeToSeconds(player.timeSurvived);
      const newSecs = parseTimeToSeconds(timeSurvived);
      if (newSecs > oldSecs) {
        player.timeSurvived = timeSurvived;
      }
    }

    await savePlayer(player);

    const all = (await loadAllPlayers()).sort(sortPlayers);
    const rankIndex = all.findIndex((p) => p.email && p.email.toLowerCase() === email);
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
    return sendJson(res, 500, { error: 'Server error saving score: ' + saveErr.message });
  }
};
