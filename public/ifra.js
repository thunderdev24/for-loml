/* ⚡ LITE MODE for weak phones (2 GB RAM and similar).
   Turns on by itself when the phone reports 2 GB of memory or less, or after the page
   closed by itself twice in a row right after opening. It removes the heavy extras
   (stars, floating names, blur, moving background, sparkle trail) and keeps everything else.
   Force it on with  yoursite/?lite=1  and off with  ?lite=0  (the choice is remembered). */
const LITE = (function () {
  let on = false;
  try {
    const q = new URLSearchParams(location.search).get('lite');
    if (q === '1') localStorage.setItem('ifraLite', '1');
    if (q === '0') { localStorage.setItem('ifraLite', '0'); localStorage.setItem('ifraFails', '0'); }
    const forced = localStorage.getItem('ifraLite');
    let fails = Number(localStorage.getItem('ifraFails') || 0);
    if (localStorage.getItem('ifraBoot') === '1') fails++;           // last time it never got to relax
    localStorage.setItem('ifraFails', String(fails));
    localStorage.setItem('ifraBoot', '1');
    setTimeout(() => { try { localStorage.removeItem('ifraBoot'); localStorage.setItem('ifraFails', '0'); } catch (e) { } }, 20000);
    window.addEventListener('pagehide', () => { try { localStorage.removeItem('ifraBoot'); } catch (e) { } });
    const weak = !!(navigator.deviceMemory && navigator.deviceMemory <= 2);
    on = forced === '1' || (forced !== '0' && (weak || fails >= 2));
  } catch (e) { }
  if (on) {
    document.documentElement.classList.add('lite');
    const st = document.createElement('style');
    st.id = 'liteCss';
    st.textContent = `
html.lite body{animation:none!important;background-attachment:scroll!important;background-size:170% 170%!important;background-position:50% 35%!important}
html.lite .star,html.lite .float-name,html.lite .shooting-star{display:none!important}
html.lite *,html.lite *::before,html.lite *::after{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
html.lite .card{background:rgba(46,10,28,.92)!important;box-shadow:0 10px 26px rgba(0,0,0,.5)!important}
html.lite #roseScreen{box-shadow:none!important}
html.lite #roseScreen::before,html.lite #roseScreen::after{display:none!important}
html.lite .flower{filter:none!important;animation:roseBloomIn 1.2s ease backwards!important}
html.lite .flower::before{animation:none!important;opacity:.8}
html.lite .petal{will-change:auto!important;box-shadow:inset 0 -5px 8px rgba(60,0,22,.45),inset 0 3px 5px rgba(255,255,255,.25)!important}
html.lite #roseScreen.opened .rose-name{animation:liteName 1.4s ease 1.2s forwards!important;filter:none!important;text-shadow:0 0 14px rgba(255,70,125,.9)!important}
@keyframes liteName{from{opacity:0;transform:translateY(-50%)}to{opacity:1;transform:translateY(-50%)}}`;
    document.head.appendChild(st);
  }
  return on;
})();

const SITE = window.SITE;

/* =====================================================
   🔐 LOGIN (gallery, Our Story and the proposal)
   Only active when logins were set up in the admin panel.
   ===================================================== */
const AUTH = {
  loaded: false, role: null, after: null,
  ok() { return !window.SITE_LOCKED || this.loaded; },
  token() { try { return (JSON.parse(localStorage.getItem('ifraAuth') || 'null') || {}).token || ''; } catch (e) { return ''; } },
  save(token, role) { try { localStorage.setItem('ifraAuth', JSON.stringify({ token, role })); } catch (e) { } this.role = role; },
  clear() { try { localStorage.removeItem('ifraAuth'); } catch (e) { } this.loaded = false; this.role = null; },
  // fetch the private parts of the site with the saved token
  async load() {
    const t = this.token();
    if (!t) return false;
    let r;
    try { r = await fetch('/api/auth/protected', { headers: { Authorization: 'Bearer ' + t }, cache: 'no-store' }); }
    catch (e) { return false; }                      // offline: stay locked, keep the token
    if (r.status === 401) { this.clear(); return false; }
    if (!r.ok) return false;
    const j = await r.json().catch(() => ({}));
    try { this.role = (JSON.parse(localStorage.getItem('ifraAuth') || '{}') || {}).role || null; } catch (e) { }
    applyProtected(j.data);
    this.loaded = true;
    refreshLockedUI();
    return true;
  }
};
function requireLogin(cb) {
  if (AUTH.ok()) { cb(); return; }
  AUTH.after = cb;
  openFun('login');
}
async function doLogin(username, password) {
  const r = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Could not log in');
  AUTH.save(j.token, j.role);
  if (!(await AUTH.load())) throw new Error('Logged in, but the page could not load. Please try again.');
}
function refreshLockedUI() {
  renderGallery();
  refreshStoryBtn();
}
// put the private data (from the server, or the built-in copy) into the page
function applyProtected(p) {
  p = p || {};
  const d = window.SITE_PROT_DEFAULT || {};
  ['memories', 'story', 'proposalScenes', 'yesScenes', 'noTexts'].forEach(k => {
    SITE[k] = p[k] !== undefined ? p[k] : d[k];
  });
  ['proposalTitle', 'proposalSub', 'proposalYes', 'proposalFinal'].forEach(k => {
    const v = (p.text && p.text[k] !== undefined) ? p.text[k] : (d.text || {})[k];
    if (v !== undefined) SITE.text[k] = v;
  });
  if (!SITE.memories) SITE.memories = [];
  if (!SITE.noTexts || !SITE.noTexts.length) SITE.noTexts = ['No'];
  galleryItems = SITE.memories.filter(m => m.src && m.src.trim());
  galleryBuilt = false; galleryTiles = []; galleryCols = 0;
  const wrap = document.getElementById('galleryMasonry');
  if (wrap) wrap.innerHTML = '';
  STORY = SITE.story || { pages: [] };
  PROPOSAL_SCENES = SITE.proposalScenes || [];
  PROPOSAL_YES_SCENES = SITE.yesScenes || [];
  NO_TEXTS = SITE.noTexts;
}

function showMessage() {
  document.getElementById('msg').style.display = 'block';
  document.getElementById('letter').classList.add('show');
  heartRain();
  // Check scaling as the content expands
  setTimeout(autoScaleCard, 100);
  setTimeout(autoScaleCard, 500);
  setTimeout(autoScaleCard, 1000);
  setTimeout(autoScaleCard, 2000);
}

function toggleMode() { document.body.classList.toggle('sunset') }

function heartRain() {
  for (let i = 0; i < (LITE ? 10 : 30); i++) {
    const h = document.createElement('div');
    h.className = 'rain-heart';
    h.innerHTML = '❤️';
    h.style.left = Math.random() * 100 + 'vw';
    h.style.animationDelay = Math.random() + 's';
    document.body.appendChild(h);
    setTimeout(() => h.remove(), 3000)
  }
}

/* ✨ Floating "I ❤️ U" letters like Ifra names */
function floatingLove() {
  const phrases = ["I ❤️ U", "I ❤️ U", "I ❤️ U", "I ❤️ U", "I ❤️ U"];
  for (let i = 0; i < 15; i++) { // 15 phrases at a time
    const n = document.createElement('div');
    n.className = 'float-name';
    n.innerText = phrases[Math.floor(Math.random() * phrases.length)];
    n.style.left = Math.random() * 100 + 'vw';
    n.style.top = '-50px';
    n.style.fontSize = (16 + Math.random() * 20) + 'px'; // random size
    n.style.color = '#ff4d6d';
    n.style.opacity = 0.8;
    n.style.animationDelay = Math.random() * 10 + 's';
    document.body.appendChild(n);
  }
}

function floatingNames() {
  for (let i = 0; i < 8; i++) {
    const n = document.createElement('div');
    n.className = 'float-name';
    n.innerText = 'Ifra';
    n.style.left = Math.random() * 100 + 'vw';
    n.style.animationDelay = Math.random() * 10 + 's';
    document.body.appendChild(n)
  }
}

// Initialize floating elements
if (!LITE) { floatingNames(); floatingLove(); }

let _lastMove = 0;
document.addEventListener('mousemove', e => {
  const _now = performance.now();
  if (_now - _lastMove < 45) return; // light-weight: ~22 sparkles/sec max, looks identical
  _lastMove = _now;
  if (_sparkleBlocked()) return;
  const p = document.createElement('div');
  p.className = 'particle';
  p.innerHTML = Math.random() > .5 ? '❤️' : '✨';
  p.style.left = e.clientX + 'px';
  p.style.top = e.clientY + 'px';

  // Random dispersion for fadeOut animation
  const dx = (Math.random() - 0.5) * 100 + 'px';
  const dy = (Math.random() - 0.5) * 100 - 50 + 'px';
  p.style.setProperty('--dx', dx);
  p.style.setProperty('--dy', dy);

  document.body.appendChild(p);
  setTimeout(() => p.remove(), 1500);
});

document.addEventListener('dblclick', () => {
  document.getElementById('secret').style.display = 'block'
})

// Star Background
for (let i = 0; i < (LITE ? 0 : 60); i++) {
  const s = document.createElement('div')
  s.className = 'star'
  s.style.left = Math.random() * 100 + 'vw'
  s.style.animationDuration = 5 + Math.random() * 10 + 's'
  s.style.opacity = Math.random()
  document.body.appendChild(s)
}

/* 🌹 ROSE FLOW */
let roseOpened = false;
function dropPetals() {
  if (roseOpened) return;          // ignore double taps
  roseOpened = true;

  const rose = document.getElementById('roseScreen');
  if (rose) rose.classList.add('opened');
  playMusic();

  document.querySelectorAll('.petal').forEach((petal, i) => {
    setTimeout(() => petal.classList.add('fall'), i * 300);
  });

  // fade the rose screen out while the card fades in underneath it
  setTimeout(() => {
    if (rose) rose.style.opacity = 0;
    const card = document.querySelector('.card');
    if (card) card.classList.add('show');
  }, 3300);

  setTimeout(() => { if (rose) rose.remove(); }, 4000);
  setTimeout(prepareLoveSong, 4500);                                   // start loading her love song quietly
  setTimeout(() => { installBannerReady = true; tryInstallBanner(); }, 8000);   // then suggest installing the app
}

const music = document.getElementById("bgMusic");
if (LITE) music.preload = 'metadata';

/* 🎶 PLAYLIST: songs play one after another (in the order of the admin list, then back to the first).
   The song that starts when she taps the rose is chosen in the admin panel (Playlist tab). */
function songList() { return ((window.SITE && SITE.songs) || []).filter(function (s) { return s && s.file; }); }
function songIndexOf(file) {
  const l = songList();
  for (let i = 0; i < l.length; i++) if (l[i].file === file) return i;
  return -1;
}
let curSong = -1, songFails = 0;
function loadSong(i, autoplay) {
  const l = songList();
  if (!l.length) return;
  i = ((i % l.length) + l.length) % l.length;
  curSong = i;
  const source = music.querySelector('source');
  if (source) { source.removeAttribute('type'); source.src = l[i].file; }
  else music.src = l[i].file;
  const sel = document.getElementById('songSelect');
  if (sel) sel.value = l[i].file;
  music.load();
  if (autoplay) { music.muted = false; music.play().catch(() => { }); }
}
music.loop = false;
music.removeAttribute('loop');                       // so the "ended" event fires and the next song can start
music.addEventListener('ended', () => {
  songFails = 0;
  if (songList().length > 1) loadSong(curSong + 1, true);
  else { music.currentTime = 0; music.play().catch(() => { }); }   // only one song: repeat it
});
music.addEventListener('playing', () => { songFails = 0; });
music.addEventListener('error', () => {              // a missing / broken file is skipped, never stuck
  const n = songList().length;
  if (n > 1 && songFails < n) { songFails++; loadSong(curSong + 1, !music.paused || roseOpened); }
});
(function initPlaylist() {                           // load the chosen start song right away so it is ready on the rose tap
  const l = songList();
  if (!l.length) return;
  let i = songIndexOf(SITE.settings && SITE.settings.roseSong);
  if (i < 0) i = 0;
  loadSong(i, false);
})();

/* Phones only allow audio inside a real tap, so music starts from the rose tap.
   (The old muted "pre-unlock" could pause the song right after the tap, so it was removed.) */
function playMusic() {
  if (curSong < 0 && songList().length) {
    const i = songIndexOf(SITE.settings && SITE.settings.roseSong);
    loadSong(i < 0 ? 0 : i, false);
  }
  music.muted = false;
  music.volume = 0.4; // Lower default volume
  const p = music.play();
  if (p && p.catch) {
    p.catch(() => {
      // blocked or not loaded yet: try once more on the very next tap
      document.addEventListener('pointerup', () => {
        music.muted = false;
        music.play().catch(() => { });
      }, { once: true });
    });
  }
}

/* Enter / Space work on every custom button marked data-kb */
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const t = e.target.closest && e.target.closest('[data-kb]');
  if (!t) return;
  e.preventDefault();
  t.click();
});

const BIRTHDAY = { day: SITE.settings.birthdayDay, month: SITE.settings.birthdayMonth - 1 };

let birthdayMode = false;
let cinemaTriggered = false;
let poetryTransitionTimer = null;

function getNextBirthday() {
  const now = new Date();
  let year = now.getFullYear();
  const thisYearBirthday = new Date(year, BIRTHDAY.month, BIRTHDAY.day, 0, 0, 0);
  if (now > thisYearBirthday) year++;
  return new Date(year, BIRTHDAY.month, BIRTHDAY.day, 0, 0, 0);
}

function isBirthdayToday() {
  const today = new Date();
  return (today.getDate() === BIRTHDAY.day && today.getMonth() === BIRTHDAY.month);
}

function triggerCinemaMode(s) {
  const overlay = document.getElementById("cinemaOverlay");
  const digit = document.getElementById("cinemaCountdown");
  const card = document.querySelector('.card');

  if (!overlay || !digit) return;

  if (cinemaTriggered) {
    if (digit.innerText != s) {
      digit.innerText = s;
      digit.classList.remove("digit-animate");
      void digit.offsetWidth; // trigger reflow
      digit.classList.add("digit-animate");
    }
    return;
  }

  cinemaTriggered = true;
  overlay.classList.add("show");
  digit.innerText = s;
  digit.classList.add("digit-animate");

  if (card) {
    card.style.opacity = '0';
    card.style.pointerEvents = 'none';
  }
}

function exitCinemaMode() {
  cinemaTriggered = false;
  const overlay = document.getElementById("cinemaOverlay");
  const card = document.querySelector('.card');
  if (overlay) overlay.classList.remove("show");
  if (card) {
    card.style.opacity = '1';
    card.style.pointerEvents = 'auto';
  }
}

