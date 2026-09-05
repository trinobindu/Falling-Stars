const { getPlayerByEmail, savePlayer, verifyPassword, sendJson, parseBody, handleCors } = require('../_lib/storage');

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
  const password = (data.password || '').trim();

  if (!email || !password) {
    return sendJson(res, 400, { error: 'Please enter both your Gmail and password.' });
  }

  try {
    const player = await getPlayerByEmail(email);
    if (!player) {
      return sendJson(res, 404, {
        error: 'No account found with this Gmail. Please sign up to create your account!'
      });
    }

    const isMatch = verifyPassword(password, player.hash, player.salt);
    if (!isMatch) {
      return sendJson(res, 401, { error: 'Incorrect password. Please check your password and try again.' });
    }

    player.lastLogin = new Date().toISOString();
    await savePlayer(player);

    return sendJson(res, 200, {
      success: true,
      message: 'Welcome back, ' + player.ign + '!',
      user: {
        id: player.id,
        email: player.email,
        ign: player.ign,
        highestScore: player.highestScore || 0,
        timeSurvived: player.timeSurvived || '0:00',
        gamesPlayed: player.gamesPlayed || 0
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return sendJson(res, 500, { error: 'Failed to authenticate user.' });
  }
};
