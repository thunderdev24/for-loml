/* ✨ PLUS LAYER: sound + vibration, combos, best scores, stars, daily streak and the Love Jar.
   Loaded after ifra.js. It hooks the existing games from outside, so nothing else changes.
   Optional: put your own notes in content.js as  rewards: [{ at: 5, emoji: '🌹', title: '...', text: '...' }]  */
(function () {
  'use strict';
  if (!window.SITE || typeof FUN === 'undefined' || typeof byId !== 'function') return;

  var GAMES = ['catch', 'match', 'ttt', 'gtr', 'flight', 'breaker'];
  var KEY = 'ifraPlus';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- saved progress ---------- */
  var S = { stars: 0, wins: {}, best: {}, streak: 0, longest: 0, lastDay: '', played: '', seen: 0, sfx: true };
  try { var raw = JSON.parse(localStorage.getItem(KEY) || 'null'); if (raw && typeof raw === 'object') Object.keys(raw).forEach(function (k) { S[k] = raw[k]; }); } catch (e) { }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
  function dayStr(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  /* ---------- love notes (unlocked with stars) ---------- */
  var NOTES = [
    { at: 5, emoji: '🌹', title: 'Pehla phool', text: 'Ifra, yeh pehla phool tumhari muskurahat ke naam. Jab tum hanstee ho, mera poora din mukammal ho jata hai.' },
    { at: 15, emoji: '💌', title: 'Chhoti si dua', text: 'Main roz bas yehi dua maangta hoon ke tumhari har dua qabool ho aur tumhari har raah aasaan ho.' },
    { at: 30, emoji: '🌙', title: 'Raat ki baat', text: 'Jab raat khamosh hoti hai, tab sabse zyada tumhari yaad aati hai. Aur woh yaad bohot meethi hoti hai.' },
    { at: 50, emoji: '🎀', title: 'Tumhari aadatein', text: 'Tumhara baat baat par muskurana aur meri baat dhyaan se sunna, yeh chhoti chhoti cheezein mujhe tumse aur zyada mohabbat karwati hain.' },
    { at: 80, emoji: '🧸', title: 'Sukoon', text: 'Tum mere liye woh jagah ho jahan saari thakan utar jaati hai. Tumhare paas aakar dil ko sukoon mil jata hai.' },
    { at: 120, emoji: '💍', title: 'Ek wada', text: 'Main wada karta hoon ke tumhara haath kabhi nahi chhodunga, chahe raaste kitne hi mushkil kyun na hon.' },
    { at: 170, emoji: '🌟', title: 'Meri dua', text: 'Meri har dua mein tumhara naam hai, aur meri har khushi ki wajah tum ho.' },
    { at: 230, emoji: '👑', title: 'Meri malika', text: 'Ifra, tum meri zindagi ki sabse khoobsurat kahani ho, aur yeh kahani hamesha chalti rahegi. Tumse mohabbat hai, hamesha ❤️' }
  ];
  function notes() {
    var r = window.SITE && SITE.rewards;
    if (Array.isArray(r) && r.length) {
      var ok = r.filter(function (n) { return n && Number(n.at) >= 0 && n.text; }).map(function (n) {
        return { at: Number(n.at), emoji: n.emoji || '💌', title: n.title || 'Love note', text: n.text };
      });
      if (ok.length) return ok.sort(function (a, b) { return a.at - b.at; });
    }
    return NOTES;
  }
  function unlockedCount() { var n = 0; notes().forEach(function (x) { if (S.stars >= x.at) n++; }); return n; }

  /* ---------- sound + vibration ---------- */
  var ac = null, master = null, lastPlay = {}, streak = 0, lastBad = 0;
  function audio() {
    if (!S.sfx) return null;
    if (!ac) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ac = new AC(); master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination); } catch (e) { ac = null; return null; }
    }
    if (ac.state === 'suspended') { try { ac.resume(); } catch (e) { } }
    return ac;
  }
  function tone(f, at, dur, type, vol, f2) {
    var o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + at;
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }
  function buzz(p) { try { if (S.sfx && navigator.vibrate) navigator.vibrate(p); } catch (e) { } }
  var C5 = 523.25;
  var SOUND = {
    tap: function () { tone(660, 0, 0.05, 'sine', 0.10); buzz(6); },
    flip: function () { tone(420, 0, 0.07, 'triangle', 0.14, 640); buzz(8); },
    pop: function () { tone(520, 0, 0.09, 'sine', 0.16, 820); buzz(10); },
    match: function () { tone(C5, 0, 0.12, 'triangle', 0.16); tone(C5 * 1.5, 0.09, 0.18, 'triangle', 0.16); buzz([14, 30, 14]); },
    good: function () { var f = C5 * Math.pow(2, Math.min(streak, 12) / 12); tone(f, 0, 0.11, 'triangle', 0.15); buzz(10); },
    bad: function () { tone(190, 0, 0.18, 'sawtooth', 0.13, 95); buzz([30, 40, 30]); },
    pickup: function () { tone(C5 * 1.26, 0, 0.09, 'square', 0.07); tone(C5 * 1.89, 0.07, 0.14, 'square', 0.07); buzz(14); },
    combo: function () { [1, 1.26, 1.5, 2].forEach(function (m, i) { tone(C5 * m, i * 0.06, 0.16, 'triangle', 0.15); }); buzz([20, 30, 40]); },
    star: function () { tone(988, 0, 0.1, 'sine', 0.16); tone(1319, 0.08, 0.22, 'sine', 0.16); buzz(16); },
    win: function () { [1, 1.26, 1.5, 2, 2.52].forEach(function (m, i) { tone(C5 * m, i * 0.1, 0.28, 'triangle', 0.17); }); buzz([60, 40, 60, 40, 140]); },
    unlock: function () { [1.5, 1.89, 2.25, 3, 3.78].forEach(function (m, i) { tone(C5 * m, i * 0.09, 0.4, 'sine', 0.14); }); buzz([40, 50, 40, 50, 160]); }
  };
  function sfx(name) {
    if (!SOUND[name] || !audio()) return;
    var now = Date.now();
    if (lastPlay[name] && now - lastPlay[name] < 35) return;
    lastPlay[name] = now;
    try { SOUND[name](); } catch (e) { }
  }
  /* browsers only allow sound after a touch: wake the audio on the first one */
  document.addEventListener('pointerdown', function () { audio(); }, { once: true, capture: true });

  /* ---------- small messages (wait until a celebration screen is closed) ---------- */
  var queue = [], qTimer = 0;
  function say(msg, ms) { queue.push([msg, ms || 3000]); if (!qTimer) qTimer = setTimeout(flush, 300); }
  function flush() {
    qTimer = 0;
    if (!queue.length) return;
    if (document.body.classList.contains('cine-on')) { qTimer = setTimeout(flush, 700); return; }
    var m = queue.shift();
    toast(m[0], m[1]);
    if (queue.length) qTimer = setTimeout(flush, m[1] + 350);
  }

  /* ---------- stars ---------- */
  function addStars(n, why) {
    if (!n) return;
    var before = unlockedCount();
    S.stars += n;
    save();
    sfx('star');
    var after = unlockedCount();
    say('+' + n + ' ⭐ ' + (why || '') + ' · ' + S.stars + ' in your jar', 2600);
    if (after > before) {
      var ns = notes();
      for (var i = before; i < after; i++) {
        (function (note) {
          setTimeout(function () {
            sfx('unlock');
            say('🎁 New love note unlocked: ' + note.emoji + ' ' + note.title, 4200);
            try { burstCenter(14); } catch (e) { }
          }, 900);
        })(ns[i]);
      }
    }
    refreshJar();
  }

  /* ---------- the game that is open right now ---------- */
  var cur = null, lastWin = 0;
  function modalOpen() { var m = byId('funModal'); return !!(m && m.classList.contains('show')); }
  var _open = window.openFun;
  window.openFun = function (name) {
    var r = _open.apply(this, arguments);
    if (modalOpen()) {
      cur = name; streak = 0; seenText = '';
      if (GAMES.indexOf(name) >= 0) {
        var today = dayStr();
        if (S.played !== today) { S.played = today; save(); addStars(1, 'first game today'); }
      }
      addSoundButton();
      renderBest();
    }
    return r;
  };
  var _close = window.closeFun;
  window.closeFun = function () { var r = _close.apply(this, arguments); if (!modalOpen()) { cur = null; streak = 0; } return r; };

  /* ---------- best scores ---------- */
  var BEST = {
    catch: { higher: true, label: function (v) { return '💖 ' + v; } },
    match: { higher: false, label: function (v) { return v + ' moves'; } },
    flight: { higher: true, label: function (v) { return v + ' gates'; } }
  };
  function recordBest(game, v) {
    var b = BEST[game];
    if (!b || !isFinite(v)) return false;
    var old = S.best[game];
    var better = old == null || (b.higher ? v > old : v < old);
    if (better && !(b.higher && v <= 0)) { S.best[game] = v; save(); renderBest(); return old != null; }   // true only when an older record was beaten
    return false;
  }
  function renderBest() {
    if (!cur || !BEST[cur]) return;
    var body = byId('funBody');
    if (!body || body.querySelector('.plus-best')) return;
    var anchor = body.querySelector('.fun-sub');
    var d = document.createElement('div');
    d.className = 'plus-best';
    var v = S.best[cur];
    d.textContent = v == null ? '🏅 Set your first record!' : '🏅 Best: ' + BEST[cur].label(v);
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(d, anchor.nextSibling); else body.insertBefore(d, body.children[1] || null);
  }
  function refreshBest() { var e = byId('funBody') && byId('funBody').querySelector('.plus-best'); if (e) e.remove(); renderBest(); }

  /* ---------- combos ---------- */
  var MILESTONES = { 3: '🔥 x3', 5: '🔥 x5 combo!', 8: '⚡ x8 on fire!', 12: '💥 x12 unstoppable!', 20: '👑 x20 legend!' };
  function banner(text) {
    if (reduce) return;
    var d = document.createElement('div');
    d.className = 'plus-combo';
    d.textContent = text;
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 1000);
  }
  function hit(kind) {
    if (!modalOpen()) return;
    if (kind === 'bad') {
      var now = Date.now();
      if (now - lastBad < 300) return;      // several crashes in one frame count once
      lastBad = now; streak = 0; sfx('bad'); return;
    }
    streak++;
    if (MILESTONES[streak]) { sfx('combo'); banner(MILESTONES[streak]); } else sfx('good');
  }

  /* ---------- wins ---------- */
  var _cel = window.celebrate;
  if (typeof _cel === 'function') {
    window.celebrate = function (extra, stat) {
      var r = _cel.apply(this, arguments);
      try { onWin(String(stat || '')); } catch (e) { }
      return r;
    };
  }
  function onWin(stat) {
    if (!cur || GAMES.indexOf(cur) < 0 || !modalOpen()) return;
    var now = Date.now();
    if (now - lastWin < 3000) return;
    lastWin = now;
    S.wins[cur] = (S.wins[cur] || 0) + 1;
    var gain = 3, why = 'for winning', m;
    if (cur === 'catch' && (m = /(\d+)\s*hearts caught/.exec(stat)) && recordBest('catch', +m[1])) { gain += 2; why = 'win + new record!'; }
    if (cur === 'match' && (m = /(\d+)\s*moves/.exec(stat)) && recordBest('match', +m[1])) { gain += 2; why = 'win + new record!'; }
    sfx('win');
    addStars(gain, why);
    refreshBest();
  }

  /* ---------- watch the game window: records from messages, match sounds, keep the "best" line ---------- */
  var seenText = '', pending = 0;
  function scan() {
    pending = 0;
    if (!modalOpen() || !cur) return;
    var body = byId('funBody');
    if (!body) return;
    var info = body.querySelector('#cInfo,#flInfo');
    var t = info ? info.textContent : '';
    if (t && t !== seenText) {
      seenText = t;
      var m;
      if (cur === 'catch' && (m = /^Score:\s*(\d+)/.exec(t))) { if (recordBest('catch', +m[1])) { addStars(2, 'new record!'); refreshBest(); } }
      if (cur === 'flight' && (m = /Gate count:\s*(\d+)/.exec(t))) { if (recordBest('flight', +m[1])) { addStars(2, 'new record!'); refreshBest(); } }
    }
    body.querySelectorAll('.mm-card.done:not([data-s])').forEach(function (c) { c.setAttribute('data-s', '1'); sfx('match'); });
    if (BEST[cur] && !body.querySelector('.plus-best')) renderBest();
  }
  function schedule() { if (!pending) pending = requestAnimationFrame(scan); }
  (function () {
    var fb = byId('funBody');
    if (!fb || !window.MutationObserver) return;
    new MutationObserver(schedule).observe(fb, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  })();

  /* ---------- tap sounds (one listener for everything) ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('.mm-card,.ttt-cell,.bq-bud,.s-tile,.envelope,.fun-btn,.heart,button,.fun-close') : null;
    if (!t) return;
    if (t.classList.contains('mm-card')) sfx('flip');
    else if (t.classList.contains('ttt-cell') || t.classList.contains('bq-bud')) sfx('pop');
    else sfx('tap');
  }, true);

  /* ---------- sound switch inside the game window ---------- */
  function addSoundButton() {
    var box = document.querySelector('#funModal .fun-box');
    if (!box || box.querySelector('.plus-snd')) return;
    var b = document.createElement('span');
    b.className = 'plus-snd'; b.setAttribute('role', 'button'); b.tabIndex = 0;
    function paint() { b.textContent = S.sfx ? '🔊' : '🔇'; b.setAttribute('aria-label', S.sfx ? 'Sound and vibration on' : 'Sound and vibration off'); }
    function flip(ev) { ev.stopPropagation(); S.sfx = !S.sfx; save(); paint(); if (S.sfx) sfx('tap'); }
    b.addEventListener('click', flip);
    b.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); flip(ev); } });
    paint();
    box.appendChild(b);
  }

  /* ---------- daily streak ---------- */
  (function () {
    var today = dayStr();
    if (S.lastDay === today) return;
    var y = new Date(); y.setDate(y.getDate() - 1);
    S.streak = S.lastDay === dayStr(y) ? (S.streak || 0) + 1 : 1;
    S.longest = Math.max(S.longest || 0, S.streak);
    S.lastDay = today;
    save();
    var bonus = { 3: 5, 7: 8, 14: 12, 30: 25 }[S.streak];
    var iv = setInterval(function () {        // wait until the rose has opened and the card is showing
      var card = document.querySelector('.card');
      if (card && card.classList.contains('show')) {
        clearInterval(iv);
        setTimeout(function () {
          if (S.streak > 1) say('🔥 ' + S.streak + ' days in a row, welcome back Ifra 💕', 3200);
          if (bonus) setTimeout(function () { addStars(bonus, S.streak + '-day streak bonus!'); }, 1200);
        }, 1500);
      }
    }, 600);
    setTimeout(function () { clearInterval(iv); }, 120000);
  })();

  /* ---------- the Love Jar (section + window) ---------- */
  var sec = null;
  function nextNote() { var n = notes(); for (var i = 0; i < n.length; i++) if (S.stars < n[i].at) return n[i]; return null; }
  function refreshJar() {
    if (!sec) return;
    var nx = nextNote(), n = notes(), prev = 0;
    for (var i = 0; i < n.length; i++) if (S.stars >= n[i].at) prev = n[i].at;
    sec.querySelector('[data-j="stars"]').textContent = S.stars;
    sec.querySelector('[data-j="streak"]').textContent = S.streak || 0;
    sec.querySelector('[data-j="wins"]').textContent = Object.keys(S.wins).reduce(function (a, k) { return a + (S.wins[k] || 0); }, 0);
    var pct = nx ? Math.max(4, Math.round((S.stars - prev) / (nx.at - prev) * 100)) : 100;
    sec.querySelector('.jar-fill').style.width = pct + '%';
    sec.querySelector('[data-j="next"]').textContent = nx ? (nx.at - S.stars) + ' ⭐ until the next love note' : 'Every love note is unlocked 💖';
    sec.querySelector('.jar-tile').classList.toggle('has-new', unlockedCount() > S.seen);
  }
  function buildSection() {
    var all = document.querySelectorAll('.surprises-section');
    var anchor = all.length ? all[all.length - 1] : null;
    if (!anchor) return;
    sec = document.createElement('div');
    sec.className = 'surprises-section jar-section';
    sec.innerHTML = '<h3>My Love Jar</h3>' +
      '<p class="letters-hint">Play, collect stars, and unlock little love notes 🏺</p>' +
      '<div class="jar-stats">' +
      '<div><b data-j="stars">0</b><span>⭐ stars</span></div>' +
      '<div><b data-j="streak">0</b><span>🔥 day streak</span></div>' +
      '<div><b data-j="wins">0</b><span>🏆 wins</span></div></div>' +
      '<div class="jar-bar"><div class="jar-fill"></div></div>' +
      '<div class="jar-next" data-j="next"></div>' +
      '<div class="tile-grid"><div class="s-tile jar-tile" tabindex="0" role="button"><span>🏺</span>Open my Love Jar</div></div>';
    anchor.parentNode.insertBefore(sec, anchor.nextSibling);
    var tile = sec.querySelector('.jar-tile');
    tile.addEventListener('click', function () { window.openFun('jar'); });
    tile.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.openFun('jar'); } });
    refreshJar();
  }

  FUN.jar = function (body) {
    var ns = notes();
    S.seen = unlockedCount(); save();
    var items = ns.map(function (n, i) {
      var open = S.stars >= n.at;
      return '<div class="jar-note ' + (open ? 'open' : 'locked') + '" data-i="' + i + '">' +
        '<div class="jar-head"><span class="jar-em">' + (open ? n.emoji : '🔒') + '</span>' +
        '<span class="jar-t">' + (open ? n.title : 'Locked note') + '</span>' +
        '<span class="jar-at">' + (open ? 'tap to read' : n.at + ' ⭐') + '</span></div>' +
        (open ? '<div class="jar-text">' + n.text + '</div>' : '') + '</div>';
    }).join('');
    body.innerHTML = '<h3>My Love Jar 🏺</h3>' +
      '<p class="fun-sub">⭐ ' + S.stars + ' stars · 🔥 ' + (S.streak || 0) + '-day streak<br>' +
      'Win games (+3), beat your best (+2), play once a day (+1) and keep your streak alive for bonus stars.</p>' +
      '<div class="jar-list">' + items + '</div>';
    body.querySelectorAll('.jar-note.open').forEach(function (el) {
      el.addEventListener('click', function () {
        var was = el.classList.contains('show');
        body.querySelectorAll('.jar-note.show').forEach(function (x) { x.classList.remove('show'); });
        if (!was) { el.classList.add('show'); try { burstOn(el, 5); } catch (e) { } sfx('pop'); }
      });
    });
    refreshJar();
  };

  window.PLUS = { hit: hit, sfx: sfx, addStars: addStars, state: S };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildSection); else buildSection();
})();
