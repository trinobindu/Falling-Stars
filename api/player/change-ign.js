const { getPlayerByEmail, loadAllPlayers, savePlayer, sendJson, parseBody, handleCors } = require('../_lib/storage');

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
  const newIgn = (data.newIgn || '').trim();

  if (!email) {
    return sendJson(res, 400, { error: 'Email is required to change In-Game Name.' });
  }
  if (!newIgn || newIgn.length < 2 || newIgn.length > 16) {
    return sendJson(res, 400, { error: 'In-Game Name must be between 2 and 16 characters.' });
  }

  try {
    const player = await getPlayerByEmail(email);
    if (!player) {
      return sendJson(res, 404, { error: 'Player account not found.' });
    }

    if (player.ign.toLowerCase() === newIgn.toLowerCase() && player.ign === newIgn) {
      return sendJson(res, 200, {
        success: true,
        message: 'Your In-Game Name is already set to this!',
        user: {
          id: player.id,
          email: player.email,
          ign: player.ign,
          highestScore: player.highestScore || 0,
          timeSurvived: player.timeSurvived || '0:00',
          gamesPlayed: player.gamesPlayed || 0
        }
      });
    }

    const all = await loadAllPlayers();
    const ignTaken = all.some(
      (p) => p.ign && p.ign.toLowerCase() === newIgn.toLowerCase() && p.email.toLowerCase() !== email
    );
    if (ignTaken) {
      return sendJson(res, 409, {
        error: 'The In-Game Name "' + newIgn + '" is already taken. Please choose a different name!'
      });
    }

    player.ign = newIgn;
    player.lastActive = new Date().toISOString();
    await savePlayer(player);

    return sendJson(res, 200, {
      success: true,
      message: 'In-Game Name updated to "' + newIgn + '"!',
      user: {
        id: player.id,
        email: player.email,
        ign: player.ign,
        highestScore: player.highestScore || 0,
        timeSurvived: player.timeSurvived || '0:00',
        gamesPlayed: player.gamesPlayed || 0
      }
    });
  } catch (saveErr) {
    console.error('Error changing IGN:', saveErr);
    return sendJson(res, 500, { error: 'Failed to save updated player name.' });
  }
};
