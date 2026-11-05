const path = require('node:path');

const APP_URL = 'offerdesk://app/';

function isAppUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'offerdesk:' && url.hostname === 'app' && !url.port && !url.username && !url.password;
  } catch {
    return false;
  }
}

function externalUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function resolveAsset(root, value) {
  if (!isAppUrl(value)) return null;
  try {
    const pathname = decodeURIComponent(new URL(value).pathname);
    if (pathname.includes('\\') || pathname.includes('\0')) return null;
    const target = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
    return target;
  } catch {
    return null;
  }
}

module.exports = { APP_URL, isAppUrl, externalUrl, resolveAsset };
