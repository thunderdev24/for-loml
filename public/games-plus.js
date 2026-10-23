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
})();