function fireCornerPoppers() {
  const corners = ['bl', 'br', 'tl', 'tr'];
  corners.forEach(corner => {
    const p = document.createElement('div');
    p.className = `popper ${corner}`;
    p.innerText = '🎉';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 2000);

    for (let i = 0; i < (LITE ? 12 : 40); i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 70%)`;

      const isTop = corner.startsWith('t');
      const isLeft = corner.endsWith('l');
      const x1 = isLeft ? 0 : window.innerWidth;
      const y1 = isTop ? 0 : window.innerHeight;
      const x2 = x1 + (isLeft ? 1 : -1) * (Math.random() * 500 + 100);
      const y2 = y1 + (isTop ? 1 : -1) * (Math.random() * 500 + 100);

      c.style.left = '0';
      c.style.top = '0';
      c.style.setProperty('--x1', x1 + 'px');
      c.style.setProperty('--y1', y1 + 'px');
      c.style.setProperty('--x2', x2 + 'px');
      c.style.setProperty('--y2', y2 + 'px');
      c.style.setProperty('--d', (0.6 + Math.random() * 1.4) + 's');

      document.body.appendChild(c);
      setTimeout(() => c.remove(), 2000);
    }
  });
}

function startBirthdayDay() {
  if (birthdayMode) return;
  birthdayMode = true;

  if (cinemaTriggered) exitCinemaMode();

  document.body.classList.add("cinematicZoom");
  document.getElementById("birthdayScene")?.classList.add("show");
  fireworks();

  // After 8 seconds, transition to Poetry
  poetryTransitionTimer = setTimeout(() => {
    if (!birthdayMode) return; // Safety check if day ended
    document.getElementById("birthdayScene")?.classList.remove("show");
    startPoetry();
  }, 8000);

  const countdownEl = document.getElementById("countdown");
  if (countdownEl) countdownEl.innerHTML = SITE.text.birthdayBanner;
}

function endBirthdayDay() {
  birthdayMode = false;

  // Clear any pending transitions
  if (poetryTransitionTimer) {
    clearTimeout(poetryTransitionTimer);
    poetryTransitionTimer = null;
  }

  // Clean up poetry
  poetryActive = false;
  clearInterval(typingTimer);
  clearTimeout(autoNextTimer);
  document.getElementById("poetryOverlay")?.classList.remove("show");

  document.body.classList.remove("cinematicZoom");
  document.getElementById("birthdayScene")?.classList.remove("show");
}

setInterval(() => {
  const now = new Date();
  const nextBirthday = getNextBirthday();
  const diff = nextBirthday - now;
  const countdownEl = document.getElementById("countdown");

  if (isBirthdayToday()) {
    startBirthdayDay();
    return;
  }

  if (birthdayMode) endBirthdayDay();

  const d = Math.floor(diff / 86400000);
  const h = Math.floor(diff / 3600000) % 24;
  const m = Math.floor(diff / 60000) % 60;
  const s = Math.floor(diff / 1000) % 60;

  if (d === 0 && h === 0 && m === 0 && s <= 10 && s > 0) {
    triggerCinemaMode(s);
  } else if (d === 0 && h === 0 && m === 0 && s === 0) {
    if (cinemaTriggered) {
      fireCornerPoppers();
      setTimeout(startBirthdayDay, 1500);
    } else {
      startBirthdayDay();
    }
  } else {
    if (cinemaTriggered) exitCinemaMode();
    if (countdownEl) {
      countdownEl.innerHTML = `🎂 ${d} days ${h} hrs ${m} mins <span>${s}</span> secs left`;
    }
  }
}, 1000);

function heartBurst() {
  for (let i = 0; i < (LITE ? 10 : 28); i++) {
    const h = document.createElement('div');
    h.className = 'heart-burst';
    h.innerHTML = '❤️';
    h.style.left = '50vw'; h.style.top = '50vh';
    h.style.setProperty('--x', (Math.random() * 400 - 200) + 'px');
    h.style.setProperty('--y', (Math.random() * 400 - 200) + 'px');
    document.body.appendChild(h);
    setTimeout(() => h.remove(), 1200);
  }
}

function fireworks() {
  for (let i = 0; i < (LITE ? 14 : 40); i++) {
    const f = document.createElement('div');
    f.className = 'firework';
    f.innerHTML = '🎆';
    f.style.left = '50vw'; f.style.top = '50vh';
    f.style.setProperty('--x', (Math.random() * 500 - 250) + 'px');
    f.style.setProperty('--y', (Math.random() * 500 - 250) + 'px');
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1500);
  }
}

function showFinale() {
  if (birthdayMode) { startBirthdayDay(); return; }
  playForeverCinematic();     // the cinematic leads into the "I LOVE YOU" screen
}

/* the "I LOVE YOU" screen itself (shown at the end of the cinematic) */
function revealFinale() {
  const finale = document.getElementById('finale');
  finale.classList.add('show');
  finale.style.pointerEvents = "auto";
  fireworks();
}

/* ---------- 🎬 FOREVER YOURS CINEMATIC ----------
   Two lights drift across a night sky, find each other, meet in a burst of
   hearts, and "Forever Yours" appears, then it melts into the I LOVE YOU screen.
   Tap anywhere to skip. The love song (admin > Playlist) starts with her tap.
   Lines are editable: add "foreverLines": [[second, "text"], ...] to content.js. */
const FOREVER_LINES = [
  [0.9, "Out of every heart in this world,"],
  [4.2, "mine found its way to yours."],
  [7.2, ""],
  [9.8, "You are my dua, answered."],
  [12.6, "Today, tomorrow, and always,"],
  [15.2, ""]
];
let foreverStop = null;
function playForeverCinematic() {
  if (foreverStop) return;
  const lines = (Array.isArray(SITE.foreverLines) && SITE.foreverLines.length) ? SITE.foreverLines : FOREVER_LINES;
  const titleText = (SITE.text && SITE.text.foreverCinemaTitle) || 'Forever Yours ❤️';
  const ov = document.createElement('div');
  ov.className = 'cine fy';
  ov.innerHTML = '<canvas class="cine-cv fy-cv"></canvas><div class="cine-bar top"></div><div class="cine-bar bottom"></div>' +
    '<div class="fy-title"></div><div class="cine-text"></div><div class="cine-hint">Tap to skip</div>';
  ov.querySelector('.fy-title').innerHTML = titleText;
  document.body.appendChild(ov);
  document.body.classList.add('cine-on');
  startLoveSong();                       // inside her tap, so phones allow the sound
  requestAnimationFrame(() => ov.classList.add('show'));

  const cv = ov.querySelector('canvas'), ctx = cv.getContext('2d');
  const textEl = ov.querySelector('.cine-text'), titleEl = ov.querySelector('.fy-title');
  const dpr = (LITE ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
  let W = 0, H = 0, S = 1;
  function size() {
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = Math.min(W, H * 0.85) / 40;
  }
  size();
  window.addEventListener('resize', size);

  const MEET = 8.4, TITLE = 15.6, END = 21.5;
  const stars = [];
  for (let i = 0; i < (LITE ? 70 : 140); i++) {
    stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.6 + 0.4, sp: 0.8 + Math.random() * 2, ph: Math.random() * 6.28 });
  }
  // two lights: one rose, one gold, each starting from a far corner
  const orbs = [
    { sx: -0.08, sy: 0.82, hue: 345, side: 1, trail: [] },
    { sx: 1.08, sy: 0.16, hue: 42, side: -1, trail: [] }
  ];
  const bits = [];                       // hearts / sparks after the meeting
  let burst = false, shooting = [], nextShoot = 2.5;
  let lineIdx = -1, closed = false, raf = 0, last = performance.now();
  const t0 = last, openedAt = t0;

  function setLine(txt) {
    textEl.classList.remove('on');
    setTimeout(() => {
      if (closed) return;
      textEl.textContent = txt;
      if (txt) textEl.classList.add('on');
    }, 450);
  }
  function spawn(x, y, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.2832, sp = speed * (0.25 + Math.random());
      bits.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20,
        life: 1, dec: 1 / (4 + Math.random() * 4), size: (0.7 + Math.random() * 1.1) * S * 0.9,
        g: Math.random() < 0.7 ? '\u2665' : '\u2726', hue: Math.random() < 0.75 ? 335 + Math.random() * 22 : 38 + Math.random() * 14,
        ph: Math.random() * 6.28
      });
    }
  }
  function glow(x, y, r, hue, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'hsla(' + hue + ',100%,78%,' + a.toFixed(3) + ')');
    g.addColorStop(0.35, 'hsla(' + hue + ',100%,62%,' + (a * 0.45).toFixed(3) + ')');
    g.addColorStop(1, 'hsla(' + hue + ',100%,55%,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    const t = (now - t0) / 1000;
    const cx = W / 2, cy = H / 2 - H * 0.05;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);

    for (const s of stars) {
      const a = 0.2 + 0.6 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
      ctx.fillStyle = 'rgba(255,235,240,' + a.toFixed(3) + ')';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalCompositeOperation = 'lighter';

    // occasional shooting star
    if (t > nextShoot && t < MEET - 1) {
      shooting.push({ x: W * (0.2 + Math.random() * 0.7), y: H * Math.random() * 0.35, vx: -W * 0.5, vy: H * 0.28, life: 1 });
      nextShoot += 1.6 + Math.random() * 1.8;
    }
    shooting = shooting.filter(s => s.life > 0);
    for (const s of shooting) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt * 1.3;
      ctx.strokeStyle = 'rgba(255,230,240,' + Math.max(0, s.life).toFixed(3) + ')';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.09, s.y - s.vy * 0.09); ctx.stroke();
    }

    // the two lights travel toward each other, swaying like they are shy
    const u = Math.max(0, Math.min(1, (t - 1.2) / (MEET - 1.2)));
    const e = u * u * (3 - 2 * u);
    if (t < MEET) {
      for (const o of orbs) {
        const x0 = o.sx * W, y0 = o.sy * H;
        const sway = Math.sin(t * 1.7 + o.side) * (1 - e) * S * 5 * o.side;
        const x = x0 + (cx - x0) * e + sway;
        const y = y0 + (cy - y0) * e - Math.sin(e * 3.1416) * S * 4 * o.side;
        o.x = x; o.y = y;
        o.trail.push({ x, y }); if (o.trail.length > 38) o.trail.shift();
        const appear = Math.min(1, t / 1.4);
        for (let i = 0; i < o.trail.length; i++) {
          const k = i / o.trail.length;
          glow(o.trail[i].x, o.trail[i].y, S * (0.5 + k * 1.1), o.hue, k * 0.35 * appear);
        }
        glow(x, y, S * (2.6 + 0.3 * Math.sin(t * 5 + o.side)), o.hue, 0.85 * appear);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.9 * appear).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(x, y, S * 0.32, 0, 6.2832); ctx.fill();
      }
      // a faint thread of light between them as they get close
      if (u > 0.35) {
        ctx.strokeStyle = 'rgba(255,170,190,' + (0.35 * (u - 0.35)).toFixed(3) + ')';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(orbs[0].x, orbs[0].y); ctx.lineTo(orbs[1].x, orbs[1].y); ctx.stroke();
      }
    }

    // the meeting: flash, shockwave, hearts
    if (t >= MEET) {
      const bt = t - MEET;
      if (!burst) { burst = true; spawn(cx, cy, LITE ? 70 : 130, 300); }
      const base = Math.min(1, bt / 2);
      glow(cx, cy, S * (7 + 3 * base + 0.5 * Math.sin(t * 5.5)), 350, 0.5 * base * (t > TITLE ? 0.7 : 1));
      if (bt < 2.2) {
        ctx.strokeStyle = 'rgba(255,205,215,' + Math.max(0, 1 - bt / 2.2).toFixed(3) + ')';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, bt * Math.max(W, H) * 0.5, 0, 6.2832); ctx.stroke();
      }
      if (bt < 0.7) {
        ctx.fillStyle = 'rgba(255,240,245,' + (0.5 * (1 - bt / 0.7)).toFixed(3) + ')';
        ctx.fillRect(0, 0, W, H);
      }
      if (t < END - 3 && Math.random() < dt * (LITE ? 5 : 9)) {
        spawn(Math.random() * W, H + 10, 1, 40);      // hearts keep floating up
        const b = bits[bits.length - 1]; b.vy = -(40 + Math.random() * 70); b.vx = (Math.random() - 0.5) * 30;
      }
    }

    // hearts and sparks
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.life -= b.dec * dt;
      if (b.life <= 0) { bits.splice(i, 1); continue; }
      const drag = Math.exp(-dt * 0.9);
      b.vx *= drag; b.vy = b.vy * drag - 14 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      const a = Math.min(1, b.life * 1.6) * (0.6 + 0.4 * Math.sin(t * 5 + b.ph));
      ctx.fillStyle = 'hsla(' + b.hue.toFixed(0) + ',100%,70%,' + Math.max(0, a).toFixed(3) + ')';
      ctx.font = Math.round(b.size) + 'px serif';
      ctx.fillText(b.g, b.x, b.y);
    }

    // poetic lines, then the title
    let idx = -1;
    for (let i = 0; i < lines.length; i++) if (t >= lines[i][0]) idx = i;
    if (idx !== lineIdx) { lineIdx = idx; if (idx >= 0) setLine(lines[idx][1]); }
    if (t >= TITLE && !titleEl.classList.contains('on')) titleEl.classList.add('on');

    if (t >= END) { finish(false); return; }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function finish(skipped) {
    if (closed || (skipped && performance.now() - openedAt < 900)) return;
    closed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', size);
    document.removeEventListener('keydown', onKey);
    revealFinale();                      // appears underneath while the cinematic fades away
    ov.style.pointerEvents = 'none';
    ov.classList.remove('show');
    document.body.classList.remove('cine-on');
    setTimeout(() => ov.remove(), 1800);
    foreverStop = null;
  }
  const onKey = e => { if (e.key === 'Escape') finish(true); };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('click', () => finish(true));
  foreverStop = () => finish(false);
}

function hideFinale() {
  const finale = document.getElementById('finale');
  stopLoveSong();
  finale.classList.remove('show');
  finale.classList.add('hide');
  setTimeout(() => {
    finale.classList.remove('hide');
    finale.style.pointerEvents = "none";
  }, 800);
}

/* 💌 POETRY LOGIC */
let poetryIndex = 0;
let charIndex = 0;
let poetryActive = false;
let typingTimer = null;
let autoNextTimer = null;

const poetryLines = SITE.poetryLines;

function typeLine() {
  if (poetryIndex >= poetryLines.length) { endPoetry(); return; }
  charIndex = 0;
  const line = poetryLines[poetryIndex];
  const el = document.getElementById("poetryLine");
  el.textContent = "";

  typingTimer = setInterval(() => {
    el.textContent += line.charAt(charIndex);
    charIndex++;
    if (charIndex >= line.length) {
      clearInterval(typingTimer);
      poetryIndex++;
      autoNextTimer = setTimeout(typeLine, 3000);
    }
  }, 70);
}

function startPoetry() {
  if (poetryActive) return;
  poetryActive = true;
  poetryIndex = 0;
  charIndex = 0;
  const overlay = document.getElementById("poetryOverlay");
  overlay.classList.add("show");
  typeLine();
}

document.addEventListener("click", () => {
  if (poetryActive) {
    clearInterval(typingTimer);
    clearTimeout(autoNextTimer);
    // If the line wasn't finished, finish it immediately
    const line = poetryLines[poetryIndex];
    const el = document.getElementById("poetryLine");
    if (el.textContent.length < line.length) {
      el.textContent = line;
      poetryIndex++;
      autoNextTimer = setTimeout(typeLine, 3000);
    } else {
      typeLine();
    }
  }
});

function endPoetry() {
  poetryActive = false;
  const overlay = document.getElementById("poetryOverlay");
  overlay.classList.remove("show");

  // Return to Birthday Screen only if it's still the birthday
  if (birthdayMode) {
    document.getElementById("birthdayScene")?.classList.add("show");
  }
}

function autoScaleCard() {
  const card = document.querySelector('.card');
  if (!card) return;
  const vh = window.innerHeight;
  const cardHeight = card.scrollHeight;
  if (cardHeight > vh) {
    const scale = Math.max(0.8, vh / (cardHeight + 40));
    card.style.transform = `scale(${scale}) translateY(0)`;
  } else { card.style.transform = 'scale(1)'; }
}

window.addEventListener('load', autoScaleCard);
window.addEventListener('resize', autoScaleCard);

/* 🖼️ GALLERY & LIGHTBOX LOGIC */
/* ---------- GALLERY (responsive, works on phone / tablet / PC) ---------- */
// Only real photos (the empty "future memories" placeholders are skipped)
let galleryItems = (SITE.memories || []).filter(m => m.src && m.src.trim());
const PREVIEW_COUNT = 4;
let currentLightboxIndex = 0;
let galleryBuilt = false;

// Small preview inside the card
function renderGallery() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;
  grid.innerHTML = '';

  if (!AUTH.ok()) {
    // logins are on and she has not logged in yet
    const lock = document.createElement('div');
    lock.className = 'gallery-lock';
    lock.setAttribute('role', 'button'); lock.tabIndex = 0; lock.setAttribute('data-kb', '');
    lock.textContent = '🔒 Log in to see our memories';
    lock.onclick = () => requireLogin(openGallery);
    grid.appendChild(lock);
    const lb = document.getElementById('openGalleryBtn');
    if (lb) lb.textContent = 'Log in to open the gallery 🔐';
    autoScaleCard();
    return;
  }

  galleryItems.slice(0, PREVIEW_COUNT).forEach((mem, i) => {
    const img = document.createElement('img');
    img.src = mem.src;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = `Memory ${i + 1}`;
    img.onclick = () => openLightbox(mem.src, mem.text, i);
    grid.appendChild(img);
  });

  const btn = document.getElementById('openGalleryBtn');
  if (btn) btn.textContent = `Open Full Gallery 📸 (${galleryItems.length})`;
  autoScaleCard();
}
renderGallery();

// Full-screen gallery: built once, on first open
let galleryTiles = [];
let galleryMoreEl = null;
let galleryCols = 0;

function galleryColumnCount() {
  const w = window.innerWidth;
  if (w >= 1500) return 6;
  if (w >= 1024) return 5;
  if (w >= 640) return 3;
  return 2;
}

// Deals tiles into columns left-to-right so the story keeps its order
function layoutGallery() {
  const wrap = document.getElementById('galleryMasonry');
  if (!wrap || !galleryBuilt) return;
  const n = galleryColumnCount();
  if (n === galleryCols) return;
  galleryCols = n;
  wrap.innerHTML = '';
  const cols = [];
  for (let c = 0; c < n; c++) {
    const col = document.createElement('div');
    col.className = 'g-col';
    wrap.appendChild(col);
    cols.push(col);
  }
  galleryTiles.forEach((t, i) => cols[i % n].appendChild(t));
  cols[galleryTiles.length % n].appendChild(galleryMoreEl);
}

function buildGallery() {
  if (galleryBuilt) return;
  galleryBuilt = true;

  const count = document.getElementById('galleryCount');
  if (count) count.textContent = `${galleryItems.length} memories`;

  galleryItems.forEach((mem, i) => {
    const tile = document.createElement('figure');
    tile.className = 'g-tile';
    tile.tabIndex = 0;
    tile.style.animationDelay = Math.min(i, 12) * 60 + 'ms';

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = `Memory ${i + 1}`;
    img.onload = () => tile.classList.add('loaded');
    img.src = mem.src;

    const cap = document.createElement('figcaption');
    const txt = (mem.text || '').trim();
    cap.textContent = txt ? (txt.length > 60 ? txt.slice(0, 60) + '…' : txt) : `Memory ${i + 1} 💕`;

    tile.append(img, cap);
    tile.onclick = () => openLightbox(mem.src, mem.text, i);
    tile.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tile.click(); } };
    galleryTiles.push(tile);
  });

  galleryMoreEl = document.createElement('div');
  galleryMoreEl.className = 'g-more';
  galleryMoreEl.innerHTML = SITE.text.galleryMore;

  layoutGallery();
  window.addEventListener('resize', layoutGallery);
}

function openGallery() {
  if (!AUTH.ok()) { requireLogin(openGallery); return; }
  buildGallery();
  const o = document.getElementById('galleryOverlay');
  o.classList.add('show');
  o.setAttribute('aria-hidden', 'false');
  o.scrollTop = 0;
}

function closeGallery() {
  const o = document.getElementById('galleryOverlay');
  o.classList.remove('show');
  o.setAttribute('aria-hidden', 'true');
}

/* ---------- LIGHTBOX ---------- */
function openLightbox(imgSrc, text, index) {
  if (typeof index !== 'number') {
    index = galleryItems.findIndex(m => m.src === imgSrc);
    if (index < 0) index = 0;
  }
  currentLightboxIndex = index;
  const item = galleryItems[index];

  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  const desc = document.getElementById('lightbox-desc');
  const body = document.querySelector('.lightbox-body');
  const container = document.querySelector('.lightbox-img-container');

  let counter = document.getElementById('lightbox-counter');
  if (!counter) {
    counter = document.createElement('div');
    counter.id = 'lightbox-counter';
    counter.className = 'lb-counter';
    container.appendChild(counter);
  }

  img.style.opacity = 0;
  img.onload = () => { img.style.opacity = 1; };
  img.src = item.src;

  const t = (item.text || '').trim();
  desc.textContent = t;
  body.classList.toggle('no-text', !t);
  counter.textContent = `${index + 1} / ${galleryItems.length}`;

  lightbox.classList.add('show');

  // Preload neighbours so swiping feels instant
  (LITE ? [] : [1, -1]).forEach(d => {
    const n = galleryItems[(index + d + galleryItems.length) % galleryItems.length];
    const pre = new Image();
    pre.src = n.src;
  });
}

function closeLightbox(event) {
  if (event) {
    if (event.target !== document.getElementById('lightbox') && !event.target.classList.contains('close-btn')) {
      return;
    }
  }
  document.getElementById('lightbox').classList.remove('show');
}

function prevLightboxImage(event) {
  if (event) event.stopPropagation();
  currentLightboxIndex = (currentLightboxIndex - 1 + galleryItems.length) % galleryItems.length;
  openLightbox(null, null, currentLightboxIndex);
}

function nextLightboxImage(event) {
  if (event) event.stopPropagation();
  currentLightboxIndex = (currentLightboxIndex + 1) % galleryItems.length;
  openLightbox(null, null, currentLightboxIndex);
}

// Keyboard: arrows to browse, Esc to close
document.addEventListener('keydown', e => {
  const lb = document.getElementById('lightbox');
  const gal = document.getElementById('galleryOverlay');
  if (lb.classList.contains('show')) {
    if (e.key === 'ArrowLeft') prevLightboxImage();
    else if (e.key === 'ArrowRight') nextLightboxImage();
    else if (e.key === 'Escape') lb.classList.remove('show');
  } else if (gal.classList.contains('show') && e.key === 'Escape') {
    closeGallery();
  }
});

// Touch: swipe left / right inside the lightbox
(function () {
  const area = document.querySelector('.lightbox-img-container');
  if (!area) return;
  let sx = 0, sy = 0;
  area.addEventListener('touchstart', e => {
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
  }, { passive: true });
  area.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      dx < 0 ? nextLightboxImage() : prevLightboxImage();
    }
  }, { passive: true });
})();

/* =====================================================
   💕 ROMANTIC EXTRAS
   ===================================================== */

/* 🎵 Music on/off button */
function updateMusicBtn() {
  const b = document.getElementById('musicToggle');
  if (b) b.textContent = music.paused ? '🔇' : '🎵';
}
function toggleMusic() {
  if (music.paused) {
    music.muted = false;
    music.volume = 0.4;
    music.play().catch(() => { });
  } else {
    music.pause();
  }
  updateMusicBtn();
}
music.addEventListener('play', updateMusicBtn);
music.addEventListener('pause', updateMusicBtn);

/* 💓 Tap the big heart: it beats, hearts fly out and it counts */
(function () {
  const heart = document.querySelector('.card .heart');
  if (!heart) return;
  heart.style.cursor = 'pointer';
  heart.style.userSelect = 'none';

  const note = document.createElement('p');
  note.className = 'heart-count';
  note.textContent = SITE.text.heartNote;
  heart.after(note);

  const milestones = SITE.heartMilestones;
  let n = 0;

  heart.addEventListener('click', () => {
    n++;
    if (milestones[n]) note.textContent = milestones[n];
    else if (n > 30) note.textContent = `${n} heartbeats, and every one of them is yours 💗`;

    const r = heart.getBoundingClientRect();
    for (let i = 0; i < 10; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.textContent = ['❤️', '💕', '💖', '✨'][Math.floor(Math.random() * 4)];
      p.style.left = r.left + r.width / 2 + 'px';
      p.style.top = r.top + r.height / 2 + 'px';
      p.style.fontSize = (1 + Math.random()) + 'rem';
      p.style.setProperty('--dx', (Math.random() - 0.5) * 160 + 'px');
      p.style.setProperty('--dy', -40 - Math.random() * 120 + 'px');
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1500);
    }
  });
})();

/* 💌 "Open When..." envelopes (one open at a time) */
(function () {
  const envs = document.querySelectorAll('.envelope');
  function toggle(env) {
    const wasOpen = env.classList.contains('open');
    envs.forEach(e => e.classList.remove('open'));
    if (!wasOpen) {
      env.classList.add('open');
      setTimeout(() => env.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 350);
    }
    setTimeout(autoScaleCard, 450);
  }
  envs.forEach(env => {
    env.addEventListener('click', () => toggle(env));
    env.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(env); }
    });
  });
})();

/* 💑 "Days of loving you" counter.
   Put your special date below, e.g. new Date(2025, 5, 5)  (month starts at 0 = January) */
const LOVE_START = SITE.settings.loveStart ? new Date(SITE.settings.loveStart) : null;

(function () {
  const el = document.getElementById('loveDays');
  if (!el || !LOVE_START) return;
  el.style.display = 'block';
  function tick() {
    const diff = Date.now() - LOVE_START.getTime();
    if (diff < 0) { el.style.display = 'none'; return; }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor(diff / 3600000) % 24;
    const m = Math.floor(diff / 60000) % 60;
    el.innerHTML = SITE.text.loveDays.replace('{d}', d).replace('{h}', h).replace('{m}', m);
  }
  tick();
  setInterval(tick, 30000);
})();

/* ✨ Sparkle trail for touch screens (the mouse version already exists) */
(function () {
  let last = 0;
  document.addEventListener('touchmove', e => {
    const now = Date.now();
    if (now - last < 70) return;
    last = now;
    if (_sparkleBlocked()) return;
    const t = e.touches[0];
    const p = document.createElement('div');
    p.className = 'particle';
    p.textContent = Math.random() > .5 ? '❤️' : '✨';
    p.style.left = t.clientX + 'px';
    p.style.top = t.clientY + 'px';
    p.style.setProperty('--dx', (Math.random() - 0.5) * 80 + 'px');
    p.style.setProperty('--dy', -30 - Math.random() * 60 + 'px');
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1500);
  }, { passive: true });
})();

/* 🌠 Shooting stars every now and then */
(function () {
  if (LITE) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  function shoot() {
    if (!document.hidden) {
      const s = document.createElement('div');
      s.className = 'shooting-star';
      s.style.left = 30 + Math.random() * 65 + 'vw';
      s.style.top = Math.random() * 35 + 'vh';
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 1600);
    }
    setTimeout(shoot, 5000 + Math.random() * 7000);
  }
  setTimeout(shoot, 4000);
})();

/* =====================================================
   🎶 SONG SELECTION LOGIC
   ===================================================== */
function changeSong() {
  const select = document.getElementById("songSelect");
  if (!select) return;
  const wasPlaying = !music.paused;
  const i = songIndexOf(select.value);
  if (i >= 0) loadSong(i, wasPlaying);               // she picked one: it plays, then the list continues from there
}

/* =====================================================
   🎁 SURPRISES & 🎮 GAMES
   Pure JS + emoji (no libraries, no images). Each one is
   built only when opened, so the page stays light.
   ===================================================== */
const byId = id => document.getElementById(id);
const FUN = {};
let funCleanup = null;

/* ---- OPTIONAL SETTING ----
   Put your WhatsApp number here (country code, no + or spaces) so
   "Write Back To Me" opens a chat with you. Example: '923001234567'
   Leave '' to let her choose the app from her phone's share menu. */
const WHATSAPP_NUMBER = SITE.settings.whatsapp;

/* ---- HOW MESSAGES REACH YOU: set ntfy / Discord / Instagram in the admin panel ---- */
const NOTIFY_ON = !!SITE.settings.notifyOn;
const INSTAGRAM_USERNAME = SITE.settings.instagram;
const TELEGRAM_USERNAME = String(SITE.settings.telegram || '').replace(/^@/, '').trim();
const EMAIL_ADDRESS = String(SITE.settings.email || '').trim();
const SMS_NUMBER = String(SITE.settings.sms || '').replace(/[^\d+]/g, '');
const WB_PREFIX = 'A message from Ifra 💌\n\n';

function openLink(url, newTab) {
  if (newTab) window.open(url, '_blank'); else window.location.href = url;
}
// copy to clipboard (works inside a tap on phones and desktops)
function copyText(t) {
  const fallback = () => {
    try {
      const ta = document.createElement('textarea');
      ta.value = t; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    } catch (e) { }
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).catch(fallback); return; }
  } catch (e) { }
  fallback();
}
// Every extra way she can reach you (only the ones you filled in, in the admin panel)
function contactChannels() {
  const list = [];
  const wa = String(WHATSAPP_NUMBER || '').replace(/\D/g, '');
  const ig = String(INSTAGRAM_USERNAME || '').replace(/^@/, '').trim();
  if (wa) list.push({ emoji: '💬', label: 'WhatsApp', go: t => openLink('https://wa.me/' + wa + '?text=' + encodeURIComponent(t), true) });
  if (ig) list.push({ emoji: '📸', label: 'Instagram', go: t => { copyText(t); openLink('https://ig.me/m/' + encodeURIComponent(ig), true); toast('Message copied. Paste it in the chat 💬', 4000); } });
  if (TELEGRAM_USERNAME) list.push({ emoji: '✈️', label: 'Telegram', go: t => { copyText(t); openLink('https://t.me/' + encodeURIComponent(TELEGRAM_USERNAME), true); toast('Message copied. Paste it in the chat 💬', 4000); } });
  if (EMAIL_ADDRESS) list.push({ emoji: '✉️', label: 'Email', go: t => openLink('mailto:' + EMAIL_ADDRESS + '?subject=' + encodeURIComponent('A message from Ifra 💌') + '&body=' + encodeURIComponent(t), false) });
  if (SMS_NUMBER) list.push({ emoji: '📱', label: 'Text message', go: t => openLink('sms:' + SMS_NUMBER + (/iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?') + 'body=' + encodeURIComponent(t), false) });
  if (navigator.share) list.push({ emoji: '🔗', label: 'Other apps', go: async t => { try { await navigator.share({ text: t }); } catch (e) { } } });
  return list;
}

// Her answer / messages are sent through a server function, so your Discord webhook
// and ntfy topic never appear in the page source (set them in the admin panel).
async function sendToHim(text) {
  try {
    const r = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: String(text).slice(0, 1500) })
    });
    return r.ok;
  } catch (e) { return false; }
}

function toast(msg, ms) {
  const t = byId('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), ms || 2600);
}

// Little burst of hearts that shows above the pop-up window
function burstAt(x, y, n) {
  const icons = ['❤️', '💕', '💖', '✨'];
  n = Math.min(n || 10, 24);
  for (let i = 0; i < n; i++) {
    const p = document.createElement('div');
    p.className = 'fun-particle';
    p.textContent = icons[i % icons.length];
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.setProperty('--dx', (Math.random() - 0.5) * 220 + 'px');
    p.style.setProperty('--dy', -30 - Math.random() * 160 + 'px');
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1500);
  }
}
function burstCenter(n) { burstAt(window.innerWidth / 2, window.innerHeight / 2, n); }
function burstOn(el, n) {
  const r = el.getBoundingClientRect();
  burstAt(r.left + r.width / 2, r.top + r.height / 2, n);
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- 🎮 GAME SETTINGS (admin panel > Games) ----------
   show / hide, rename, order, play-time limit, rest time and difficulty come from SITE.games */
const GAME_TIMED = ['catch', 'match', 'ttt', 'gtr', 'flight', 'breaker', 'quiz', 'sweet'];
const GM = Object.assign({
  timeUpTitle: 'Time is up ⏳',
  timeUpText: 'That was so much fun! Come back and play again soon 💕',
  restText: 'This game is resting 🌙 You can play it again in {min} min.'
}, SITE.gameMsgs || {});
function gameCfg(id) {
  const a = SITE.games;
  return (Array.isArray(a) && a.find(g => g && g.id === id)) || {};
}
function gameOpt(id, key, def, min, max) {
  const o = gameCfg(id).opt || {};
  let v = (o[key] === '' || o[key] == null) ? def : Number(o[key]);
  if (!isFinite(v)) v = def;
  return Math.max(min, Math.min(max, Math.round(v)));
}
function applyGameTiles() {
  const list = Array.isArray(SITE.games) ? SITE.games : [];
  const tiles = {};
  document.querySelectorAll('.s-tile').forEach(t => { tiles[t.dataset.fun] = t; });
  list.forEach(g => {
    const t = g && tiles[g.id];
    if (!t) return;
    if (t._orig === undefined) {
      const sp = t.querySelector('span');
      t._orig = { emoji: sp ? sp.textContent : '', label: t.textContent.replace(sp ? sp.textContent : '', '').trim() };
    }
    const emoji = String(g.emoji || '').trim() || t._orig.emoji;
    const label = String(g.label || '').trim() || t._orig.label;
    t.textContent = '';
    const sp = document.createElement('span');
    sp.textContent = emoji;
    t.appendChild(sp);
    t.appendChild(document.createTextNode(label));
    t.style.display = g.on === false ? 'none' : '';
    t.parentNode.appendChild(t);              // keeps the order chosen in the admin panel
  });
  document.querySelectorAll('.tile-grid').forEach(grid => {
    const sec = grid.closest('.surprises-section');
    if (!sec) return;
    const kids = Array.from(grid.children);
    sec.style.display = kids.length && kids.every(k => k.style.display === 'none') ? 'none' : '';
  });
}
applyGameTiles();

function restLeft(id) {
  try { return Math.max(0, Number(localStorage.getItem('ifraRest_' + id) || 0) - Date.now()); } catch (e) { return 0; }
}
let funClock = null;
function stopFunClock() {
  if (funClock) { clearInterval(funClock.t); if (funClock.el) funClock.el.remove(); funClock = null; }
}
function startFunClock(name, cfg) {
  const mins = Number(cfg.minutes) || 0;
  if (!GAME_TIMED.includes(name) || mins <= 0) return;
  const modal = byId('funModal');
  const badge = document.createElement('div');
  badge.style.cssText = 'position:fixed;top:max(10px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:5;font:600 13px Poppins,sans-serif;color:#ffd6e4;background:rgba(0,0,0,.55);padding:4px 12px;border-radius:14px;pointer-events:none';
  modal.appendChild(badge);
  const end = Date.now() + mins * 60000;
  const tick = () => {
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    badge.textContent = '⏳ ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
    if (left <= 0) timesUp(name, cfg);
  };
  funClock = { t: setInterval(tick, 1000), el: badge };
  tick();
}
function timesUp(name, cfg) {
  stopFunClock();
  runCleanup();
  const rest = Number(cfg.rest) || 0;
  if (rest > 0) { try { localStorage.setItem('ifraRest_' + name, String(Date.now() + rest * 60000)); } catch (e) { } }
  const body = byId('funBody');
  body.innerHTML = `<h3>${GM.timeUpTitle}</h3>
    <p class="fun-sub">${GM.timeUpText}</p>` +
    (rest > 0 ? `<p class="fun-sub">${String(GM.restText).replace('{min}', rest)}</p>` : '') +
    `<div class="fun-btn" id="tuClose">Close 💕</div>` +
    (rest > 0 ? '' : ` <div class="fun-btn" id="tuAgain">Play again 🔄</div>`);
  byId('tuClose').onclick = () => closeFun();
  const again = byId('tuAgain');
  if (again) again.onclick = () => openFun(name);
  burstCenter(12);
}

function openFun(name) {
  if (!FUN[name]) return;
  const cfg = gameCfg(name);
  if (cfg.on === false) return;
  const wait = restLeft(name);
  if (wait > 0) { toast(String(GM.restText).replace('{min}', Math.max(1, Math.ceil(wait / 60000))), 3800); return; }
  runCleanup();
  stopFunClock();
  const body = byId('funBody');
  body.innerHTML = '';
  FUN[name](body);
  const m = byId('funModal');
  m.classList.add('show');
  m.setAttribute('aria-hidden', 'false');
  startFunClock(name, cfg);
}
function runCleanup() { if (funCleanup) { funCleanup(); funCleanup = null; } }
function closeFun(event) {
  if (event && event.target !== byId('funModal')) return;
  runCleanup();
  stopFunClock();
  const m = byId('funModal');
  m.classList.remove('show');
  m.setAttribute('aria-hidden', 'true');
  setTimeout(() => { if (!m.classList.contains('show')) byId('funBody').innerHTML = ''; }, 350);
}

document.querySelectorAll('.s-tile').forEach(t => {
  t.addEventListener('click', () => openFun(t.dataset.fun));
  t.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFun(t.dataset.fun); }
  });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && byId('funModal').classList.contains('show') && !document.body.classList.contains('cine-on')) closeFun();
});

/* ---------- 🌠 MAKE A WISH ---------- */
FUN.wish = body => {
  body.innerHTML = `<h3>Make a Wish 🌠</h3>
    <p class="fun-sub">Raise your hands, make a quiet dua, and hold a wish close to your heart. Then write it here, and let the stars carry it away.</p>
    <textarea id="wishText" maxlength="140" placeholder="I wish for..."></textarea>
    <div class="fun-btn" id="wishSend">Send to the stars ✨</div>`;
  byId('wishSend').onclick = () => {
    const txt = byId('wishText').value.trim();
    if (!txt) { toast('Whisper a wish first ✨'); return; }
    closeFun();
    const w = document.createElement('div');
    w.className = 'wish-float';
    w.textContent = '✨ ' + txt + ' ✨';
    document.body.appendChild(w);
    if (w.animate) {
      const rise = w.animate([
        { opacity: 0, transform: 'translate(-50%, 30px) scale(0.8)' },
        { opacity: 1, transform: 'translate(-50%, 0) scale(1)', offset: 0.15 },
        { opacity: 0, transform: 'translate(-50%, -55vh) scale(0.6)' }
      ], { duration: 6500, easing: 'ease-out', fill: 'forwards' });
      rise.onfinish = () => w.remove();
    } else {
      setTimeout(() => w.remove(), 6500);
    }
    heartRain();
    toast('Your wish is rising to the sky ✨ May it come true with Allah’s mercy and blessing 🤲', 5000);
  };
};

/* ---------- 🎟️ SCRATCH CARDS (24 different reveals, shuffled, never repeating) ---------- */
const SCRATCH_MESSAGES = SITE.scratch;
let scratchDeck = null, scratchPos = 0;

FUN.scratch = body => {
  if (!scratchDeck) { scratchDeck = shuffle(SCRATCH_MESSAGES.slice()); scratchPos = 0; }
  const msg = scratchDeck[scratchPos];
  const last = scratchPos === scratchDeck.length - 1;

  body.innerHTML = `<h3>Scratch Cards 🎟️</h3>
    <p class="fun-sub">Card ${scratchPos + 1} of ${scratchDeck.length}. Scratch gently to reveal a secret.</p>
    <div class="scratch-wrap">
      <div class="scratch-msg">${msg}</div>
      <canvas id="scratchCv" width="300" height="160"></canvas>
    </div>
    <div class="fun-btn" id="scratchNext" style="visibility:hidden">${last ? 'Begin again 🔄' : 'Next card →'}</div>`;

  const cv = byId('scratchCv'), ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 300, 160);
  g.addColorStop(0, '#c9c9d6'); g.addColorStop(0.5, '#f2f2fa'); g.addColorStop(1, '#a9a9bd');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 300, 160);
  ctx.fillStyle = '#7a7a90';
  ctx.font = '600 18px Poppins, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Scratch here ✨', 150, 80);
  ctx.globalCompositeOperation = 'destination-out';

  let drawing = false, done = false, n = 0;
  const pt = e => {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * 300 / r.width, y: (e.clientY - r.top) * 160 / r.height };
  };
  function check() {
    const d = ctx.getImageData(0, 0, 300, 160).data;
    let c = 0, total = 0;
    for (let i = 3; i < d.length; i += 16) { total++; if (d[i] === 0) c++; }
    if (c / total > 0.5) {
      done = true;
      cv.classList.add('gone');
      burstOn(cv, 14);
      byId('scratchNext').style.visibility = 'visible';
    }
  }
  function move(e) {
    if (!drawing || done) return;
    const p = pt(e);
    ctx.beginPath(); ctx.arc(p.x, p.y, 17, 0, 7); ctx.fill();
    if (++n % 6 === 0) check();
  }
  cv.addEventListener('pointerdown', e => { drawing = true; cv.setPointerCapture(e.pointerId); move(e); });
  cv.addEventListener('pointerup', () => { drawing = false; });
  cv.addEventListener('pointercancel', () => { drawing = false; });
  cv.addEventListener('pointermove', move);

  byId('scratchNext').onclick = () => {
    if (last) { scratchDeck = null; toast('Every secret uncovered. The deck has been reshuffled ✨', 3500); }
    else scratchPos++;
    FUN.scratch(body);
  };
};

/* ---------- 💐 BOUQUET (10 buds) ---------- */
FUN.bouquet = body => {
  const items = SITE.bouquet;
  body.innerHTML = `<h3>Your Bouquet 💐</h3>
    <p class="fun-sub">Touch each bud and watch it bloom 🌱</p>
    <div class="bq-row">${items.map((_, i) => `<span class="bq-bud" data-i="${i}">🌱</span>`).join('')}</div>
    <div class="bq-msg" id="bqMsg">&nbsp;</div>`;
  let opened = 0;
  body.querySelectorAll('.bq-bud').forEach(b => {
    b.onclick = () => {
      const it = items[b.dataset.i];
      byId('bqMsg').textContent = it[1];
      if (b.classList.contains('bloom')) return;
      b.classList.add('bloom');
      b.textContent = it[0];
      burstOn(b, 6);
      if (++opened === items.length) {
        setTimeout(() => {
          byId('bqMsg').textContent = 'Every flower here was grown for you. May every blessing find you always 💐';
          burstCenter(24);
        }, 900);
      }
    };
  });
};

/* ---------- 💭 QUIZ ENGINE (shared by Funny Riddles and Sweet Quiz) ----------
   Each round picks random questions from the pool and shuffles the answers,
   so it feels different every time. Add your own questions to the pools below. */
const FUNNY_RIGHT = SITE.funnyRight;
const FUNNY_WRONG = SITE.funnyWrong;

function runQuiz(body, cfg) {
  const rounds = shuffle(cfg.pool.slice()).slice(0, cfg.rounds);
  let i = 0, score = 0, first = true;

  function show() {
    if (i >= rounds.length) return end();
    const q = rounds[i];
    first = true;
    const opts = shuffle(q.o.map((t, k) => ({ t, ok: k === q.a })));
    body.innerHTML = `<h3>${cfg.title}</h3>
      <p class="fun-sub">${cfg.label} ${i + 1} of ${rounds.length}</p>
      <p class="quiz-q">${q.q}</p>
      <div class="quiz-opts">${opts.map(o => `<div class="q-opt">${o.t}</div>`).join('')}</div>
      <div class="quiz-fb" id="qFb">&nbsp;</div>`;
    body.querySelectorAll('.q-opt').forEach((el, k) => {
      el.onclick = () => {
        if (el.classList.contains('right')) return;
        if (opts[k].ok) {
          el.classList.add('right');
          if (first) score++;
          byId('qFb').textContent = (q.fun ? q.fun + ' ' : '') + FUNNY_RIGHT[Math.floor(Math.random() * FUNNY_RIGHT.length)];
          burstOn(el, 8);
          body.querySelectorAll('.q-opt').forEach(o => { o.style.pointerEvents = 'none'; });
          setTimeout(() => { i++; show(); }, q.fun ? 1700 : 1100);
        } else {
          first = false;
          el.classList.add('wrong');
          byId('qFb').textContent = FUNNY_WRONG[Math.floor(Math.random() * FUNNY_WRONG.length)];
        }
      };
    });
  }
  function end() {
    const r = score / rounds.length;
    const msg = r >= 0.9 ? cfg.msgs[0] : r >= 0.5 ? cfg.msgs[1] : cfg.msgs[2];
    body.innerHTML = `<h3>${cfg.title}</h3>
      <div class="big-score">${score} / ${rounds.length}</div>
      <p class="fun-sub">${msg}</p>
      <div class="fun-btn" id="quizAgain">Play again 🔄</div>`;
    if (r >= 0.5) burstCenter(r >= 0.9 ? 24 : 14);
    byId('quizAgain').onclick = () => runQuiz(body, cfg);
  }
  show();
}

/* ---------- 😄 FUNNY RIDDLES (easy and silly; 20 random ones per round) ---------- */
const RIDDLE_POOL = SITE.riddles;






FUN.quiz = body => runQuiz(body, {
  title: 'Funny Riddles 😄', label: 'Riddle', pool: RIDDLE_POOL, rounds: gameOpt('quiz', 'questions', 20, 5, 60),
  msgs: SITE.riddleMsgs
});

/* ---------- 🧠 SWEET QUIZ (love trivia; 20 random ones per round) ---------- */
const SWEET_POOL = SITE.sweet;



FUN.sweet = body => runQuiz(body, {
  title: 'Sweet Quiz 🧠', label: 'Question', pool: SWEET_POOL, rounds: gameOpt('sweet', 'questions', 20, 5, 60),
  msgs: SITE.sweetMsgs
});

/* ---------- 📜 MY PROMISES (serious pledges, sealed with a tap, remembered on her phone) ---------- */
FUN.promises = body => {
  const P = SITE.promises;
  let sealed = {};
  try { sealed = JSON.parse(localStorage.getItem('ifraPromises') || '{}'); } catch (e) { }
  body.innerHTML = `<h3>My Promises 📜</h3>
    <p class="fun-sub">Some words are meant to be kept. Touch a promise to seal it.</p>
    <div class="cp-list">${P.map((c, i) => `
      <div class="coupon ${sealed[i] ? 'used' : ''}" data-i="${i}">
        <span class="cp-ic">${c[0]}</span><span class="cp-tx">${c[1]}</span>
        <span class="cp-stamp">SEALED ✓</span>
      </div>`).join('')}</div>`;
  body.querySelectorAll('.coupon').forEach(el => {
    el.onclick = () => {
      if (el.classList.contains('used')) { toast('This promise is already sealed 🤍'); return; }
      el.classList.add('used');
      sealed[el.dataset.i] = 1;
      try { localStorage.setItem('ifraPromises', JSON.stringify(sealed)); } catch (e) { }
      burstOn(el, 10);
      if (Object.keys(sealed).length === P.length) {
        toast('Every promise is sealed. May Allah’s mercy make them easy to keep 🤍', 4800);
        setTimeout(() => burstCenter(20), 300);
      } else {
        toast('Sealed with love. May Allah bless it 🤍', 3200);
      }
    };
  });
};

/* ---------- 💗 LOVE METER (hold the button, then a cinematic moment) ---------- */
FUN.meter = body => {
  body.innerHTML = `<h3>Love Meter 💗</h3>
    <p class="fun-sub">Press and hold, and watch how far the feeling can travel...</p>
    <div class="meter"><div class="meter-fill" id="mFill"></div></div>
    <div class="meter-val" id="mVal">0%</div>
    <div class="fun-btn hold" id="mBtn">Hold to feel 💗</div>
    <p class="fun-sub" id="mMsg">&nbsp;</p>
    <div class="fun-btn" id="mAgain" style="display:none">Watch again ✨</div>`;
  const fill = byId('mFill'), val = byId('mVal'), btn = byId('mBtn');
  let v = 0, down = false, full = false;
  prepareCineSong();
  btn.addEventListener('pointerdown', e => { down = true; btn.setPointerCapture(e.pointerId); unlockCineSong(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => btn.addEventListener(ev, () => { down = false; }));
  btn.addEventListener('contextmenu', e => e.preventDefault());
  byId('mAgain').onclick = playCinematic;
  const timer = setInterval(() => {
    if (down) v = Math.min(v + 1.6, 100);
    else if (!full) v = Math.max(v - 2.5, 0);
    if (v >= 100 && !full) {
      full = true;
      burstOn(val, 20);
      byId('mMsg').textContent = 'Some feelings have no ceiling. Alhamdulillah.';
      byId('mAgain').style.display = '';
      setTimeout(playCinematic, 500);
    }
    fill.style.width = v + '%';
    val.textContent = full ? '∞%' : Math.floor(v) + '%';
  }, 30);
  funCleanup = () => clearInterval(timer);
};

/* ---------- 🎬 THE CINEMATIC MOMENT ----------
   A night sky fades in, hundreds of lights spiral together into a beating
   heart, the heart bursts into golden embers, and the infinity sign appears. */
/* ---------- 🎵 THE CINEMATIC SONG ----------
   When the love meter hits the limit, the song below fades in under the
   cinematic, starting from the second you choose, and your normal music
   resumes afterwards.
   - CINE_SONG_FILE : must match the file name in your folder / dropdown
   - CINE_SONG_START: second of the song to start from. Find the moment you
     want, note the time, and set it here (example: 1:35 = 95).
     To test quickly without editing, open the page with ?songstart=95 */
const CINE_SONG_FILE = SITE.settings.cineSongFile;
/* PROPOSAL_SONG_START: the second where the song begins when she opens the proposal */
const PROPOSAL_SONG_START = SITE.settings.proposalSongStart;
const CINE_SONG_START = Number(new URLSearchParams(window.location.search).get('songstart')) || SITE.settings.cineSongStart;
let cineAudio = null, cineResume = false, cineUnlocked = false;

function prepareCineSong() {
  if (cineAudio) return;
  cineAudio = new Audio();
  cineAudio.preload = LITE ? 'metadata' : 'auto';
  cineAudio.src = CINE_SONG_FILE;
  cineAudio.addEventListener('error', () => {
    if (cineResume) { music.play().catch(() => { }); cineResume = false; }
  });
}
// Phones only allow sound after a touch, so we "unlock" it on the first press of the button
function unlockCineSong() {
  if (cineUnlocked || !cineAudio) return;
  cineUnlocked = true;
  cineAudio.muted = true;
  cineAudio.play().then(() => { cineAudio.pause(); cineAudio.muted = false; })
    .catch(() => { cineAudio.muted = false; });
}
function fadeAudio(a, to, ms) {
  clearInterval(a._f);
  const from = a.volume, steps = 20;
  let n = 0;
  a._f = setInterval(() => {
    n++;
    a.volume = Math.max(0, Math.min(1, from + (to - from) * n / steps));
    if (n >= steps) { clearInterval(a._f); if (to === 0) a.pause(); }
  }, ms / steps);
}
function startCineSong(startAt) {
  prepareCineSong();
  const from = (typeof startAt === 'number') ? startAt : CINE_SONG_START;
  cineResume = !music.paused;
  music.pause();
  const a = cineAudio;
  a.muted = false;
  a.volume = 0;
  const seek = () => { try { a.currentTime = from; } catch (e) { } };
  if (a.readyState >= 1) seek(); else a.addEventListener('loadedmetadata', seek, { once: true });
  // play() right away, inside her tap, so phones allow the sound
  a.play().then(() => fadeAudio(a, 0.85, 3000)).catch(() => { });
}
function stopCineSong() {
  if (!cineAudio) return;
  fadeAudio(cineAudio, 0, 1400);
  if (cineResume) { setTimeout(() => { music.play().catch(() => { }); }, 1500); cineResume = false; }
}

let cineStop = null;
function playCinematic() {
  if (cineStop) return;
  const ov = document.createElement('div');
  ov.className = 'cine';
  ov.innerHTML = '<canvas class="cine-cv"></canvas><div class="cine-bar top"></div><div class="cine-bar bottom"></div>' +
    '<div class="cine-inf">∞</div><div class="cine-text"></div><div class="cine-hint">Tap anywhere to close</div>';
  document.body.appendChild(ov);
  document.body.classList.add('cine-on');
  startCineSong();
  requestAnimationFrame(() => ov.classList.add('show'));

  const cv = ov.querySelector('canvas'), ctx = cv.getContext('2d');
  const textEl = ov.querySelector('.cine-text'), infEl = ov.querySelector('.cine-inf');
  const dpr = (LITE ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
  let W = 0, H = 0, S = 1;
  function size() {
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = Math.min(W, H * 0.85) / 40;
  }
  size();
  window.addEventListener('resize', size);

  const stars = [];
  for (let i = 0; i < 130; i++) {
    stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.6 + 0.4, sp: 0.8 + Math.random() * 2, ph: Math.random() * 6.28 });
  }

  const N = W < 500 ? 420 : 650;
  const P = [];
  for (let i = 0; i < N; i++) {
    const outline = Math.random() < 0.55;
    const t = Math.random() * Math.PI * 2;
    const k = outline ? 1 : Math.sqrt(Math.random()) * 0.95;
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    const a = Math.random() * Math.PI * 2, dist = Math.max(W, H) * (0.55 + Math.random() * 0.6);
    P.push({
      tx: hx * k, ty: hy * k - 2.5,
      sx: Math.cos(a) * dist, sy: Math.sin(a) * dist,
      d: Math.random() * 3, r: 0.8 + Math.random() * 1.8,
      hue: Math.random() < 0.8 ? -22 + Math.random() * 20 : 38 + Math.random() * 14,
      ph: Math.random() * 6.28, vx: 0, vy: 0, bx: 0, by: 0, init: false
    });
  }

  const lines = SITE.cinemaLines;
  let lineIdx = -1, closed = false, raf = 0;
  const t0 = performance.now(), openedAt = t0;
  const BURST = 11;

  function setLine(txt) {
    textEl.classList.remove('on');
    setTimeout(() => {
      if (closed) return;
      textEl.textContent = txt;
      if (txt) textEl.classList.add('on');
    }, 450);
  }

  function frame(now) {
    const t = (now - t0) / 1000;
    const cx = W / 2, cy = H / 2 - H * 0.02;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);

    // twinkling stars
    for (const s of stars) {
      const a = 0.2 + 0.6 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
      ctx.fillStyle = 'rgba(255,235,240,' + a.toFixed(3) + ')';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }

    // soft glow behind the heart
    if (t > 2 && t < BURST + 1.5) {
      const fade = Math.min(1, (t - 2) / 4) * (t > BURST ? Math.max(0, 1 - (t - BURST) / 1.5) : 1);
      const alpha = fade * (0.28 + 0.06 * Math.sin(t * 5.5));
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 24);
      g.addColorStop(0, 'rgba(255,77,109,' + alpha.toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,77,109,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // particles (assemble -> beat -> burst into golden embers)
    ctx.globalCompositeOperation = 'lighter';
    const beat = t > 6 && t < BURST ? 1 + 0.035 * Math.sin(t * 5.5) : 1;
    if (t < 17.5) {
      for (const p of P) {
        let x, y, alpha, hue = p.hue;
        if (t < BURST) {
          const pr = Math.max(0, Math.min(1, (t - 0.8 - p.d) / 3.4));
          const e = 1 - Math.pow(1 - pr, 3);
          const rot = (1 - e) * 2.4;
          const bx = p.sx * (1 - e), by = p.sy * (1 - e);
          const cr = Math.cos(rot), sr = Math.sin(rot);
          x = cx + p.tx * S * beat + bx * cr - by * sr;
          y = cy + p.ty * S * beat + bx * sr + by * cr;
          alpha = (0.15 + 0.85 * pr) * (0.7 + 0.3 * Math.sin(t * 3 + p.ph));
        } else {
          const bt = t - BURST;
          if (!p.init) {
            p.init = true;
            const ex = p.tx * S, ey = p.ty * S;
            const ang = Math.atan2(ey, ex) + (Math.random() - 0.5) * 0.7;
            const sp = 80 + Math.random() * 330;
            p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp - 40;
            p.bx = cx + ex; p.by = cy + ey;
          }
          const drag = Math.exp(-bt * 0.7);
          x = p.bx + p.vx * (1 - drag) / 0.7;
          y = p.by + p.vy * (1 - drag) / 0.7 - bt * bt * 6;
          alpha = Math.max(0, 1 - bt / 5.5) * (0.6 + 0.4 * Math.sin(t * 6 + p.ph));
          hue = p.hue + (44 - p.hue) * Math.min(1, bt / 2);
        }
        if (alpha <= 0.01) continue;
        ctx.fillStyle = 'hsla(' + hue.toFixed(0) + ',100%,68%,' + alpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, 6.2832);
        ctx.fill();
      }
    }

    // shockwave + soft flash at the moment of the burst
    if (t >= BURST) {
      const bt = t - BURST;
      if (bt < 1.8) {
        ctx.strokeStyle = 'rgba(255,205,215,' + Math.max(0, 1 - bt / 1.8).toFixed(3) + ')';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, bt * Math.max(W, H) * 0.55, 0, 6.2832);
        ctx.stroke();
      }
      if (bt < 0.6) {
        ctx.fillStyle = 'rgba(255,240,245,' + (0.4 * (1 - bt / 0.6)).toFixed(3) + ')';
        ctx.fillRect(0, 0, W, H);
      }
    }

    // poetic lines
    let idx = -1;
    for (let i = 0; i < lines.length; i++) if (t >= lines[i][0]) idx = i;
    if (idx !== lineIdx) { lineIdx = idx; if (idx >= 0) setLine(lines[idx][1]); }
    if (t >= BURST + 0.2 && !infEl.classList.contains('on')) infEl.classList.add('on');

    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function close() {
    if (closed || performance.now() - openedAt < 1200) return;
    closed = true;
    stopCineSong();
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', size);
    document.removeEventListener('keydown', onKey);
    ov.classList.remove('show');
    document.body.classList.remove('cine-on');
    setTimeout(() => ov.remove(), 900);
    cineStop = null;
  }
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('click', close);
  cineStop = close;
}

/* ---------- 🏆 WIN CELEBRATION ----------
   Fireworks, drifting petals, a golden crown and a loving message. */
const CELE_MESSAGES = SITE.celebration;
let celeStop = null;
function celebrate(extra, stat) {
  if (celeStop || cineStop) return;
  const msg = CELE_MESSAGES[Math.floor(Math.random() * CELE_MESSAGES.length)];
  const ov = document.createElement('div');
  ov.className = 'cine cele';
  ov.innerHTML = '<canvas class="cele-cv"></canvas><div class="cine-bar top"></div><div class="cine-bar bottom"></div>' +
    '<div class="cele-box"><div class="cele-crown">👑</div><div class="cele-title">Congratulations</div>' +
    '<div class="cele-msg">' + msg + '</div><div class="cele-extra">' + (extra || '') + '</div>' +
    '<div class="cele-stat">' + (stat || '') + '</div></div><div class="cine-hint">Tap anywhere to continue</div>';
  document.body.appendChild(ov);
  document.body.classList.add('cine-on');
  requestAnimationFrame(() => ov.classList.add('show'));

  const cv = ov.querySelector('canvas'), ctx = cv.getContext('2d');
  const dpr = (LITE ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
  let W = 0, H = 0;
  function size() {
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size();
  window.addEventListener('resize', size);

  const rockets = [], sparks = [], petals = [];
  for (let i = 0; i < 26; i++) {
    petals.push({ x: Math.random() * W, y: -Math.random() * H, vy: 30 + Math.random() * 50, vx: (Math.random() - 0.5) * 30,
      r: 3 + Math.random() * 4, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 2, hue: 330 + Math.random() * 25 });
  }
  const hues = [340, 350, 45, 20, 320, 50];
  let last = performance.now(), t = 0, nextShot = 0.6, closed = false, raf = 0;

  function explode(x, y) {
    const hue = hues[Math.floor(Math.random() * hues.length)];
    for (let i = 0; i < 34; i++) {
      const ang = (i / 34) * 6.2832 + Math.random() * 0.2, sp = 90 + Math.random() * 150;
      sparks.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 1, hue });
    }
  }
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now; t += dt;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    if (t >= nextShot && t < 10) {
      rockets.push({ x: W * (0.12 + Math.random() * 0.76), y: H, ty: H * (0.14 + Math.random() * 0.36), vy: -H * 0.9 });
      nextShot += 0.3 + Math.random() * 0.45;
    }
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.y += r.vy * dt;
      ctx.fillStyle = 'rgba(255,230,200,0.9)';
      ctx.fillRect(r.x - 1.5, r.y, 3, 10);
      if (r.y <= r.ty) { explode(r.x, r.y); rockets.splice(i, 1); }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.vx *= Math.pow(0.5, dt * 2); s.vy = s.vy * Math.pow(0.5, dt * 2) + 120 * dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt * 0.7;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.fillStyle = 'hsla(' + s.hue + ',100%,70%,' + s.life.toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(s.x, s.y, 2, 0, 6.2832); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const p of petals) {
      p.y += p.vy * dt; p.x += p.vx * dt + Math.sin(t + p.rot) * 0.4; p.rot += p.vr * dt;
      if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; }
      ctx.fillStyle = 'hsla(' + p.hue.toFixed(0) + ',90%,80%,0.8)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.55, p.rot, 0, 6.2832); ctx.fill();
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  const openedAt = performance.now();
  function close() {
    if (closed || performance.now() - openedAt < 1200) return;
    closed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', size);
    document.removeEventListener('keydown', onKey);
    clearTimeout(auto);
    ov.classList.remove('show');
    document.body.classList.remove('cine-on');
    setTimeout(() => ov.remove(), 900);
    celeStop = null;
  }
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('click', close);
  const auto = setTimeout(() => close(), 15000);
  celeStop = close;
}

/* ---------- 🔐 LOGIN WINDOW ---------- */
FUN.login = body => {
  body.innerHTML = `<h3>Just for us 🔐</h3>
    <p class="fun-sub">Please log in to continue.</p>
    <input id="lgEmail" class="fun-input" type="text" autocomplete="username" placeholder="Username" autocapitalize="off" spellcheck="false">
    <input id="lgPass" class="fun-input" type="password" autocomplete="current-password" placeholder="Password">
    <p class="fun-sub" id="lgErr" style="min-height:1.4em;margin:8px 0 0"></p>
    <div class="fun-btn" id="lgGo">Log in 💌</div>`;
  const err = byId('lgErr'), go = byId('lgGo');
  let busy = false;
  async function submit() {
    if (busy) return;
    const email = byId('lgEmail').value.trim(), pw = byId('lgPass').value;
    if (!email || !pw) { err.textContent = 'Enter your username and password'; return; }
    busy = true; err.textContent = ''; go.textContent = 'Checking…';
    try {
      await doLogin(email, pw);
      const cb = AUTH.after; AUTH.after = null;
      closeFun();
      if (cb) setTimeout(cb, 350);
    } catch (e) {
      err.textContent = e.message;
      go.textContent = 'Log in 💌';
    }
    busy = false;
  }
  go.onclick = submit;
  ['lgEmail', 'lgPass'].forEach(id => byId(id).addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }));
  setTimeout(() => { try { byId('lgEmail').focus(); } catch (e) { } }, 350);
};

/* ---------- 💌 WRITE BACK TO ME ---------- */
let writebackPrefill = '';
FUN.writeback = body => {
  body.innerHTML = `<h3>Write Back 💌</h3>
    <p class="fun-sub">Is there something your heart wants to say? Write it here and send it my way 💕</p>
    <textarea id="wbText" maxlength="500" placeholder="Words from the heart..."></textarea>
    <div class="fun-btn" id="wbSend">Send it my way 💌</div>`;
  if (writebackPrefill) { byId('wbText').value = writebackPrefill; writebackPrefill = ''; }
  const chans = contactChannels();
  if (chans.length) {
    const alt = document.createElement('div');
    alt.className = 'wb-alt';
    alt.innerHTML = '<div class="wb-alt-title">Or send it with</div><div class="wb-row"></div>';
    const row = alt.querySelector('.wb-row');
    chans.forEach(c => {
      const chip = document.createElement('div');
      chip.className = 'wb-chip'; chip.setAttribute('role', 'button'); chip.tabIndex = 0; chip.setAttribute('data-kb', '');
      chip.textContent = c.emoji + ' ' + c.label;
      chip.onclick = () => {
        const t = byId('wbText').value.trim();
        if (!t) { toast('Write a few words first ✍️'); return; }
        c.go(WB_PREFIX + t);
      };
      row.appendChild(chip);
    });
    body.appendChild(alt);
  }
  byId('wbSend').onclick = async () => {
    const t = byId('wbText').value.trim();
    if (!t) { toast('Write a few words first ✍️'); return; }
    const text = 'A message from Ifra 💌\n\n' + t;
    if (NOTIFY_ON) {
      toast('Sending... 💌');
      if (await sendToHim(text)) { toast('Delivered. It will reach my heart 💌', 4200); closeFun(); return; }
    }
    if (WHATSAPP_NUMBER) {
      window.open('https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(text), '_blank');
    } else if (navigator.share) {
      try { await navigator.share({ text }); } catch (e) { }
    } else {
      window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
    }
  };
};

/* ---------- 📅 PLAN A DATE / VALORANT SESSION ---------- */
FUN.calendar = (body, initialType) => {
  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  let currentPlanType = initialType === 'valorant' ? 'valorant' : 'valorant';
  let valorantMode = 'Competitive 🏆';
  let customTitle = '';
  let selectedDate = new Date();
  let displayYear = selectedDate.getFullYear();
  let displayMonth = selectedDate.getMonth();
  let selectedTime = '21:30';
  let noteText = '';

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  function formatDateStr(d) {
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  function formatISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function formatTimeStr(time24) {
    if (!time24) return '9:30 PM';
    const parts = time24.split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }

  function render() {
    body.innerHTML = `
      <h3>Plan a Date / Game 📅🎮</h3>
      <p class="fun-sub">Pick a day & time to play Valorant, watch a movie, or plan anything special! Tayyab’s phone gets the notification immediately 📲💕</p>
      
      <div class="planner-wrap">
        <div>
          <div class="plan-sec-title">1. What's the plan?</div>
          <div class="plan-chips" id="planTypeChips">
            <div class="plan-chip ${currentPlanType === 'valorant' ? 'active' : ''}" data-type="valorant">🎮 Valorant Date</div>
            <div class="plan-chip ${currentPlanType === 'movie' ? 'active' : ''}" data-type="movie">🎬 Movie Night</div>
            <div class="plan-chip ${currentPlanType === 'call' ? 'active' : ''}" data-type="call">☕ Late Night Call</div>
            <div class="plan-chip ${currentPlanType === 'dinner' ? 'active' : ''}" data-type="dinner">🍕 Dinner / Food</div>
            <div class="plan-chip ${currentPlanType === 'custom' ? 'active' : ''}" data-type="custom">🌸 Custom Plan</div>
          </div>
          <div id="subTypeWrap" style="margin-top:8px;"></div>
        </div>

        <div>
          <div class="plan-sec-title">2. Pick a Date (${formatDateStr(selectedDate)})</div>
          <div class="plan-chips" style="margin-bottom:8px;">
            <div class="plan-chip" id="quickToday">Today</div>
            <div class="plan-chip" id="quickTomorrow">Tomorrow</div>
            <div class="plan-chip" id="quickWeekend">This Weekend</div>
          </div>
          <div class="cal-box">
            <div class="cal-head">
              <button class="cal-btn" id="calPrev" type="button">◀</button>
              <div class="cal-month-title" id="calMonthTitle">${MONTH_NAMES[displayMonth]} ${displayYear}</div>
              <button class="cal-btn" id="calNext" type="button">▶</button>
            </div>
            <div class="cal-days-grid" id="calDaysGrid"></div>
          </div>
        </div>

        <div>
          <div class="plan-sec-title">3. Pick a Time (${formatTimeStr(selectedTime)})</div>
          <div class="plan-chips" style="margin-bottom:8px;">
            <div class="plan-chip ${selectedTime === '19:00' ? 'active' : ''}" data-time="19:00">🌅 7:00 PM (Evening)</div>
            <div class="plan-chip ${selectedTime === '21:00' ? 'active' : ''}" data-time="21:00">🌙 9:00 PM (Prime)</div>
            <div class="plan-chip ${selectedTime === '21:30' ? 'active' : ''}" data-time="21:30">⚡ 9:30 PM (Valorant Time)</div>
            <div class="plan-chip ${selectedTime === '22:30' ? 'active' : ''}" data-time="22:30">🌌 10:30 PM (Late Night)</div>
            <div class="plan-chip ${selectedTime === '00:00' ? 'active' : ''}" data-time="00:00">🕛 Midnight</div>
          </div>
          <div class="plan-time-row">
            <span style="font-size:0.85rem;color:var(--mut);">Or pick exact time:</span>
            <input type="time" class="plan-time-input" id="planExactTime" value="${selectedTime}">
          </div>
        </div>

        <div>
          <div class="plan-sec-title">4. Little note for Tayyab (optional)</div>
          <textarea class="plan-note-input" id="planNoteInput" maxlength="300" placeholder="e.g. Lock in Reyna, let's play competitive! Don't be late 💕">${esc(noteText)}</textarea>
        </div>

        <div class="fun-btn" id="planSubmitBtn" style="margin-top:4px;">Send Plan to Tayyab's Phone 🚀💖</div>
      </div>
    `;

    renderSubTypes();
    renderCalendar();
    attachEvents();
  }

  function renderSubTypes() {
    const wrap = body.querySelector('#subTypeWrap');
    if (!wrap) return;
    if (currentPlanType === 'valorant') {
      const modes = ['Competitive 🏆', 'Swiftplay ⚡', 'Spike Rush 💥', 'Unrated 🎯', 'Custom 1v1 ⚔️'];
      wrap.innerHTML = `
        <span style="font-size:0.75rem;color:#ffcad4;display:block;margin-bottom:4px;">Game Mode:</span>
        <div class="plan-chips">
          ${modes.map(m => `<div class="plan-chip ${valorantMode === m ? 'active' : ''}" data-mode="${m}">${m}</div>`).join('')}
        </div>
      `;
      wrap.querySelectorAll('[data-mode]').forEach(ch => {
        ch.onclick = () => { valorantMode = ch.dataset.mode; renderSubTypes(); };
      });
    } else if (currentPlanType === 'custom') {
      wrap.innerHTML = `
        <input type="text" class="plan-time-input" id="customPlanTitleInp" placeholder="Name your plan (e.g. Virtual date, Surprise...)" style="width:100%;box-sizing:border-box;margin-top:4px;" value="${esc(customTitle)}">
      `;
      const inp = wrap.querySelector('#customPlanTitleInp');
      inp.oninput = () => { customTitle = inp.value; };
    } else {
      wrap.innerHTML = '';
    }
  }

  function renderCalendar() {
    const grid = body.querySelector('#calDaysGrid');
    if (!grid) return;
    grid.innerHTML = '';

    DAYS_SHORT.forEach(d => {
      const el = document.createElement('div');
      el.className = 'cal-dow';
      el.textContent = d;
      grid.appendChild(el);
    });

    const firstDay = new Date(displayYear, displayMonth, 1).getDay();
    const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      const blank = document.createElement('div');
      blank.className = 'cal-cell disabled';
      grid.appendChild(blank);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= daysInMonth; day++) {
      const thisDate = new Date(displayYear, displayMonth, day);
      thisDate.setHours(0, 0, 0, 0);
      const cell = document.createElement('div');
      cell.className = 'cal-cell';
      cell.textContent = day;

      const isPast = thisDate < today;
      const isToday = thisDate.getTime() === today.getTime();
      const isSelected = selectedDate && thisDate.getTime() === new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).getTime();

      if (isPast) cell.classList.add('disabled');
      if (isToday) cell.classList.add('today');
      if (isSelected) cell.classList.add('selected');

      if (!isPast) {
        cell.onclick = () => {
          selectedDate = new Date(displayYear, displayMonth, day);
          render();
        };
      }
      grid.appendChild(cell);
    }
  }

  function attachEvents() {
    body.querySelectorAll('#planTypeChips .plan-chip').forEach(ch => {
      ch.onclick = () => {
        currentPlanType = ch.dataset.type;
        render();
      };
    });

    const qToday = body.querySelector('#quickToday');
    const qTomorrow = body.querySelector('#quickTomorrow');
    const qWeekend = body.querySelector('#quickWeekend');

    if (qToday) qToday.onclick = () => {
      selectedDate = new Date();
      displayYear = selectedDate.getFullYear();
      displayMonth = selectedDate.getMonth();
      render();
    };
    if (qTomorrow) qTomorrow.onclick = () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      selectedDate = d;
      displayYear = selectedDate.getFullYear();
      displayMonth = selectedDate.getMonth();
      render();
    };
    if (qWeekend) qWeekend.onclick = () => {
      const d = new Date();
      const day = d.getDay();
      const diff = (6 - day + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      selectedDate = d;
      displayYear = selectedDate.getFullYear();
      displayMonth = selectedDate.getMonth();
      render();
    };

    const prevBtn = body.querySelector('#calPrev');
    const nextBtn = body.querySelector('#calNext');
    if (prevBtn) prevBtn.onclick = () => {
      displayMonth--;
      if (displayMonth < 0) { displayMonth = 11; displayYear--; }
      render();
    };
    if (nextBtn) nextBtn.onclick = () => {
      displayMonth++;
      if (displayMonth > 11) { displayMonth = 0; displayYear++; }
      render();
    };

    body.querySelectorAll('[data-time]').forEach(ch => {
      ch.onclick = () => {
        selectedTime = ch.dataset.time;
        const inp = body.querySelector('#planExactTime');
        if (inp) inp.value = selectedTime;
        render();
      };
    });

    const timeInp = body.querySelector('#planExactTime');
    if (timeInp) timeInp.onchange = () => {
      selectedTime = timeInp.value;
      render();
    };

    const noteInp = body.querySelector('#planNoteInput');
    if (noteInp) noteInp.oninput = () => { noteText = noteInp.value; };

    const submitBtn = body.querySelector('#planSubmitBtn');
    if (submitBtn) submitBtn.onclick = async () => {
      submitBtn.classList.add('disabled');
      submitBtn.textContent = 'Sending to Tayyab’s phone… 💌';

      let planTitle = 'Valorant Session 🎮';
      let subType = valorantMode;
      if (currentPlanType === 'movie') { planTitle = 'Movie Date 🎬'; subType = ''; }
      else if (currentPlanType === 'call') { planTitle = 'Late Night Call & Tea ☕'; subType = ''; }
      else if (currentPlanType === 'dinner') { planTitle = 'Dinner / Food Date 🍕'; subType = ''; }
      else if (currentPlanType === 'custom') { planTitle = customTitle.trim() || 'Special Plan 🌸'; subType = ''; }

      const dateFormatted = formatDateStr(selectedDate);
      const isoDate = formatISODate(selectedDate);
      const timeFormatted = formatTimeStr(selectedTime);
      const note = (noteInp ? noteInp.value : noteText).trim();

      const text = `🎮 New Plan from Ifra: ${planTitle}${subType ? ' (' + subType + ')' : ''}!\n` +
                   `📅 Date: ${dateFormatted}\n` +
                   `⏰ Time: ${timeFormatted}\n` +
                   (note ? `💬 Note: “${note}”\n` : '') +
                   `💌 Sent with love from your website 💕`;

      const planData = {
        planType: currentPlanType,
        title: planTitle,
        subType,
        date: isoDate,
        dateFormatted,
        time: selectedTime,
        timeFormatted,
        note
      };

      try {
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'plan',
            title: `🎮 ${planTitle} from Ifra! 💖`,
            text,
            plan: planData
          })
        });

        burstCenter(24);

        body.innerHTML = `
          <div class="plan-success-wrap">
            <div style="font-size:48px;margin-bottom:10px;animation:plusPulse 1.2s infinite;">🎉🎮💖</div>
            <h3 style="color:#ffb3c4;">Plan Sent to Tayyab!</h3>
            <p style="font-size:0.9rem;color:#fbe9ef;margin:8px 0 14px;">
              Your plan has been sent straight to his phone and devices! 📲
            </p>
            <div class="plan-summary-box">
              <b style="color:#ff7597;font-size:1.05rem;">${esc(planTitle)} ${subType ? '· ' + esc(subType) : ''}</b><br>
              📅 <b>${esc(dateFormatted)}</b><br>
              ⏰ <b>${esc(timeFormatted)}</b>
              ${note ? `<br>💬 <i>“${esc(note)}”</i>` : ''}
            </div>
            <p class="hint" style="margin:12px 0 16px;">
              He will receive an instant notification alert on his phone so you two can enjoy your time together! 💕
            </p>
            <div class="bar" style="justify-content:center;gap:10px;">
              <div class="fun-btn" onclick="closeFun()" style="min-width:120px;">Awesome ✨</div>
              ${WHATSAPP_NUMBER ? `<div class="fun-btn" id="planWhatsApp" style="background:#25d366;min-width:140px;">Send on WhatsApp too 💬</div>` : ''}
            </div>
          </div>
        `;

        const wa = body.querySelector('#planWhatsApp');
        if (wa && WHATSAPP_NUMBER) {
          wa.onclick = () => {
            window.open('https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(text), '_blank');
          };
        }
      } catch (err) {
        toast('Could not deliver to server, opening WhatsApp fallback 💕', 3500);
        if (WHATSAPP_NUMBER) {
          window.open('https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(text), '_blank');
        } else if (navigator.share) {
          try { await navigator.share({ text }); } catch (e) { }
        }
        closeFun();
      }
    };
  }

  render();
};

FUN.valorant = body => FUN.calendar(body, 'valorant');

/* ---------- 🧺 GAME 1: CATCH THE HEARTS ---------- */
FUN.catch = body => {
  const W = 300, H = 380;
  const ROUND = gameOpt('catch', 'seconds', 30, 10, 300), K = ROUND / 30;   // K scales the score targets
  body.innerHTML = `<h3>Catch the Hearts 💖</h3>
    <p class="fun-sub" id="cInfo">Catch the falling hearts 💖 and avoid the broken ones 💔 (${ROUND} seconds)</p>
    <canvas id="cCv" class="game-cv" width="${W}" height="${H}"></canvas>
    <div class="fun-btn" id="cStart">Start ▶️</div>`;
  const cv = byId('cCv'), ctx = cv.getContext('2d');
  let raf = 0, last = 0, score = 0, time = ROUND, spawn = 0, items = [], bx = W / 2;

  function setX(clientX) {
    const r = cv.getBoundingClientRect();
    bx = Math.max(30, Math.min(W - 30, (clientX - r.left) * W / r.width));
  }
  cv.addEventListener('pointermove', e => setX(e.clientX));
  cv.addEventListener('pointerdown', e => setX(e.clientX));
  const onKey = e => {
    if (e.key === 'ArrowLeft') bx = Math.max(30, bx - 26);
    if (e.key === 'ArrowRight') bx = Math.min(W - 30, bx + 26);
  };
  document.addEventListener('keydown', onKey);

  function start() {
    score = 0; time = ROUND; items = []; spawn = 0;
    byId('cStart').style.display = 'none';
    byId('cInfo').textContent = 'Glide the basket with your finger or mouse 🧺';
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now; time -= dt; spawn -= dt;
    if (spawn <= 0) {
      spawn = Math.max(0.35, 0.8 - (ROUND - time) * 0.012);
      items.push({ x: 20 + Math.random() * (W - 40), y: -20, v: 110 + Math.random() * 90 + (ROUND - time) * 3, bad: Math.random() < 0.22 });
    }
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '28px serif';
    items = items.filter(it => {
      it.y += it.v * dt;
      if (it.y > H - 52 && it.y < H - 8 && Math.abs(it.x - bx) < 40) {
        score = Math.max(0, score + (it.bad ? -2 : 1));
        if (window.PLUS) PLUS.hit(it.bad ? 'bad' : 'good');
        return false;
      }
      ctx.fillText(it.bad ? '💔' : '💖', it.x, it.y);
      return it.y < H + 30;
    });
    ctx.fillText('🧺', bx, H - 12);
    ctx.font = '600 14px Poppins, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';  ctx.fillText('💖 ' + score, 10, 22);
    ctx.textAlign = 'right'; ctx.fillText('⏱ ' + Math.max(0, Math.ceil(time)), W - 10, 22);
    if (time <= 0) return end();
    raf = requestAnimationFrame(loop);
  }
  function end() {
    const msg = score >= 25 * K ? 'Beautiful! You caught every heart that fell for you 💖'
      : score >= 12 * K ? 'Well caught. Hearts always find their way to you 💕'
      : 'Hearts are delicate to catch 😉 Try once more!';
    byId('cInfo').textContent = 'Score: ' + score + '. ' + msg;
    const b = byId('cStart');
    b.textContent = 'Play again ▶️'; b.style.display = '';
    if (score >= 15 * K) setTimeout(() => celebrate('You caught every falling heart, just as you once caught mine.', '💖 ' + score + ' hearts caught'), 600);
    else if (score >= 12 * K) burstCenter(18);
  }
  byId('cStart').onclick = start;
  funCleanup = () => { cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); };
};

/* ---------- 🃏 GAME 2: MEMORY MATCH ---------- */
FUN.match = body => {
  const E = ['🌹', '💌', '🌙', '💍', '🎀', '🧸'];
  const deck = shuffle([...E, ...E]);
  body.innerHTML = `<h3>Memory Match 🃏</h3>
    <p class="fun-sub" id="mmInfo">Find the pairs 💕 &nbsp;|&nbsp; Moves: 0</p>
    <div class="mm-grid">${deck.map((e, i) => `
      <div class="mm-card" data-i="${i}"><div class="mm-in">
        <div class="mm-front">❤️</div><div class="mm-back">${e}</div>
      </div></div>`).join('')}</div>
    <div class="fun-btn" id="mmAgain">Play again 🔄</div>`;
  let first = null, lock = false, moves = 0, matched = 0, alive = true;
  const info = byId('mmInfo');
  body.querySelectorAll('.mm-card').forEach(card => {
    card.onclick = () => {
      if (lock || card.classList.contains('flip') || card.classList.contains('done')) return;
      card.classList.add('flip');
      if (!first) { first = card; return; }
      moves++;
      info.innerHTML = 'Find the pairs 💕 &nbsp;|&nbsp; Moves: ' + moves;
      const a = first, b = card;
      first = null;
      if (deck[a.dataset.i] === deck[b.dataset.i]) {
        a.classList.add('done'); b.classList.add('done');
        burstOn(b, 5);
        if (++matched === E.length) {
          info.textContent = 'Every pair found in ' + moves + ' moves 💖 Some things are simply meant to be together 🥰';
          setTimeout(() => celebrate('You found every pair, because some things are simply meant to be together.', '🃏 ' + moves + ' moves'), 800);
        }
      } else {
        lock = true;
        setTimeout(() => {
          if (!alive) return;
          a.classList.remove('flip'); b.classList.remove('flip');
          lock = false;
        }, 750);
      }
    };
  });
  byId('mmAgain').onclick = () => FUN.match(body);
  funCleanup = () => { alive = false; };
};

/* ---------- ❌ GAME 3: TIC-TAC-LOVE (❤️ you  vs  🌹 the garden) ---------- */
FUN.ttt = body => {
  const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const b = Array(9).fill('');
  let over = false, alive = true;
  body.innerHTML = `<h3>Tic-Tac-Love ❤️</h3>
    <p class="fun-sub" id="tStatus">Your turn ❤️</p>
    <div class="ttt-grid">${b.map((_, i) => `<div class="ttt-cell" data-i="${i}"></div>`).join('')}</div>
    <div class="fun-btn" id="tAgain">Play again 🔄</div>`;
  const cells = body.querySelectorAll('.ttt-cell');
  const status = byId('tStatus');

  function result() {
    for (const [x, y, z] of LINES) if (b[x] && b[x] === b[y] && b[x] === b[z]) return b[x];
    return b.every(Boolean) ? 'tie' : null;
  }
  function need(mark) {
    for (const l of LINES) {
      const v = l.map(i => b[i]);
      if (v.filter(m => m === mark).length === 2 && v.includes('')) return l[v.indexOf('')];
    }
    return -1;
  }
  function place(i, mark) {
    b[i] = mark; cells[i].textContent = mark;
    const r = result();
    if (r) {
      over = true;
      if (r === '❤️') { status.textContent = 'You won! Hearts always make the winning move 💖'; setTimeout(() => celebrate('Three in a row, and my heart makes four.', '❤️ A winning move!'), 700); }
      else if (r === '🌹') status.textContent = 'The rose wins this time... but love always wins 💕';
      else status.textContent = 'A perfect tie, like two hearts in harmony 🥰';
    } else {
      status.textContent = mark === '❤️' ? 'The rose is thinking 🌹...' : 'Your turn ❤️';
    }
  }
  function ai() {
    if (over || !alive) return;
    const free = b.map((v, i) => v ? -1 : i).filter(i => i >= 0);
    let m = -1;
    if (Math.random() > 0.3) {            // plays kindly: sometimes misses, so you can win
      m = need('🌹');
      if (m < 0) m = need('❤️');
      if (m < 0 && !b[4]) m = 4;
    }
    if (m < 0) m = free[Math.floor(Math.random() * free.length)];
    place(m, '🌹');
  }
  cells.forEach(c => {
    c.onclick = () => {
      const i = +c.dataset.i;
      if (over || b[i]) return;
      place(i, '❤️');
      if (!over) setTimeout(ai, 450);
    };
  });
  byId('tAgain').onclick = () => FUN.ttt(body);
  funCleanup = () => { alive = false; };
};

/* 🎮 GT-R, Love Flight and Love Breaker live in games.js and are loaded on first tap (keeps the first page load light). */
let _gamesP = null;
function loadGamesJs() {
  if (_gamesP) return _gamesP;
  _gamesP = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'games.js';
    s.onload = res;
    s.onerror = () => { _gamesP = null; rej(new Error('games.js')); };
    document.head.appendChild(s);
  });
  return _gamesP;
}
['gtr', 'flight', 'breaker'].forEach(name => {
  const stub = body => {
    body.innerHTML = '<p class="fun-sub">Loading… 💕</p>';
    loadGamesJs().then(() => {
      if (FUN[name] && FUN[name] !== stub) { body.innerHTML = ''; FUN[name](body); }
    }).catch(() => { body.innerHTML = '<p class="fun-sub">Could not load the game. Check the connection and try again 💕</p>'; });
  };
  FUN[name] = stub;
});


function _sparkleBlocked() {
  if (LITE) return true;   // no sparkle trail on weak phones
  const m = document.getElementById('funModal');
  return document.body.classList.contains('cine-on') || (m && m.classList.contains('show'));
}


/* ✨ Sections gently appear as she scrolls down the card */
(function () {
  const card = document.querySelector('.card');
  if (!card || !('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { root: card, threshold: 0.1 });
  card.querySelectorAll('.song-section, .gallery-section, .letters-section, .surprises-section').forEach(s => {
    s.classList.add('rv');
    io.observe(s);
  });
})();

/* =====================================================
   💍 THE PROPOSAL
   A night sky with drifting lanterns, a story told line by line,
   then the question. "No" runs away; "Yes" opens fireworks, duas
   and a message straight to you (see the admin panel).
   ===================================================== */
let PROPOSAL_SCENES = SITE.proposalScenes || [];

let PROPOSAL_YES_SCENES = SITE.yesScenes || [];

let NO_TEXTS = SITE.noTexts || ['No'];

let proposalStop = null, proposalSent = false;

function openProposal() {
  if (proposalStop) return;
  if (!AUTH.ok()) { requireLogin(openProposal); return; }
  const ov = document.createElement('div');
  ov.className = 'cine proposal';
  ov.innerHTML =
    '<canvas class="pp-cv"></canvas>' +
    '<div class="cine-bar top"></div><div class="cine-bar bottom"></div>' +
    '<div class="pp-stage" id="ppStage"><div class="pp-ar" dir="rtl" lang="ar"></div><div class="pp-line"></div></div>' +
    '<div class="pp-ask" id="ppAsk">' +
      '<div class="pp-ring">💍</div>' +
      '<div class="pp-title">' + SITE.text.proposalTitle + '</div>' +
      '<div class="pp-sub">' + SITE.text.proposalSub + '</div>' +
      '<div class="pp-btns">' +
        '<div class="pp-yes" id="ppYes" role="button" tabindex="0" data-kb>' + SITE.text.proposalYes + '</div>' +
        '<div class="pp-no" id="ppNo" role="button" tabindex="0" data-kb>No</div>' +
      '</div>' +
    '</div>' +
    '<div class="pp-yesscene" id="ppYesScene">' +
      '<div class="pp-ar" dir="rtl" lang="ar"></div><div class="pp-line"></div>' +
      '<div class="pp-final" id="ppFinal">' +
        '<div class="pp-ring big">💍</div>' +
        '<div class="pp-title">' + SITE.text.proposalFinal + '</div>' +
        '<div class="pp-sub" id="ppStatus">&nbsp;</div>' +
        '<div class="pp-btns" id="ppEndBtns"></div>' +
      '</div>' +
    '</div>' +
    '<div class="pp-flash" id="ppFlash"></div>' +
    '<div class="pp-close" id="ppClose" role="button" tabindex="0" aria-label="Close" data-kb>&times;</div>' +
    '<div class="pp-skip" id="ppSkip" role="button" tabindex="0" data-kb>Skip ›</div>';
  document.body.appendChild(ov);
  document.body.classList.add('cine-on');
  // Stop the background music while the proposal story plays; reflections starts only on Yes
  const proposalResume = !music.paused;
  music.pause();
  prepareCineSong();
  requestAnimationFrame(() => ov.classList.add('show'));

  const q = s => ov.querySelector(s);
  const cv = q('canvas'), ctx = cv.getContext('2d');
  const stage = q('#ppStage'), ask = q('#ppAsk'), yesScene = q('#ppYesScene');
  const yesBtn = q('#ppYes'), noBtn = q('#ppNo'), skipBtn = q('#ppSkip');
  const dpr = (LITE ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
  let W = 0, H = 0, closed = false, raf = 0, mode = 'night';
  const timers = [];
  const later = (fn, ms) => { const id = setTimeout(() => { if (!closed) fn(); }, ms); timers.push(id); return id; };

  function size() {
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size();
  window.addEventListener('resize', size);

  /* ---------- the night sky ---------- */
  const stars = [];
  for (let i = 0; i < 110; i++) stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.5 + 0.4, sp: 0.8 + Math.random() * 2, ph: Math.random() * 6.28 });
  const lanterns = [];
  for (let i = 0; i < 22; i++) {
    lanterns.push({ x: Math.random(), y: Math.random() * 1.2, r: 3 + Math.random() * 5, vy: 10 + Math.random() * 22, ph: Math.random() * 6.28, sw: 8 + Math.random() * 18 });
  }
  const rockets = [], sparks = [], petals = [];
  for (let i = 0; i < 30; i++) petals.push({ x: Math.random() * W, y: -Math.random() * H, vy: 30 + Math.random() * 50, vx: (Math.random() - 0.5) * 30, r: 3 + Math.random() * 4, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 2, hue: 335 + Math.random() * 20 });
  const hues = [345, 45, 38, 330, 52, 20];
  let t = 0, last = performance.now(), nextShot = 0, yesAt = 0;

  function explode(x, y) {
    const hue = hues[Math.floor(Math.random() * hues.length)];
    for (let i = 0; i < 38; i++) {
      const ang = (i / 38) * 6.2832 + Math.random() * 0.2, sp = 90 + Math.random() * 170;
      sparks.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 1, hue });
    }
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now; t += dt;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);

    for (const s of stars) {
      const a = 0.2 + 0.6 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
      ctx.fillStyle = 'rgba(255,240,215,' + a.toFixed(3) + ')';
      ctx.fillRect(s.x * W, s.y * H, s.r, s.r);
    }

    // crescent moon
    const mx = W * 0.8, my = H * 0.2, R = Math.min(W, H) * 0.075;
    const mg = ctx.createRadialGradient(mx, my, R * 0.5, mx, my, R * 3.2);
    mg.addColorStop(0, 'rgba(255,233,170,0.30)'); mg.addColorStop(1, 'rgba(255,233,170,0)');
    ctx.fillStyle = mg; ctx.fillRect(mx - R * 3.5, my - R * 3.5, R * 7, R * 7);
    ctx.save();
    ctx.beginPath(); ctx.arc(mx, my, R, 0, 6.2832); ctx.clip();
    ctx.fillStyle = '#ffe9a8'; ctx.fillRect(mx - R, my - R, R * 2, R * 2);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(mx + R * 0.5, my - R * 0.15, R * 0.88, 0, 6.2832); ctx.fill();
    ctx.restore();

    // drifting lanterns
    ctx.globalCompositeOperation = 'lighter';
    const rise = mode === 'yes' ? 2.4 : 1;
    for (const l of lanterns) {
      l.y -= (l.vy * rise * dt) / H;
      if (l.y < -0.06) { l.y = 1.06; l.x = Math.random(); }
      const x = l.x * W + Math.sin(t * 0.6 + l.ph) * l.sw, y = l.y * H;
      const a = 0.55 + 0.35 * Math.sin(t * 1.5 + l.ph);
      ctx.fillStyle = 'rgba(255,185,90,' + (0.10 * a).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x, y, l.r * 3.4, 0, 6.2832); ctx.fill();
      ctx.fillStyle = 'rgba(255,215,130,' + (0.35 * a).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x, y, l.r * 1.6, 0, 6.2832); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,205,' + (0.9 * a).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x, y, l.r * 0.6, 0, 6.2832); ctx.fill();
    }

    // celebration layer
    if (mode === 'yes') {
      const ty = t - yesAt;
      const cg = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.max(W, H) * 0.5);
      cg.addColorStop(0, 'rgba(255,190,110,' + (0.16 + 0.04 * Math.sin(t * 2)).toFixed(3) + ')');
      cg.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);

      if (ty >= nextShot) {
        rockets.push({ x: W * (0.1 + Math.random() * 0.8), y: H, ty: H * (0.12 + Math.random() * 0.4), vy: -H * 0.95 });
        nextShot = ty + 0.3 + Math.random() * 0.4;
      }
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.y += r.vy * dt;
        ctx.fillStyle = 'rgba(255,235,200,0.9)';
        ctx.fillRect(r.x - 1.5, r.y, 3, 12);
        if (r.y <= r.ty) { explode(r.x, r.y); rockets.splice(i, 1); }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        const d = Math.pow(0.5, dt * 2);
        s.vx *= d; s.vy = s.vy * d + 120 * dt;
        s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt * 0.65;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        ctx.fillStyle = 'hsla(' + s.hue + ',100%,70%,' + s.life.toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(s.x, s.y, 2, 0, 6.2832); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const p of petals) {
        p.y += p.vy * dt; p.x += p.vx * dt + Math.sin(t + p.rot) * 0.4; p.rot += p.vr * dt;
        if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; }
        ctx.fillStyle = 'hsla(' + p.hue.toFixed(0) + ',90%,82%,0.8)';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.55, p.rot, 0, 6.2832); ctx.fill();
      }
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  /* ---------- text scenes ---------- */
  function playScenes(root, scenes, onDone) {
    const arEl = root.querySelector('.pp-ar'), lnEl = root.querySelector('.pp-line');
    let idx = -1, timer = 0, sceneAt = 0;
    function step() {
      clearTimeout(timer);
      idx++;
      arEl.classList.remove('on'); lnEl.classList.remove('on');
      if (idx >= scenes.length) { later(onDone, 700); return; }
      const sc = scenes[idx];
      sceneAt = performance.now();
      later(() => {
        arEl.textContent = sc.ar || '';
        lnEl.textContent = sc.text || '';
        lnEl.classList.toggle('big', !!sc.big);
        if (sc.ar) arEl.classList.add('on');
        lnEl.classList.add('on');
      }, 650);
      timer = later(step, sc.dur);
      timers.push(timer);
    }
    step();
    return {
      advance() { if (performance.now() - sceneAt > 1400) step(); },
      finish() { clearTimeout(timer); idx = scenes.length - 1; arEl.classList.remove('on'); lnEl.classList.remove('on'); step(); }
    };
  }

  let asked = false;
  function showAsk() {
    if (asked) return;
    asked = true;
    stage.classList.add('off');
    skipBtn.classList.add('off');
    ask.classList.add('on');
  }
  const story = playScenes(stage, PROPOSAL_SCENES, showAsk);
  stage.addEventListener('click', () => { if (!asked) story.advance(); });
  skipBtn.addEventListener('click', () => { if (!asked) { story.finish(); } });

  /* ---------- the runaway "No" ---------- */
  let noCount = 0, answered = false, yesCtl = null, finalShown = false;
  function dodge(e) {
    if (answered) return;
    if (e && e.preventDefault) e.preventDefault();
    noCount++;
    noBtn.textContent = NO_TEXTS[Math.min(noCount, NO_TEXTS.length - 1)];
    const yesCap = Math.min(1.6, (W - 40) / (yesBtn.offsetWidth || 1));   // never wider than the screen
    yesBtn.style.transform = 'scale(' + Math.max(1, Math.min(yesCap, 1 + noCount * 0.07)).toFixed(2) + ')';
    noBtn.style.setProperty('--ns', Math.max(0.65, 1 - noCount * 0.04).toFixed(2));
    noBtn.classList.add('fly');
    const bw = noBtn.offsetWidth, bh = noBtn.offsetHeight;
    const yr = yesBtn.getBoundingClientRect();
    const yx = yr.left + yr.width / 2, yy = yr.top + yr.height / 2;
    const minY = H * 0.14, maxY = H * 0.84 - bh;
    let x = 0, y = 0, tries = 0;
    do {
      x = 12 + Math.random() * Math.max(10, W - bw - 24);
      y = minY + Math.random() * Math.max(10, maxY - minY);
      tries++;
    } while (tries < 40 && Math.hypot(x + bw / 2 - yx, y + bh / 2 - yy) < 170);
    noBtn.style.left = x + 'px';
    noBtn.style.top = y + 'px';
  }
  ['pointerenter', 'pointerdown', 'touchstart', 'click', 'focus'].forEach(ev => noBtn.addEventListener(ev, dodge, { passive: false }));

  /* ---------- YES ---------- */
  function deliver() {
    const msg = '💍✨ IFRA SAID YES! ✨💍\nAlhamdulillah!\n\nShe tried to press "No" ' + noCount +
      ' time' + (noCount === 1 ? '' : 's') + ' before choosing love 😂❤️\nTime: ' + new Date().toLocaleString();
    if (proposalSent) return Promise.resolve(true);
    if (AUTH.role === 'me') return Promise.resolve(true);   // you testing the proposal: do not message yourself
    return sendToHim(msg).then(ok => { if (ok) proposalSent = true; return ok; });
  }

  function onYes() {
    if (answered) return;
    answered = true;
    asked = true;
    startCineSong(PROPOSAL_SONG_START);   // Reflections from 0:38, inside her tap so phones allow sound
    cineResume = proposalResume;
    noBtn.style.display = 'none';
    ask.classList.remove('on');
    stage.classList.add('off');
    skipBtn.classList.add('off');
    q('#ppFlash').classList.add('go');
    mode = 'yes'; yesAt = t; nextShot = 0.2;
    const sent = deliver();

    later(() => {
      yesScene.classList.add('on');
      yesCtl = playScenes(yesScene, PROPOSAL_YES_SCENES, async () => {
        finalShown = true;
        yesScene.querySelector('.pp-ar').classList.remove('on');
        yesScene.querySelector('.pp-line').classList.remove('on');
        q('#ppFinal').classList.add('on');
        const status = q('#ppStatus'), btns = q('#ppEndBtns');
        status.textContent = 'Sending your answer to me... 💌';
        const ok = await sent;
        const auto = !!(NOTIFY_ON);
        status.textContent = ok ? 'Your answer has reached me. I am smiling from ear to ear 😊'
          : auto ? 'It could not be sent just now, so please tell me yourself 💌'
          : 'Now tell me your answer yourself, my love 💌';
        {
          const m = document.createElement('div');
          m.className = ok ? 'pp-no static' : 'pp-yes small'; m.setAttribute('role', 'button'); m.tabIndex = 0; m.setAttribute('data-kb', '');
          m.textContent = ok ? 'Message me too 💌' : 'Message him 💌';
          m.onclick = () => { writebackPrefill = SITE.text.proposalYes; closeProposal(); openFun('writeback'); };
          btns.appendChild(m);
        }
        if (!ok && INSTAGRAM_USERNAME) {
          {
            const ig = document.createElement('div');
            ig.className = 'pp-no static'; ig.setAttribute('role', 'button'); ig.tabIndex = 0; ig.setAttribute('data-kb', '');
            ig.textContent = 'Open Instagram DM';
            ig.onclick = () => {
              copyText(SITE.text.proposalYes);
              window.open('https://ig.me/m/' + encodeURIComponent(INSTAGRAM_USERNAME), '_blank');
              toast('Message copied. Paste it in the chat 💬', 3500);
            };
            btns.appendChild(ig);
          }
        }
        const c = document.createElement('div');
        c.className = 'pp-no static'; c.setAttribute('role', 'button'); c.tabIndex = 0; c.setAttribute('data-kb', '');
        c.textContent = 'Close ✨';
        c.onclick = closeProposal;
        btns.appendChild(c);
      });
    }, 1800);
  }
  yesBtn.addEventListener('click', onYes);
  yesScene.addEventListener('click', () => { if (yesCtl && !finalShown) yesCtl.advance(); });

  /* ---------- closing ---------- */
  function closeProposal() {
    if (closed) return;
    closed = true;
    stopCineSong();
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    window.removeEventListener('resize', size);
    document.removeEventListener('keydown', onKey);
    ov.classList.remove('show');
    document.body.classList.remove('cine-on');
    setTimeout(() => ov.remove(), 900);
    proposalStop = null;
  }
  const onKey = e => { if (e.key === 'Escape') closeProposal(); };
  document.addEventListener('keydown', onKey);
  q('#ppClose').addEventListener('click', closeProposal);
  proposalStop = closeProposal;
}


/* =====================================================
   📖 OUR STORY  (cinematic story pages, background song, optional voice)
   Everything is written in the admin panel > "Our Story".
   ===================================================== */
let STORY = SITE.story || { pages: [] };
refreshStoryBtn();
function refreshStoryBtn() {
  const b = document.getElementById('storyBtn');
  const ok = (STORY.pages || []).some(p => p && (p.heading || p.text || p.voice));
  // while logins are on and she has not logged in, show the button so it can ask for the login
  if (b) b.style.display = (ok || (window.SITE_LOCKED && !AUTH.loaded)) ? '' : 'none';
}

let storyStop = null;
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';
const STORY_SCENES = ['stars', 'petals', 'fireflies', 'hearts', 'aurora'];

/* little particle engine for the moving backgrounds */
function storyEngine(cv) {
  const ctx = cv.getContext('2d');
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, mode = 'stars', parts = [], raf = 0, shoot = null, born = 0, running = true;

  function resize() {
    const dpr = (LITE ? 1 : Math.min(2, window.devicePixelRatio || 1));
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const R = (a, b) => a + Math.random() * (b - a);
  function spawn(m, anywhere) {
    const x = R(0, W);
    if (m === 'stars') return { x, y: R(0, H), r: R(0.4, 1.7), ph: R(0, 6.3), sp: R(0.6, 2) };
    if (m === 'petals') return { x, y: anywhere ? R(-20, H) : -20, vy: R(0.5, 1.3), ph: R(0, 6.3), rot: R(0, 6.3), vr: R(-0.03, 0.03), s: R(6, 13) };
    if (m === 'fireflies') return { x, y: R(0, H), vx: R(-0.25, 0.25), vy: R(-0.25, 0.25), ph: R(0, 6.3), r: R(1.6, 3.6) };
    if (m === 'hearts') return { x, y: anywhere ? R(0, H + 40) : H + 30, vy: R(0.4, 1.2), ph: R(0, 6.3), s: R(7, 20), a: R(0.35, 0.85) };
    return { x, y: R(0, H), r: R(0.4, 1.3), ph: R(0, 6.3), sp: R(0.6, 2) }; // aurora's stars
  }
  function setMode(m) {
    mode = m; born = performance.now();
    const base = Math.min(95, Math.max(24, (W * H) / 11000));
    const n = Math.round((reduce ? base * 0.4 : base) * (m === 'aurora' ? 0.5 : 1));
    parts = []; for (let i = 0; i < n; i++) parts.push(spawn(m, true));
  }
  function heart(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
    ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
    ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
    ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
    ctx.fill();
  }
  function frame(t) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    ctx.clearRect(0, 0, W, H);
    const fade = Math.min(1, (t - born) / 900);
    ctx.globalAlpha = fade;
    if (mode === 'aurora') {
      for (let k = 0; k < 3; k++) {
        const cx = W * (0.25 + 0.25 * k) + Math.sin(t / 3800 + k * 2) * W * 0.18;
        const cy = H * (0.3 + 0.12 * k) + Math.cos(t / 4500 + k) * H * 0.1;
        const rad = Math.max(W, H) * 0.55;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        const col = ['120,80,255', '255,90,170', '70,200,220'][k];
        g.addColorStop(0, 'rgba(' + col + ',0.28)'); g.addColorStop(1, 'rgba(' + col + ',0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
    }
    for (const p of parts) {
      if (mode === 'stars' || mode === 'aurora') {
        ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + 0.55 * Math.abs(Math.sin(t / 900 * p.sp + p.ph))) * fade + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.3); ctx.fill();
      } else if (mode === 'petals') {
        p.y += p.vy; p.x += Math.sin(t / 1200 + p.ph) * 0.6; p.rot += p.vr;
        if (p.y > H + 20) Object.assign(p, spawn('petals', false));
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = 'rgba(255,' + Math.round(110 + 50 * Math.sin(p.ph)) + ',150,0.8)';
        ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, 6.3); ctx.fill(); ctx.restore();
      } else if (mode === 'fireflies') {
        p.x += p.vx + Math.sin(t / 1500 + p.ph) * 0.25; p.y += p.vy + Math.cos(t / 1700 + p.ph) * 0.25;
        if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10; if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10;
        const a = 0.25 + 0.75 * Math.abs(Math.sin(t / 1100 + p.ph));
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
        g.addColorStop(0, 'rgba(255,236,150,' + a + ')'); g.addColorStop(1, 'rgba(255,236,150,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 6, 0, 6.3); ctx.fill();
      } else if (mode === 'hearts') {
        p.y -= p.vy; p.x += Math.sin(t / 1000 + p.ph) * 0.5;
        if (p.y < -30) Object.assign(p, spawn('hearts', false));
        ctx.fillStyle = 'rgba(255,90,135,' + (p.a * Math.min(1, p.y / (H * 0.35))) + ')';
        heart(p.x, p.y, p.s);
      }
    }
    // an occasional shooting star on the starry scenes
    if ((mode === 'stars' || mode === 'aurora') && !reduce) {
      if (!shoot && Math.random() < 0.004) shoot = { x: R(W * 0.2, W), y: R(0, H * 0.4), l: R(70, 140), v: R(7, 11), a: 1 };
      if (shoot) {
        const g = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x + shoot.l, shoot.y - shoot.l * 0.45);
        g.addColorStop(0, 'rgba(255,255,255,' + shoot.a + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.beginPath();
        ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x + shoot.l, shoot.y - shoot.l * 0.45); ctx.stroke();
        shoot.x -= shoot.v; shoot.y += shoot.v * 0.45; shoot.a -= 0.018;
        if (shoot.a <= 0) shoot = null;
      }
    }
    ctx.globalAlpha = 1;
  }
  resize();
  window.addEventListener('resize', resize);
  setMode('stars');
  raf = requestAnimationFrame(frame);
  return {
    setMode,
    stop() { running = false; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); }
  };
}

/* Volume control for the story song.
   Phones running iOS ignore audio.volume completely, so there the song is routed through a
   Web Audio gain node instead. If even that is not possible, the song simply pauses while the
   voice message plays. Everywhere else the normal audio.volume is used. */
const IS_IOS_DEVICE = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function makeLevel(a) {
  let nativeOk = true;
  try { const probe = new Audio(); probe.volume = 0.5; nativeOk = probe.volume === 0.5; } catch (e) { }
  let ctx = null, gain = null;
  if (!nativeOk || IS_IOS_DEVICE) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC && new URL(a.src, location.href).origin === location.origin) {
        if (navigator.audioSession) navigator.audioSession.type = 'playback';
        ctx = new AC();
        const node = ctx.createMediaElementSource(a);
        gain = ctx.createGain();
        gain.gain.value = 0;
        node.connect(gain); gain.connect(ctx.destination);
        if (ctx.resume) ctx.resume().catch(() => { });
      }
    } catch (e) { ctx = null; gain = null; }
  }
  if (!gain && nativeOk) a.volume = 0;
  return {
    wake() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => { }); },
    /* flag: 'duck' = a voice message is playing, 'close' = fade out and stop */
    set(to, ms, flag) {
      if (gain) {
        const t = ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(to, t + ms / 1000);
        if (flag === 'close') setTimeout(() => { try { a.pause(); } catch (e) { } }, ms + 60);
      } else if (nativeOk) {
        fadeAudio(a, to, ms);
        if (flag === 'close' && to > 0) setTimeout(() => { try { a.pause(); } catch (e) { } }, ms + 60);
      } else if (flag === 'duck' || flag === 'close') {
        try { a.pause(); } catch (e) { }
      } else {
        a.play().catch(() => { });
      }
    },
    close() { if (ctx) { try { ctx.close(); } catch (e) { } } }
  };
}

function openStory() {
  if (storyStop) return;
  if (!AUTH.ok()) { requireLogin(openStory); return; }
  const pages = (STORY.pages || []).filter(p => p && (p.heading || p.text || p.voice));
  if (!pages.length) { toast('The story is still being written 🤍', 3200); return; }
  const slides = [{ kind: 'cover' }]
    .concat(pages.map(p => Object.assign({ kind: 'page' }, p)), [{ kind: 'end' }]);

  /* --- music: pause the playlist, start the chosen song at the chosen second --- */
  const resume = !music.paused;
  music.pause();
  const startAt = Number(STORY.songStart) || 0;
  const song = new Audio();
  song.preload = LITE ? 'metadata' : 'auto';
  song.src = STORY.songFile || CINE_SONG_FILE;
  /* volumes come from the admin panel > Our Story (percent: 0 = silent, 100 = full) */
  const pct = (v, d) => { v = (v === '' || v == null) ? d : Number(v); if (!isFinite(v)) v = d; return Math.max(0, Math.min(100, v)) / 100; };
  const SONG_LEVEL = pct(STORY.songVolume, 80);
  const DUCK_LEVEL = pct(STORY.duckVolume, 8);
  const lvl = makeLevel(song);
  let restoreT = 0;
  const seek = () => { try { song.currentTime = startAt; } catch (e) { } };
  if (song.readyState >= 1) seek(); else song.addEventListener('loadedmetadata', seek, { once: true });
  song.addEventListener('ended', () => { seek(); song.play().catch(() => { }); });
  song.play().then(() => lvl.set(SONG_LEVEL, 2500)).catch(() => { });

  /* voice player (unlocked now, inside her tap, so phones let it play later) */
  const voice = new Audio();
  voice.preload = LITE ? 'metadata' : 'auto';
  voice.src = SILENT_WAV;
  voice.play().then(() => voice.pause()).catch(() => { });

  /* --- build the overlay --- */
  const ov = document.createElement('div');
  ov.className = 'story';
  ov.innerHTML =
    '<div class="story-bg a"></div><div class="story-bg b"></div>' +
    '<div class="story-photo"></div><canvas class="story-cv"></canvas><div class="story-vig"></div>' +
    '<div class="story-prog"><i></i></div>' +
    '<button class="story-x" aria-label="Close story">&times;</button>' +
    '<div class="story-stage"><div class="story-card"></div></div>' +
    '<button class="story-voice" style="display:none"></button>' +
    '<div class="story-nav"><button class="story-btn-nav back">‹ Back</button><span class="story-count"></span><button class="story-btn-nav next">Next ›</button></div>';
  document.body.appendChild(ov);
  document.body.classList.add('story-on');
  const $ = s => ov.querySelector(s);
  const card = $('.story-card'), bgA = $('.story-bg.a'), bgB = $('.story-bg.b');
  const photo = $('.story-photo'), prog = $('.story-prog i'), count = $('.story-count');
  const bBack = $('.back'), bNext = $('.next'), bVoice = $('.story-voice');
  const engine = storyEngine($('.story-cv'));
  requestAnimationFrame(() => ov.classList.add('show'));

  let i = 0, closed = false, topBg = false, curScene = '';
  function setScene(name) {
    if (name === curScene) return;
    curScene = name;
    const next = topBg ? bgA : bgB, prev = topBg ? bgB : bgA;
    next.className = 'story-bg sc-' + name + ' ' + (topBg ? 'a' : 'b') + ' on';
    prev.classList.remove('on');
    topBg = !topBg;
    engine.setMode(name);
  }
  function para(text) {
    const wrap = document.createDocumentFragment();
    String(text || '').split(/\n\s*\n/).forEach((chunk, k) => {
      if (!chunk.trim()) return;
      const p = document.createElement('p');
      p.className = 'story-p'; p.style.animationDelay = (0.35 + k * 0.28) + 's';
      chunk.split('\n').forEach((line, j) => { if (j) p.appendChild(document.createElement('br')); p.appendChild(document.createTextNode(line)); });
      wrap.appendChild(p);
    });
    return wrap;
  }
  function stopVoice() { try { voice.pause(); } catch (e) { } }
  function voiceUI() {
    bVoice.textContent = voice.paused ? '🎙 Play voice message' : '⏸ Pause voice message';
  }
  /* song goes quiet under your voice, and comes back a moment after it stops
     (the short wait avoids a loud jump when the voice just changes between pages) */
  const isSilentUnlock = () => voice.src.indexOf('data:') === 0;
  const duck = () => { clearTimeout(restoreT); lvl.set(DUCK_LEVEL, 600, 'duck'); };
  const unduck = () => {
    clearTimeout(restoreT);
    restoreT = setTimeout(() => { if (!closed && voice.paused) lvl.set(SONG_LEVEL, 1500); }, 600);
  };
  voice.addEventListener('play', () => { if (isSilentUnlock()) return; duck(); voiceUI(); });
  voice.addEventListener('pause', () => { if (!closed && !isSilentUnlock()) unduck(); voiceUI(); });
  voice.addEventListener('ended', () => { if (!closed && !isSilentUnlock()) unduck(); voiceUI(); });
  bVoice.addEventListener('click', () => { lvl.wake(); if (voice.paused) voice.play().catch(() => { }); else voice.pause(); });

  function render() {
    const s = slides[i];
    card.innerHTML = '';
    card.scrollTop = 0;
    const auto = STORY_SCENES[(i + 1) % STORY_SCENES.length];
    let scene = s.kind === 'cover' ? 'stars' : s.kind === 'end' ? 'hearts' : (s.scene && s.scene !== 'auto' ? s.scene : auto);
    if (STORY_SCENES.indexOf(scene) < 0) scene = 'stars';
    setScene(scene);

    if (s.kind === 'cover') {
      const h = document.createElement('h1'); h.className = 'story-title'; h.textContent = STORY.coverTitle || 'Our Story';
      const p = document.createElement('p'); p.className = 'story-sub'; p.textContent = STORY.coverSubtitle || '';
      const o = document.createElement('div'); o.className = 'story-orn'; o.textContent = '❦';
      card.append(o, h, p);
      card.classList.add('center');
    } else if (s.kind === 'end') {
      const h = document.createElement('h2'); h.className = 'story-h'; h.textContent = STORY.endTitle || 'The End';
      card.append(h, para(STORY.endText || ''));
      const c = document.createElement('button'); c.className = 'story-close-btn'; c.textContent = 'Close 🤍';
      c.addEventListener('click', close); card.append(c);
      card.classList.add('center');
    } else {
      card.classList.remove('center');
      if (s.heading) { const h = document.createElement('h2'); h.className = 'story-h'; h.textContent = s.heading; card.append(h); }
      card.append(para(s.text));
    }
    // optional photo behind the page
    if (s.kind === 'page' && s.photo) {
      photo.style.backgroundImage = 'url("' + String(s.photo).replace(/"/g, '%22') + '")';
      photo.classList.remove('on'); void photo.offsetWidth; photo.classList.add('on');
    } else photo.classList.remove('on');
    // voice
    stopVoice();
    if (s.kind === 'page' && s.voice) {
      bVoice.style.display = '';
      voice.src = s.voice;
      voice.play().catch(() => { });
      voiceUI();
    } else bVoice.style.display = 'none';

    bBack.style.visibility = i === 0 ? 'hidden' : 'visible';
    bNext.style.visibility = i === slides.length - 1 ? 'hidden' : 'visible';
    bNext.textContent = i === 0 ? 'Begin ›' : 'Next ›';
    count.textContent = i === 0 || i === slides.length - 1 ? '' : i + ' / ' + (slides.length - 2);
    prog.style.width = (i / (slides.length - 1) * 100) + '%';
  }
  function go(n) {
    if (n < 0 || n >= slides.length || n === i && card.childNodes.length) return;
    i = n;
    card.classList.remove('in');
    setTimeout(() => { if (closed) return; render(); requestAnimationFrame(() => card.classList.add('in')); }, 260);
  }
  bNext.addEventListener('click', () => go(i + 1));
  bBack.addEventListener('click', () => go(i - 1));
  render(); requestAnimationFrame(() => card.classList.add('in'));

  function close() {
    if (closed) return;
    closed = true;
    engine.stop();
    clearTimeout(restoreT);
    lvl.set(0, 1300, 'close');
    setTimeout(() => lvl.close(), 1700);
    fadeAudio(voice, 0, 500);
    ov.classList.remove('show');
    setTimeout(() => ov.remove(), 700);
    document.body.classList.remove('story-on');
    document.removeEventListener('keydown', onKey);
    if (resume) setTimeout(() => { music.play().catch(() => { }); }, 1400);
    storyStop = null;
  }
  const onKey = e => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') go(i + 1);
    else if (e.key === 'ArrowLeft') go(i - 1);
  };
  document.addEventListener('keydown', onKey);
  $('.story-x').addEventListener('click', close);
  ov.addEventListener('click', () => lvl.wake());
  let tx = null;
  ov.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  ov.addEventListener('touchend', e => {
    if (tx == null) return;
    const dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 60) go(i + (dx < 0 ? 1 : -1));
  }, { passive: true });
  storyStop = close;
}

/* =====================================================
   🔔 BIRTHDAY REMINDERS (web push notifications)
   ===================================================== */
function b64ToU8(s) {
  const pad = '='.repeat((4 - s.length % 4) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let k = 0; k < raw.length; k++) out[k] = raw.charCodeAt(k);
  return out;
}
const REMIND_LABEL = (document.getElementById('remindBtn') || {}).textContent || '';
function remindOn() {
  const b = document.getElementById('remindBtn');
  if (!b) return;
  b.textContent = '✅ Birthday reminders are on';
  b.classList.add('on');
}
(function () {
  const b = document.getElementById('remindBtn');
  if (!b) return;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const canPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!canPush && !ios) { b.style.display = 'none'; return; }
  if (canPush && Notification.permission === 'granted' && localStorage.getItem('ifraRemind') === '1') remindOn();
})();
/* Get (or repair) this phone's push subscription and tell the server about it. */
/* Detect detailed device information (model, name, OS, browser, screen, app mode) */
async function detectDeviceDetails() {
  const ua = navigator.userAgent || '';
  let model = '';
  let os = 'Unknown OS';
  let browser = 'Unknown Browser';
  let type = 'mobile';
  const standalone = window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);

  if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
    try {
      const hints = await navigator.userAgentData.getHighEntropyValues(['model', 'platform', 'platformVersion', 'architecture']);
      if (hints.model) model = hints.model;
      if (hints.platform) os = hints.platform + (hints.platformVersion ? ' ' + hints.platformVersion.split('.')[0] : '');
    } catch (e) { }
  }

  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    const isIPad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    type = isIPad ? 'tablet' : 'mobile';
    const m = ua.match(/OS (\d+[_\.]\d+)/);
    os = (isIPad ? 'iPadOS' : 'iOS') + (m ? ' ' + m[1].replace(/_/g, '.') : '');
    if (isIPad) {
      model = 'Apple iPad';
    } else {
      const w = window.screen.width, h = window.screen.height, r = window.devicePixelRatio || 1;
      const minD = Math.min(w, h), maxD = Math.max(w, h);
      if (minD === 430 && maxD === 932) model = 'iPhone 15/16 Pro Max / Plus';
      else if (minD === 393 && maxD === 852) model = 'iPhone 15/16 Pro / 15/16';
      else if (minD === 390 && maxD === 844) model = 'iPhone 14 / 13 / 12';
      else if (minD === 428 && maxD === 926) model = 'iPhone 14/13/12 Pro Max';
      else if (minD === 414 && maxD === 896) model = r >= 3 ? 'iPhone 11 Pro Max / XS Max' : 'iPhone 11 / XR';
      else if (minD === 375 && maxD === 812) model = 'iPhone 11 Pro / X / XS';
      else if (minD === 375 && maxD === 667) model = 'iPhone SE / 8 / 7';
      else model = 'Apple iPhone';
    }
  } else if (/Android/i.test(ua)) {
    type = /Mobile/i.test(ua) ? 'mobile' : 'tablet';
    const m = ua.match(/Android\s+([0-9.]+)/i);
    os = 'Android' + (m ? ' ' + m[1] : '');
    if (!model) {
      const match = ua.match(/Android[^;]+;\s*([^;)]+)\s+(?:Build\/|;|\))/i);
      if (match && match[1] && !/wv/i.test(match[1])) {
        model = match[1].trim();
      } else {
        model = 'Android Device';
      }
    }
  } else if (/Windows NT/i.test(ua)) {
    type = 'desktop';
    const m = ua.match(/Windows NT ([\d\.]+)/);
    const v = m ? m[1] : '';
    os = v === '10.0' ? 'Windows 10/11' : ('Windows ' + v);
    model = 'Windows PC';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    type = 'desktop';
    os = 'macOS';
    model = 'Apple Mac';
  } else if (/Linux/i.test(ua)) {
    type = 'desktop';
    os = 'Linux';
    model = 'Linux PC';
  }

  if (/^SM-S9/i.test(model)) model = 'Samsung Galaxy S-Series (' + model + ')';
  else if (/^SM-A/i.test(model)) model = 'Samsung Galaxy A-Series (' + model + ')';
  else if (/^SM-F/i.test(model)) model = 'Samsung Galaxy Z-Series (' + model + ')';
  else if (/^SM-G/i.test(model)) model = 'Samsung Galaxy (' + model + ')';
  else if (/Pixel\s*\d/i.test(model)) model = 'Google ' + model;

  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/SamsungBrowser\//i.test(ua)) browser = 'Samsung Internet';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (/Opera|OPR\//i.test(ua)) browser = 'Opera';

  let name = '';
  if (type === 'mobile' || type === 'tablet') {
    if (/iPhone|iPad/i.test(model) || /iOS/i.test(os)) {
      name = "Ifra's " + (model.includes('iPad') ? 'iPad' : 'iPhone');
    } else if (/Samsung/i.test(model)) {
      name = "Ifra's Galaxy";
    } else {
      name = "Ifra's Phone (" + (model || 'Mobile') + ")";
    }
  } else {
    name = (model || 'Computer') + ' (' + browser + ')';
  }

  return {
    name,
    model: model || 'Unknown Model',
    os,
    browser,
    type,
    screen: window.screen.width + 'x' + window.screen.height + (window.devicePixelRatio ? ' @ ' + window.devicePixelRatio + 'x' : ''),
    isStandalone: !!standalone,
    timezone: (Intl && Intl.DateTimeFormat && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'Asia/Karachi',
    language: navigator.language || 'en'
  };
}

async function pushSubscribeAndSave() {
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const kr = await fetch('/api/push/key', { cache: 'no-store' });
  if (!kr.ok) throw new Error('key');
  const key = (await kr.json()).key;
  const keyBytes = b64ToU8(key);
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    const cur = sub.options && sub.options.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
    const same = cur && cur.length === keyBytes.length && cur.every((v, i) => v === keyBytes[i]);
    if (!same) { try { await sub.unsubscribe(); } catch (e) { } sub = null; }
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes });
  let device = null;
  try { device = await detectDeviceDetails(); } catch (e) { }
  const r = await fetch('/api/push/subscribe', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), device })
  });
  if (!r.ok) throw new Error('save');
  return sub;
}
/* every visit: if reminders were turned on, quietly make sure the server still has this phone */
(function () {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    if (Notification.permission !== 'granted' || localStorage.getItem('ifraRemind') !== '1') return;
    window.addEventListener('load', () => { setTimeout(() => { pushSubscribeAndSave().catch(() => { }); }, 2500); });
  } catch (e) { }
})();
async function enableReminders() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    if (ios && !standalone) toast('On iPhone: tap Share ⬆️, choose “Add to Home Screen”, open the site from your Home Screen, then tap this button again 💕', 10000);
    else toast('This browser cannot show reminders. Try Chrome on your phone 💕', 5000);
    return;
  }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('No problem. You can allow notifications later in your browser settings 🤍', 4500); return; }
    await pushSubscribeAndSave();
    localStorage.setItem('ifraRemind', '1');
    remindOn();
    toast('Reminders are on! I will tell you how many days are left 🎂💕', 5000);
  } catch (e) {
    toast('Could not turn reminders on this time. Please try again 🤍', 4500);
  }
}


/* =====================================================
   📲 INSTALL THE APP (works on PC, Android and iPhone)
   Installs the site like a real app: own icon, own window, opens offline.
   ===================================================== */
let deferredInstall = null;
(function () {
  const b = document.getElementById('installBtn');
  const standalone = window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { }); });
  }
  if (!b) return;
  if (standalone) { b.style.display = 'none'; return; }   // already running as the installed app
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; tryInstallBanner(); });
  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    hideInstallBanner();
    b.textContent = '✅ App installed';
    toast('Installed! Open it from your home screen or desktop 🌹', 5000);
    setTimeout(() => { b.style.display = 'none'; }, 3000);
  });
})();
async function installApp() {
  if (deferredInstall) {
    const p = deferredInstall;
    deferredInstall = null;
    try {
      p.prompt();
      const r = await p.userChoice;
      if (r && r.outcome === 'accepted') toast('Installing… 🌹', 3500);
    } catch (e) { }
    return;
  }
  const ua = navigator.userAgent;
  if (/Instagram|FBAN|FBAV|Line\/|Snapchat|MicroMessenger|WhatsApp/i.test(ua)) {
    toast('Open this page in Chrome or Safari first (menu ⋮ then “Open in browser”), then tap this button again 💕', 9000);
  } else if (IS_IOS_DEVICE) {
    toast('On iPhone: tap the Share button ⬆️, then choose “Add to Home Screen” 📲', 9000);
  } else if (/Firefox/i.test(ua) && !/Android/i.test(ua)) {
    toast('Firefox on PC cannot install web apps. Please open this page in Chrome or Edge 💕', 8000);
  } else {
    toast('Open your browser menu (⋮) and choose “Install app” or “Add to Home screen” 📲', 8000);
  }
}


/* =====================================================
   💞 LOVE SONG: plays when she taps "Forever Yours"
   Choose the file (and where it starts) in admin > Playlist > Love song.
   Her normal music pauses while it plays and comes back when she closes the finale.
   ===================================================== */
let loveAudio = null, loveResume = false, loveFile = '';
function loveSongOn() { return !!String((SITE.settings || {}).loveSongFile || '').trim(); }
function loveStart() { return Math.max(0, Number((SITE.settings || {}).loveSongStart) || 0); }
function loveVolume() {
  const v = (SITE.settings || {}).loveSongVolume;
  return Math.max(0, Math.min(1, (v == null || v === '' ? 85 : Number(v)) / 100));
}
function prepareLoveSong() {
  if (!loveSongOn()) return;
  const f = String(SITE.settings.loveSongFile).trim();
  if (loveAudio && loveFile === f) return;
  if (loveAudio) { try { loveAudio.pause(); } catch (e) { } }
  loveFile = f;
  loveAudio = new Audio();
  loveAudio.preload = 'auto';
  loveAudio.src = f;
  // loop from the chosen second, not from 0:00
  loveAudio.addEventListener('ended', () => {
    try { loveAudio.currentTime = loveStart(); } catch (e) { }
    loveAudio.play().catch(() => { });
  });
  loveAudio.addEventListener('error', () => {
    if (loveResume) { loveResume = false; music.play().catch(() => { }); }
  });
}
function startLoveSong() {
  if (!loveSongOn()) return;
  prepareLoveSong();
  const a = loveAudio;
  clearInterval(a._f);
  if (!a.paused) return;                        // already playing
  loveResume = !music.paused;
  music.pause();
  a.muted = false;
  a.volume = 0;
  const from = loveStart();
  const seek = () => { try { a.currentTime = from; } catch (e) { } };
  if (a.readyState >= 1) seek(); else a.addEventListener('loadedmetadata', seek, { once: true });
  a.play().then(() => fadeAudio(a, loveVolume(), 2500)).catch(() => {
    if (loveResume) { loveResume = false; music.play().catch(() => { }); }
  });
}
function stopLoveSong() {
  if (!loveAudio || loveAudio.paused) return;
  fadeAudio(loveAudio, 0, 1400);
  if (loveResume) { loveResume = false; setTimeout(() => { music.play().catch(() => { }); }, 1500); }
}

/* =====================================================
   📲 INSTALL SUGGESTION: a small banner a few seconds after she opens the rose
   - Android / PC (Chrome, Edge): one tap opens the real install window
   - iPhone: shows the "Share > Add to Home Screen" steps
   - WhatsApp / Instagram in-app browser: asks her to open the page in Chrome / Safari
   If she taps "Not now" it stays away for 3 days. Never shown once installed.
   ===================================================== */
let installBannerReady = false;
const INSTALL_SNOOZE_MS = 3 * 86400e3;
const IN_APP_BROWSER = /Instagram|FBAN|FBAV|Line\/|Snapchat|MicroMessenger|WhatsApp|TikTok/i.test(navigator.userAgent);
function isStandalone() {
  return window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
}
function installSnoozed() {
  try { const t = Number(localStorage.getItem('ifraInstallNo')) || 0; return t && Date.now() - t < INSTALL_SNOOZE_MS; } catch (e) { return false; }
}
function hideInstallBanner() {
  const b = document.getElementById('installBanner');
  if (!b) return;
  b.classList.remove('show');
  b.setAttribute('aria-hidden', 'true');
}
function tryInstallBanner() {
  const b = document.getElementById('installBanner');
  if (!b || !installBannerReady || b.classList.contains('show') || b._shown) return;
  if (isStandalone() || installSnoozed() || /[?&]preview=1/.test(location.search)) return;
  const yes = document.getElementById('ibYes'), no = document.getElementById('ibNo'), tx = document.getElementById('ibText');
  if (deferredInstall) {
    /* normal install window is ready: keep the texts from the admin panel */
  } else if (IN_APP_BROWSER) {
    tx.textContent = 'Open this page in Chrome or Safari (menu ⋮ then “Open in browser”) to install it as an app 💕';
    yes.style.display = 'none'; no.textContent = 'Got it';
  } else if (IS_IOS_DEVICE) {
    tx.innerHTML = 'Tap the Share button <b style="display:inline">⬆️</b>, then “Add to Home Screen” 📲';
    yes.style.display = 'none'; no.textContent = 'Got it';
  } else {
    return;               // this browser cannot install (yet): stay quiet; it tries again when the browser says it can
  }
  b._shown = true;
  b.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => b.classList.add('show'));
}
function dismissInstallBanner() {
  try { localStorage.setItem('ifraInstallNo', String(Date.now())); } catch (e) { }
  hideInstallBanner();
}
function installFromBanner() {
  hideInstallBanner();
  installApp();
}

/* 🔐 if she logged in before, load the private parts again (runs last, after everything above exists) */
if (window.SITE_LOCKED) { AUTH.load(); }

/* =====================================================
   🔒 WEBSITE LOCKS
   Individual things (a button, a surprise tile, a game, one "Open When" letter...) can get their own
   password in the admin panel (Website locks). Tapping a locked thing asks for it first.
   ===================================================== */
const ITEM_LOCKS = window.SITE_ITEM_LOCKS || {};
const ItemLock = {
  open: new Set(),                       // unlocked during this visit
  tokens: (() => { try { return JSON.parse(localStorage.getItem('ifraItems') || '{}') || {}; } catch (e) { return {}; } })(),
  pending: null,
  saveTokens() { try { localStorage.setItem('ifraItems', JSON.stringify(this.tokens)); } catch (e) { } },
  locked(id) { return !!ITEM_LOCKS[id] && !this.open.has(id); },
  async call(id, password, token) {
    const r = await fetch('/api/auth/item', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password, token })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || 'Could not unlock'); e.status = r.status; throw e; }
    return j;
  },
  // which locked thing was tapped (null when it is not one of the lockable things)
  idOf(t) {
    if (!t || !t.closest) return null;
    let e;
    if ((e = t.closest('.s-tile[data-fun]'))) return e.dataset.fun;
    if ((e = t.closest('.envelope'))) return 'env' + Array.prototype.indexOf.call(document.querySelectorAll('.envelope'), e);
    if (t.closest('#openGalleryBtn, #galleryGrid')) return 'gallery';
    if (t.closest('#storyBtn')) return 'story';
    if (t.closest('.proposal-btn:not(.story-btn)')) return 'proposal';
    if ((e = t.closest('button[onclick]'))) {
      const oc = e.getAttribute('onclick') || '';
      if (oc.indexOf('showFinale') === 0) return 'forever';
      if (oc.indexOf('showMessage') === 0) return 'care';
    }
    return null;
  },
  elFor(id) {
    if (/^env\d+$/.test(id)) return document.querySelectorAll('.envelope')[Number(id.slice(3))] || null;
    const map = { gallery: '#openGalleryBtn', story: '#storyBtn', proposal: '.proposal-btn:not(.story-btn)', forever: 'button[onclick^="showFinale"]', care: 'button[onclick^="showMessage"]' };
    return document.querySelector(map[id] || '.s-tile[data-fun="' + id + '"]');
  },
  badges() {
    Object.keys(ITEM_LOCKS).forEach(id => {
      const el = this.elFor(id);
      if (el) el.classList.toggle('is-locked', this.locked(id));
    });
  },
  // a locked "Open When" letter comes back from the server only after the password
  fill(id, data) {
    if (!/^env\d+$/.test(id) || !data || typeof data.body !== 'string' || !data.body) return;
    const env = this.elFor(id), b = env && env.querySelector('.env-body');
    if (b) b.innerHTML = data.body;
  },
  done(id, token, data) {
    this.open.add(id);
    if (token) { this.tokens[id] = token; this.saveTokens(); }
    this.fill(id, data);
    this.badges();
  },
  // she came back: unlock everything she already unlocked before
  async restore() {
    for (const id of Object.keys(ITEM_LOCKS)) {
      const tk = this.tokens[id];
      if (!tk) continue;
      try { const j = await this.call(id, '', tk); this.done(id, j.token, j.data); }
      catch (e) { if (e.status === 401) { delete this.tokens[id]; this.saveTokens(); } }
    }
  }
};
let itemBypass = false;
function itemGate(e) {
  if (itemBypass) return;
  if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
  const id = ItemLock.idOf(e.target);
  if (!id || !ItemLock.locked(id)) return;
  e.stopImmediatePropagation(); e.preventDefault();
  ItemLock.pending = { id, target: e.target };
  openFun('itemlock');
}
window.addEventListener('click', itemGate, true);
window.addEventListener('keydown', itemGate, true);

FUN.itemlock = body => {
  const p = ItemLock.pending;
  if (!p) return;
  const L = ITEM_LOCKS[p.id] || {};
  body.innerHTML = `<h3>This is locked 🔒</h3>
    <p class="fun-sub" id="ilHint"></p>
    <input id="ilPass" class="fun-input" type="password" autocomplete="off" placeholder="Password" autocapitalize="off" spellcheck="false">
    <p class="fun-sub" id="ilErr" style="min-height:1.4em;margin:8px 0 0"></p>
    <div class="fun-btn" id="ilGo">Unlock 💌</div>`;
  byId('ilHint').textContent = L.hint ? 'Hint: ' + L.hint : 'Ask me for the password 💕';
  const err = byId('ilErr'), go = byId('ilGo'), inp = byId('ilPass');
  let busy = false;
  async function submit() {
    if (busy || !inp.value) return;
    busy = true; err.textContent = ''; go.textContent = 'Checking…';
    try {
      const j = await ItemLock.call(p.id, inp.value, '');
      ItemLock.done(p.id, j.token, j.data);
      closeFun();
      ItemLock.pending = null;
      setTimeout(() => {                 // now open the thing she tapped
        itemBypass = true;
        try { (p.target && p.target.isConnected ? p.target : ItemLock.elFor(p.id)).click(); } catch (e) { }
        itemBypass = false;
      }, 450);
      return;
    } catch (e) {
      err.textContent = e.message;
      go.textContent = 'Unlock 💌';
      inp.value = ''; inp.focus();
    }
    busy = false;
  }
  go.onclick = submit;
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  setTimeout(() => { try { inp.focus(); } catch (e) { } }, 350);
};
ItemLock.badges();
if (Object.keys(ITEM_LOCKS).length) ItemLock.restore();
