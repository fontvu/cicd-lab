// test/counter.test.js — the robot taste-testers.
//
// WHY: node:test ships inside Node (no install). Each test() is one item on
// the taster's checklist. Exit code 0 = all passed; non-zero = CI shows red.
// (The spec reporter prints "ℹ pass 5 / ℹ fail 0" — match the numbers.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCounter } from '../counter.js';

test('counter starts at 0 by default', () => {
  const c = createCounter();
  assert.equal(c.value, 0);
});

test('counter starts at a custom value', () => {
  const c = createCounter(42);
  assert.equal(c.value, 42);
});

test('increment returns the new value', () => {
  const c = createCounter();
  assert.equal(c.increment(), 1);
  assert.equal(c.increment(), 2);
});

test('reset returns the counter to 0', () => {
  const c = createCounter(99);
  c.increment();
  assert.equal(c.reset(), 0);
});

test('non-integer start value throws', () => {
  assert.throws(() => createCounter(3.5), /integer/);
});
