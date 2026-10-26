/* 🎮 GAME SHELL: pause / resume (also Esc and P), restart with confirmation, how-to-play, auto-pause when the tab is hidden,
   and launcher cards with a description, a played tick and a best score. It works on top of every game, no game code needed.
   Pause works by holding back requestAnimationFrame while the overlay is open. */
(function () {
  'use strict';
  if (typeof FUN === 'undefined' || typeof byId !== 'function' || typeof closeFun !== 'function') return;
  var G = {
    catch: { d: 'Catch the falling hearts', h: 'Slide the basket with your finger or the ← → keys. Catch 💖 (golden hearts are +3) and dodge the broken ones.' },
    match: { d: 'Find every pair', h: 'Tap two cards to flip them. Match all six pairs in as few moves as you can.' },
    ttt: { d: 'Beat the rose', h: 'Tap a square to place ❤️. Get three in a row before 🌹 does.' },
    gtr: { d: 'Race the neon highway', h: 'Drag on the road or use ◀ ▶ (A / D) to steer. Hold NITRO (Space) to boost and BRAKE (↓ / S) to slow down. Dodge traffic and grab 💖.' },
    flight: { d: 'Fly through rose gates', h: 'Tap, click or press Space to flap. Pass the gates without touching the pillars.' },
    breaker: { d: 'Smash the love blocks', h: 'Move the paddle with your finger, ◀ ▶ buttons or the arrow keys. Keep the heart in play and catch the falling bonuses.' },
    football: { d: 'Penalty shootout', h: 'Pick a mode, then press and hold to aim. Release in the gold zone of the power bar. The glowing corners are worth x2.' }
  };
  var realRAF = window.requestAnimationFrame.bind(window), realCAF = window.cancelAnimationFrame.bind(window);
  var paused = false, q = [], map = {}, fid = -1, cur = null, ov = null;
  window.requestAnimationFrame = function (cb) { if (!paused) return realRAF(cb); var id = fid--; q.push({ id: id, cb: cb }); return id; };
  window.cancelAnimationFrame = function (id) {
    if (id < 0) { q = q.filter(function (x) { return x.id !== id; }); if (map[id]) { realCAF(map[id]); delete map[id]; } } else realCAF(id);
  };
  function modalOpen() { var m = byId('funModal'); return !!(m && m.classList.contains('show')); }
  function pause(confirmAsk) {
    if (!cur || !ov) return;
    if (!paused) { paused = true; }
    ov.hidden = false;
    var c = ov.querySelector('.gs-confirm'), r = ov.querySelector('[data-a=restart2]');
    c.hidden = !confirmAsk; r.textContent = confirmAsk ? 'Yes, restart' : 'Restart 🔄';
    try { ov.querySelector('.gs-main').focus({ preventScroll: true }); } catch (e) { }
  }
  function resume() {
    if (ov) ov.hidden = true;
    if (!paused) return;
    paused = false;
    q.forEach(function (x) { map[x.id] = realRAF(x.cb); });
    q = [];
  }
  function mount(name) {
    var box = document.querySelector('#funModal .fun-box');
    if (!box) return;
    ['.gs-bar', '.gs-pause'].forEach(function (s) { var o = box.querySelector(s); if (o) o.remove(); });
    var bar = document.createElement('div'); bar.className = 'gs-bar';
    bar.innerHTML = '<button type="button" data-a="pause" aria-label="Pause">⏸</button><button type="button" data-a="restart" aria-label="Restart game">🔄</button>';
    ov = document.createElement('div'); ov.className = 'gs-pause'; ov.hidden = true; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Paused');
    ov.innerHTML = '<div class="gs-card"><h4>Paused</h4><p class="gs-how"></p><p class="gs-confirm" hidden>Restart this game? Your current progress will be lost.</p>' +
      '<div class="gs-row"><button type="button" class="gs-main" data-a="resume">Resume ▶</button><button type="button" data-a="restart2">Restart 🔄</button><button type="button" data-a="quit">Quit ✕</button></div></div>';
    ov.querySelector('.gs-how').textContent = G[name].h;
    box.appendChild(bar); box.appendChild(ov);
    function act(e) {
      var a = e.target.closest && e.target.closest('[data-a]'); if (!a) return;
      var k = a.getAttribute('data-a');
      if (k === 'pause') pause(false);
      else if (k === 'restart') pause(true);
      else if (k === 'resume') resume();
      else if (k === 'restart2') { if (ov.querySelector('.gs-confirm').hidden) pause(true); else { var n = cur; resume(); window.openFun(n); } }
      else if (k === 'quit') { resume(); closeFun(); }
    }
    bar.addEventListener('click', act); ov.addEventListener('click', act);
  }
  /* progress */
  function played() { try { return JSON.parse(localStorage.getItem('ifraPlayed') || '{}') || {}; } catch (e) { return {}; } }
  function mark(n) { var p = played(); p[n] = (p[n] || 0) + 1; try { localStorage.setItem('ifraPlayed', JSON.stringify(p)); } catch (e) { } }
  function best(id) {
    var b = (window.PLUS && PLUS.state && PLUS.state.best) || {}, v;
    if (id === 'catch' && b.catch != null) return '💖 ' + b.catch;
    if (id === 'match' && b.match != null) return b.match + ' moves';
    if (id === 'flight' && b.flight != null) return b.flight + ' gates';
    if (id === 'gtr') { try { v = +localStorage.getItem('ifraGtrBest'); } catch (e) { } return v ? v + ' pts' : ''; }
    if (id === 'football') { try { v = +localStorage.getItem('ifraFootBest'); } catch (e) { } return v ? v + ' pts' : ''; }
    return '';
  }
  function decorate() {
    var p = played(), n = 0, tot = 0, grid = document.querySelector('.tile-grid.three');
    document.querySelectorAll('.s-tile[data-fun]').forEach(function (t) {
      var id = t.dataset.fun; if (!G[id]) return;
      tot++;
      var d = t.querySelector('.gs-desc'); if (!d) { d = document.createElement('small'); d.className = 'gs-desc'; t.appendChild(d); }
      var b = best(id); d.textContent = G[id].d + (b ? ' · Best ' + b : '');
      var g = t.querySelector('.gs-badge');
      if (p[id]) { n++; if (!g) { g = document.createElement('i'); g.className = 'gs-badge'; g.textContent = '✓'; t.appendChild(g); } }
    });
    if (grid) {
      var pr = document.querySelector('.gs-progress');
      if (!pr) { pr = document.createElement('div'); pr.className = 'gs-progress'; grid.parentNode.insertBefore(pr, grid); }
      pr.textContent = '🎮 ' + n + ' of ' + tot + ' games played';
    }
  }
  var _open = window.openFun;
  window.openFun = function (name) {
    var r = _open.apply(this, arguments);
    if (modalOpen() && G[name]) { cur = name; paused = false; q = []; mount(name); mark(name); }
    return r;
  };
  var _close = window.closeFun;
  window.closeFun = function () {
    var was = modalOpen(), r = _close.apply(this, arguments);
    if (was && !modalOpen()) { paused = false; q = []; map = {}; cur = null; if (ov) ov.hidden = true; decorate(); }
    return r;
  };
  window.addEventListener('keydown', function (e) {
    if (!cur || !modalOpen() || document.body.classList.contains('cine-on')) return;
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (e.key !== 'Escape' && /input|textarea/i.test((e.target || {}).tagName || '')) return;
      e.stopImmediatePropagation(); e.preventDefault();
      if (paused) resume(); else pause(false);
    }
  }, true);
  document.addEventListener('visibilitychange', function () { if (document.hidden && cur && modalOpen()) pause(false); });
  decorate();
  window.SHELL = { pause: pause, resume: resume };
})();
