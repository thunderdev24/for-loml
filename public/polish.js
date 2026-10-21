/* ✨ POLISH: greeting, rose petals, extra reveal, daily envelope, accent colours, lyrics, lightbox zoom,
   memory reel, milestone hearts, secret long-press, battery saver. Loaded last; nothing else is changed. */
(function () {
  'use strict';
  var lite = (typeof LITE !== 'undefined') ? LITE : false;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var S = window.SITE || {};
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { } return null; }
  function txt(k, d) { return (S.text && S.text[k]) || d; }

  /* 1) time-of-day greeting above the title */
  (function () {
    var h1 = $('.card > h1'); if (!h1) return;
    var name = ($('.rose-name') || {}).textContent || '';
    var h = new Date().getHours();
    var g = h < 5 ? txt('greetNight', 'Good night') : h < 12 ? txt('greetMorning', 'Good morning') : h < 17 ? txt('greetAfternoon', 'Good afternoon') : h < 21 ? txt('greetEvening', 'Good evening') : txt('greetNight', 'Good night');
    var e = document.createElement('div'); e.className = 'pl-greet';
    e.textContent = g + (name ? ', ' + name.trim() : '') + ' ' + (h >= 21 || h < 5 ? '🌙' : h < 12 ? '☀️' : '🌹');
    h1.parentNode.insertBefore(e, h1);
  })();

  /* 2) rose screen: soft glow + a few petals (skipped on weak phones) */
  (function () {
    var r = $('#roseScreen'); if (!r || lite || reduce) return;
    var g = document.createElement('div'); g.className = 'pl-glow';
    var f = document.createElement('div'); f.className = 'pl-fall';
    for (var i = 0; i < 9; i++) {
      var p = document.createElement('i');
      p.style.left = (6 + i * 10.5) + '%';
      p.style.setProperty('--dx', (i % 2 ? 40 : -40) + 'px');
      p.style.animationDuration = (9 + (i * 7) % 6) + 's';
      p.style.animationDelay = (-i * 1.7) + 's';
      f.appendChild(p);
    }
    r.insertBefore(f, r.firstChild); r.insertBefore(g, r.firstChild);
  })();

  /* 3) reveal for the question section too (same rules as the existing reveal) */
  (function () {
    var card = $('.card');
    if (!card || reduce || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } });
    }, { root: card, threshold: 0.1 });
    $$('.proposal-section', card).forEach(function (s) { s.classList.add('rv'); io.observe(s); });
  })();

  /* 4) "Today" badge on one envelope, picked by the date (changes every day) */
  (function () {
    var envs = $$('.envelope'); if (!envs.length) return;
    var d = new Date(), day = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
    var e = envs[day % envs.length];
    var b = document.createElement('span'); b.className = 'pl-today'; b.textContent = 'Today ✨';
    e.appendChild(b);
  })();

  /* 5) player: accent colour per song + live lyric line */
  (function () {
    var sec = $('.song-section'), mp = $('.mp'), music = document.getElementById('bgMusic');
    if (!sec || !mp || !music) return;
    var pal = [['#ff4d6d', '#ff8fa3'], ['#ffb86b', '#ff7a59'], ['#b983ff', '#ff8fd0'], ['#4dd0e1', '#7c9cff'], ['#7be0a4', '#ffd36b']];
    var lyr = document.createElement('div'); lyr.className = 'pl-lyric'; lyr.setAttribute('aria-live', 'off');
    var seek = $('.mp-seek', mp); mp.insertBefore(lyr, seek);
    var cur = -1, lines = [], li = -2;
    function idx() { return (typeof curSong === 'number' && curSong >= 0) ? curSong : 0; }
    function songs() { return (typeof songList === 'function') ? songList() : []; }
    function accent() {
      var i = idx(), s = songs()[i] || {}, c = pal[i % pal.length];
      var a1 = s.accent || c[0], a2 = s.accent2 || c[1];
      sec.style.setProperty('--acc1', a1); sec.style.setProperty('--acc2', a2);
    }
    function load() {
      var i = idx(); if (i === cur) return; cur = i; li = -2;
      var s = songs()[i] || {};
      var fromText = String(s.lyricsText || '').split(/\r?\n/).map(function (ln) {
        var m = /^\s*(?:\[)?(\d+):(\d{1,2})(?:[.,]\d+)?(?:\])?\s+(.+)$/.exec(ln) || /^\s*(?:\[)?(\d+)(?:\])?\s+(.+)$/.exec(ln);
        if (!m) return null;
        return m.length === 4 ? { t: Number(m[1]) * 60 + Number(m[2]), l: m[3] } : { t: Number(m[1]), l: m[2] };
      }).filter(Boolean);
      lines = (fromText.length ? fromText : (s.lyrics || [])).filter(function (x) { return x && typeof x.t === 'number' && x.l; }).sort(function (a, b) { return a.t - b.t; });
      lyr.textContent = ''; accent();
    }
    function tick() {
      load();
      if (!lines.length) return;
      var t = music.currentTime, n = -1;
      for (var i = 0; i < lines.length; i++) { if (lines[i].t <= t) n = i; else break; }
      if (n === li) return; li = n;
      lyr.classList.add('sw');
      setTimeout(function () { lyr.textContent = n >= 0 ? lines[n].l : ''; lyr.classList.remove('sw'); }, 160);
    }
    ['timeupdate', 'loadstart', 'play', 'seeked'].forEach(function (n) { music.addEventListener(n, tick); });
    load();
  })();

  /* 6) lightbox: double-tap zoom (swipe is paused while zoomed), soft arrive */
  (function () {
    var lb = document.getElementById('lightbox'), img = document.getElementById('lightbox-img');
    if (!lb || !img) return;
    var lastTap = 0;
    function unzoom() { img.classList.remove('pl-zoom'); }
    img.addEventListener('click', function (e) {
      var now = Date.now();
      if (now - lastTap < 320) {
        var r = img.getBoundingClientRect();
        img.style.setProperty('--zx', ((e.clientX - r.left) / r.width * 100) + '%');
        img.style.setProperty('--zy', ((e.clientY - r.top) / r.height * 100) + '%');
        img.classList.toggle('pl-zoom'); lastTap = 0;
      } else lastTap = now;
    });
    lb.addEventListener('touchend', function (e) { if (img.classList.contains('pl-zoom')) e.stopPropagation(); }, true);
    img.addEventListener('load', function () {
      unzoom();
      if (reduce || lite) return;
      img.classList.remove('pl-arrive'); void img.offsetWidth; img.classList.add('pl-arrive');
    });
    new MutationObserver(function () { if (!lb.classList.contains('show')) unzoom(); }).observe(lb, { attributes: true, attributeFilter: ['class'] });
  })();

  /* 7) memory reel: auto-plays the photos one by one */
  (function () {
    var head = $('#galleryOverlay .gallery-head'), lb = document.getElementById('lightbox');
    if (!head || !lb) return;
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'pl-reel'; btn.textContent = '▶ Reel';
    var close = $('.gallery-close', head); head.insertBefore(btn, close);
    var timer = null;
    function stop() { clearInterval(timer); timer = null; btn.classList.remove('on'); btn.textContent = '▶ Reel'; }
    btn.addEventListener('click', function () {
      if (timer) { stop(); return; }
      if (typeof galleryItems === 'undefined' || !galleryItems.length) return;
      openLightbox(null, null, 0);
      btn.classList.add('on'); btn.textContent = '⏸ Reel';
      timer = setInterval(function () {
        if (!lb.classList.contains('show')) { stop(); return; }
        var z = $('#lightbox-img'); if (z && z.classList.contains('pl-zoom')) return;
        nextLightboxImage();
      }, 4200);
    });
    new MutationObserver(function () { if (!lb.classList.contains('show') && timer) stop(); }).observe(lb, { attributes: true, attributeFilter: ['class'] });
  })();

  /* 8) hearts burst + milestone message */
  function hearts(n) {
    if (lite || reduce) return;
    var set = ['❤️', '💖', '💕', '🌹', '✨'];
    for (var i = 0; i < n; i++) {
      var s = document.createElement('span'); s.className = 'pl-conf'; s.textContent = set[i % set.length];
      s.style.left = Math.random() * 100 + 'vw';
      s.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
      s.style.setProperty('--rot', (Math.random() * 500 - 250) + 'deg');
      s.style.animationDuration = (2.6 + Math.random() * 2.2) + 's';
      s.style.animationDelay = (Math.random() * 0.9) + 's';
      document.body.appendChild(s);
      (function (x) { setTimeout(function () { x.remove(); }, 6500); })(s);
    }
  }
  (function () {
    var start = (typeof LOVE_START !== 'undefined') ? LOVE_START : null;
    if (!start || isNaN(start)) return;
    var days = Math.floor((Date.now() - start.getTime()) / 864e5);
    var hit = days > 0 && (days % 100 === 0 || days % 365 === 0);
    if (!hit || ls('ifraMs') === String(days)) return;
    var tries = 0, iv = setInterval(function () {
      if (++tries > 120) { clearInterval(iv); return; }
      if (typeof roseOpened === 'undefined' || !roseOpened) return;
      clearInterval(iv);
      setTimeout(function () {
        ls('ifraMs', String(days));
        var m = document.createElement('div'); m.className = 'pl-ms';
        m.textContent = (days % 365 === 0 ? (days / 365) + (days === 365 ? ' year' : ' years') : days + ' days') + ' of loving you ❤️';
        document.body.appendChild(m); setTimeout(function () { m.remove(); }, 3400);
        hearts(34);
      }, 1800);
    }, 500);
  })();

  /* 9) secret: hold the big heart for 3 seconds */
  (function () {
    var heart = $('.card .heart'); if (!heart) return;
    var t = null;
    function end() { clearTimeout(t); t = null; heart.classList.remove('pl-hold'); }
    heart.addEventListener('pointerdown', function () {
      end(); heart.classList.add('pl-hold');
      t = setTimeout(function () {
        heart.classList.remove('pl-hold');
        var s = document.getElementById('secret');
        if (s) { s.style.display = 'block'; try { s.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { } }
        try { if (navigator.vibrate) navigator.vibrate([60, 40, 120]); } catch (e) { }
        hearts(16);
      }, 3000);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (n) { heart.addEventListener(n, end); });
  })();

  /* 10) battery saver: pause all animation while the tab is hidden */
  document.addEventListener('visibilitychange', function () { document.documentElement.classList.toggle('pl-hidden', document.hidden); });
})();
