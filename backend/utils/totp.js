const { authenticator } = require("otplib");
const QRCode = require("qrcode");

// Zero-tolerance (the library default) rejects a still-valid code the moment
// the clock ticks into the next 30s step while the request is in flight, and
// breaks entirely if the server clock drifts even slightly from the phone's.
// +/-1 step is the standard recommendation (Google Authenticator itself uses it).
authenticator.options = { window: 1 };

function generateSecret() {
  return authenticator.generateSecret();
}

function buildOtpauthUrl(email, secret) {
  return authenticator.keyuri(email, "NestLeads", secret);
}

async function generateQrCodeDataUrl(otpauthUrl) {
  return QRCode.toDataURL(otpauthUrl);
}

function verifyToken(token, secret) {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

function currentToken(secret) {
  return authenticator.generate(secret);
}

module.exports = {
  generateSecret,
  buildOtpauthUrl,
  generateQrCodeDataUrl,
  verifyToken,
  currentToken,
};
