const { getStorageDirs, loadAllPlayers, getPlayerFilePath, updateSignupsIndex, sendJson, parseBody, handleCors } = require('../_lib/storage');
const fs = require('fs');

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

  const { dataDir, playersDir } = getStorageDirs();
  const filePath = getPlayerFilePath(email, playersDir);
  if (!fs.existsSync(filePath)) {
    return sendJson(res, 404, { error: 'Player account not found.' });
  }

  let player;
  try {
    player = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (readErr) {
    return sendJson(res, 500, { error: 'Failed to read account data.' });
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

  const existingPlayers = loadAllPlayers(playersDir);
  const ignTaken = existingPlayers.some(
    (p) => p.ign.toLowerCase() === newIgn.toLowerCase() && p.email.toLowerCase() !== email
  );
  if (ignTaken) {
    return sendJson(res, 409, {
      error: 'The In-Game Name "' + newIgn + '" is already taken. Please choose a different name!'
    });
  }

  player.ign = newIgn;
  player.lastActive = new Date().toISOString();

  try {
    fs.writeFileSync(filePath, JSON.stringify(player, null, 2), 'utf8');
    updateSignupsIndex(dataDir, playersDir);

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
    return sendJson(res, 500, { error: 'Failed to save updated player name.' });
  }
};
