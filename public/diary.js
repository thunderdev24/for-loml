/* 📖 DIARY CALENDAR
   Replaces the old list-only diary (FUN.diary in ifra.js) without touching ifra.js.
   Loaded after ifra.js / plus.js. Everything is controlled from admin → Shared Diary → Diary settings
   (window.SITE.diary); the values below are only the fallbacks.
   Storage and sharing are unchanged: pages live in localStorage 'ifraDiaryEntries' and shared pages go to /api/notify. */
(function () {
  'use strict';
  if (typeof FUN === 'undefined') return;

  var LS = 'ifraDiaryEntries', LSD = 'ifraDiaryDrafts';
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DOWS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  var DEF = {
    enabled: true, defaultView: 'calendar', theme: 'rose',
    showStreak: true, showMoodSummary: true, showPrompts: true, allowSharing: true, allowBackfill: true,
    title: "Ifra's Personal Diary 📖🔒",
    subtitle: 'A safe, quiet haven for your thoughts and feelings 💕',
    writeButton: '✍️ Write a page for this day',
    emptyTitle: 'Nothing written on this day',
    emptyText: 'Every day deserves a few lines. Tell your diary how today felt 💕',
    futureText: 'This page is still waiting for its day. Come back then and fill it with your heart 🌙',
    lockedText: 'Pages can only be written on the day itself, so every page stays honest 🌹',
    editTitle: 'Dear Diary... ✍️',
    editSub: 'Pour your heart out. You decide whether to keep it secret or share it with him 💕',
    placeholder: 'Dear diary... write whatever you are thinking or feeling today 💕',
    shareTitle: '💌 Let Tayyab read this page',
    shareSub: 'Toggle ON if you want this specific page to be visible to Tayyab',
    shareOn: '💖 <b>Shared with Tayyab:</b> When you save, this page will be delivered to Tayyab and he can read it in his admin panel!',
    shareOff: '🔒 <b>Private:</b> This page stays 100% private on your phone. Nobody else can ever see it.',
    savedPrivate: 'Saved privately to your personal diary 🔒',
    savedShared: 'Saved to your diary & shared with Tayyab 💕',
    footNote: '🔒 Your pages stay on this phone unless you choose to share one.',
    moods: [
      { emoji: '💖', label: 'In Love' }, { emoji: '🌸', label: 'Happy & Sweet' }, { emoji: '🥺', label: 'Missing You' },
      { emoji: '☕', label: 'Cozy & Calm' }, { emoji: '🌙', label: 'Night Thoughts' }, { emoji: '✨', label: 'Excited' },
      { emoji: '💭', label: 'Reflective' }, { emoji: '🌧️', label: 'A Bit Sad' }, { emoji: '😴', label: 'Tired' }, { emoji: '🔥', label: 'Fired Up' }
    ],
    prompts: [
      'What made you smile today?', 'Write about a moment you wish you could replay.', 'What are you grateful for tonight?',
      'Describe today in three words, then explain them.', 'What would you tell yourself a year ago?',
      'Something small that felt a little magical today…', 'What are you looking forward to?',
      'A thought you have been carrying quietly…', 'Who made your day better, and how?',
      'What song matches your mood today, and why?', 'Write a wish for tomorrow.', 'What did you learn about yourself lately?'
    ]
  };

  function cfg() {
    var s = (window.SITE && window.SITE.diary) || {}, o = {}, k;
    for (k in DEF) {
      var v = s[k];
      if (Array.isArray(DEF[k])) o[k] = (Array.isArray(v) && v.length) ? v : DEF[k];
      else o[k] = (v === undefined || v === null || v === '') ? DEF[k] : v;
    }
    o.moods = o.moods.filter(function (m) { return m && m.emoji; });
    if (!o.moods.length) o.moods = DEF.moods;
    o.prompts = o.prompts.map(function (p) { return String(p || '').trim(); }).filter(Boolean);
    if (!o.prompts.length) o.prompts = DEF.prompts;
    return o;
  }

  /* ---------- small helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function p2(n) { return n < 10 ? '0' + n : '' + n; }
  function kOf(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function parseKey(k) { var a = String(k).split('-'); return new Date(+a[0], (+a[1] || 1) - 1, +a[2] || 1); }
  function longDate(k) { return parseKey(k).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); }
  function shortDate(d) { return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); }
  function lite() { try { return typeof LITE !== 'undefined' && !!LITE; } catch (e) { return false; } }
  function words(t) { t = String(t || '').trim(); return t ? t.split(/\s+/).length : 0; }
  function say(m, ms) { try { toast(m, ms); } catch (e) { } }
  function burst(n) { if (!lite()) { try { burstCenter(n); } catch (e) { } } }

  function load() { try { var a = JSON.parse(localStorage.getItem(LS) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function store(a) { try { localStorage.setItem(LS, JSON.stringify(a)); return true; } catch (e) { return false; } }
  function stamp(e) { if (e.ts) return e.ts; var m = /entry_([a-z0-9]+)_/.exec(e.id || ''); return m ? (parseInt(m[1], 36) || 0) : 0; }
  function sorted() {
    return load().filter(function (e) { return e && e.id; }).sort(function (a, b) {
      var da = a.date || '', db = b.date || '';
      return da < db ? 1 : da > db ? -1 : stamp(b) - stamp(a);
    });
  }
  function byDate(list) { var m = {}; list.forEach(function (e) { if (e.date) (m[e.date] = m[e.date] || []).push(e); }); return m; }
  function streakOf(map) {
    var d = new Date(); d.setHours(0, 0, 0, 0);
    var n = 0, guard = 0;
    if (!map[kOf(d)]) d.setDate(d.getDate() - 1);
    while (map[kOf(d)] && guard++ < 4000) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function drafts() { try { return JSON.parse(localStorage.getItem(LSD) || '{}') || {}; } catch (e) { return {}; } }
  function putDraft(key, v) { try { var d = drafts(); if (v) d[key] = v; else delete d[key]; localStorage.setItem(LSD, JSON.stringify(d)); } catch (e) { } }

  /* ---------- the window ---------- */
  FUN.diary = function (body) {
    var c = cfg();
    var box = body.closest ? body.closest('.fun-box') : null;
    if (box) box.classList.add('dy-wide');

    var now = new Date(); now.setHours(0, 0, 0, 0);
    var todayK = kOf(now);
    var st = { view: c.defaultView === 'list' ? 'list' : 'cal', back: 'cal', y: now.getFullYear(), m: now.getMonth(), sel: todayK, q: '', entry: null, prompt: -1 };

    function moodLabel(e) { for (var i = 0; i < c.moods.length; i++) if (c.moods[i].emoji === e) return c.moods[i].label || ''; return ''; }
    function canWrite(k) { return k <= todayK && (c.allowBackfill || k === todayK); }
    function wrap(inner) { return '<div class="dy" data-theme="' + esc(c.theme) + '">' + inner + '</div>'; }
    function $(s) { return body.querySelector(s); }

    /* ===== main screen (calendar + list) ===== */
    function renderMain() {
      body.innerHTML = wrap(
        '<div class="dy-hero"><h3>' + esc(c.title) + '</h3><p class="fun-sub">' + esc(c.subtitle) + '</p></div>' +
        '<div class="dy-stats" id="dyStats"></div>' +
        '<div class="dy-seg" role="tablist"><button type="button" data-v="cal" class="' + (st.view === 'cal' ? 'on' : '') + '">📅 Calendar</button>' +
        '<button type="button" data-v="list" class="' + (st.view === 'list' ? 'on' : '') + '">📜 All pages</button></div>' +
        '<div id="dyPane"></div>' +
        '<p class="dy-foot">' + esc(c.footNote) + '</p>');
      Array.prototype.forEach.call(body.querySelectorAll('.dy-seg button'), function (b) {
        b.onclick = function () { st.view = b.getAttribute('data-v'); renderMain(); };
      });
      drawStats();
      if (st.view === 'cal') drawCal(); else drawList();
    }

    function drawStats() {
      var list = sorted(), map = byDate(list), el = $('#dyStats'); if (!el) return;
      var shared = list.filter(function (e) { return e.shared; }).length, sk = streakOf(map);
      var h = '<div class="dy-stat"><b>' + list.length + '</b><span>PAGES</span></div>';
      if (c.showStreak) h += '<div class="dy-stat ' + (sk ? 'hot' : '') + '"><b>' + (sk ? '🔥 ' + sk : '🌱 0') + '</b><span>' + (sk ? 'DAY STREAK' : 'START TODAY') + '</span></div>';
      if (c.allowSharing) h += '<div class="dy-stat"><b>💖 ' + shared + '</b><span>SHARED</span></div>';
      el.innerHTML = h;
    }

    /* ----- calendar ----- */
    function drawCal() {
      var pane = $('#dyPane');
      pane.innerHTML =
        '<div class="dy-monthbar"><button type="button" class="dy-nav" id="dyPrev" aria-label="Previous month">‹</button>' +
        '<div class="dy-title" id="dyTitle"></div>' +
        '<button type="button" class="dy-today" id="dyToday">Today</button>' +
        '<button type="button" class="dy-nav" id="dyNext" aria-label="Next month">›</button></div>' +
        '<div class="dy-dows">' + DOWS.map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div>' +
        '<div class="dy-grid" id="dyGrid"></div><div id="dyMoods"></div><div class="dy-day" id="dyDay"></div>';
      $('#dyPrev').onclick = function () { shift(-1); };
      $('#dyNext').onclick = function () { shift(1); };
      $('#dyToday').onclick = function () {
        var dir = (now.getFullYear() * 12 + now.getMonth()) - (st.y * 12 + st.m);
        st.y = now.getFullYear(); st.m = now.getMonth(); st.sel = todayK;
        drawGrid(dir === 0 ? '' : dir > 0 ? 'l' : 'r'); drawMoods(); drawDay();
      };
      var grid = $('#dyGrid');
      grid.onclick = function (ev) {
        var t = ev.target.closest ? ev.target.closest('[data-k]') : null;
        if (!t) return;
        st.sel = t.getAttribute('data-k'); drawGrid(''); drawDay();
      };
      var sx = 0, sy = 0;
      grid.addEventListener('touchstart', function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
      grid.addEventListener('touchend', function (e) {
        var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
        if (Math.abs(dx) > 55 && Math.abs(dy) < 40) shift(dx < 0 ? 1 : -1);
      }, { passive: true });
      var day = $('#dyDay'); day.onclick = dayClick;
      drawGrid(''); drawMoods(); drawDay();
    }

    function shift(delta) {
      st.m += delta;
      if (st.m < 0) { st.m = 11; st.y--; } else if (st.m > 11) { st.m = 0; st.y++; }
      var map = byDate(sorted()), dim = new Date(st.y, st.m + 1, 0).getDate(), pick = null;
      if (st.y === now.getFullYear() && st.m === now.getMonth()) pick = todayK;
      else {
        for (var d = dim; d >= 1; d--) { var k = st.y + '-' + p2(st.m + 1) + '-' + p2(d); if (map[k]) { pick = k; break; } }
        if (!pick) pick = st.y + '-' + p2(st.m + 1) + '-01';
      }
      st.sel = pick;
      drawGrid(delta > 0 ? 'l' : 'r'); drawMoods(); drawDay();
    }

    function drawGrid(slide) {
      var grid = $('#dyGrid'), title = $('#dyTitle'); if (!grid) return;
      title.innerHTML = esc(MONTHS[st.m]) + '<small>' + st.y + '</small>';
      var map = byDate(sorted()), first = new Date(st.y, st.m, 1).getDay(), dim = new Date(st.y, st.m + 1, 0).getDate(), h = '', i, d;
      for (i = 0; i < first; i++) h += '<span class="dy-blank"></span>';
      for (d = 1; d <= dim; d++) {
        var k = st.y + '-' + p2(st.m + 1) + '-' + p2(d), l = map[k], cls = 'dy-cell';
        if (l) { cls += ' has'; if (l.some(function (e) { return e.shared; })) cls += ' is-shared'; }
        if (k === todayK) cls += ' is-today';
        if (k > todayK) cls += ' is-future';
        if (k === st.sel) cls += ' is-sel';
        h += '<button type="button" class="' + cls + '" data-k="' + k + '" aria-label="' + esc(longDate(k)) + (l ? ', ' + l.length + (l.length === 1 ? ' page' : ' pages') : '') + '">' +
          '<span class="dy-d">' + d + '</span>' +
          (l ? '<span class="dy-m">' + esc(l[0].mood || '💖') + '</span>' : '') +
          (l && l.length > 1 ? '<b class="dy-n">' + l.length + '</b>' : '') + '</button>';
      }
      grid.className = 'dy-grid';
      grid.innerHTML = h;
      if (slide && !lite()) { void grid.offsetWidth; grid.classList.add(slide === 'l' ? 'slide-l' : 'slide-r'); }
    }

    function drawMoods() {
      var el = $('#dyMoods'); if (!el) return;
      if (!c.showMoodSummary) { el.innerHTML = ''; return; }
      var pre = st.y + '-' + p2(st.m + 1) + '-', tally = {}, n = 0;
      sorted().forEach(function (e) { if (e.date && e.date.indexOf(pre) === 0) { var m = e.mood || '💖'; tally[m] = (tally[m] || 0) + 1; n++; } });
      if (!n) { el.innerHTML = ''; return; }
      var top = Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; }), lead = top[0], lab = moodLabel(lead);
      el.innerHTML = '<div class="dy-moodsum"><p>This month you wrote <b>' + n + (n === 1 ? ' page' : ' pages') + '</b>' +
        (lab ? ', mostly feeling <b>' + esc(lead + ' ' + lab) + '</b>' : '') + '</p><div class="dy-pills">' +
        top.slice(0, 5).map(function (m) { return '<span class="dy-pill">' + esc(m) + ' ' + tally[m] + '</span>'; }).join('') + '</div></div>';
    }

    /* ----- selected day ----- */
    function cardHtml(e, showDate) {
      var t = stamp(e), tm = t ? new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
      return '<article class="dy-card ' + (e.shared ? 'is-shared' : '') + '" data-id="' + esc(e.id) + '">' +
        '<div class="dy-card-top"><span class="dy-card-mood">' + esc(e.mood || '💖') + '</span>' +
        '<div class="dy-card-t">' + (showDate ? '<span class="dy-datetag">' + esc(e.dateFormatted || e.date || '') + '</span>' : '') +
        '<b>' + esc(e.title || 'Untitled Page') + '</b>' + (!showDate && tm ? '<small>' + esc(tm) + '</small>' : '') + '</div>' +
        (c.allowSharing || e.shared ? '<span class="dy-badge ' + (e.shared ? 'shared' : 'private') + '">' + (e.shared ? '💖 Shared' : '🔒 Private') + '</span>' : '') + '</div>' +
        '<div class="dy-snip">' + esc(e.text || '') + '</div>' +
        '<div class="dy-card-act"><button type="button" class="dy-btn sm" data-a="edit">Read / Edit ✏️</button>' +
        '<button type="button" class="dy-btn sm danger" data-a="del" aria-label="Delete page">🗑️</button></div></article>';
    }

    function drawDay() {
      var el = $('#dyDay'); if (!el) return;
      var map = byDate(sorted()), list = map[st.sel] || [], h = '';
      h += '<div class="dy-dayhead"><div><div class="dy-dow">' + esc(parseKey(st.sel).toLocaleDateString('en-US', { weekday: 'long' })) + '</div>' +
        '<div class="dy-date">' + esc(parseKey(st.sel).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })) + '</div></div>' +
        (list.length ? '<div class="dy-daymood">' + esc(list[0].mood || '💖') + '</div>' : '') + '</div>';

      var md = st.sel.slice(5), yr = st.sel.slice(0, 4), past = null;
      sorted().some(function (e) { if (e.date && e.date.slice(5) === md && e.date.slice(0, 4) < yr) { past = e; return true; } return false; });
      if (past) h += '<div class="dy-otd" data-id="' + esc(past.id) + '" data-a="edit" role="button" tabindex="0"><small>🕰️ On this day · ' + esc(past.date.slice(0, 4)) + '</small><p>' +
        esc((past.title ? past.title + ': ' : '') + String(past.text || '').slice(0, 130)) + (String(past.text || '').length > 130 ? '…' : '') + '</p></div>';

      if (list.length) h += list.map(function (e) { return cardHtml(e, false); }).join('');
      else if (st.sel > todayK) h += '<div class="dy-empty"><div class="big">🌙</div><h4>Not yet</h4><p>' + esc(c.futureText) + '</p></div>';
      else if (!canWrite(st.sel)) h += '<div class="dy-empty"><div class="big">🌹</div><h4>' + esc(c.emptyTitle) + '</h4><p>' + esc(c.lockedText) + '</p></div>';
      else h += '<div class="dy-empty"><div class="big">📖✨</div><h4>' + esc(c.emptyTitle) + '</h4><p>' + esc(c.emptyText) + '</p></div>';

      if (canWrite(st.sel)) h += '<button type="button" class="dy-btn block" data-a="new" style="margin-top:12px">' + esc(c.writeButton) + '</button>';
      el.innerHTML = h;
    }

    /* ----- list ----- */
    function drawList() {
      var pane = $('#dyPane');
      pane.innerHTML = '<input type="search" class="dy-search" id="dySearch" placeholder="🔍 Search your pages…" value="' + esc(st.q) + '"><div id="dyList"></div>';
      var s = $('#dySearch');
      s.oninput = function () { st.q = s.value; fillList(); };
      $('#dyList').onclick = dayClick;
      fillList();
    }
    function fillList() {
      var el = $('#dyList'); if (!el) return;
      var q = st.q.trim().toLowerCase();
      var list = sorted().filter(function (e) { return !q || (String(e.title || '') + ' ' + String(e.text || '') + ' ' + moodLabel(e.mood)).toLowerCase().indexOf(q) >= 0; });
      if (!list.length) {
        el.innerHTML = '<div class="dy-empty"><div class="big">' + (q ? '🔎' : '📖✨') + '</div><h4>' + (q ? 'No pages found' : 'Your diary is empty') + '</h4><p>' +
          (q ? 'Try another word.' : esc(c.emptyText)) + '</p></div>' + (!q && canWrite(todayK) ? '<button type="button" class="dy-btn block" data-a="new-today" style="margin-top:12px">' + esc(c.writeButton) + '</button>' : '');
        return;
      }
      var h = '', last = '';
      list.forEach(function (e) {
        var g = e.date ? MONTHS[parseKey(e.date).getMonth()] + ' ' + parseKey(e.date).getFullYear() : 'Earlier';
        if (g !== last) { h += '<div class="dy-group">' + esc(g) + '</div>'; last = g; }
        h += cardHtml(e, true);
      });
      el.innerHTML = h;
    }

    /* ----- clicks inside day panel / list ----- */
    function find(id) { var l = sorted(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
    function dayClick(ev) {
      var t = ev.target, a = t.closest ? t.closest('[data-a]') : null, card = t.closest ? t.closest('.dy-card') : null;
      if (a) {
        var act = a.getAttribute('data-a');
        if (act === 'new') { openEdit(newEntry(st.sel)); return; }
        if (act === 'new-today') { openEdit(newEntry(todayK)); return; }
        var id = a.getAttribute('data-id') || (card && card.getAttribute('data-id')), e = id && find(id);
        if (act === 'edit' && e) { openEdit(JSON.parse(JSON.stringify(e))); return; }
        if (act === 'del' && e) {
          if (!a.classList.contains('armed')) {
            a.classList.add('armed'); a.textContent = 'Sure? 🗑️';
            setTimeout(function () { if (a.isConnected) { a.classList.remove('armed'); a.textContent = '🗑️'; } }, 3000);
            return;
          }
          remove(e); return;
        }
      }
      if (card) card.classList.toggle('open');
    }

    function remove(e) {
      if (e.shared) { try { fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'diary-unshare', id: e.id }) }).catch(function () { }); } catch (x) { } }
      store(load().filter(function (x) { return x.id !== e.id; }));
      say('Diary page deleted');
      drawStats();
      if (st.view === 'cal') { drawGrid(''); drawMoods(); drawDay(); } else fillList();
    }

    /* ===== editor ===== */
    function newEntry(k) {
      var n = Date.now();
      return { id: 'entry_' + n.toString(36) + '_' + Math.random().toString(36).slice(2, 6), title: '', mood: c.moods[0].emoji, date: k,
        dateFormatted: shortDate(parseKey(k)), text: '', shared: false, ts: n, _new: true };
    }
    function openEdit(e) { st.back = st.view; st.entry = e; renderEdit(); try { if (box) box.scrollTop = 0; } catch (x) { } }

    function renderEdit() {
      var e = st.entry, dk = e._new ? 'new:' + e.date : e.id, dr = drafts()[dk], restored = false;
      if (dr && typeof dr.text === 'string' && dr.text.trim() && dr.text !== e.text) {
        e.text = dr.text; if (dr.title) e.title = dr.title; if (dr.mood) e.mood = dr.mood; e.shared = !!dr.shared && c.allowSharing; restored = true;
      }
      if (!c.allowSharing) e.shared = false;
      var moods = c.moods.map(function (m) {
        return '<button type="button" class="dy-mood ' + (e.mood === m.emoji ? 'on' : '') + '" data-m="' + esc(m.emoji) + '">' + esc(m.emoji) + ' ' + esc(m.label || '') + '</button>';
      }).join('');
      if (!c.moods.some(function (m) { return m.emoji === e.mood; }) && e.mood) moods = '<button type="button" class="dy-mood on" data-m="' + esc(e.mood) + '">' + esc(e.mood) + '</button>' + moods;

      body.innerHTML = wrap(
        '<button type="button" class="dy-back" id="dyBack">‹ Back</button>' +
        '<div class="dy-hero"><h3>' + esc(e._new ? c.editTitle : 'Edit Diary Page 📖') + '</h3><p class="fun-sub">' + esc(c.editSub) + '</p></div>' +
        '<div class="dy-datechip">📅 ' + esc(longDate(e.date)) + '</div>' +
        '<span class="dy-label">How are you feeling right now?</span><div class="dy-moods" id="dyMoodRow">' + moods + '</div>' +
        '<span class="dy-label">Page title</span><input type="text" class="dy-input" id="dyTitle" maxlength="90" placeholder="e.g. Thinking of you today, A happy dream…" value="' + esc(e.title) + '">' +
        (c.showPrompts ? '<span class="dy-label">Need a spark?</span><div class="dy-prompt"><small>💡 Writing prompt</small><p id="dyPrompt"></p><div class="row">' +
          '<button type="button" class="dy-btn sm" id="dyUse">Use this ✍️</button><button type="button" class="dy-btn sm ghost" id="dyShuf">Another 🔄</button></div></div>' : '') +
        '<span class="dy-label">Your page</span><textarea class="dy-paper" id="dyText" placeholder="' + esc(c.placeholder) + '"></textarea>' +
        '<div class="dy-count" id="dyCount"></div>' +
        (c.allowSharing ? '<div class="dy-share"><label><input type="checkbox" id="dyShare"' + (e.shared ? ' checked' : '') + '><div><b>' + esc(c.shareTitle) + '</b><span>' + esc(c.shareSub) + '</span></div></label>' +
          '<p id="dyShareHint"></p></div>' : '') +
        '<div class="dy-actions"><button type="button" class="dy-btn ghost" id="dyCancel">Cancel</button><button type="button" class="dy-btn" id="dySave">💾 Save Page</button></div>');

      var ta = $('#dyText'), ti = $('#dyTitle'), cnt = $('#dyCount'), chk = $('#dyShare'), hint = $('#dyShareHint'), t = 0;
      ta.value = e.text || '';
      function count() { var w = words(ta.value); cnt.textContent = w + (w === 1 ? ' word' : ' words'); }
      function hintUpdate() { if (!hint) return; hint.style.color = e.shared ? '#ffd0da' : '#d9a9b9'; hint.innerHTML = e.shared ? c.shareOn : c.shareOff; }
      function draft() {
        clearTimeout(t);
        t = setTimeout(function () { putDraft(dk, (ta.value.trim() || ti.value.trim()) ? { title: ti.value, text: ta.value, mood: e.mood, shared: e.shared, t: Date.now() } : null); }, 450);
      }
      count(); hintUpdate();
      ta.oninput = function () { count(); draft(); };
      ti.oninput = draft;
      if (restored) say('Restored your unsaved words 💕', 2400);

      Array.prototype.forEach.call(body.querySelectorAll('.dy-mood'), function (b) {
        b.onclick = function () {
          Array.prototype.forEach.call(body.querySelectorAll('.dy-mood'), function (x) { x.classList.remove('on'); });
          b.classList.add('on'); e.mood = b.getAttribute('data-m'); draft();
        };
      });
      if (chk) chk.onchange = function () { e.shared = chk.checked; hintUpdate(); draft(); };

      if (c.showPrompts) {
        var pe = $('#dyPrompt');
        function nextPrompt() {
          var n = c.prompts.length, i = st.prompt;
          if (i < 0) { var d = parseKey(e.date); i = (Math.floor(d.getTime() / 864e5)) % n; }
          else if (n > 1) { var j; do { j = Math.floor(Math.random() * n); } while (j === i); i = j; }
          st.prompt = i; pe.textContent = c.prompts[i];
        }
        nextPrompt();
        $('#dyShuf').onclick = nextPrompt;
        $('#dyUse').onclick = function () {
          var cur = ta.value.trim(), line = c.prompts[st.prompt];
          ta.value = line + '\n\n' + (cur ? ta.value : ''); count(); draft(); ta.focus();
          try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (x) { }
        };
      }

      function leave() { st.entry = null; st.view = st.back; renderMain(); }
      $('#dyBack').onclick = leave;
      $('#dyCancel').onclick = leave;

      var save = $('#dySave');
      save.onclick = function () {
        var title = ti.value.trim(), text = ta.value.trim();
        if (!title && !text) { say('Please write something in your diary page 💕', 2400); return; }
        save.classList.add('is-busy'); save.textContent = 'Saving…';
        var rec = { id: e.id, title: title || 'Diary Page', mood: e.mood, date: e.date, dateFormatted: e.dateFormatted || shortDate(parseKey(e.date)), text: text, shared: !!(c.allowSharing && chk && chk.checked), ts: e.ts || stamp(e) || Date.now() };
        var all = load(), ix = -1, i;
        for (i = 0; i < all.length; i++) if (all[i].id === rec.id) { ix = i; break; }
        if (ix >= 0) all[ix] = rec; else all.unshift(rec);
        if (!store(all)) { say('Could not save on this phone (storage is full) 😔', 3200); save.classList.remove('is-busy'); save.textContent = '💾 Save Page'; return; }
        putDraft(dk, null);

        function done() {
          var d = parseKey(rec.date);
          st.y = d.getFullYear(); st.m = d.getMonth(); st.sel = rec.date; st.entry = null; st.view = st.back; renderMain();
        }
        if (rec.shared) {
          fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'diary', diary: { id: rec.id, title: rec.title, mood: rec.mood, date: rec.date, dateFormatted: rec.dateFormatted, text: rec.text } }) })
            .then(function (r) { if (!r.ok) throw new Error('http'); burst(20); say(c.savedShared, 3200); })
            .catch(function () { say('Saved on your phone, but it could not reach Tayyab yet. Open this page and save again when you are online 💕', 4200); })
            .then(done);
        } else {
          try { fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'diary-unshare', id: rec.id }) }).catch(function () { }); } catch (x) { }
          burst(8); say(c.savedPrivate, 2600); done();
        }
      };
    }

    renderMain();
  };

  /* ---------- housekeeping: wide box only for the diary, hide everything when switched off in admin ---------- */
  var _open = window.openFun;
  if (typeof _open === 'function') {
    window.openFun = function (name) {
      if (name === 'diary' && cfg().enabled === false) return;
      if (name !== 'diary') { var b = document.querySelector('#funModal .fun-box'); if (b) b.classList.remove('dy-wide'); }
      return _open.apply(this, arguments);
    };
  }
  if (cfg().enabled === false) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-fun="diary"], #diaryBtn'), function (el) { el.style.display = 'none'; });
  }
})();
