// This opt-in configuration must never silently fall back to an unsigned build.
const required = ['CSC_LINK', 'CSC_KEY_PASSWORD', 'APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'];
const missing = required.filter(name => !process.env[name]?.trim());
if (missing.length) {
  throw new Error(`Mac 签名凭据缺失：${missing.join(', ')}。请先按照 docs/signing.md 配置 GitHub Secrets。`);
}

module.exports = {
  extends: './electron-builder.yml',
  forceCodeSigning: true,
  mac: {
    hardenedRuntime: true,
    strictVerify: true,
    notarize: true,
  },
};
