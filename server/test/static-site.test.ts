import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHarness, type Harness } from './helpers';

describe('static site', () => {
  let h: Harness;
  before(async () => {
    h = await createHarness();
  });
  after(() => h.close());

  test('serves the home page with HTML caching rules', async () => {
    const res = await h.request('/');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /text[/]html/);
    assert.equal(res.headers.get('cache-control'), 'no-cache');
    assert.match(await res.text(), /<h1>Home<[/]h1>/);
  });

  test('redirects /book to /book/ and keeps the query string', async () => {
    const res = await h.request('/book?space=indoor');
    assert.equal(res.status, 301);
    assert.equal(res.headers.get('location'), '/book/?space=indoor');
    const page = await h.request('/book/');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<h1>Book<[/]h1>/);
  });

  test('fingerprinted assets are immutable for a year; other files get a short cache', async () => {
    const js = await h.request('/_astro/app.abc123.js');
    assert.equal(js.status, 200);
    assert.equal(js.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    const robots = await h.request('/robots.txt');
    assert.equal(robots.status, 200);
    assert.equal(robots.headers.get('cache-control'), 'public, max-age=3600');
  });

  test('misses get 404.html with status 404', async () => {
    const res = await h.request('/no-such-page/');
    assert.equal(res.status, 404);
    assert.match(await res.text(), /Page not found/);
    assert.equal(res.headers.get('cache-control'), 'no-cache');
    assert.equal((await h.request('/no-such-file.png')).status, 404);
  });

  test('path traversal is refused', async () => {
    for (const p of ['/../venue.db', '/%2e%2e/venue.db', '/..%2fvenue.db', '//evil.example/']) {
      const res = await h.request(p);
      assert.ok([400, 404].includes(res.status), `${p} -> ${res.status}`);
      assert.equal(res.headers.get('location'), null);
    }
  });

  test('HEAD works for pages', async () => {
    const res = await h.request('/', { method: 'HEAD' });
    assert.equal(res.status, 200);
  });

  test('admin pages are marked noindex', async () => {
    const res = await h.request('/api/health');
    assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
  });
});
