const crypto = require('node:crypto');

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

module.exports = { sha256 };
