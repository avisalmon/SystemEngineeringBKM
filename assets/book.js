/* SystemEngineeringBKM: the behaviour of the course book pages.
   The theme switch, the diagrams (drawn by Mermaid, with a zoom), the reading progress, the contents
   that follow the reader, and the way back to the top. deck.js adds the slide show on deck pages and
   waits for window.SEBKM.diagramsReady before it measures the slides. */
(function () {
  'use strict';

  var root = document.documentElement;
  var SEBKM = window.SEBKM = window.SEBKM || {};
  var SVG = '<svg class="i" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">';
  var ICON_ZOOM = SVG + '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M11 8.5v5M8.5 11h5"/></svg>';
  var ICON_CLOSE = SVG + '<path d="M6 6l12 12M18 6L6 18"/></svg>';
  var MERMAID_THEME = {
    primaryColor: '#e0e8fb', primaryBorderColor: '#1d4ed8', primaryTextColor: '#17202e',
    textColor: '#17202e', lineColor: '#556173', clusterBkg: '#f7f8fb', clusterBorder: '#c9d2e0',
    edgeLabelBackground: '#ffffff', fontSize: '16px'
  };

  function all(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  function fragment(hash) {
    try { return decodeURIComponent(hash.slice(1)); } catch (e) { return hash.slice(1); }
  }

  /* The theme: the reader's choice is kept; otherwise the system setting decides */
  function currentTheme() {
    var chosen = root.getAttribute('data-theme');
    if (chosen === 'light' || chosen === 'dark') return chosen;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function setupTheme() {
    var button = document.querySelector('.theme');
    if (!button) return;
    function label() {
      var text = currentTheme() === 'dark' ? 'מעבר למצב בהיר' : 'מעבר למצב כהה';
      button.setAttribute('aria-label', text);
      button.setAttribute('title', text);
    }
    button.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('sebkm-theme', next); } catch (e) { /* storage blocked: this page only */ }
      label();
    });
    if (window.matchMedia) {
      var query = window.matchMedia('(prefers-color-scheme: dark)');
      if (query.addEventListener) query.addEventListener('change', label);
    }
    label();
  }

  /* Diagrams. A diagram that Mermaid can't draw shows its source text instead. */
  function renderDiagrams() {
    var nodes = all('pre.mermaid');
    if (!nodes.length) return Promise.resolve();
    if (!window.mermaid) {
      root.classList.add('diagrams-off');
      return Promise.resolve();
    }
    var sources = nodes.map(function (pre) { return pre.textContent; });
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    return fonts.then(function () {
      window.mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        suppressErrorRendering: true,
        fontFamily: getComputedStyle(document.body).fontFamily,
        themeVariables: MERMAID_THEME,
        flowchart: { htmlLabels: true, useMaxWidth: true }
      });
      return window.mermaid.run({ nodes: nodes, suppressErrors: true });
    }).catch(function (error) {
      console.warn('SystemEngineeringBKM: a diagram could not be drawn.', error);
    }).then(function () {
      nodes.forEach(function (pre, i) {
        if (!pre.querySelector('svg')) {
          pre.textContent = sources[i];
          pre.classList.add('failed');
        }
      });
    });
  }

  /* In a chapter, a wide diagram keeps a readable size and scrolls sideways; the zoom shows it large */
  function enhanceDiagrams() {
    all('.prose .diagram').forEach(function (figure) {
      var pre = figure.querySelector('pre.mermaid');
      var svg = pre && pre.querySelector('svg');
      if (!svg || pre.classList.contains('failed')) return;
      var box = svg.viewBox && svg.viewBox.baseVal;
      var natural = box && box.width ? box.width : svg.getBoundingClientRect().width;
      svg.style.minWidth = Math.round(Math.min(natural, 560)) + 'px';
      var scroll = document.createElement('div');
      scroll.className = 'diagram-scroll';
      figure.insertBefore(scroll, pre);
      scroll.appendChild(pre);
      scroll.scrollLeft = scroll.scrollWidth;  // like the text, a diagram starts on the right
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'zoom-btn';
      button.title = 'הגדלת התרשים';
      button.innerHTML = ICON_ZOOM + '<span>הגדלה</span>';
      button.addEventListener('click', function () { openZoom(svg, natural, button); });
      figure.appendChild(button);
      figure.classList.add('zoomable');
    });
  }

  var zoom = null;
  function openZoom(svg, natural, opener) {
    if (typeof HTMLDialogElement !== 'function') return;
    if (!zoom) {
      zoom = document.createElement('dialog');
      zoom.className = 'zoom';
      zoom.setAttribute('aria-label', 'תרשים מוגדל');
      zoom.innerHTML = '<div class="zoom-bar"><span>תרשים מוגדל</span>' +
        '<button type="button" class="zoom-close" aria-label="סגירה" title="סגירה">' + ICON_CLOSE + '</button></div>' +
        '<div class="zoom-body"></div>';
      document.body.appendChild(zoom);
      zoom.querySelector('.zoom-close').addEventListener('click', function () { zoom.close(); });
      zoom.addEventListener('click', function (event) {
        if (event.target === zoom) zoom.close();  // a click on the backdrop
      });
      zoom.addEventListener('close', function () {
        zoom.querySelector('.zoom-body').innerHTML = '';
        if (zoom.opener) zoom.opener.focus();
      });
    }
    // The copy keeps the ids of the original: Mermaid's own styles find the diagram by its id.
    var copy = svg.cloneNode(true);
    var width = Math.max(natural, Math.min(window.innerWidth * 0.9, natural * 1.8));
    copy.style.width = Math.round(width) + 'px';
    copy.style.minWidth = '';
    copy.style.maxWidth = 'none';
    var body = zoom.querySelector('.zoom-body');
    body.innerHTML = '';
    body.appendChild(copy);
    zoom.opener = opener;
    zoom.showModal();
    body.scrollTop = 0;
    body.scrollLeft = body.scrollWidth;
  }

  /* Reading progress, the way back up, and the contents that follow the reader */
  function setupScroll() {
    var bar = document.querySelector('.progress span');
    var toTop = document.querySelector('.to-top');
    var nav = document.querySelector('.toc-side');
    var byId = {};
    all('.toc-side a').forEach(function (a) { byId[fragment(a.hash)] = a; });
    var headings = all('.prose > h2[id], .prose > h3[id]').filter(function (h) { return byId[h.id]; });
    var current = null;
    var ticking = false;

    function keepInView(link) {
      if (!nav || nav.scrollHeight <= nav.clientHeight) return;
      var top = link.offsetTop;
      var bottom = top + link.offsetHeight;
      if (top < nav.scrollTop + 40) nav.scrollTop = Math.max(0, top - 40);
      else if (bottom > nav.scrollTop + nav.clientHeight - 40) nav.scrollTop = bottom - nav.clientHeight + 40;
    }

    function update() {
      ticking = false;
      var y = window.scrollY || window.pageYOffset;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
      if (toTop) toTop.classList.toggle('show', y > 700);
      if (!headings.length) return;
      var active = null;
      for (var i = 0; i < headings.length; i++) {
        if (headings[i].getBoundingClientRect().top <= 110) active = headings[i];
        else break;
      }
      var link = active ? byId[active.id] : null;
      if (link === current) return;
      if (current) {
        current.classList.remove('active');
        current.removeAttribute('aria-current');
      }
      all('.toc-side li.h2.open').forEach(function (li) { li.classList.remove('open'); });
      current = link;
      if (link) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'location');
        var section = link.closest('li.h2');
        if (section) section.classList.add('open');
        keepInView(link);
      }
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    if (toTop) toTop.addEventListener('click', function () { window.scrollTo(0, 0); });
    var mobile = document.querySelector('.toc-mobile');
    if (mobile) {
      mobile.addEventListener('click', function (event) {
        if (event.target.closest('a')) mobile.open = false;
      });
    }
    update();
    return onScroll;
  }

  setupTheme();
  var refresh = setupScroll();
  var initialHash = location.hash;
  SEBKM.diagramsReady = renderDiagrams().then(enhanceDiagrams).then(function () {
    // Drawn diagrams push the text down: return to the section the address points to.
    if (initialHash && location.hash === initialHash && initialHash.length > 1) {
      var target = document.getElementById(fragment(initialHash));
      if (target && Math.abs(target.getBoundingClientRect().top - 72) > 40) {
        target.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    }
    refresh();
  });
}());
