const { loadAllPlayers, savePlayer, hashPassword, sendJson, parseBody, handleCors } = require('../_lib/storage');

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
  const ign = (data.ign || '').trim();

  if (!email || !email.includes('@')) {
    return sendJson(res, 400, { error: 'Please enter a valid Gmail address.' });
  }
  if (!password || password.length < 4) {
    return sendJson(res, 400, { error: 'Password must be at least 4 characters long.' });
  }
  if (!ign || ign.length < 2 || ign.length > 16) {
    return sendJson(res, 400, { error: 'In-Game Name (IGN) must be between 2 and 16 characters.' });
  }

  try {
    const players = await loadAllPlayers();

    const existingEmail = players.find(p => p.email && p.email.toLowerCase() === email);
    if (existingEmail) {
      return sendJson(res, 409, {
        error: 'An account with this Gmail already exists. Please log in with your password instead!'
      });
    }

    const ignTaken = players.some(p => p.ign && p.ign.toLowerCase() === ign.toLowerCase());
    if (ignTaken) {
      return sendJson(res, 409, {
        error: 'The In-Game Name "' + ign + '" is already taken. Please choose a unique name!'
      });
    }

    const { salt, hash } = hashPassword(password);
    const newPlayer = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      email,
      ign,
      salt,
      hash,
      signupDate: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      highestScore: 0,
      timeSurvived: '0:00',
      gamesPlayed: 0
    };

    await savePlayer(newPlayer);

    return sendJson(res, 201, {
      success: true,
      message: 'Account registered successfully! Welcome to Catch the Stars.',
      user: {
        id: newPlayer.id,
        email: newPlayer.email,
        ign: newPlayer.ign,
        highestScore: 0,
        timeSurvived: '0:00',
        gamesPlayed: 0
      }
    });
  } catch (saveErr) {
    console.error('Error saving new player:', saveErr);
    return sendJson(res, 500, { error: 'Server error saving account data.' });
  }
};
