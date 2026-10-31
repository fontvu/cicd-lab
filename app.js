// app.js — the glue. It is the ONLY file allowed to touch the DOM.
//
// WHY: all real logic lives in counter.js (pure, Node-testable). This file
// just connects that logic to three things in index.html: the big number
// (#count), the magic button (#magic-button) and reset (#reset-button).
import { createCounter } from './counter.js';

const counter = createCounter(); // the magic starts at 0

// DEFENSIVE WIRING (important!):
// We only touch the page if the magic button actually exists on it.
// WHY: exercise (c) in the README adds a second page (about.html) that may
// include this same script tag — but that page has no #count / #magic-button
// / #reset-button elements. Without this guard, getElementById would return
// null and the page would crash with a TypeError. With the guard, app.js is
// safe on ANY page that loads it: full behavior on index.html, silent no-op
// everywhere else. This is the "look before you leap" habit that keeps the
// robots (and browsers) happy.
if (document.getElementById('magic-button')) {
  const countEl = document.getElementById('count');
  const magicButton = document.getElementById('magic-button');
  const resetButton = document.getElementById('reset-button');

  function render() {
    countEl.textContent = String(counter.value);
  }

  magicButton.addEventListener('click', () => {
    counter.increment();
    render();
  });

  resetButton.addEventListener('click', () => {
    counter.reset();
    render();
  });

  render(); // show the initial 0 before anyone clicks
}
