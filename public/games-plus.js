/* 🎮 Upgraded Catch Hearts and Tic-Tac-Love (Memory Match is restyled in style.css).
   Loaded after ifra.js: it replaces FUN.catch and FUN.ttt and keeps the same ids, scores and hooks that plus.js reads. */
(function () {
  'use strict';
  if (typeof FUN === 'undefined' || typeof byId !== 'function') return;
  var TAU = Math.PI * 2;

  /* ---------- 🧺 CATCH THE HEARTS ---------- */
  FUN.catch = function (body) {
    var W = 300, H = 380;
    var ROUND = gameOpt('catch', 'seconds', 30, 10, 300), K = ROUND / 30;
    body.innerHTML = '<h3>Catch the Hearts 💖</h3>' +
      '<p class="fun-sub" id="cInfo">Catch the falling hearts, dodge the broken ones, grab golden ones for +3 (' + ROUND + ' seconds)</p>' +
      '<canvas id="cCv" class="game-cv" width="' + W + '" height="' + H + '"></canvas>' +
      '<div class="fun-btn" id="cStart">Start ▶️</div>';
    var cv = byId('cCv');
    var dpr = (typeof LITE !== 'undefined' && LITE) ? 1 : Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr;
    var ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    var raf = 0, last = 0, running = false, score = 0, time = ROUND, spawn = 0, combo = 0, shake = 0, bump = 0;
    var items = [], parts = [], pops = [], bx = W / 2, tx = W / 2;
    var stars = [];
    for (var i = 0; i < 40; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.3, v: 6 + Math.random() * 14, p: Math.random() * 6 });

    function setX(cx) { var r = cv.getBoundingClientRect(); tx = Math.max(34, Math.min(W - 34, (cx - r.left) * W / r.width)); }
    cv.addEventListener('pointermove', function (e) { setX(e.clientX); });
    cv.addEventListener('pointerdown', function (e) { setX(e.clientX); });
    function onKey(e) {
      if (e.key === 'ArrowLeft') tx = Math.max(34, tx - 30);
      if (e.key === 'ArrowRight') tx = Math.min(W - 34, tx + 30);
    }
    document.addEventListener('keydown', onKey);

    function burst(x, y, col, n) { for (var k = 0; k < n; k++) parts.push({ x: x, y: y, vx: (Math.random() - 0.5) * 220, vy: -30 - Math.random() * 170, l: 0.7, col: col }); }
    function pop(x, y, t, col) { pops.push({ x: x, y: y, t: t, col: col, l: 1 }); }
    function heart(x, y, s, fill, stroke, glow) {
      ctx.save();
      if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 16; }
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.9);
      ctx.bezierCurveTo(x - s * 1.6, y - s * 0.1, x - s * 0.9, y - s * 1.2, x, y - s * 0.45);
      ctx.bezierCurveTo(x + s * 0.9, y - s * 1.2, x + s * 1.6, y - s * 0.1, x, y + s * 0.9);
      ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
      ctx.shadowBlur = 0; ctx.strokeStyle = stroke; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.restore();
    }
    function basket(x, y) {
      ctx.save(); ctx.translate(x, y); ctx.scale(1 + bump * 0.1, 1 - bump * 0.1);
      var g = ctx.createLinearGradient(0, -22, 0, 0); g.addColorStop(0, '#f9a8c4'); g.addColorStop(1, '#b81f58');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-38, -22); ctx.lineTo(38, -22); ctx.lineTo(28, 0); ctx.lineTo(-28, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1;
      for (var k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(k * 11, -22); ctx.lineTo(k * 8, 0); ctx.stroke(); }
      var r = ctx.createLinearGradient(-40, 0, 40, 0); r.addColorStop(0, '#e0a94f'); r.addColorStop(0.5, '#ffe7a8'); r.addColorStop(1, '#e0a94f');
      ctx.fillStyle = r; ctx.fillRect(-42, -26, 84, 7);
      ctx.restore();
    }

    function draw() {
      ctx.save();
      if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 12, (Math.random() - 0.5) * shake * 12);
      var bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1d0a2e'); bg.addColorStop(0.7, '#5a1a58'); bg.addColorStop(1, '#a3265f');
      ctx.fillStyle = bg; ctx.fillRect(-10, -10, W + 20, H + 20);
      stars.forEach(function (s) { ctx.fillStyle = 'rgba(255,235,240,' + (0.3 + 0.5 * Math.abs(Math.sin(s.p))).toFixed(2) + ')'; ctx.fillRect(s.x, s.y, s.r, s.r); });
      items.forEach(function (it) {
        var wob = Math.sin(it.y / 28 + it.ph) * 3;
        if (it.type === 'good') heart(it.x + wob, it.y, 11, '#ff5c8a', '#fff', '#ff4d8d');
        else if (it.type === 'gold') heart(it.x + wob, it.y, 13, '#fbbf24', '#fff', '#fde047');
        else {
          heart(it.x + wob, it.y, 11, '#2a1238', '#9ca3af', null);
          ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 1.6; ctx.beginPath();
          ctx.moveTo(it.x + wob, it.y - 6); ctx.lineTo(it.x + wob - 3, it.y); ctx.lineTo(it.x + wob + 3, it.y + 4); ctx.lineTo(it.x + wob, it.y + 9); ctx.stroke();
        }
      });
      basket(bx, H - 14);
      parts.forEach(function (p) { ctx.globalAlpha = Math.max(0, p.l); ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, 3, 3); });
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center'; ctx.font = '700 15px Poppins, sans-serif';
      pops.forEach(function (p) { ctx.globalAlpha = Math.min(1, p.l * 1.5); ctx.fillStyle = p.col; ctx.fillText(p.t, p.x, p.y); });
      ctx.globalAlpha = 1;
      ctx.restore();
      /* HUD */
      ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(0, 0, W, 4);
      var tg = ctx.createLinearGradient(0, 0, W, 0); tg.addColorStop(0, '#ff4d6d'); tg.addColorStop(1, '#ffb86b');
      ctx.fillStyle = tg; ctx.fillRect(0, 0, W * Math.max(0, time) / ROUND, 4);
      ctx.font = '600 15px Poppins, sans-serif'; ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 4;
      ctx.textAlign = 'left'; ctx.fillText('💖 ' + score, 10, 26);
      ctx.textAlign = 'right'; ctx.fillText('⏱ ' + Math.max(0, Math.ceil(time)), W - 10, 26);
      if (combo >= 3) { ctx.textAlign = 'center'; ctx.fillStyle = '#ffe3b0'; ctx.fillText('🔥 x' + combo, W / 2, 26); }
      ctx.shadowBlur = 0;
      if (!running) {
        ctx.textAlign = 'center'; ctx.font = '600 16px Poppins, sans-serif'; ctx.fillStyle = '#fff';
        ctx.fillText('Tap Start, then slide the basket', W / 2, H / 2);
      }
    }
    function step(dt) {
      bx += (tx - bx) * Math.min(1, dt * 14);
      shake = Math.max(0, shake - dt * 2); bump = Math.max(0, bump - dt * 5);
      stars.forEach(function (s) { s.y += s.v * dt; s.p += dt * 2; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } });
      parts.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.l -= dt * 1.4; });
      parts = parts.filter(function (p) { return p.l > 0; });
      pops.forEach(function (p) { p.y -= 34 * dt; p.l -= dt * 1.1; });
      pops = pops.filter(function (p) { return p.l > 0; });
      if (!running) return;
      time -= dt; spawn -= dt;
      if (spawn <= 0) {
        spawn = Math.max(0.35, 0.8 - (ROUND - time) * 0.012);
        var r = Math.random();
        items.push({ x: 24 + Math.random() * (W - 48), y: -20, v: 110 + Math.random() * 90 + (ROUND - time) * 3, ph: Math.random() * 6, type: r < 0.22 ? 'bad' : r < 0.28 ? 'gold' : 'good' });
      }
      items = items.filter(function (it) {
        it.y += it.v * dt;
        if (it.y > H - 62 && it.y < H - 12 && Math.abs(it.x - bx) < 44) {
          bump = 1;
          if (it.type === 'bad') {
            score = Math.max(0, score - 2); combo = 0; shake = 0.45;
            burst(it.x, it.y, '#9ca3af', 12); pop(it.x, it.y - 16, '-2', '#fca5a5');
            if (window.PLUS) PLUS.hit('bad');
          } else {
            var g = it.type === 'gold' ? 3 : 1;
            score += g; combo++;
            burst(it.x, it.y, it.type === 'gold' ? '#fde047' : '#ff8fb1', 10); pop(it.x, it.y - 16, '+' + g, it.type === 'gold' ? '#fde047' : '#ffd1dc');
            if (combo % 5 === 0) pop(W / 2, H / 2, '🔥 x' + combo, '#ffe3b0');
            if (window.PLUS) PLUS.hit('good');
          }
          return false;
        }
        if (it.y > H + 30) { if (it.type !== 'bad') combo = 0; return false; }
        return true;
      });
      if (time <= 0) end();
    }
    function loop(now) {
      var dt = Math.min((now - last) / 1000, 0.05); last = now;
      step(dt); draw();
      if (running || parts.length || pops.length) raf = requestAnimationFrame(loop);
    }
    function start() {
      score = 0; time = ROUND; items = []; combo = 0; spawn = 0; running = true;
      byId('cStart').style.display = 'none';
      byId('cInfo').textContent = 'Glide the basket with your finger or mouse 🧺';
      last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    }
    function end() {
      running = false;
      var msg = score >= 25 * K ? 'Beautiful! You caught every heart that fell for you 💖'
        : score >= 12 * K ? 'Well caught. Hearts always find their way to you 💕'
        : 'Hearts are delicate to catch 😉 Try once more!';
      byId('cInfo').textContent = 'Score: ' + score + '. ' + msg;
      var b = byId('cStart'); b.textContent = 'Play again ▶️'; b.style.display = '';
      if (score >= 15 * K) setTimeout(function () { celebrate('You caught every falling heart, just as you once caught mine.', '💖 ' + score + ' hearts caught'); }, 600);
      else if (score >= 12 * K) burstCenter(18);
    }
    byId('cStart').onclick = start;
    funCleanup = function () { cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); };
    draw();
  };

  /* ---------- ❌ TIC-TAC-LOVE (marks pop in, the winning line glows) ---------- */
  FUN.ttt = function (body) {
    var LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    var b = ['', '', '', '', '', '', '', '', ''], over = false, alive = true;
    body.innerHTML = '<h3>Tic-Tac-Love ❤️</h3><p class="fun-sub" id="tStatus">Your turn ❤️</p>' +
      '<div class="ttt-grid">' + b.map(function (_, i) { return '<div class="ttt-cell" data-i="' + i + '"></div>'; }).join('') + '</div>' +
      '<div class="fun-btn" id="tAgain">Play again 🔄</div>';
    var cells = body.querySelectorAll('.ttt-cell'), status = byId('tStatus');

    function winLine() { for (var k = 0; k < LINES.length; k++) { var l = LINES[k]; if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return l; } return null; }
    function need(mark) {
      for (var k = 0; k < LINES.length; k++) {
        var l = LINES[k], v = l.map(function (i) { return b[i]; });
        if (v.filter(function (m) { return m === mark; }).length === 2 && v.indexOf('') >= 0) return l[v.indexOf('')];
      }
      return -1;
    }
    function place(i, mark) {
      b[i] = mark; cells[i].innerHTML = '<span class="ttt-mark">' + mark + '</span>';
      var wl = winLine(), full = b.every(Boolean);
      if (wl || full) {
        over = true;
        if (wl) wl.forEach(function (j) { cells[j].classList.add('win'); });
        if (!wl) status.textContent = 'A perfect tie, like two hearts in harmony 🥰';
        else if (mark === '❤️') { status.textContent = 'You won! Hearts always make the winning move 💖'; setTimeout(function () { celebrate('Three in a row, and my heart makes four.', '❤️ A winning move!'); }, 900); }
        else status.textContent = 'The rose wins this time... but love always wins 💕';
      } else status.textContent = mark === '❤️' ? 'The rose is thinking 🌹...' : 'Your turn ❤️';
    }
    function ai() {
      if (over || !alive) return;
      var free = [];
      b.forEach(function (v, i) { if (!v) free.push(i); });
      var m = -1;
      if (Math.random() > 0.3) { m = need('🌹'); if (m < 0) m = need('❤️'); if (m < 0 && !b[4]) m = 4; }
      if (m < 0) m = free[Math.floor(Math.random() * free.length)];
      place(m, '🌹');
    }
    cells.forEach(function (c) {
      c.onclick = function () {
        var i = +c.dataset.i;
        if (over || b[i]) return;
        place(i, '❤️');
        if (!over) setTimeout(ai, 450);
      };
    });
    byId('tAgain').onclick = function () { FUN.ttt(body); };
    funCleanup = function () { alive = false; };
  };

  /* ---------- ⚽ LOVE STRIKER: penalty shootout. Hold to aim and charge, release to shoot ---------- */
  var fbLevel = 1, fbHist = [0, 0, 0];
  FUN.football = function (body) {
    var W = 300, H = 360, SHOTS = 5, GX1 = 55, GX2 = 245, GY1 = 82, GY2 = 152;
    var best = 0; try { best = +localStorage.getItem('ifraFootBest') || 0; } catch (e) { }
    body.innerHTML = '<h3>Love Striker ⚽</h3>' +
      '<p class="fun-sub" id="fbInfo">Choose a mode: ❤️ Romantic Shootout (5 penalties), ⚡ Sudden Death (first miss ends it) or 🧤 Beat the Keeper (3 lives, it learns). Hold to aim, release in the gold zone. Corners are x2 🎯</p>' +
      '<canvas id="fbCv" class="game-cv" width="' + W + '" height="' + H + '"></canvas>' +
      '<div class="fb-modes" id="fbModes"><div class="fun-btn" data-m="romantic">❤️ Shootout</div><div class="fun-btn" data-m="sudden">⚡ Sudden Death</div><div class="fun-btn" data-m="beat">🧤 Beat the Keeper</div></div><div class="fun-btn" id="fbStart" style="display:none">Play again ⚽</div>';
    var cv = byId('fbCv');
    var dpr = (typeof LITE !== 'undefined' && LITE) ? 1 : Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr;
    var ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    var started = false, mode = 'wait', shots = SHOTS, pts = 0, goals = 0, streak = 0;
    var tx = 150, ty = 110, pw = 0, pdir = 1, holding = false, time = 0, last = 0, raf = 0, shake = 0, jump = 0, kick = 0, resT = 0;
    var fl = null, dive = null, msg = null, parts = [], netB = null, keeper = { x: 150, y: 128, rot: 0 };
    var gm = 'romantic', taken = 0, misses = 0, lastKind = '', spin = 0;
    var crowd = [];
    for (var i = 0; i < 150; i++) crowd.push({ x: Math.random() * W, y: 6 + Math.random() * 64, h: Math.floor(Math.random() * 360), p: Math.random() * 6 });
    var grass = document.createElement('canvas'); grass.width = W; grass.height = H - GY2 + 24;
    (function () { var g = grass.getContext('2d'); for (var y = 0, i = 0; y < grass.height; y += 24, i++) { g.fillStyle = i % 2 ? '#1f7a3a' : '#27913f'; g.fillRect(0, y, W, 24); }
      for (var n = 0; n < 1400; n++) { g.fillStyle = n % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.08)'; g.fillRect(Math.random() * W, Math.random() * grass.height, 1, 3 + Math.random() * 3); } })();
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function sfx(n) { if (window.PLUS) PLUS.sfx(n); }
    function setMsg(t, c) { msg = { t: t, c: c, l: 1.5 }; }
    var CFG = (window.GAME_CONFIG && GAME_CONFIG.football) || {}, NAME = (window.GAME_CONFIG && GAME_CONFIG.playerName) || 'Ifra';
    function pick(k, d) { var a = (CFG[k] && CFG[k].length) ? CFG[k] : d; return String(a[Math.floor(Math.random() * a.length)]).replace(/\{name\}/g, NAME); }
    function say(t) { var i = byId('fbInfo'); if (i) i.textContent = t; }
    function L() { return Math.min(10, fbLevel + (gm === 'beat' ? Math.floor(goals / 2) : 0)); }
    function bkey() { return gm === 'romantic' ? 'ifraFootBest' : 'ifraFootBest_' + gm; }
    function isOver() { if (gm === 'romantic') return shots <= 0; if (gm === 'sudden') return lastKind !== 'goal' || taken >= 15; return misses >= 3; }
    function confetti(n) { for (var k = 0; k < n; k++) parts.push({ x: 150, y: 190, vx: (Math.random() - 0.5) * 380, vy: -60 - Math.random() * 300, l: 1.3, c: 'hsl(' + Math.floor(Math.random() * 360) + ',90%,65%)' }); }

    /* ----- input ----- */
    function aim(e) {
      var r = cv.getBoundingClientRect();
      tx = clamp((e.clientX - r.left) * W / r.width, 28, 272);
      ty = clamp((e.clientY - r.top) * H / r.height - (e.pointerType === 'touch' ? 46 : 0), 56, 210);
    }
    cv.addEventListener('pointerdown', function (e) {
      if (!started) { start(); return; }
      if (mode !== 'ready') return;
      mode = 'aim'; holding = true; pw = 0; pdir = 1; aim(e);
      try { cv.setPointerCapture(e.pointerId); } catch (x) { }
    });
    cv.addEventListener('pointermove', function (e) { if (mode === 'aim') aim(e); });
    ['pointerup', 'pointercancel'].forEach(function (n) { cv.addEventListener(n, function () { if (mode === 'aim') shoot(); }); });

    /* ----- the kick: everything is decided here, then animated ----- */
    function shoot() {
      holding = false; mode = 'shot'; shots--;
      var p = pw, X = tx + (Math.random() - 0.5) * (4 + p * 8), Y = ty;
      if (p > 0.92) Y -= (p - 0.92) * 420;          // blasted it over the bar
      if (p < 0.15) Y += (0.15 - p) * 320;          // too soft, falls short
      var inG = X > GX1 + 3 && X < GX2 - 3 && Y > GY1 + 3 && Y <= GY2;
      var post = !inG && (((Math.abs(X - GX1) < 8 || Math.abs(X - GX2) < 8) && Y > GY1 - 4 && Y < GY2) || (Math.abs(Y - GY1) < 5 && X > GX1 && X < GX2));
      /* the keeper cannot see where the ball is going: it guesses from how you usually shoot, and only a slow shot gives it time to react */
      var skill = Math.min(0.85, 0.28 + 0.09 * L()), g, tot = fbHist[0] + fbHist[1] + fbHist[2] + 3, rr = Math.random() * tot;
      var zn = rr < fbHist[0] + 1 ? 0 : rr < fbHist[0] + fbHist[1] + 2 ? 1 : 2;
      if (Math.random() > skill) zn = Math.floor(Math.random() * 3);
      g = { x: GX1 + 32 + zn * 63 + (Math.random() - 0.5) * 36, y: GY1 + 14 + Math.random() * 46 };
      if (Math.random() < clamp(0.85 - p * 0.8, 0.05, 0.7) * Math.min(1, skill + 0.2)) g = { x: X + (Math.random() - 0.5) * 36, y: Y + (Math.random() - 0.5) * 24 };
      fbHist = fbHist.map(function (v) { return v * 0.92; }); fbHist[X < GX1 + 63 ? 0 : X < GX1 + 127 ? 1 : 2]++;
      g.x = clamp(g.x, GX1 + 14, GX2 - 14); g.y = clamp(g.y, GY1 + 14, GY2 - 16);
      var corner = Y < GY1 + 18 && (X < GX1 + 32 || X > GX2 - 32);
      var rx = Math.max(14, 36 - p * 14 + (p < 0.3 ? 20 : 0) - (corner ? 8 : 0));
      var kind;
      if (post) kind = 'post';
      else if (!inG) kind = Y > GY2 ? 'short' : (Y < GY1 ? 'over' : 'wide');
      else if (Math.hypot((X - g.x) / rx, (Y - g.y) / 28) < 1) kind = 'saved';
      else kind = 'goal';
      var bonus = kind === 'goal' && (Math.hypot(X - (GX1 + 22), Y - (GY1 + 16)) < 13 || Math.hypot(X - (GX2 - 22), Y - (GY1 + 16)) < 13);
      fl = { t: 0, dur: 0.75 - p * 0.35, X: X, Y: Y, kind: kind, bonus: bonus };
      dive = { t: 0, x0: keeper.x, y0: keeper.y, x1: g.x, y1: g.y };
      kick = 1; taken++; sfx('pop'); setTimeout(function () { sfx('flip'); }, 120);
    }
    function land() {
      var k = fl.kind; mode = 'result'; resT = 1.4; lastKind = k; if (k !== 'goal') misses++;
      if (k === 'goal') {
        pts += fl.bonus ? 2 : 1; goals++; streak++;
        netB = { x: fl.X, y: fl.Y, l: 1 }; shake = 0.35; jump = 1; confetti(34);
        setMsg(streak >= 3 ? pick('streak', ['ON FIRE! 🔥']) + ' x' + streak : fl.bonus ? pick('bonus', ['TOP BINS! 🎯 +2']) : pick('goal', ['GOAL! ⚽🔥']), '#ffe3b0'); say(pick('loveGoal', ['GOAL! You just made my heart skip a beat ❤️']));
        sfx('win'); if (window.PLUS) PLUS.hit('good');
      } else {
        streak = 0; shake = k === 'post' ? 0.4 : 0.15;
        setMsg(pick(k, [k.toUpperCase() + '!']), '#ffb4b4'); say(pick('loveMiss', ['Missed it, but you still win my heart 💕']));
        sfx('bad'); if (window.PLUS) PLUS.hit('bad');
      }
    }
    function end() {
      mode = 'over'; started = false; sfx('unlock');
      var nb = pts > best; if (nb) { best = pts; try { localStorage.setItem(bkey(), String(pts)); } catch (e) { } }
      var m = pick(pts >= 8 ? 'endGreat' : pts >= 5 ? 'endGood' : pts >= 3 ? 'endOk' : 'endLow', ['Great match! ❤️']);
      byId('fbInfo').textContent = pts + ' points (' + goals + ' goals). ' + m + (nb && pts > 0 ? ' 🏅 New best!' : ' Best: ' + best);
      var b = byId('fbStart'); b.textContent = 'Play again ⚽ (keeper gets smarter)'; b.style.display = '';
      byId('fbModes').style.display = ''; fbLevel = Math.min(8, fbLevel + 1);
      if (window.PLUS) { if (pts >= 3) PLUS.addStars(pts >= 5 ? 5 : 3, 'on the pitch'); if (nb && pts > 0) setTimeout(function () { PLUS.addStars(2, 'new record!'); }, 600); }
      if (pts >= 4) setTimeout(function () { celebrate(pick('celebrate', ['You scored your way into my heart, {name}! ❤️⚽']), '⚽ ' + pts + ' points | ' + goals + ' goals'); }, 900);
    }
    function start() {
      started = true; shots = gm === 'romantic' ? SHOTS : 999; taken = 0; misses = 0; lastKind = ''; pts = 0; goals = 0; streak = 0; mode = 'ready'; fl = null; netB = null;
      byId('fbStart').style.display = 'none'; byId('fbModes').style.display = 'none';
      byId('fbInfo').textContent = ({ romantic: 'Romantic Shootout: 5 penalties', sudden: 'Sudden Death: the first miss ends it', beat: 'Beat the Keeper: 3 lives, it learns your habits' }[gm]) + '. Hold, aim, release in the gold zone 🎯';
      last = performance.now(); if (!raf) raf = requestAnimationFrame(loop);
    }

    /* ----- simulation ----- */
    function step(dt) {
      time += dt; if (mode === 'shot') spin += dt * 16; shake = Math.max(0, shake - dt * 2); jump = Math.max(0, jump - dt * 1.5); kick = Math.max(0, kick - dt * 3);
      if (netB) netB.l = Math.max(0, netB.l - dt * 0.7);
      if (msg) { msg.l -= dt; if (msg.l <= 0) msg = null; }
      parts.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; p.l -= dt; });
      parts = parts.filter(function (p) { return p.l > 0; });
      if (mode === 'aim' && holding) { pw += pdir * dt * (0.9 + 0.12 * L()); if (pw >= 1) { pw = 1; pdir = -1; } if (pw <= 0) { pw = 0; pdir = 1; } }
      if (mode !== 'shot') {
        if (mode !== 'result') { keeper.x = 150 + Math.sin(time * (1.6 + 0.2 * L())) * (26 + 3 * L()); keeper.y = 128; keeper.rot = 0; }
      } else {
        fl.t += dt; dive.t += dt;
        var d = Math.min(1, dive.t / 0.45), e = 1 - Math.pow(1 - d, 3);
        keeper.x = dive.x0 + (dive.x1 - dive.x0) * e; keeper.y = dive.y0 + (dive.y1 - dive.y0) * e;
        keeper.rot = clamp((dive.x1 - 150) / 70, -1.1, 1.1) * e;
        if (fl.t >= fl.dur) land();
      }
      if (mode === 'result') { resT -= dt; if (resT <= 0) { if (isOver()) end(); else { mode = 'ready'; fl = null; keeper.rot = 0; } } }
    }

    /* ----- drawing ----- */
    function ballPos() {
      if (!fl) return { x: 150, y: 292, s: 1 };
      var u = Math.min(1, fl.t / fl.dur), x = 150 + (fl.X - 150) * u, y = 292 + (fl.Y - 292) * u - Math.sin(u * Math.PI) * 26, s = 1 - 0.5 * u;
      if (mode === 'result' && fl.kind !== 'goal') { var f = 1.4 - resT; y += f * 36; if (fl.kind === 'post') x += (fl.X < 150 ? -1 : 1) * f * 40; }
      return { x: x, y: y, s: s };
    }
    function drawPlayer() {
      var x = 96, y = 350, k = kick;
      ctx.save(); ctx.translate(x, y); ctx.scale(0.9, 0.9);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 2, 24, 5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f1c9a5'; ctx.fillRect(-10, -34, 7, 34);                            // left leg
      ctx.save(); ctx.translate(6, -34); ctx.rotate(-k * 1.1); ctx.fillRect(-3, 0, 7, 34 - k * 10); ctx.restore();   // kicking leg
      ctx.fillStyle = '#fff'; ctx.fillRect(-10, -12, 7, 12);                               // socks
      ctx.fillStyle = '#0b1b3a'; ctx.fillRect(-14, -46, 28, 14);                           // shorts
      for (var s = 0; s < 6; s++) { ctx.fillStyle = s % 2 ? '#fff' : '#75aadb'; ctx.fillRect(-15 + s * 5, -84, 5, 38); }   // sky-blue stripes
      ctx.fillStyle = '#75aadb'; ctx.fillRect(-21, -82, 7, 16); ctx.fillRect(14, -82, 7, 16);
      ctx.fillStyle = '#0b1b3a'; ctx.font = '700 15px Poppins, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('10', 0, -62);
      ctx.fillStyle = '#f1c9a5'; ctx.beginPath(); ctx.arc(0, -94, 10, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3b2314'; ctx.beginPath(); ctx.arc(0, -96, 10, Math.PI, TAU); ctx.fill();
      ctx.restore();
    }
    function drawKeeper() {
      ctx.save(); ctx.translate(keeper.x, keeper.y); ctx.rotate(keeper.rot);
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(-9, -14, 18, 26);
      ctx.fillStyle = '#1f2937'; ctx.fillRect(-9, 12, 8, 14); ctx.fillRect(1, 12, 8, 14);
      var up = mode === 'shot' ? -1.2 : -0.5;
      ctx.save(); ctx.rotate(up); ctx.fillStyle = '#fbbf24'; ctx.fillRect(-26, -4, 18, 6); ctx.fillStyle = '#34d399'; ctx.fillRect(-32, -6, 8, 10); ctx.restore();
      ctx.save(); ctx.rotate(-up); ctx.fillStyle = '#fbbf24'; ctx.fillRect(8, -4, 18, 6); ctx.fillStyle = '#34d399'; ctx.fillRect(24, -6, 8, 10); ctx.restore();
      ctx.fillStyle = '#f1c9a5'; ctx.beginPath(); ctx.arc(0, -22, 8, 0, TAU); ctx.fill();
      ctx.restore();
    }
    function draw() {
      ctx.save();
      if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 14, (Math.random() - 0.5) * shake * 14);
      var zm = 1 + jump * 0.035; ctx.translate(W / 2, H / 2); ctx.scale(zm, zm); ctx.translate(-W / 2, -H / 2);
      var g = ctx.createLinearGradient(0, 0, 0, GY2); g.addColorStop(0, '#070c2a'); g.addColorStop(1, '#1c2c70');
      ctx.fillStyle = g; ctx.fillRect(-10, -10, W + 20, GY2 + 12);
      crowd.forEach(function (c) { ctx.fillStyle = 'hsl(' + c.h + ',65%,' + (42 + 14 * Math.sin(time * 3 + c.p)) + '%)'; ctx.fillRect(c.x, c.y - jump * Math.abs(Math.sin(time * 9 + c.p)) * 6, 3, 3); });
      [[18, 14], [282, 14]].forEach(function (l) { var rg = ctx.createRadialGradient(l[0], l[1], 0, l[0], l[1], 70); rg.addColorStop(0, 'rgba(255,255,230,.8)'); rg.addColorStop(1, 'rgba(255,255,230,0)'); ctx.fillStyle = rg; ctx.fillRect(l[0] - 70, l[1] - 70, 140, 140); });
      ctx.fillStyle = 'rgba(255,140,190,.35)';
      for (var mi = 0; mi < 24; mi++) { var mx = (mi * 37 + Math.sin(time * 0.4 + mi) * 12) % W, my = ((mi * 53) - time * (8 + (mi % 5) * 3)) % GY2; if (my < 0) my += GY2; ctx.beginPath(); ctx.arc(mx, my, 1.6, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#1a0b2e'; ctx.fillRect(-10, GY1 - 14, W + 20, 12); ctx.fillStyle = '#ff6fa5'; ctx.font = '700 10px Poppins, sans-serif'; ctx.textAlign = 'center';
      for (var hb = 14; hb < W; hb += 28) ctx.fillText('❤', hb, GY1 - 4);
      ctx.fillStyle = '#1f7a3a'; ctx.fillRect(-20, GY2, W + 40, H); ctx.drawImage(grass, 0, GY2);
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(70, GY2); ctx.lineTo(25, 255); ctx.lineTo(275, 255); ctx.lineTo(230, GY2); ctx.moveTo(105, GY2); ctx.lineTo(88, 190); ctx.lineTo(212, 190); ctx.lineTo(195, GY2); ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(GX1, GY1, GX2 - GX1, GY2 - GY1);
      drawKeeper();
      /* net, with a ripple where the ball hit it */
      ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1;
      var bl = netB ? netB.l : 0;
      function dy(px, py) { return bl ? Math.exp(-((px - netB.x) * (px - netB.x) + (py - netB.y) * (py - netB.y)) / 1800) * 12 * bl * Math.sin(time * 18) : 0; }
      for (var gy = GY1; gy <= GY2; gy += 10) { ctx.beginPath(); for (var gx = GX1; gx <= GX2; gx += 10) { var yy = gy + dy(gx, gy); if (gx === GX1) ctx.moveTo(gx, yy); else ctx.lineTo(gx, yy); } ctx.stroke(); }
      for (var gx2 = GX1; gx2 <= GX2; gx2 += 10) { ctx.beginPath(); for (var gy2 = GY1; gy2 <= GY2; gy2 += 10) { var xx = gx2 + dy(gx2, gy2); if (gy2 === GY1) ctx.moveTo(xx, gy2); else ctx.lineTo(xx, gy2); } ctx.stroke(); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(GX1, GY2 + 2); ctx.lineTo(GX1, GY1); ctx.lineTo(GX2, GY1); ctx.lineTo(GX2, GY2 + 2); ctx.stroke();
      if (mode === 'ready' || mode === 'aim' || mode === 'wait') {          /* x2 corner targets */
        var pr = 11 + Math.sin(time * 5) * 2;
        [GX1 + 22, GX2 - 22].forEach(function (cx) {
          ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 2; ctx.shadowColor = '#ffd36b'; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.arc(cx, GY1 + 16, pr, 0, TAU); ctx.stroke(); ctx.shadowBlur = 0;
          ctx.fillStyle = '#ffd36b'; ctx.font = '700 9px Poppins, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('x2', cx, GY1 + 19);
        });
      }
      drawPlayer();
      var b = ballPos();
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(b.x, Math.max(b.y + 8 * b.s, 296), 9 * b.s, 3 * b.s, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, 9 * b.s, 0, TAU); ctx.fill();
      ctx.fillStyle = '#222'; var ca = Math.cos(spin), sa = Math.sin(spin); [[0, -3], [-5, 3], [5, 3]].forEach(function (o) { ctx.beginPath(); ctx.arc(b.x + (o[0] * ca - o[1] * sa) * b.s, b.y + (o[0] * sa + o[1] * ca) * b.s, 2.4 * b.s, 0, TAU); ctx.fill(); });
      if (mode === 'aim') {                                                 /* crosshair + dotted line */
        ctx.setLineDash([4, 5]); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(150, 285); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
        var cp = 14 + Math.sin(time * 8) * 2;
        ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(tx, ty, cp, 0, TAU); ctx.moveTo(tx - cp - 5, ty); ctx.lineTo(tx + cp + 5, ty); ctx.moveTo(tx, ty - cp - 5); ctx.lineTo(tx, ty + cp + 5); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(20, H - 22, W - 40, 12);                      /* power bar */
        ctx.fillStyle = 'rgba(255,211,107,.45)'; ctx.fillRect(20 + (W - 40) * 0.6, H - 22, (W - 40) * 0.3, 12);   // sweet spot
        var pg = ctx.createLinearGradient(20, 0, W - 20, 0); pg.addColorStop(0, '#34d399'); pg.addColorStop(0.7, '#facc15'); pg.addColorStop(1, '#ef4444');
        ctx.fillStyle = pg; ctx.fillRect(20, H - 22, (W - 40) * pw, 12);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(20, H - 22, W - 40, 12);
      }
      parts.forEach(function (p) { ctx.globalAlpha = Math.max(0, p.l); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 4, 4); }); ctx.globalAlpha = 1;
      if (msg) {
        ctx.textAlign = 'center'; ctx.font = '700 ' + (26 + 4 * Math.min(1, (1.5 - msg.l) * 5)) + 'px Poppins, sans-serif';
        ctx.globalAlpha = Math.min(1, msg.l * 2); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(msg.t, W / 2, 215);
        ctx.fillStyle = msg.c; ctx.fillText(msg.t, W / 2, 215); ctx.globalAlpha = 1;
      }
      ctx.restore();
      /* HUD */
      ctx.fillStyle = 'rgba(8,4,24,.7)'; ctx.fillRect(0, 0, W, 30);
      ctx.font = '600 14px Poppins, sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 4;
      var balls = ''; if (gm === 'romantic') { for (var s2 = 0; s2 < SHOTS; s2++) balls += s2 < shots ? '⚽' : '·'; } else if (gm === 'sudden') balls = '⚡ Shot ' + Math.max(1, taken + (mode === 'ready' || mode === 'aim' ? 1 : 0)) + '/15'; else for (var s3 = 0; s3 < 3; s3++) balls += s3 < 3 - misses ? '❤️' : '🖤';
      ctx.fillText(balls, 8, 20);
      ctx.textAlign = 'right'; ctx.fillText('⭐ ' + pts + '   🏅 ' + best, W - 8, 20);
      if (streak >= 2) { ctx.textAlign = 'center'; ctx.fillStyle = '#ffe3b0'; ctx.fillText('🔥 x' + streak, W / 2, 20); }
      ctx.shadowBlur = 0;
      if (mode === 'wait') { ctx.textAlign = 'center'; ctx.font = '600 15px Poppins, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('Pick a game mode below ⬇', W / 2, 230); }
      if (mode === 'ready' && shots === SHOTS) { ctx.textAlign = 'center'; ctx.font = '600 14px Poppins, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('Press & hold to aim 🎯', W / 2, 235); }
    }
    function loop(now) {
      var dt = Math.min((now - last) / 1000, 0.05); last = now;
      step(dt); draw();
      raf = requestAnimationFrame(loop);
    }
    byId('fbStart').onclick = start;
    byId('fbModes').querySelectorAll('[data-m]').forEach(function (bt) { bt.onclick = function () { gm = bt.dataset.m; try { best = +localStorage.getItem(bkey()) || 0; } catch (e) { best = 0; } start(); }; });
    funCleanup = function () { cancelAnimationFrame(raf); raf = 0; };
    last = performance.now(); raf = requestAnimationFrame(loop);
  };
})();
