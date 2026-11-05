/* SystemEngineeringBKM: the slide show of a deck page. Runs after book.js.
   Every slide is a 1280 by 720 canvas. Once the diagrams are drawn, each slide's text is made smaller,
   step by step, until it fits; then the canvas is scaled to the stage. Keys: the arrows, Space,
   Page Up and Page Down, Home and End, F for full screen and N for the speaker notes. */
(function () {
  'use strict';

  var deck = document.querySelector('section.deck');
  var stage = deck && deck.querySelector('.deck-stage');
  var viewport = deck && deck.querySelector('.deck-viewport');
  var slides = deck ? Array.prototype.slice.call(deck.querySelectorAll('.slide')) : [];
  if (!stage || !viewport || !slides.length) return;

  var W = 1280;
  var H = 720;
  var prevButton = deck.querySelector('.deck-prev');
  var nextButton = deck.querySelector('.deck-next');
  var count = deck.querySelector('.deck-count b');
  var progress = deck.querySelector('.deck-progress span');
  var notesToggle = deck.querySelector('.deck-notes-toggle');
  var fullButton = deck.querySelector('.deck-full');
  var notesPanel = document.querySelector('.deck-notes');
  var notesBody = notesPanel && notesPanel.querySelector('.deck-notes-body');
  var index = 0;
  var ready = false;

  /* Scale the canvas to the stage. Only after fit(): Mermaid and fit() measure the canvas unscaled. */
  function layout() {
    if (!ready) return;
    var w = stage.clientWidth;
    var h = stage.clientHeight;
    if (!w || !h) return;
    var s = Math.min(w / W, h / H);
    var x = (w - W * s) / 2;
    var y = (h - H * s) / 2;
    viewport.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + s + ')';
  }

  function fit() {
    slides.forEach(function (slide) {
      var inner = slide.querySelector('.slide-in');
      if (!inner) return;
      var k = 1;
      inner.style.setProperty('--k', '1');
      while (inner.scrollHeight > inner.clientHeight + 1 && k > 0.6) {
        k = Math.round((k - 0.05) * 100) / 100;
        inner.style.setProperty('--k', String(k));
      }
      if (inner.scrollHeight > inner.clientHeight + 1) {
        slide.classList.add('too-long');
        console.warn('SystemEngineeringBKM: slide ' + slide.getAttribute('data-n') + ' is too long for its canvas.');
      }
    });
  }

  function show(i) {
    index = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach(function (slide, k) {
      slide.classList.toggle('active', k === index);
      slide.setAttribute('aria-hidden', k === index ? 'false' : 'true');
    });
    if (count) count.textContent = String(index + 1);
    if (progress) progress.style.transform = 'scaleX(' + (index + 1) / slides.length + ')';
    if (prevButton) prevButton.disabled = index === 0;
    if (nextButton) nextButton.disabled = index === slides.length - 1;
    if (notesBody) {
      var notes = slides[index].querySelector('.slide-notes-body');
      notesBody.innerHTML = notes ? notes.innerHTML : '<p>אין הערות דובר לשקף הזה.</p>';
    }
    var hash = '#' + (index + 1);
    if (location.hash !== hash) history.replaceState(null, '', hash);
  }

  function fromHash() {
    var n = parseInt(location.hash.slice(1), 10);
    return n >= 1 && n <= slides.length ? n - 1 : null;
  }

  /* Speaker notes: on by default; the choice is kept */
  function notesOn() {
    return !!notesToggle && notesToggle.getAttribute('aria-pressed') === 'true';
  }

  function setNotes(on, keep) {
    if (!notesToggle || !notesPanel) return;
    notesToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    notesPanel.hidden = !on;
    if (keep) {
      try { localStorage.setItem('sebkm-notes', on ? 'on' : 'off'); } catch (e) { /* storage blocked */ }
    }
  }

  /* Full screen, with Safari's prefixed API too */
  function isFull() {
    return (document.fullscreenElement || document.webkitFullscreenElement) === deck;
  }

  function toggleFull() {
    if (isFull()) {
      var exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document);
      return;
    }
    var request = deck.requestFullscreen || deck.webkitRequestFullscreen;
    if (!request) return;
    var result = request.call(deck);
    if (result && result.catch) result.catch(function () { /* refused, for example inside a frame */ });
  }

  function onFullChange() {
    var full = isFull();
    deck.classList.toggle('is-full', full);
    if (fullButton) {
      var text = full ? 'יציאה ממסך מלא' : 'מסך מלא';
      fullButton.setAttribute('aria-label', text);
      fullButton.title = text;
    }
    layout();
  }

  var canFull = !!(deck.requestFullscreen || deck.webkitRequestFullscreen) &&
    !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  if (fullButton) {
    if (canFull) fullButton.addEventListener('click', toggleFull);
    else fullButton.hidden = true;
  }
  document.addEventListener('fullscreenchange', onFullChange);
  document.addEventListener('webkitfullscreenchange', onFullChange);

  /* Keys. In a right-to-left deck, the left arrow goes forward. */
  function typing(target) {
    return !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
  }

  document.addEventListener('keydown', function (event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || typing(event.target)) return;
    if (document.querySelector('dialog[open]')) return;
    var key = event.key;
    var go = null;
    if (key === 'ArrowLeft' || key === 'PageDown') go = index + 1;
    else if (key === 'ArrowRight' || key === 'PageUp') go = index - 1;
    else if (key === ' ' || key === 'Spacebar') {
      if (event.target.closest && event.target.closest('button, a, summary')) return;
      go = event.shiftKey ? index - 1 : index + 1;
    } else if (key === 'Home') go = 0;
    else if (key === 'End') go = slides.length - 1;
    else if (key === 'ArrowDown' && isFull()) go = index + 1;
    else if (key === 'ArrowUp' && isFull()) go = index - 1;
    else if (event.code === 'KeyF' && !event.shiftKey) {
      if (canFull) {
        event.preventDefault();
        toggleFull();
      }
      return;
    } else if (event.code === 'KeyN' && !event.shiftKey) {
      event.preventDefault();
      setNotes(!notesOn(), true);
      return;
    }
    if (go === null) return;
    event.preventDefault();
    show(go);
  });

  /* Swipes on the stage: like a page in a Hebrew book, a swipe to the right goes forward */
  var touch = null;
  stage.addEventListener('touchstart', function (event) {
    touch = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }, { passive: true });
  stage.addEventListener('touchend', function (event) {
    if (!touch) return;
    var end = event.changedTouches[0];
    var dx = end.clientX - touch.x;
    var dy = end.clientY - touch.y;
    touch = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) show(dx > 0 ? index + 1 : index - 1);
  }, { passive: true });

  if (prevButton) prevButton.addEventListener('click', function () { show(index - 1); });
  if (nextButton) nextButton.addEventListener('click', function () { show(index + 1); });
  if (notesToggle) notesToggle.addEventListener('click', function () { setNotes(!notesOn(), true); });
  window.addEventListener('hashchange', function () {
    var i = fromHash();
    if (i !== null && i !== index) show(i);
  });
  if (window.ResizeObserver) new ResizeObserver(layout).observe(stage);
  else window.addEventListener('resize', layout);

  slides.forEach(function (slide) { slide.setAttribute('aria-roledescription', 'שקף'); });
  var saved = null;
  try { saved = localStorage.getItem('sebkm-notes'); } catch (e) { /* storage blocked */ }
  setNotes(saved !== 'off', false);
  var start = fromHash();
  show(start === null ? 0 : start);

  var diagrams = (window.SEBKM && window.SEBKM.diagramsReady) || Promise.resolve();
  var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.all([diagrams, fonts]).catch(function () { /* fit what we have */ }).then(function () {
    fit();
    ready = true;
    deck.classList.add('ready');
    layout();
  });
}());
