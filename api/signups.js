const { getStorageDirs, updateSignupsIndex, sendJson, handleCors } = require('./_lib/storage');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  const { dataDir, playersDir } = getStorageDirs();
  const summary = updateSignupsIndex(dataDir, playersDir);
  return sendJson(res, 200, summary);
};
