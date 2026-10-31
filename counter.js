// counter.js — the pure logic of the Magic Button.
//
// WHY IT LOOKS LIKE THIS:
//  - No DOM, no window, no document. That is deliberate.
//  - Pure logic can be tested by Node directly (node:test) with no browser
//    and no extra libraries. This is the #1 habit that makes code testable.
//  - app.js (the DOM glue) imports from here. Separating "what" from "how it
//    looks" is what lets our robot inspectors run in CI.

// Create a counter starting at `start` (default 0).
export function createCounter(start = 0) {
  // Guard clause: a counter that starts at 3.5 makes no sense for kids.
  // Throwing here is what our "non-integer start throws" test checks.
  if (!Number.isInteger(start)) {
    throw new Error('start must be an integer');
  }

  let count = start; // private state — closed over, not reachable from outside

  return {
    // Current value (a getter, so it reads like a property: counter.value)
    get value() {
      return count;
    },
    // Add one and RETURN the new value (so callers can show it immediately)
    increment() {
      count += 1;
      return count;
    },
    // Back to zero
    reset() {
      count = 0;
      return count;
    },
  };
}
