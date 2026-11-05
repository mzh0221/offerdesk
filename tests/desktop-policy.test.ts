import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import policy from '../desktop/policy.cjs';

test('桌面协议仅映射应用资源，拒绝外部来源和路径穿越', () => {
  const root = path.resolve('desktop/renderer-dist');
  assert.equal(policy.resolveAsset(root, 'offerdesk://app/'), path.join(root, 'index.html'));
  assert.equal(policy.resolveAsset(root, 'offerdesk://app/assets/main.js'), path.join(root, 'assets/main.js'));
  for (const url of ['file:///etc/passwd', 'https://app/', 'offerdesk://other/', 'offerdesk://app:123/', 'offerdesk://user@app/', 'offerdesk://app/%2e%2e%2fsecret', 'offerdesk://app/%5c..%5csecret', 'offerdesk://app/%00', 'offerdesk://app/%invalid']) {
    assert.equal(policy.resolveAsset(root, url), null, url);
  }
});

test('桌面外链只允许普通网页，不允许系统协议或带凭据的地址', () => {
  assert.equal(policy.externalUrl('https://example.com/jobs'), 'https://example.com/jobs');
  assert.equal(policy.externalUrl('http://example.com/'), 'http://example.com/');
  for (const url of ['javascript:alert(1)', 'file:///tmp/test', 'data:text/html,test', 'offerdesk://app/', 'https://user:pass@example.com', 'invalid']) {
    assert.equal(policy.externalUrl(url), null, url);
  }
});
