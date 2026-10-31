// test/counter.test.js — the robot taste-testers.
//
// WHY: node:test ships inside Node (no install). Each test() is one item on
// the taster's checklist. Exit code 0 = all passed; non-zero = CI shows red.
// (The spec reporter prints "ℹ pass 8 / ℹ fail 0" — match the numbers.)
//
// WHAT A GOOD UNIT TEST LOOKS LIKE: one behaviour per test, a name that says
// what SHOULD happen (not "test 3"), and no setup shared between tests — so
// a failure tells you exactly which rule broke.
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

// --- edge cases -------------------------------------------------------------
// A test suite that only proves the happy path is a smoke test. These three
// pin down the boundaries a real user would hit: a negative start, a
// read-only value, and two counters that must not share state.

test('a negative start value is allowed (only non-integers are rejected)', () => {
  const c = createCounter(-5);
  assert.equal(c.value, -5);
  assert.equal(c.increment(), -4);
});

test('the value is read-only — assigning to it throws', () => {
  const c = createCounter();
  // `value` is a getter with no setter, so an assignment is a TypeError.
  // This is the "encapsulation" rule in practice: outside code reads the
  // count, it does not rewrite it.
  assert.throws(() => { c.value = 99; }, TypeError);
  assert.equal(c.value, 0, 'the value must be unchanged after a failed write');
});

test('two counters do not share state', () => {
  const a = createCounter();
  const b = createCounter(10);
  a.increment();
  a.increment();
  assert.equal(a.value, 2);
  assert.equal(b.value, 10, 'incrementing a must not touch b');
});
