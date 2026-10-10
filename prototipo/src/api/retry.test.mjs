import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchRead} from './retry.ts';

test('recovers from a temporary database 503', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', {status: ++calls === 1 ? 503 : 200}));
  assert.equal((await fetchRead('https://example.test', new AbortController().signal)).status, 200);
  assert.equal(calls, 2);
});
test('does not repeat invalid filter requests', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response('{}', {status: 422}));
  assert.equal((await fetchRead('https://example.test', new AbortController().signal)).status, 422);
  assert.equal(mock.mock.callCount(), 1);
});
test('persistent failure stops after three attempts', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response('{}', {status: 503}));
  assert.equal((await fetchRead('https://example.test', new AbortController().signal)).status, 503);
  assert.equal(mock.mock.callCount(), 3);
});
test('changing filters cancels retries', async t => {
  const controller = new AbortController();
  const mock = t.mock.method(globalThis, 'fetch', async () => {
    setTimeout(() => controller.abort(), 10);
    return new Response('{}', {status: 503});
  });
  await assert.rejects(fetchRead('https://example.test', controller.signal), {name: 'AbortError'});
  assert.equal(mock.mock.callCount(), 1);
});
