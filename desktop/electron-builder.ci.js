// Release config: the base build config plus code signing. Used only by CI/release builds
// (electron-builder --config electron-builder.ci.js). Secrets come from env vars.
const base = require("./package.json").build;

const azure = {
  publisherName: process.env.AZURE_PUBLISHER_NAME,
  endpoint: process.env.AZURE_ENDPOINT,
  codeSigningAccountName: process.env.AZURE_ACCOUNT_NAME,
  certificateProfileName: process.env.AZURE_PROFILE_NAME,
};
const azureConfigured = Object.values(azure).every(Boolean);

module.exports = {
  ...base,
  mac: {
    ...base.mac,
    hardenedRuntime: true,
    notarize: true, // needs APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID
  },
  win: {
    ...base.win,
    // Azure Trusted Signing; credentials via AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET.
    // Left out entirely until all four values are set, so unsigned Windows builds still work.
    ...(azureConfigured ? { azureSignOptions: azure } : {}),
  },
};
