import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTokenBalance } from '../src/balance.ts';

test('75 USDC uses six token decimals', () => {
  assert.equal(formatTokenBalance(75000000n, 6), '75');
});
test('keeps USDC fractional precision', () => {
  assert.equal(formatTokenBalance(75000123n, 6), '75.000123');
});
test('an 18-decimal asset retains its balance', () => {
  assert.equal(formatTokenBalance(1250000000000000000n, 18), '1.25');
});
test('zero does not gain a spurious fractional part', () => {
  assert.equal(formatTokenBalance(0n, 6), '0');
});
test('retains integer precision above Number.MAX_SAFE_INTEGER', () => {
  assert.equal(formatTokenBalance(9007199254740993123456789012345678n, 18), '9007199254740993.123456789012345678');
});
test('rejects invalid balances and token metadata', () => {
  assert.throws(() => formatTokenBalance(-1n, 6), RangeError);
  for (const decimals of [-1, 1.5, 37, NaN]) {
    assert.throws(() => formatTokenBalance(1n, decimals), RangeError);
  }
});
