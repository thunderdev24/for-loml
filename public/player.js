/* 🎵 MUSIC PLAYER: replaces the plain song dropdown with a modern player.
   Seek bar (drag), volume, shuffle, repeat, prev / next, a slide-up playlist, and lock-screen controls.
   Loaded after ifra.js; it drives the same audio element and playlist, nothing else changes. */
(function () {
  'use strict';
  var music = document.getElementById('bgMusic');
  var sec = document.querySelector('.song-section');
  if (!music || !sec || typeof songList !== 'function' || typeof loadSong !== 'function') return;

  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { } }
  function $(s, r) { return (r || document).querySelector(s); }
  function fmt(s) {
    if (!isFinite(s) || s < 0) return '0:00';
    s = Math.floor(s);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  /* ---------- icons ---------- */
  var I = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4.5" width="4.4" height="15" rx="1.4"/><rect x="13.6" y="4.5" width="4.4" height="15" rx="1.4"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="2.6" height="14" rx="1.2"/><path d="M19 6v12a.9.9 0 0 1-1.4.75l-8.6-6a.9.9 0 0 1 0-1.5l8.6-6A.9.9 0 0 1 19 6z"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="16.4" y="5" width="2.6" height="14" rx="1.2"/><path d="M5 6v12a.9.9 0 0 0 1.4.75l8.6-6a.9.9 0 0 0 0-1.5l-8.6-6A.9.9 0 0 0 5 6z"/></svg>',
    shuf: '<svg viewBox="0 0 24 24" aria-hidden="true" class="st"><path d="M16 4h4v4M20 4l-6.2 6.2M4 20l5.5-5.5M16 20h4v-4M20 20l-4.5-4.5M4 4l5 5"/></svg>',
    rep: '<svg viewBox="0 0 24 24" aria-hidden="true" class="st"><path d="M17 3l3 3-3 3"/><path d="M4 11V9a3 3 0 0 1 3-3h13"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v2a3 3 0 0 1-3 3H4"/></svg>',
    rep1: '<svg viewBox="0 0 24 24" aria-hidden="true" class="st"><path d="M17 3l3 3-3 3"/><path d="M4 11V9a3 3 0 0 1 3-3h13"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v2a3 3 0 0 1-3 3H4"/><path d="M11 10l1.4-.8V14" stroke-width="1.6"/></svg>',
    list: '<svg viewBox="0 0 24 24" aria-hidden="true" class="st"><path d="M4 6h12M4 12h12M4 18h7"/><path d="M19 15.5V8l3 1.5" /><circle cx="17" cy="16" r="2" fill="currentColor" stroke="none"/></svg>',
    vol: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.4l4.3 3.6a.8.8 0 0 0 1.3-.6V6.5a.8.8 0 0 0-1.3-.6L7.4 9.5H4z"/><path class="st" d="M16.2 9a4.2 4.2 0 0 1 0 6M18.6 6.6a7.6 7.6 0 0 1 0 10.8"/></svg>',
    vollow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.4l4.3 3.6a.8.8 0 0 0 1.3-.6V6.5a.8.8 0 0 0-1.3-.6L7.4 9.5H4z"/><path class="st" d="M16.2 9a4.2 4.2 0 0 1 0 6"/></svg>',
    mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.4l4.3 3.6a.8.8 0 0 0 1.3-.6V6.5a.8.8 0 0 0-1.3-.6L7.4 9.5H4z"/><path class="st" d="M16.5 9.5l5 5M21.5 9.5l-5 5"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true" class="st"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  /* ---------- settings kept on her phone ---------- */
  var shuffleOn = lsGet('ifraMpShuffle', '0') === '1';
  var repeatOne = lsGet('ifraMpRepeat', 'all') === 'one';

  /* iPhone Safari ignores the volume of web audio (only the side buttons work): detect it and hide the slider there */
  var volOk = (function () {
    try { var o = music.volume; music.volume = 0.37; var ok = Math.abs(music.volume - 0.37) < 0.02; music.volume = o; return ok; } catch (e) { return false; }
  })();
  var rawDef = window.SITE && SITE.settings ? SITE.settings.musicVolume : undefined;
  var def = (rawDef === undefined || rawDef === null || rawDef === '') ? NaN : Number(rawDef);
  var vol = parseFloat(lsGet('ifraVol', ''));
  if (!isFinite(vol)) vol = isFinite(def) ? Math.max(0, Math.min(100, def)) / 100 : 0.4;
  var lastVol = vol > 0 ? vol : 0.4;
  window.MP_VOL = vol;
  if (volOk) { try { music.volume = vol; } catch (e) { } }

  /* ---------- build the player ---------- */
  var old = sec.querySelector('.mp');
  if (old) old.remove();
  var box = document.createElement('div');
  box.className = 'mp';
  box.innerHTML =
    '<div class="mp-top">' +
    '<div class="mp-disc" id="mpDisc"><span>🌹</span></div>' +
    '<div class="mp-meta" id="mpMeta" role="button" tabindex="0" aria-label="Choose a song">' +
    '<div class="mp-kicker" id="mpKick">Now playing</div>' +
    '<div class="mp-title" id="mpTitle">—</div>' +
    '<div class="mp-sub" id="mpSub"></div></div>' +
    '<button type="button" class="mp-ico" id="mpListBtn" aria-label="Open playlist">' + I.list + '</button></div>' +
    '<div class="mp-seek"><span id="mpCur">0:00</span>' +
    '<input type="range" id="mpSeek" min="0" max="1000" step="1" value="0" aria-label="Seek in song">' +
    '<span id="mpDur">0:00</span></div>' +
    '<div class="mp-ctl">' +
    '<button type="button" class="mp-ico" id="mpShuf" aria-label="Shuffle" aria-pressed="false">' + I.shuf + '</button>' +
    '<button type="button" class="mp-ico big" id="mpPrev" aria-label="Previous song">' + I.prev + '</button>' +
    '<button type="button" class="mp-play" id="mpPlay" aria-label="Play">' + I.play + '</button>' +
    '<button type="button" class="mp-ico big" id="mpNext" aria-label="Next song">' + I.next + '</button>' +
    '<button type="button" class="mp-ico" id="mpRep" aria-label="Repeat" aria-pressed="false">' + I.rep + '</button></div>' +
    '<div class="mp-vol" id="mpVolRow"><button type="button" class="mp-ico" id="mpMute" aria-label="Mute">' + I.vol + '</button>' +
    '<input type="range" id="mpVol" min="0" max="100" step="1" value="40" aria-label="Volume"></div>' +
    '<div class="mp-note" id="mpNote" hidden>On iPhone, use the side volume buttons 🔊</div>';
  var h3 = sec.querySelector('h3');
  if (h3) h3.after(box); else sec.prepend(box);

  var sheet = document.createElement('div');
  sheet.className = 'mp-sheet';
  sheet.id = 'mpSheet';
  sheet.setAttribute('aria-hidden', 'true');
  sheet.innerHTML =
    '<div class="mp-panel" role="dialog" aria-modal="true" aria-label="Playlist">' +
    '<div class="mp-grab" id="mpGrab"><i></i></div>' +
    '<div class="mp-sh-head"><div><h4>Our Playlist 🎶</h4><span id="mpShCount"></span></div>' +
    '<button type="button" class="mp-ico" id="mpClose" aria-label="Close playlist">' + I.close + '</button></div>' +
    '<div class="mp-rows" id="mpRows"></div></div>';
  document.body.appendChild(sheet);

  var el = {
    disc: $('#mpDisc'), meta: $('#mpMeta'), title: $('#mpTitle'), sub: $('#mpSub'), kick: $('#mpKick'),
    seek: $('#mpSeek'), cur: $('#mpCur'), dur: $('#mpDur'),
    play: $('#mpPlay'), prev: $('#mpPrev'), next: $('#mpNext'), shuf: $('#mpShuf'), rep: $('#mpRep'),
    mute: $('#mpMute'), vol: $('#mpVol'), volRow: $('#mpVolRow'), note: $('#mpNote'),
    listBtn: $('#mpListBtn'), rows: $('#mpRows'), count: $('#mpShCount'), close: $('#mpClose'), grab: $('#mpGrab')
  };
  if (!volOk) { el.volRow.hidden = true; el.note.hidden = false; }

  /* ---------- state -> screen ---------- */
  function idx() { return (typeof curSong === 'number' && curSong >= 0) ? curSong : 0; }
  function paintSeek(p) { el.seek.style.setProperty('--p', Math.max(0, Math.min(1, p)) * 100 + '%'); }
  function paintVol() {
    el.vol.value = Math.round(vol * 100);
    el.vol.style.setProperty('--p', Math.round(vol * 100) + '%');
    el.mute.innerHTML = vol === 0 ? I.mute : vol < 0.5 ? I.vollow : I.vol;
    el.mute.setAttribute('aria-label', vol === 0 ? 'Unmute' : 'Mute');
  }
  function paintToggles() {
    el.shuf.classList.toggle('on', shuffleOn); el.shuf.setAttribute('aria-pressed', shuffleOn);
    el.rep.classList.toggle('on', repeatOne); el.rep.setAttribute('aria-pressed', repeatOne);
    el.rep.innerHTML = repeatOne ? I.rep1 : I.rep;
    el.rep.setAttribute('aria-label', repeatOne ? 'Repeat this song' : 'Repeat all');
  }
  var dragging = false;
  function progress() {
    var d = music.duration, t = music.currentTime || 0, ok = isFinite(d) && d > 0;
    el.seek.disabled = !ok;
    if (!dragging) {
      el.cur.textContent = fmt(t);
      el.seek.value = ok ? Math.round(t / d * 1000) : 0;
      paintSeek(ok ? t / d : 0);
    }
    el.dur.textContent = ok ? fmt(d) : '--:--';
  }
  function ui() {
    var l = songList();
    var i = idx();
    var s = l[i] || l[0] || null;
    el.title.textContent = s ? s.label : 'No songs yet';
    el.sub.textContent = l.length ? 'Song ' + (i + 1) + ' of ' + l.length : '';
    var playing = !music.paused;
    el.kick.textContent = playing ? 'Now playing' : 'Paused';
    el.play.innerHTML = playing ? I.pause : I.play;
    el.play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    el.disc.classList.toggle('spin', playing);
    sec.classList.toggle('mp-playing', playing);
    el.prev.disabled = el.next.disabled = l.length < 2;
    el.listBtn.disabled = !l.length;
    if (sheet.classList.contains('show')) rows();
    meta();
  }

  /* ---------- playlist sheet ---------- */
  function rows() {
    var l = songList(), c = idx(), playing = !music.paused;
    el.count.textContent = l.length + (l.length === 1 ? ' song' : ' songs');
    el.rows.innerHTML = '';
    l.forEach(function (s, i) {
      var r = document.createElement('div');
      r.className = 'mp-row' + (i === c ? ' on' : '') + (i === c && playing ? ' playing' : '');
      r.setAttribute('role', 'button'); r.tabIndex = 0; r.dataset.i = i;
      r.innerHTML = '<span class="mp-n">' + (i + 1) + '</span><span class="mp-eq"><i></i><i></i><i></i></span>' +
        '<span class="mp-rt"></span><span class="mp-st">' + (i === c ? (playing ? 'Playing' : 'Paused') : '') + '</span>';
      r.querySelector('.mp-rt').textContent = s.label;
      el.rows.appendChild(r);
    });
  }
  function openSheet() {
    if (!songList().length) return;
    rows();
    sheet.classList.add('show');
    sheet.setAttribute('aria-hidden', 'false');
    var on = el.rows.querySelector('.mp-row.on');
    if (on) { setTimeout(function () { try { on.scrollIntoView({ block: 'center' }); } catch (e) { } }, 60); on.focus({ preventScroll: true }); }
  }
  function closeSheet() {
    sheet.classList.remove('show');
    sheet.setAttribute('aria-hidden', 'true');
    var p = $('.mp-panel', sheet); if (p) p.style.transform = '';
    try { el.listBtn.focus({ preventScroll: true }); } catch (e) { }
  }
  function pickRow(r) {
    var i = Number(r.dataset.i);
    if (i === idx()) { toggle(); }
    else { loadSong(i, true); }
    setTimeout(closeSheet, 260);
  }
  el.rows.addEventListener('click', function (e) { var r = e.target.closest('.mp-row'); if (r) pickRow(r); });
  el.rows.addEventListener('keydown', function (e) {
    var r = e.target.closest && e.target.closest('.mp-row');
    if (!r) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickRow(r); }
    if (e.key === 'ArrowDown' && r.nextElementSibling) { e.preventDefault(); r.nextElementSibling.focus(); }
    if (e.key === 'ArrowUp' && r.previousElementSibling) { e.preventDefault(); r.previousElementSibling.focus(); }
  });
  el.listBtn.addEventListener('click', openSheet);
  el.meta.addEventListener('click', openSheet);
  el.meta.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSheet(); } });
  el.close.addEventListener('click', closeSheet);
  sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheet.classList.contains('show')) closeSheet(); });

  /* swipe the sheet down to close it */
  (function () {
    var panel = $('.mp-panel', sheet), y0 = null, dy = 0;
    function down(e) { y0 = e.clientY; dy = 0; panel.style.transition = 'none'; try { el.grab.setPointerCapture(e.pointerId); } catch (x) { } }
    function move(e) { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); panel.style.transform = 'translateY(' + dy + 'px)'; }
    function up() {
      if (y0 == null) return;
      panel.style.transition = '';
      if (dy > 90) closeSheet(); else panel.style.transform = '';
      y0 = null; dy = 0;
    }
    el.grab.addEventListener('pointerdown', down);
    el.grab.addEventListener('pointermove', move);
    el.grab.addEventListener('pointerup', up);
    el.grab.addEventListener('pointercancel', up);
  })();

  /* ---------- controls ---------- */
  function toggle() {
    if (typeof toggleMusic === 'function') toggleMusic();
    else if (music.paused) { music.muted = false; music.play().catch(function () { }); } else music.pause();
    ui();
  }
  function nextIdx() {
    var n = songList().length, c = idx();
    if (n < 2) return 0;
    if (shuffleOn) { var r; do { r = Math.floor(Math.random() * n); } while (r === c); return r; }
    return (c + 1) % n;
  }
  function next() { if (songList().length) loadSong(nextIdx(), true); }
  function prev() {
    if (music.currentTime > 3) { music.currentTime = 0; return; }
    if (songList().length) loadSong(idx() - 1, true);
  }
  el.play.addEventListener('click', toggle);
  el.next.addEventListener('click', next);
  el.prev.addEventListener('click', prev);
  el.shuf.addEventListener('click', function () { shuffleOn = !shuffleOn; lsSet('ifraMpShuffle', shuffleOn ? '1' : '0'); paintToggles(); });
  el.rep.addEventListener('click', function () { repeatOne = !repeatOne; lsSet('ifraMpRepeat', repeatOne ? 'one' : 'all'); paintToggles(); });

  /* seek: drag the bar, the time follows, the song jumps when you let go */
  el.seek.addEventListener('input', function () {
    dragging = true;
    var d = music.duration;
    if (isFinite(d) && d > 0) { el.cur.textContent = fmt(el.seek.value / 1000 * d); paintSeek(el.seek.value / 1000); }
  });
  function commitSeek() {
    if (!dragging) return;
    dragging = false;
    var d = music.duration;
    if (isFinite(d) && d > 0) { try { music.currentTime = el.seek.value / 1000 * d; } catch (e) { } }
  }
  el.seek.addEventListener('change', commitSeek);
  el.seek.addEventListener('pointerup', commitSeek);
  el.seek.addEventListener('touchend', commitSeek);

  /* volume */
  function setVol(v, persist) {
    v = Math.max(0, Math.min(1, v));
    vol = v; window.MP_VOL = v;
    if (v > 0) lastVol = v;
    if (volOk) { try { music.volume = v; } catch (e) { } }
    if (persist) lsSet('ifraVol', v);
    paintVol();
  }
  el.vol.addEventListener('input', function () { setVol(el.vol.value / 100, true); });
  el.mute.addEventListener('click', function () { setVol(vol > 0 ? 0 : (lastVol || 0.4), true); });

  /* ---------- hooks used by ifra.js (song ended) ---------- */
  window.MP = {
    onEnded: function () {
      var n = songList().length;
      if (repeatOne) { music.currentTime = 0; music.play().catch(function () { }); return true; }
      if (shuffleOn && n > 1) { loadSong(nextIdx(), true); return true; }
      return false;
    },
    next: next, prev: prev, toggle: toggle
  };

  /* ---------- lock-screen / notification controls ---------- */
  var ms = 'mediaSession' in navigator ? navigator.mediaSession : null;
  function meta() {
    if (!ms || typeof MediaMetadata === 'undefined') return;
    var l = songList(), s = l[idx()];
    if (!s) return;
    try {
      ms.metadata = new MediaMetadata({
        title: s.label, artist: 'For Ifra 💕', album: 'Our Playlist',
        artwork: [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: '/icon-192.png', sizes: '192x192', type: 'image/png' }]
      });
    } catch (e) { }
  }
  if (ms) {
    var set = function (a, f) { try { ms.setActionHandler(a, f); } catch (e) { } };
    set('play', function () { music.muted = false; music.play().catch(function () { }); });
    set('pause', function () { music.pause(); });
    set('previoustrack', prev);
    set('nexttrack', next);
    set('seekto', function (d) { if (d && isFinite(d.seekTime)) music.currentTime = d.seekTime; });
    set('seekbackward', function (d) { music.currentTime = Math.max(0, music.currentTime - ((d && d.seekOffset) || 10)); });
    set('seekforward', function (d) { music.currentTime = Math.min(music.duration || 1e9, music.currentTime + ((d && d.seekOffset) || 10)); });
  }
  var lastPos = 0;
  function position() {
    if (!ms || !ms.setPositionState) return;
    var now = Date.now();
    if (now - lastPos < 1000) return;
    lastPos = now;
    var d = music.duration;
    if (!isFinite(d) || d <= 0) return;
    try { ms.setPositionState({ duration: d, position: Math.min(music.currentTime || 0, d), playbackRate: music.playbackRate || 1 }); } catch (e) { }
  }

  /* ---------- listen to the audio ---------- */
  ['play', 'pause', 'playing', 'loadstart', 'emptied', 'ended'].forEach(function (n) { music.addEventListener(n, ui); });
  ['timeupdate', 'durationchange', 'loadedmetadata', 'seeked'].forEach(function (n) { music.addEventListener(n, function () { progress(); position(); }); });

  paintToggles(); paintVol(); ui(); progress();
})();
