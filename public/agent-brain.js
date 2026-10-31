/* ===================================================================
   🧠 AGENT BRAIN: everything the little guide knows about the website.
   - sections()   the guided journey, built from what is really on the page (songs, letters, games, locks...)
   - tiles()      a short description of every surprise tile / game
   - answer(q)    answers her questions (admin Q&A first, then the built-in knowledge, then small talk)
   - run(act)     performs the "try it" buttons (opens a tile, taps a button, scrolls...)
   Nothing here is sent anywhere: it only reads the page and window.SITE, so it always matches the admin panel.
   =================================================================== */
(function () {
  'use strict';
  var W = window, D = document;

  /* ---------- small helpers ---------- */
  function S() { return W.SITE || W.SITE_CONTENT || {}; }
  function ST() { return S().settings || {}; }
  function AC() { return S().agent || {}; }
  function $(s) { try { return D.querySelector(s); } catch (e) { return null; } }
  function $$(s) { try { return Array.prototype.slice.call(D.querySelectorAll(s)); } catch (e) { return []; } }
  function visible(el) { return !!el && el.style.display !== 'none' && (el.offsetParent !== null || getComputedStyle(el).position === 'fixed'); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function strip(h) { return String(h == null ? '' : h).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim(); }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function nice(arr, max) {
    arr = arr.filter(Boolean);
    if (max && arr.length > max) arr = arr.slice(0, max).concat(['more']);
    if (arr.length <= 1) return arr.join('');
    return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
  }
  function her() {
    var n = ((D.querySelector('.rose-name') || {}).textContent || '').trim();
    return n || (S().text && S().text.roseName) || 'Ifra';
  }
  function him() { return 'Tayyab'; }

  /* ---------- facts about the live site ---------- */
  function songs() { return (S().songs || []).filter(function (s) { return s && s.file; }); }
  function envTitles() { return (S().envelopes || []).map(function (e) { return strip(e && e.title); }).filter(Boolean); }
  function memCount() { return (S().memories || []).filter(function (m) { return m && m.src && String(m.src).trim(); }).length; }
  function plannerOn() { var p = S().planner; return !(p && p.enabled === false); }
  function diaryCfg() { return S().diary || {}; }
  function diaryOn() { return diaryCfg().enabled !== false; }
  function notifyOn() { return !!(W.SITE_NOTIFY || ST().notifyOn); }
  function lockOf(id) { var L = W.SITE_ITEM_LOCKS || {}; return L[id] || null; }
  function lockOpen(id) { try { return !(typeof ItemLock !== 'undefined' && ItemLock.locked(id)); } catch (e) { return true; } }
  function loginNeeded() { try { return !!W.SITE_LOCKED && !(typeof AUTH !== 'undefined' && AUTH.loaded); } catch (e) { return !!W.SITE_LOCKED; } }
  function lockLine(id) {
    var L = lockOf(id);
    if (!L || lockOpen(id)) return '';
    return ' 🔒 This one has a password' + (L.hint ? ' (hint: ' + L.hint + ')' : ' that ' + him() + ' knows') + '.';
  }
  function loginLine() {
    return loginNeeded() ? ' 🔐 The photos, Our Story and the proposal are behind the login ' + him() + ' made for you. When you tap them I’ll see a login window; it is remembered on this phone for about a month.' : '';
  }
  function bdayText() {
    var m = Number(ST().birthdayMonth), d = Number(ST().birthdayDay);
    if (!m || !d) return 'your birthday';
    return d + ' ' + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1];
  }
  function daysToBirthday() {
    var m = Number(ST().birthdayMonth) - 1, d = Number(ST().birthdayDay);
    if (isNaN(m) || !d) return null;
    var now = new Date(), t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var b = new Date(now.getFullYear(), m, d);
    if (b < t0) b = new Date(now.getFullYear() + 1, m, d);
    return Math.round((b - t0) / 864e5);
  }
  function remindDays() {
    var a = String(ST().reminderDays || '').split(',').map(function (x) { return parseInt(x, 10); }).filter(function (n) { return !isNaN(n) && n > 0; });
    return a.sort(function (x, y) { return y - x; });
  }
  function reminderOn() { try { return localStorage.getItem('ifraRemind') === '1'; } catch (e) { return false; } }
  function channels() {
    var s = ST(), c = [];
    if (s.whatsapp) c.push('WhatsApp');
    if (s.instagram) c.push('Instagram');
    if (s.telegram) c.push('Telegram');
    if (s.email) c.push('email');
    if (s.sms) c.push('SMS');
    return c;
  }
  function gamesOf(group) {
    var g = S().games;
    return Array.isArray(g) ? g.filter(function (x) { return x && x.group === group && x.on !== false; }) : [];
  }
  function gameCfg(id) { var g = S().games; return (Array.isArray(g) && g.filter(function (x) { return x && x.id === id; })[0]) || {}; }
  function tileEl(id) { return $('.s-tile[data-fun="' + id + '"]'); }
  function tileShown(id) { var t = tileEl(id); return !!t && t.style.display !== 'none'; }
  function plan() { return S().planner || {}; }
  function activities() {
    var a = plan().activities;
    a = (a && a.length) ? a : [{ label: 'Valorant Date', icon: '🎮' }, { label: 'Movie Night', icon: '🎬' }, { label: 'Late Night Call', icon: '☕' }, { label: 'Dinner / Food', icon: '🍕' }, { label: 'Custom Plan', icon: '🌸' }];
    return a.filter(function (x) { return x && x.enabled !== false; });
  }
  function rewards() {
    var r = S().rewards;
    return (Array.isArray(r) && r.length) ? r : [{ at: 5 }, { at: 15 }, { at: 30 }, { at: 50 }, { at: 80 }, { at: 120 }, { at: 170 }, { at: 230 }];
  }
  function hasStory() { var b = $('#storyBtn'); return !!b && b.style.display !== 'none'; }

  /* ---------- the surprise tiles and games ---------- */
  function opt(id, key, def) { var o = gameCfg(id).opt || {}; return (o[key] === '' || o[key] == null) ? def : o[key]; }
  var TILES = {
    wish: ['🌠', 'Make a Wish', function () { return 'Write a wish (up to 140 characters) and watch it float away to the stars.'; }],
    scratch: ['🎟️', 'Scratch Cards', function () { return 'Scratch each card with your finger to uncover a little love message. They are shuffled, so you won’t see the same one twice until you have seen them all.'; }],
    bouquet: ['💐', 'Your Bouquet', function () { return 'Touch each bud and watch it bloom into a flower; every flower has its own wish for you.'; }],
    quiz: ['😄', 'Funny Riddles', function () { return 'Easy, silly riddles: 20 random ones each round, with a cute reaction for right and wrong answers.'; }],
    sweet: ['🧠', 'Sweet Quiz', function () { return 'Love trivia about the two of you: 20 random questions a round, with a score at the end.'; }],
    promises: ['📜', 'My Promises', function () { return 'Serious promises from ' + him() + '. Touch one to seal it; sealed promises are remembered on your phone.'; }],
    meter: ['💗', 'Love Meter', function () { return 'Press and hold the button and watch the meter climb. Past 100% a little cinematic moment (with a song) begins.'; }],
    writeback: ['💌', 'Write Back To Me', function () { return 'Write him a message (up to 500 characters) and send it straight to his phone.'; }],
    calendar: ['📅', 'Plan a Date', function () { return 'Pick an activity, a day and a time. The plan lands on his phone instantly.'; }],
    diary: ['📖', 'Personal Diary', function () { return 'Your private diary with a calendar, moods and writing prompts.'; }],
    valorant: ['🎮', 'Valorant Date', function () { return 'Opens the date planner already set to a Valorant session (pick the game mode, day and time).'; }],
    catch: ['🧺', 'Catch Hearts', function () { return 'Slide the basket to catch falling hearts 💖 and dodge the broken ones 💔. You have ' + opt('catch', 'seconds', 30) + ' seconds.'; }],
    match: ['🃏', 'Memory Match', function () { return 'Flip the cards and find the matching pairs.'; }],
    ttt: ['❌', 'Tic-Tac-Love', function () { return 'Tic-tac-toe where you play ❤️ against 🌹 the garden.'; }],
    gtr: ['🏎️', 'GT-R R34', function () { return 'Drive the GT-R R34 and collect hearts along the road (about ' + opt('gtr', 'hearts', 15) + ' hearts to win).'; }],
    flight: ['🕊️', 'Love Flight', function () { return 'Guide the little dove through the gates (' + opt('flight', 'gates', 10) + ' gates to clear).'; }],
    breaker: ['🧱', 'Love Breaker', function () { return 'A brick-breaker: keep the ball alive and clear the bricks. You have ' + opt('breaker', 'lives', 3) + ' lives.'; }],
    football: ['⚽', 'Love Striker', function () { return 'A small football game: line up your shot and score.'; }]
  };
  var SURPRISE_IDS = ['wish', 'scratch', 'bouquet', 'quiz', 'sweet', 'promises', 'meter', 'writeback', 'calendar', 'diary'];
  var PLAY_IDS = ['valorant', 'catch', 'match', 'ttt', 'gtr', 'flight', 'breaker', 'football'];

  function tiles(group) {
    var ids = group === 'play' ? PLAY_IDS : SURPRISE_IDS, out = [];
    ids.forEach(function (id) {
      var t = TILES[id], el = tileEl(id), g = gameCfg(id);
      if (!t || !el || el.style.display === 'none') return;
      var label = (g.label && String(g.label).trim()) || t[1], icon = (g.emoji && String(g.emoji).trim()) || t[0];
      var lk = lockOf(id) && !lockOpen(id);
      out.push({ id: id, icon: icon, label: label, line: t[2](), locked: !!lk, act: 'tile:' + id });
    });
    return out;
  }
  function tileLine(id) { var t = TILES[id]; return t ? t[2]() : ''; }

  /* ---------- the guided journey ---------- */
  function build() {
    var out = [];
    var p = plan(), d = diaryCfg(), sg = songs(), env = $$('.envelope').length;
    function add(o) { out.push(o); }

    add({
      id: 'basics', icon: '🧭', sel: '.card', title: 'Finding your way around',
      what: 'This whole page is one long, soft card made just for ' + her() + '. Scroll down and every section is a little room of its own. Two round buttons stay in the corner: 🌙 switches the look between day and sunset, and the speaker turns the music on or off.',
      how: ['Scroll the card to move between sections.', 'Tap 🌙 to change the colours.', 'Tap the speaker to mute or unmute the music.', 'Tap me any time. You can also drag me anywhere you like.'],
      tip: 'The greeting at the top changes with the time of day.' + (W.SITE_LOCKED ? '' : ''),
      q: 'Want to try the two buttons?',
      opts: [{ l: '🌙 Switch the look', act: 'night' }, { l: '🔊 Music on/off', act: 'music' }],
      ask: ['What is this website?', 'Where should I start?']
    });

    if ($('.song-section')) add({
      id: 'playlist', icon: '🎶', sel: '.song-section', title: 'Our Playlist',
      what: 'The playlist has ' + plural(sg.length || 1, 'song') + (sg.length ? ' (' + nice(sg.map(function (s) { return s.label; }), 5) + ')' : '') + '. They play one after another, and the first one started when you tapped the rose.',
      how: ['Press the big round ▶ to play or pause.', 'Use ⏮ and ⏭ to change songs, and drag the bar to jump to any moment.', 'Tap the song name (or the list button) to open the whole playlist and pick one.', '🔀 shuffles and 🔁 repeats. Some songs show their words line by line while they play.'],
      tip: 'After the first play a song is saved on your phone, so it also plays without internet.',
      q: 'What would you like?',
      opts: [{ l: '▶ Play / pause', act: 'player:play' }, { l: '📜 Open the playlist', act: 'click:#mpListBtn' }],
      ask: ['How do I change the song?', 'Why is there no sound?']
    });

    if ($('.card .heart')) add({
      id: 'heart', icon: '❤️', sel: '.card .heart', title: 'The big heart',
      what: 'The big ❤️ is alive. Tap it and hearts fly out while a little line underneath counts your heartbeats.',
      how: ['Tap it again and again. At special counts it shows a sweet note.', 'It does one more thing if you press and hold it for a few seconds… 🤫'],
      tip: 'Try it, then come back and tell me what happened!',
      q: 'Shall we feel its heartbeat?',
      opts: [{ l: '❤️ Tap the heart', act: 'click:.card .heart' }],
      ask: ['Tell me a secret']
    });

    if ($('#remindBtn')) {
      var rd = remindDays();
      add({
        id: 'reminders', icon: '🎂', sel: '#remindBtn', title: 'Birthday countdown & reminders',
        what: 'A live countdown ticks toward ' + bdayText() + '. The 🔔 button turns on birthday reminders: your phone gets a small notification as the day gets closer' + (rd.length ? ' (when ' + nice(rd.map(String)) + ' days are left, and on the day itself)' : '') + '.' + (reminderOn() ? ' ✅ They are already on for this phone.' : ''),
        how: ['Tap the 🔔 button once.', 'Your phone asks “Allow notifications?”. Tap Allow.', 'That’s all. The button changes to show they are on.', 'On iPhone: tap Share ⬆️ → “Add to Home Screen”, open the site from that new icon, then tap the 🔔 button.'],
        tip: 'If you tapped “Block” by mistake, you can allow notifications again in your browser’s site settings.',
        q: 'Turn the reminders on?',
        opts: [{ l: '🔔 Yes, turn them on', act: 'click:#remindBtn' }, { l: '🍎 I’m on iPhone', reply: 'On iPhone, notifications only work for an installed app. Tap the Share button ⬆️ in Safari, choose “Add to Home Screen”, open the site from the new rose icon, then tap the 🔔 button and allow notifications. 💕' }],
        ask: ['Reminders are not working', 'When will I get the reminder?']
      });
    }

    if (diaryOn() && ($('#diaryBtn') || tileShown('diary'))) {
      var how = ['Tap a day on the calendar to read or write that day’s page.'];
      if (d.allowBackfill === false) how.push('Pages can only be written on the day itself, so every page stays honest.');
      how.push('Pick a mood, give the page a title and write whatever your heart says.');
      if (d.showPrompts !== false) how.push('Not sure what to write? Ask for a writing prompt.');
      if (d.showStreak !== false) how.push('Write on following days to build a 🔥 streak.');
      if (d.allowSharing !== false) how.push('Every page has a switch: “Let ' + him() + ' read this page”. Off = private. On = delivered to him.');
      add({
        id: 'diary', icon: '📖', sel: '#diaryBtn', title: strip(d.title) || 'Your Personal Diary',
        what: 'A private diary with a calendar. Every day you write gets its mood on the calendar, so you can look back on how the month felt.',
        how: how,
        tip: 'Your pages are saved only in this phone’s browser. Nobody can read them unless you switch sharing on. If you clear your browser data or change phones, private pages won’t come with you.',
        q: 'What would you like to do?',
        opts: [{ l: '📖 Open my diary', act: 'click:#diaryBtn' }, { l: '🔒 Who can read it?', reply: d.allowSharing === false ? 'Nobody. Sharing is switched off, so every page stays on this phone only. 🔒' : 'Only you, unless you switch on “Let ' + him() + ' read this page” for a page. Then that one page is delivered to him (and he gets a notification). You can switch it off again and save, or delete the page, and it disappears from his side. 🔒' }],
        ask: ['Can Tayyab read my diary?', 'Can I move my diary to a new phone?']
      });
    }

    var ib = $('#installBtn');
    if (ib && visible(ib)) add({
      id: 'install', icon: '📲', sel: '#installBtn', title: 'Keep it on your phone',
      what: 'You can keep this website on your phone like a real app: it gets its own rose icon, opens in one tap and even works without internet.',
      how: ['Android or PC (Chrome / Edge): tap “📲 Install the app”, then Install.', 'iPhone (Safari): tap Share ⬆️ → “Add to Home Screen”.', 'If you opened the link inside Instagram or WhatsApp, open it in Chrome or Safari first.'],
      tip: 'Reminders also arrive more reliably once the app is installed.',
      q: 'Install it now?',
      opts: [{ l: '📲 Install the app', act: 'click:#installBtn' }],
      ask: ['Does it work offline?']
    });

    if ($('.gallery-section')) {
      var mc = memCount();
      add({
        id: 'gallery', icon: '📸', sel: '.gallery-section', title: 'Our Memories',
        what: 'A few photo previews, and “Open Full Gallery” shows every photo full-screen with its caption' + (mc ? ' (' + plural(mc, 'photo') + ' so far)' : '') + '. New photos that ' + him() + ' adds appear here by themselves.' + loginLine() + lockLine('gallery'),
        how: ['Tap a photo to see it big, with its caption.', 'Swipe or use the arrows to move between photos.', 'Double-tap a photo to zoom in; double-tap again to zoom out.', 'In the full gallery, tap ▶ Reel and the photos play one by one like a tiny film.'],
        tip: 'The photos are saved after the first look, so they open fast the next time.',
        q: 'Open the gallery?',
        opts: [{ l: '📸 Open full gallery', act: 'click:#openGalleryBtn' }, { l: '▶ What is the Reel?', reply: 'Inside the full gallery there is a ▶ Reel button. Tap it and the photos change by themselves every few seconds, like a slideshow. Tap ⏸ to pause, or double-tap a photo to zoom and it waits for you. 🎞️' }],
        ask: ['Where are our photos?']
      });
    }

    if ($('.letters-section')) {
      var et = envTitles();
      add({
        id: 'envelopes', icon: '💌', sel: '.letters-section', title: '“Open When…” letters',
        what: (env ? plural(env, 'sealed envelope') : 'Sealed envelopes') + ', each a letter for a different feeling' + (et.length ? ' (' + nice(et, 4) + ')' : '') + '. Open the one that matches how your heart is right now.',
        how: ['Tap an envelope to open it, tap again to close it.', 'Only one stays open at a time.', 'A glowing “Today ✨” badge marks the envelope he’d suggest for today. It changes every day.', 'An envelope with 🔒 needs a password (the hint is shown on the lock).'],
        tip: 'You can open them as many times as you like.',
        q: 'Which one first?',
        opts: [{ l: '💌 Open today’s letter', act: 'env:today' }, { l: '📋 List them all', reply: et.length ? 'The envelopes are: ' + et.join(' · ') + '.' : 'There are no envelopes yet.' }],
        ask: ['What if I miss him?']
      });
    }

    var sTiles = tiles('surprises');
    if ($('.surprises-section') && sTiles.length) add({
      id: 'surprises', icon: '🎁', sel: '.surprises-section', title: 'Little Surprises',
      what: plural(sTiles.length, 'little tile') + ', and each hides something different: ' + nice(sTiles.map(function (t) { return t.label; }), 6) + '.',
      how: ['Tap any tile and it opens in a small window.', 'Close it with the ✕ in the corner, then try another.', 'Some tiles send something to ' + him() + ' (Write Back, Plan a Date, a shared diary page). The rest stay on your phone.'],
      tip: 'Nothing here can break. Tap everything!',
      q: 'Want the full list?',
      opts: [{ l: '📋 What does each tile do?', act: 'tiles:surprises' }, { l: '✨ Surprise me', act: 'tile:random' }],
      ask: ['What does Scratch Cards do?', 'What does Love Meter do?']
    });

    if (plannerOn() && tileShown('calendar')) {
      var acts = activities();
      var tsl = p.timeSlots || [];
      add({
        id: 'planner', icon: '📅', sel: '.s-tile[data-fun="calendar"]', title: 'Plan a Date',
        what: 'Choose something to do together (' + nice(acts.map(function (a) { return a.label; }), 6) + '), pick a day and a time, and send it. The plan lands on ' + him() + '’s phone the moment you press send.' + lockLine('calendar'),
        how: ['Pick what you’d like to do. (Valorant lets you choose the game mode too.)', 'Tap a day on the calendar. ' + (p.showQuickDates === false ? '' : 'Today, Tomorrow and This weekend are quick shortcuts.'), 'Pick a time' + (tsl.length ? ' from the buttons' : '') + (p.showExactTime === false ? '' : ' or type an exact one') + '.', (p.showNote === false ? '' : 'Add a little note if you like, then press send.'), 'He is notified straight away and confirms the plan with you.'].filter(Boolean),
        tip: 'The colours of the planner change with the plan: red for Valorant, violet for movies, amber for calls, coral for dinner. Days that already passed are greyed out.',
        q: 'Plan something now?',
        opts: [{ l: '📅 Plan a date', act: 'tile:calendar' }].concat(tileShown('valorant') ? [{ l: '🎮 Plan Valorant', act: 'tile:valorant' }] : []),
        ask: ['How do I plan a date?', 'Can I change a plan after sending?']
      });
    }

    if (tileShown('writeback')) {
      var ch = channels();
      add({
        id: 'writeback', icon: '💌', sel: '.s-tile[data-fun="writeback"]', title: 'Write Back To Me',
        what: 'Your direct line to ' + him() + '. Type anything (up to 500 characters) and send it' + (notifyOn() ? ': it is delivered privately to his phone.' : '.') + lockLine('writeback'),
        how: notifyOn()
          ? ['Write your message.', 'Press “Send it my way”.', ch.length ? 'Prefer another app? You can also send the same words with ' + nice(ch) + '.' : '']
          : ['Write your message.', 'Choose how to send it: ' + (ch.length ? nice(ch) : 'your phone’s share menu') + '.'],
        tip: 'Missing him? This is the fastest way to reach him.',
        q: 'Say something to him?',
        opts: [{ l: '💌 Write a message', act: 'tile:writeback' }],
        ask: ['What does Tayyab see?']
      });
    }

    var pl = tiles('play');
    if ($('.tile-grid.three') && pl.length) {
      var timed = gamesOf('play').concat(gamesOf('surprises')).some(function (g) { return Number(g.minutes) > 0; });
      add({
        id: 'games', icon: '🎮', sel: '.tile-grid.three', title: 'Play Together',
        what: plural(pl.length, 'small game') + ' made for the two of you: ' + nice(pl.map(function (t) { return t.label; }), 8) + '.',
        how: ['Tap a game to start. Each one tells you how to play first.', 'The small buttons at the top let you pause or restart.', 'Wins earn ⭐ stars for your Love Jar, and your best scores are remembered.', timed ? 'Some games have a play-time limit, then rest for a while before you can play again.' : ''].filter(Boolean),
        tip: 'The first game you play each day gives a bonus ⭐.',
        q: 'Pick one?',
        opts: [].concat(tileShown('catch') ? [{ l: '🧺 Catch Hearts', act: 'tile:catch' }] : [], tileShown('match') ? [{ l: '🃏 Memory Match', act: 'tile:match' }] : [], [{ l: '📋 About each game', act: 'tiles:play' }]),
        ask: ['What are the stars for?', 'Why is a game resting?']
      });
    }

    if ($('.jar-section')) {
      var rw = rewards();
      add({
        id: 'jar', icon: '🏺', sel: '.jar-section', title: 'My Love Jar',
        what: 'The Love Jar collects ⭐ stars while you play. Stars unlock little love notes written by ' + him() + ' (' + plural(rw.length, 'note') + ', the first at ' + rw[0].at + ' ⭐).',
        how: ['Your first game each day gives a ⭐; wins and combos give more.', 'Open the jar to see which notes are unlocked and how many ⭐ remain for the next one.', 'Come back every day to grow your 🔥 streak.'],
        tip: 'Stars, streaks and best scores are saved on this phone.',
        q: 'Peek inside?',
        opts: [{ l: '🏺 Open my Love Jar', act: 'click:.jar-tile' }],
        ask: ['How do I unlock love notes?']
      });
    }

    if ($('.proposal-section')) {
      var po = [];
      if (hasStory()) po.push({ l: '📖 Read our story', act: 'click:#storyBtn' });
      po.push({ l: '💍 I’m ready', act: 'click:.proposal-btn:not(.story-btn)' }, { l: '⏳ Not yet', act: 'next' });
      add({
        id: 'proposal', icon: '💍', sel: '.proposal-section', title: 'One Last Thing…',
        what: 'There is a question ' + him() + ' has been carrying in his heart. I’m not allowed to tell you what it is. 🤍' + loginLine() + lockLine('proposal'),
        how: [hasStory() ? '“📖 Read Our Story” is a little film of the two of you.' : '', 'When you’re ready, tap “I Have a Question For You”.', 'Find a quiet moment first, and keep your sound on.'].filter(Boolean),
        tip: 'There’s no rush. It will be here whenever you’re ready.',
        q: 'Are you ready?',
        opts: po,
        ask: ['What is the question?']
      });
    }

    var fb = $('button[onclick^="showFinale"]');
    if (fb) add({
      id: 'forever', icon: '🌹', sel: 'button[onclick^="showFinale"]', title: 'Forever Yours',
      what: 'The “Forever Yours ❤️” button plays a short cinematic with words and a song, just for you.' + (ST().loveStart ? ' Above it a counter shows how long ' + him() + ' has been loving you, down to the minutes, and on special milestones (every 100 days and every anniversary) hearts rain when you open the site.' : '') + lockLine('forever'),
      how: ['Turn your volume up.', 'Tap the button and let it play.'],
      tip: 'Best at night, with the lights low. 🌙',
      q: 'Play it?',
      opts: [{ l: '❤️ Play it', act: 'click:button[onclick^="showFinale"]' }],
      ask: ['How long have we been together?']
    });

    var cb = $('button[onclick^="showMessage"]');
    if (cb) add({
      id: 'letter', icon: '✉️', sel: 'button[onclick^="showMessage"]', title: 'The hidden letter',
      what: 'At the very bottom, “Tap to see how much I care” unfolds a letter and a message. Hearts rain down as it opens.' + lockLine('care'),
      how: ['Tap the button.', 'Read the message, then scroll up a little to see the letter.'],
      tip: 'There is one more secret on this page: press and hold the big heart at the top for a few seconds. 🤫',
      q: 'Open it now?',
      opts: [{ l: '💌 Open the letter', act: 'click:button[onclick^="showMessage"]' }],
      ask: ['Tell me a secret']
    });

    /* admin overrides: Cute AI Guide → Section notes */
    var ov = Array.isArray(AC().sections) ? AC().sections : [];
    out.forEach(function (s) {
      ov.forEach(function (o) {
        if (!o || o.id !== s.id) return;
        if (o.title) s.title = o.title;
        if (o.text) s.what = o.text;
        if (o.tip) s.tip = o.tip;
      });
    });
    return out;
  }

  /* ---------- actions ("try it" buttons) ---------- */
  var MODAL_KINDS = /^(tile|click):/;
  function run(act) {
    act = String(act || '');
    var i = act.indexOf(':'), kind = i > 0 ? act.slice(0, i) : act, arg = i > 0 ? act.slice(i + 1) : '';
    try {
      if (kind === 'tile') {
        if (arg === 'random') {
          var ok = ['wish', 'scratch', 'bouquet', 'quiz', 'sweet', 'promises', 'meter'].filter(function (id) { return tileShown(id) && !(lockOf(id) && !lockOpen(id)); });
          if (!ok.length) return false;
          arg = pick(ok);
        }
        var t = tileEl(arg);
        if (!t) return false;
        t.click();
        return 'modal';
      }
      if (kind === 'click') {
        var e = $(arg);
        if (!e) return false;
        e.click();
        return /remindBtn|installBtn|mpListBtn|\.card \.heart/.test(arg) ? 'ok' : 'modal';
      }
      if (act === 'night') { var n = $('.toggle'); if (n) n.click(); return 'ok'; }
      if (act === 'music') { var m = $('#musicToggle'); if (m) m.click(); return 'ok'; }
      if (kind === 'player') {
        var b = $(arg === 'next' ? '#mpNext' : arg === 'prev' ? '#mpPrev' : '#mpPlay');
        if (b) { b.click(); return 'ok'; }
        var mt = $('#musicToggle'); if (mt) mt.click();
        return 'ok';
      }
      if (kind === 'env') {
        var envs = $$('.envelope'), td = $('.envelope .pl-today'), target = td ? td.parentNode : envs[0];
        if (!target) return false;
        target.click();
        try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (x) { }
        return 'ok';
      }
      if (kind === 'scroll') {
        var s = $(arg);
        if (s) { s.scrollIntoView({ behavior: 'smooth', block: 'start' }); return 'ok'; }
        return false;
      }
    } catch (err) { }
    return false;
  }
  function overlayOpen() {
    return !!($('#funModal.show') || $('#galleryOverlay.show') || $('#lightbox.show') || $('#finale.show') || $('.mp-sheet.show') || D.body.classList.contains('cine-on'));
  }

  /* ---------- the knowledge base (questions she may ask) ---------- */
  function overview() {
    var parts = [];
    var sg = songs().length; if (sg) parts.push('🎶 a playlist of ' + sg + ' songs');
    parts.push('❤️ a heart that beats when you tap it');
    var en = $$('.envelope').length; if (en) parts.push('💌 ' + plural(en, '“Open When” letter'));
    if (memCount() || $('.gallery-section')) parts.push('📸 a photo gallery');
    var st = tiles('surprises').length; if (st) parts.push('🎁 ' + plural(st, 'little surprise'));
    var pg = tiles('play').length; if (pg) parts.push('🎮 ' + plural(pg, 'game'));
    if ($('.jar-section')) parts.push('🏺 a Love Jar that fills with ⭐');
    if (diaryOn()) parts.push('📖 your private diary');
    if (plannerOn() && tileShown('calendar')) parts.push('📅 a date planner');
    parts.push('💍 and one last question at the end');
    return 'This website exists only for you, ' + her() + '. ' + him() + ' made it with his own hands. Inside you’ll find ' + nice(parts) + '.';
  }

  function whatTayyabSees() {
    var l = [];
    if (tileShown('writeback')) l.push('messages you send with Write Back To Me');
    if (plannerOn()) l.push('plans you send from Plan a Date / Valorant Date');
    if (diaryOn() && diaryCfg().allowSharing !== false) l.push('diary pages where you switched on “Let ' + him() + ' read this page”');
    l.push('that your phone turned on birthday reminders (so he can send them)');
    return 'He only receives things you send on purpose: ' + nice(l) + '. Everything else (your wishes, scratch cards, promises, stars, quiz scores, private diary pages) stays on your phone.';
  }

  var KB = [
    { id: 'what', k: ['what is this', 'what is this website', 'about this site', 'what can i do here', 'what is inside', 'whats here', 'what does this site have', 'kya hai', 'site kya hai'], a: function () { return overview(); }, f: ['Where should I start?', 'Show me around'] },
    { id: 'start', k: ['where should i start', 'where to start', 'what first', 'what should i explore first', 'start here', 'kahan se shuru', 'kya pehle'], a: function () { return 'Start with the playlist 🎶 and let a song play, tap the big heart ❤️, open today’s “Open When” letter 💌, then try a surprise tile 🎁. Or tap “Show me around” and I’ll take you through everything, one section at a time. ✨'; }, acts: [{ l: '✨ Show me around', a: 'tour' }], f: ['What is this website?'] },
    { id: 'who', k: ['who made this', 'who made this website', 'who created', 'who built', 'made by', 'kisne banaya', 'kis ne banaya'], a: function () { return him() + ' made this website with all his heart, every word, song and little animation, just to make you smile. ❤️'; } },
    { id: 'howmuch', k: ['how much does he love me', 'does he love me', 'how much love', 'tayyab love me', 'kitna pyaar', 'kitna love'], a: function () { return 'More than words, stars or numbers could count. 💖 (And the website is just a tiny part of it.)'; }, acts: [{ l: '💗 Open the Love Meter', a: 'tile:meter' }] },
    { id: 'miss', k: ['i miss him', 'miss tayyab', 'missing him', 'miss you', 'what if i miss him', 'yaad aa rahi', 'yaad aati', 'feeling lonely'], a: function () { return 'Oh, come here. 🤍 Open an “Open When…” envelope (the one for missing him), or send him a message right now with Write Back To Me. He’d love to hear from you.'; }, acts: [{ l: '💌 Open today’s letter', a: 'env:today' }, { l: '✍️ Write to him', a: 'tile:writeback' }] },
    { id: 'secret', k: ['tell me a secret', 'secret', 'hidden', 'easter egg', 'raaz', 'something hidden'], a: function () { return 'Shh… 🤫 Press and hold the big red heart near the top for about three seconds. Hold on tight and don’t let go. A secret message will appear.'; }, acts: [{ l: '❤️ Take me to the heart', a: 'scroll:.card .heart' }] },
    { id: 'nightmode', k: ['night mode', 'dark mode', 'sunset', 'change colours', 'change colors', 'change theme', 'theme', 'moon button'], a: function () { return 'Tap the 🌙 button in the corner to switch the colours between the day look and the sunset look. Tap again to go back.'; }, acts: [{ l: '🌙 Switch the look', a: 'night' }] },
    { id: 'musicnosound', k: ['no sound', 'music not playing', 'song not playing', 'cant hear', 'cannot hear', 'not working music', 'music is not working', 'muted', 'awaaz nahi', 'gaana nahi chal raha', 'sound'], a: function () { return 'Let’s check: 1) tap the speaker button in the corner (🔇 means muted), 2) press the big ▶ in the player, 3) turn your phone’s volume up, and if you are on iPhone make sure the silent switch is off. Browsers only allow sound after a tap, so the very first tap on the rose is what starts it. 🎶'; }, acts: [{ l: '▶ Play / pause', a: 'player:play' }, { l: '🔊 Music on/off', a: 'music' }] },
    { id: 'musicchange', k: ['change song', 'change the song', 'next song', 'another song', 'different song', 'pick a song', 'playlist', 'play a song', 'play song', 'gaana badlo', 'gana change', 'song change', 'shuffle', 'repeat', 'skip song'], a: function () { var sg = songs(); return 'Tap the song name (or the list button) in the player to open the playlist and pick any song' + (sg.length ? ' (there are ' + sg.length + ': ' + nice(sg.map(function (s) { return s.label; }), 6) + ')' : '') + '. ⏭ jumps to the next song, 🔀 shuffles and 🔁 repeats.'; }, acts: [{ l: '📜 Open the playlist', a: 'click:#mpListBtn' }, { l: '⏭ Next song', a: 'player:next' }] },
    { id: 'lyrics', k: ['lyrics', 'words of the song', 'song words', 'song colour', 'song color'], a: function () { return 'When a song has its lyrics added, the words appear line by line under the song name while it plays, and the card glows in a colour chosen for that song. ✨'; } },
    { id: 'whichsong', k: ['which song is playing', 'what song is this', 'current song', 'now playing', 'konsa gaana'], a: function () { var n = ''; try { var s = songs()[typeof curSong === 'number' ? curSong : 0]; n = s && s.label; } catch (e) { } return n ? 'Right now it’s “' + n + '” 🎶' : 'Open the player to see the name of the song. 🎶'; } },
    { id: 'offline', k: ['offline', 'without internet', 'no internet', 'no wifi', 'works offline', 'internet nahi'], a: function () { return 'Yes! After your first visit the site saves itself on your phone, and every song you’ve played is saved too. So it opens even without internet. New things Tayyab adds appear when you’re online again. 🌐'; } },
    { id: 'install', k: ['install', 'install the app', 'add to home screen', 'home screen', 'download app', 'app icon', 'make it an app'], a: function () { return 'Android or PC (Chrome / Edge): tap “📲 Install the app”, then Install. iPhone (Safari): tap Share ⬆️ → “Add to Home Screen”. If you opened the link inside Instagram or WhatsApp, open it in Chrome or Safari first. 📲'; }, acts: [{ l: '📲 Install now', a: 'click:#installBtn' }] },
    { id: 'reminder', k: ['reminder', 'reminders', 'notification', 'notifications', 'remind me', 'birthday reminder', 'remind', 'alert', 'reminder kaise'], a: function () { var rd = remindDays(); return 'Tap the 🔔 “Remind me before my birthday” button once and allow notifications. ' + (rd.length ? 'You’ll get a notification when ' + nice(rd.map(String)) + ' days are left and on the day itself. ' : '') + 'On iPhone, first add the site to your Home Screen. ' + (reminderOn() ? '✅ They are already on for this phone.' : '🎂'); }, acts: [{ l: '🔔 Turn on reminders', a: 'click:#remindBtn' }] },
    { id: 'reminderfail', k: ['reminders not working', 'reminder not working', 'not getting notifications', 'no notification', 'notification not coming', 'notifications blocked', 'blocked notifications', 'didnt get reminder', 'notification nahi'], a: function () { return 'Check these: 1) allow notifications for this site in your browser settings (if you tapped Block, allow it again), 2) on iPhone the site must be added to the Home Screen and opened from there, 3) turn off battery-saver for your browser, 4) tap the 🔔 button once more. If it still fails, tell ' + him() + ': he can send a test notification to your device from his side. 💕'; }, acts: [{ l: '🔔 Try again', a: 'click:#remindBtn' }, { l: '💌 Tell Tayyab', a: 'tile:writeback' }] },
    { id: 'remindwhen', k: ['when will i get the reminder', 'what time reminder', 'which days reminder', 'how many reminders', 'when do reminders come'], a: function () { var rd = remindDays(); return rd.length ? 'Once a day he checks, and you get a reminder when ' + nice(rd.map(String)) + ' days are left, and on the day itself.' : 'You get a reminder on the days Tayyab picked before your birthday.'; } },
    { id: 'birthday', k: ['how many days until my birthday', 'days to my birthday', 'when is my birthday', 'my birthday', 'birthday countdown', 'kitne din baaki'], a: function () { var d = daysToBirthday(); return d === null ? 'Your birthday countdown is at the top of the page. 🎂' : d === 0 ? 'It’s TODAY! 🎂🎉 Happy birthday, ' + her() + '!' : 'Your birthday is ' + bdayText() + ', which is ' + plural(d, 'day') + ' away. 🎂'; } },
    { id: 'lovedays', k: ['how long have we been together', 'how many days together', 'days of loving', 'love counter', 'our anniversary', 'kitne din'], a: function () { var ls = ST().loveStart ? new Date(ST().loveStart) : null; if (!ls || isNaN(ls)) return 'The counter near the bottom shows how long ' + him() + ' has been loving you, once he has set the start date. ❤️'; var d = Math.floor((Date.now() - ls.getTime()) / 864e5); return d < 0 ? 'Your story starts soon. 🌹' : 'That’s ' + plural(d, 'day') + ' of ' + him() + ' loving you, and counting. ❤️'; } },
    { id: 'photos', k: ['photos', 'pictures', 'gallery', 'memories', 'where are our photos', 'see photos', 'tasveer', 'tasveerein', 'pics', 'album'], a: function () { return 'Scroll to “Our Memories” and tap “Open Full Gallery 📸”. Tap a photo to see it big with its caption, swipe for the next one, double-tap to zoom, and press ▶ Reel for a slideshow.' + loginLine(); }, acts: [{ l: '📸 Open the gallery', a: 'click:#openGalleryBtn' }] },
    { id: 'login', k: ['login', 'log in', 'username', 'password', 'what is my password', 'forgot password', 'forgot my password', 'locked', 'lock icon', 'cant open', 'it asks for password', 'password kya hai', 'password bhool'], a: function () { return 'A 🔒 means ' + him() + ' put a password on that thing. The lock window may show a hint. Type the password once and it’s remembered on this phone for about a month. For the photos, Our Story and the question there may be a login (username + password) instead. If you forgot a password, ask ' + him() + ': only he can tell you or change it.'; }, acts: [{ l: '💌 Ask Tayyab', a: 'tile:writeback' }] },
    { id: 'envelopes', k: ['open when', 'envelope', 'envelopes', 'letters', 'khat', 'what is the today badge', 'today badge'], a: function () { var et = envTitles(); return 'The “Open When…” envelopes are letters for different feelings' + (et.length ? ': ' + et.join(' · ') : '') + '. Tap one to open it. The ✨ “Today” badge marks the one he’d suggest for today; it changes every day.'; }, acts: [{ l: '💌 Open today’s letter', a: 'env:today' }] },
    { id: 'letter', k: ['the letter', 'unfolding letter', 'how do i open the letter', 'open the letter', 'how much i care', 'tap to see how much i care'], a: function () { return 'At the bottom of the page, tap “Tap to see how much I care”. A message appears, hearts rain down and the letter unfolds. 💌'; }, acts: [{ l: '💌 Open the letter', a: 'click:button[onclick^="showMessage"]' }] },
    { id: 'heart', k: ['big heart', 'the heart', 'heartbeat', 'tap the heart', 'heart counter'], a: function () { return 'Tap the big ❤️ and hearts fly out while the little counter counts your heartbeats. At special counts it shows a sweet note. And if you hold it a few seconds… 🤫'; }, acts: [{ l: '❤️ Tap the heart', a: 'click:.card .heart' }] },
    { id: 'tiles', k: ['surprises', 'little surprises', 'tiles', 'what are the surprises', 'what can i tap', 'surprise tiles'], a: function () { var t = tiles('surprises'); return t.length ? 'The little surprises are: ' + t.map(function (x) { return x.icon + ' ' + x.label; }).join(', ') + '. Tap any tile to open it. Want a short description of each?' : 'Scroll down to “Little Surprises” and tap any tile.'; }, acts: [{ l: '📋 Describe each tile', a: 'tiles:surprises' }] },
    { id: 'scratch', k: ['scratch', 'scratch card', 'scratch cards', 'coupon'], a: function () { return tileLine('scratch'); }, acts: [{ l: '🎟️ Scratch one', a: 'tile:scratch' }] },
    { id: 'wish', k: ['make a wish', 'wish', 'wishes', 'dua'], a: function () { return tileLine('wish') + ' (A wish stays between you and the stars; it isn’t sent to anyone.) 🌠'; }, acts: [{ l: '🌠 Make a wish', a: 'tile:wish' }] },
    { id: 'bouquet', k: ['bouquet', 'flowers', 'buds', 'phool'], a: function () { return tileLine('bouquet'); }, acts: [{ l: '💐 Open the bouquet', a: 'tile:bouquet' }] },
    { id: 'riddles', k: ['riddle', 'riddles', 'funny riddles', 'puzzle', 'paheli'], a: function () { return tileLine('quiz'); }, acts: [{ l: '😄 Try a riddle', a: 'tile:quiz' }] },
    { id: 'sweetquiz', k: ['sweet quiz', 'quiz', 'trivia', 'love trivia'], a: function () { return tileLine('sweet'); }, acts: [{ l: '🧠 Take the quiz', a: 'tile:sweet' }] },
    { id: 'promises', k: ['promise', 'promises', 'seal a promise', 'wada', 'wade'], a: function () { return tileLine('promises'); }, acts: [{ l: '📜 Read the promises', a: 'tile:promises' }] },
    { id: 'meter', k: ['love meter', 'meter', 'hold the button', 'how to fill the love meter'], a: function () { return tileLine('meter') + ' Keep your finger down until it passes 100%. 💗'; }, acts: [{ l: '💗 Try the meter', a: 'tile:meter' }] },
    { id: 'writeback', k: ['write back', 'write back to me', 'send a message', 'message tayyab', 'message him', 'talk to tayyab', 'tell tayyab', 'contact tayyab', 'send him a message', 'how do i message him'], a: function () { var ch = channels(); return 'Open “Write Back To Me”, type what your heart wants to say (up to 500 characters) and press send' + (notifyOn() ? '; it is delivered to his phone privately' : '') + '.' + (ch.length ? ' You can also send the same words with ' + nice(ch) + '.' : '') + ' 💌'; }, acts: [{ l: '✍️ Write to him', a: 'tile:writeback' }] },
    { id: 'seen', k: ['what does tayyab see', 'what can tayyab see', 'what does he see', 'does tayyab get notified', 'does he get a notification', 'privacy', 'who can see', 'is it private', 'what is shared', 'does he know when i'], a: function () { return whatTayyabSees() + ' 🔒'; } },
    { id: 'saved', k: ['what is saved on my phone', 'saved on my phone', 'will i lose my stars', 'clear data', 'new phone', 'change phone', 'lost my progress', 'move to new phone', 'move my diary'], a: function () { return 'Your stars, streak, best scores, sealed promises, diary pages and unlocked passwords are saved in this phone’s browser. If you clear the browser data, use another browser or get a new phone, they start fresh. If a diary page matters, switch on sharing for it so ' + him() + ' keeps a copy. 🤍'; } },
    { id: 'diary', k: ['diary', 'personal diary', 'dairy', 'write in diary', 'how does the diary work', 'diary calendar', 'diary kaise', 'journal'], a: function () { var d = diaryCfg(); return 'Open the diary and tap a day on the calendar to write that day’s page: pick a mood, add a title and write. ' + (d.allowBackfill === false ? 'Pages can only be written on the day itself. ' : '') + (d.showPrompts !== false ? 'Stuck? Ask for a writing prompt. ' : '') + (d.showStreak !== false ? 'Write on following days for a 🔥 streak. ' : '') + 'Pages stay on this phone unless you switch sharing on. 📖'; }, acts: [{ l: '📖 Open my diary', a: 'click:#diaryBtn' }] },
    { id: 'diaryprivacy', k: ['can tayyab read my diary', 'who can read my diary', 'is my diary private', 'diary private', 'share diary', 'share a page', 'unshare', 'delete diary page', 'delete a page', 'diary share'], a: function () { var d = diaryCfg(); if (d.allowSharing === false) return 'Nobody. Sharing is switched off, so every page stays only on this phone. 🔒'; return 'Only you, unless you switch on “Let ' + him() + ' read this page” for that page. Then it’s delivered to him and he can read it in his private panel. Changed your mind? Switch it off and save (or delete the page) and it disappears from his side. 🔒'; }, acts: [{ l: '📖 Open my diary', a: 'click:#diaryBtn' }] },
    { id: 'diarystreak', k: ['streak', 'diary streak', 'day streak', 'fire streak'], a: function () { return 'A streak counts the days in a row you’ve visited and played (the 🏺 Love Jar shows it) and the days in a row you’ve written in your diary. Miss a day and it starts again from 1, and that’s okay. 🔥'; } },
    { id: 'plan', k: ['plan a date', 'plan date', 'how do i plan', 'schedule', 'book a date', 'date planner', 'planner', 'calendar', 'plan valorant', 'valorant', 'play valorant', 'movie night', 'date plan', 'plan kaise'], a: function () { var a = activities(); return 'Open “Plan a Date”, choose what to do (' + nice(a.map(function (x) { return x.label; }), 6) + '), tap a day, pick a time, add a note if you like and press send. The plan lands on ' + him() + '’s phone straight away. 📅'; }, acts: [{ l: '📅 Plan a date', a: 'tile:calendar' }].concat(tileShown('valorant') ? [{ l: '🎮 Plan Valorant', a: 'tile:valorant' }] : []) },
    { id: 'planchange', k: ['change a plan', 'cancel a plan', 'cancel plan', 'edit plan', 'wrong date', 'wrong time', 'plan after sending', 'change the date', 'change the time', 'delete plan'], a: function () { return 'Once a plan is sent you can’t edit it from here. Just send a new plan with the right day and time, or tell ' + him() + ' with “Write Back To Me” and he’ll fix it on his side. 💕'; }, acts: [{ l: '📅 Send a new plan', a: 'tile:calendar' }, { l: '✍️ Write to him', a: 'tile:writeback' }] },
    { id: 'games', k: ['games', 'play together', 'mini games', 'game', 'play a game', 'khel', 'which games'], a: function () { var t = tiles('play'); return t.length ? 'You can play: ' + t.map(function (x) { return x.icon + ' ' + x.label; }).join(', ') + '. Each one shows how to play before it starts. Wins earn ⭐ stars for your Love Jar.' : 'Scroll down to “Play Together” and tap a game.'; }, acts: [{ l: '📋 About each game', a: 'tiles:play' }] },
    { id: 'catch', k: ['catch hearts', 'catch the hearts', 'basket'], a: function () { return tileLine('catch'); }, acts: [{ l: '🧺 Play Catch Hearts', a: 'tile:catch' }] },
    { id: 'match', k: ['memory match', 'match cards', 'pairs', 'flip cards'], a: function () { return tileLine('match'); }, acts: [{ l: '🃏 Play Memory Match', a: 'tile:match' }] },
    { id: 'ttt', k: ['tic tac', 'tic-tac-love', 'tictactoe', 'noughts'], a: function () { return tileLine('ttt'); }, acts: [{ l: '❌ Play Tic-Tac-Love', a: 'tile:ttt' }] },
    { id: 'gtr', k: ['gtr', 'gt-r', 'r34', 'car', 'race', 'racing', 'drive'], a: function () { return tileLine('gtr'); }, acts: [{ l: '🏎️ Start the GT-R', a: 'tile:gtr' }] },
    { id: 'flight', k: ['love flight', 'flight', 'dove', 'fly'], a: function () { return tileLine('flight'); }, acts: [{ l: '🕊️ Fly', a: 'tile:flight' }] },
    { id: 'breaker', k: ['love breaker', 'breaker', 'bricks', 'brick'], a: function () { return tileLine('breaker'); }, acts: [{ l: '🧱 Play Love Breaker', a: 'tile:breaker' }] },
    { id: 'football', k: ['love striker', 'striker', 'football', 'soccer', 'goal'], a: function () { return tileLine('football'); }, acts: [{ l: '⚽ Play Love Striker', a: 'tile:football' }] },
    { id: 'gamerest', k: ['game resting', 'game is resting', 'why is a game resting', 'time is up', 'time limit', 'cant play game', 'game locked', 'play again later', 'game rest'], a: function () { return 'Some games have a play-time limit. When the time is up they rest for a while (the message tells you how many minutes) and then open again. That keeps them special. 🌙'; } },
    { id: 'stars', k: ['stars', 'what are the stars for', 'love jar', 'jar', 'unlock love notes', 'love notes', 'rewards', 'how do i unlock', 'how do i get stars', 'points'], a: function () { var rw = rewards(); return 'Playing earns ⭐: your first game each day, wins and combos. Stars fill the 🏺 Love Jar and unlock love notes written by ' + him() + ' (the first at ' + rw[0].at + ' ⭐, ' + rw.length + ' notes in all). Open the jar to see your stars, your streak and the next note.'; }, acts: [{ l: '🏺 Open my Love Jar', a: 'click:.jar-tile' }] },
    { id: 'story', k: ['our story', 'read our story', 'story', 'kahani'], a: function () { return hasStory() ? 'Tap “📖 Read Our Story” in “One Last Thing”. It plays like a little film of the two of you, with music.' + loginLine() : 'Our Story appears next to the last question once it’s ready.'; }, acts: hasStory() ? [{ l: '📖 Read our story', a: 'click:#storyBtn' }] : [] },
    { id: 'question', k: ['what is the question', 'what question', 'the question', 'question for me', 'proposal', 'one last thing', 'what does he want to ask', 'sawal'], a: function () { return 'That one is a secret. 🤍 I’m not allowed to tell you. When you’re ready, find a quiet moment, keep your sound on and tap “I Have a Question For You”.'; }, acts: [{ l: '💍 I’m ready', a: 'click:.proposal-btn:not(.story-btn)' }] },
    { id: 'forever', k: ['forever yours', 'forever button', 'finale', 'cinematic'], a: function () { return 'The “Forever Yours ❤️” button plays a short cinematic with words and a song, just for you. Turn your volume up first. 🌹'; }, acts: [{ l: '❤️ Play it', a: 'click:button[onclick^="showFinale"]' }] },
    { id: 'slow', k: ['slow', 'laggy', 'lag', 'hanging', 'stuck', 'phone is hot', 'battery', 'too many animations', 'animations', 'calm mode', 'heavy'], a: function () { return 'On slower phones the site switches to a calmer mode by itself (fewer moving parts) and pauses animations when you leave the tab. If it still feels heavy, close other apps, or install it as an app from the “📲 Install” button. 🌿'; } },
    { id: 'cantopen', k: ['not opening', 'doesnt open', 'does not open', 'not loading', 'blank', 'error', 'something went wrong', 'broken', 'bug', 'not working'], a: function () { return 'Oh no. Try this: 1) refresh the page, 2) check your internet, 3) if a locked thing won’t open, tap it again and type the password, 4) if it still fails, tell ' + him() + ' what you tapped and what happened and he’ll fix it. 💕'; }, acts: [{ l: '✍️ Tell Tayyab', a: 'tile:writeback' }] },
    { id: 'tour', k: ['show me around', 'tour', 'guide me', 'take me on a tour', 'walk me through', 'help me', 'how does this work', 'how does this website work', 'help', 'guide', 'madad'], a: function () { return 'Of course! I’ll take you through the website section by section, tell you what each part is, how it works, and let you try it. 🌸'; }, acts: [{ l: '✨ Show me around', a: 'tour' }] },
    { id: 'whoami', k: ['who are you', 'what are you', 'your name', 'what is your name', 'tum kaun ho', 'aap kaun', 'naam'], a: function () { return 'I’m ' + String(AC().name || 'Mochi').replace(/\s*[^\w\s].*$/, '') + ', your little guide. ' + him() + ' made me to show you around and keep you company. 🌸'; } },
    { id: 'can', k: ['what can you do', 'what do you do', 'how can you help', 'your abilities', 'kya kar sakti', 'kya kar sakte'], a: function () { return 'I can show you around the whole website, explain how anything works, open things for you (diary, planner, games…), whisper a love note from ' + him() + ', tell you your birthday countdown, and chat a little. Ask me anything! ✨'; }, acts: [{ l: '✨ Show me around', a: 'tour' }, { l: '💌 Love note', a: 'whisper' }] },
    { id: 'language', k: ['urdu', 'hindi', 'roman urdu', 'speak urdu', 'which language', 'language'], a: function () { return 'I mostly speak English, but I understand a lot of Roman Urdu too, like “gaana kaise badlun?” or “password kya hai?”. 🌷'; } }
  ];

  /* ---------- small talk (no network, just a few warm replies) ---------- */
  function voice() { return String(AC().personality || 'sweet'); }
  var V = {
    sweet: { ok: ['Aww, ', 'Of course! ', 'Happy to help. '], bye: 'Take care, and remember how loved you are. 🌹', cheer: 'You deserve every good thing today. 💖' },
    playful: { ok: ['Ooh! ', 'Yesss, ', 'Okay okay, '], bye: 'Bye bye! Come back soon, I’ll be right here. 🎀', cheer: 'Plot twist: you’re the best part of the internet today. ✨' },
    caring: { ok: ['Of course. ', 'I’m here. ', 'No rush. '], bye: 'Rest well, and be gentle with yourself. 🌙', cheer: 'Take a slow breath. You’re doing better than you think. 🤍' },
    poetic: { ok: ['Ji, ', 'Zaroor, ', 'Sunno, '], bye: 'Khuda hafiz, jab dil chahe laut aana. 🌹', cheer: 'Kuch lamhe khud mein khushi hote hain, aur tum unmein se ek ho. ✨' }
  };
  function vv() { return V[voice()] || V.sweet; }
  function twoDigits(n) { return n < 10 ? '0' + n : '' + n; }
  function smallTalk(raw, t) {
    var h = new Date().getHours();
    if (/^(hi|hello|hey|hii+|salam|assalam|assalamualaikum|asalam|aoa|helo|yo|hola)\b/.test(t) || /assalam/.test(t)) {
      var g = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night';
      return { t: (/assalam|salam|aoa/.test(t) ? 'Wa Alaikum Assalam' : g) + ', ' + her() + '! 🌹 How can I help?' };
    }
    if (/how are you|how r u|kaisi ho|kaise ho|kese ho|kya haal|whats up|what\'s up/.test(t)) return { t: pick(['I’m wonderful, because you came to say hi. 🌸', 'Floating happily in the corner of your screen. And you? 💕']) };
    if (/\b(thanks|thank you|thankyou|thx|shukriya|shukria|jazak)/.test(t)) return { t: pick(['Always. 💖', 'Anytime, ' + her() + '. 🌷', 'You’re so welcome. ✨']) };
    if (/i love you|love you|luv u|ily|i luv/.test(t)) return { t: pick(['I love you too, from my tiny corner. 🥹 But I’m only the messenger. The real love comes from ' + him() + '. 💖', 'Aww! I’ll pass that on. Want to tell him yourself?']), acts: [{ l: '💌 Tell him', a: 'tile:writeback' }] };
    if (/good ?night|sleep|sone ja|shab ?b?a ?khair/.test(t)) return { t: 'Good night, ' + her() + '. 🌙 Sweet dreams, and may tomorrow be kind to you.' };
    if (/good ?morning|subah/.test(t)) return { t: 'Good morning! ☀️ I hope today is soft on you.' };
    if (/\b(bye|goodbye|see you|allah hafiz|khuda hafiz|alvida)\b/.test(t)) return { t: vv().bye };
    if (/bored|boring|bore ho/.test(t)) return { t: 'Let’s fix that! 🎮 Try a game, or tap a surprise tile.', acts: [{ l: '🧺 Catch Hearts', a: 'tile:catch' }, { l: '✨ Surprise me', a: 'tile:random' }] };
    if (/\b(sad|upset|cry|crying|tired|stressed|anxious|lonely|udaas|pareshan)\b/.test(t)) return { t: vv().cheer + ' If you want, open an “Open When…” letter, or tell your diary how you feel.', acts: [{ l: '💌 Open a letter', a: 'env:today' }, { l: '📖 Open my diary', a: 'click:#diaryBtn' }] };
    if (/\b(happy|excited|so good|khush)\b/.test(t)) return { t: 'That makes me so happy! 🥰 Want to share it with ' + him() + '?', acts: [{ l: '💌 Tell him', a: 'tile:writeback' }] };
    if (/joke|make me laugh|funny/.test(t)) return { t: pick(['Why did the heart go to school? It wanted to learn how to beat. 💓', 'What do you call two birds in love? Tweet-hearts. 🐦', 'I told my phone I love it, and now it won’t stop notifying me. 📱']), acts: [{ l: '😄 Try the riddles', a: 'tile:quiz' }] };
    if (/what.*(time|waqt)|time kya|kitne baje/.test(t)) { var d = new Date(), hh = d.getHours() % 12 || 12; return { t: 'It’s ' + hh + ':' + twoDigits(d.getMinutes()) + ' ' + (d.getHours() >= 12 ? 'PM' : 'AM') + '. ⏰' }; }
    if (/what.*(date|day) (is it|today)|today.?s date|aaj kya|aaj ki tareekh|what day/.test(t)) return { t: 'Today is ' + new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + '. 📅' };
    if (/compliment|am i cute|am i pretty|am i beautiful|say something nice|cute/.test(t)) return { t: pick(['You’re the reason this whole website exists. 🌹', 'You light up every corner of this page. ✨', 'Pretty, kind and impossible not to love. 💖']) };
    if (/are you real|are you human|are you ai|robot/.test(t)) return { t: 'I’m a little website guide, not a person. But the love in this website is completely real. 💗' };
    if (/\b(ok|okay|hmm+|hm+|cool|nice|wow|lol|haha+|acha|theek)\b/.test(t) && t.split(' ').length <= 3) return { t: pick(['😊', 'Anything else I can show you?', 'I’m here whenever you need me. 🌸']) };
    return null;
  }

  /* ---------- matching ---------- */
  var SYN = {
    gaana: 'song', gaane: 'song', gana: 'song', gaanay: 'song', songs: 'song', naghma: 'song', music: 'song',
    tasveer: 'photo', tasveerein: 'photo', tasveeren: 'photo', pic: 'photo', pics: 'photo', photos: 'photo', picture: 'photo', pictures: 'photo', image: 'photo', images: 'photo',
    khat: 'letter', letters: 'letter', khatt: 'letter', kahani: 'story', mohabbat: 'love', pyaar: 'love', pyar: 'love', ishq: 'love',
    kaise: 'how', kaisay: 'how', kese: 'how', kya: 'what', kahan: 'where', kidhar: 'where', kab: 'when', kyun: 'why', kyu: 'why',
    band: 'off', badlo: 'change', badlun: 'change', badal: 'change', badalna: 'change', badle: 'change', chalao: 'play', chala: 'play', bajao: 'play', kholo: 'open', khol: 'open', likhna: 'write', likho: 'write',
    dairy: 'diary', tohfa: 'gift', pw: 'password', pass: 'password', passcode: 'password', reminders: 'reminder', notifications: 'notification', notif: 'notification', notifs: 'notification',
    laggy: 'slow', lag: 'slow', hang: 'slow', madad: 'help', mujhe: '', mera: '', meri: '', mere: '', hai: '', ho: '', hain: '', ka: '', ki: '', ke: '', ko: '', se: '', mein: '', me: '', please: '', plz: '', pls: '', can: '', you: '', the: '', a: '', an: '', is: '', are: '', do: '', does: '', i: '', to: '', of: '', my: '', it: '', and: '', in: '', on: '', for: '', am: '', was: '', be: '', so: '', just: '', tell: '', show: '', me: ''
  };
  function norm(s) { return String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9\u0600-\u06ff\s-]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function toks(s) {
    return norm(s).split(' ').map(function (w) { return Object.prototype.hasOwnProperty.call(SYN, w) ? SYN[w] : w; }).filter(Boolean);
  }
  function lev1(a, b) {
    if (a === b) return true;
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1 || la < 5) return false;
    var i = 0, j = 0, d = 0;
    while (i < la && j < lb) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++d > 1) return false;
      if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
    }
    return d + (la - i) + (lb - j) <= 1;
  }
  function score(entry, qn, qt) {
    var best = 0;
    for (var i = 0; i < entry.k.length; i++) {
      var kn = norm(entry.k[i]), kt = toks(kn);
      if (!kt.length) continue;
      var s = 0;
      if (qn === kn) s = 20 + kt.length;
      else if ((' ' + qn + ' ').indexOf(' ' + kn + ' ') >= 0) s = 6 + kt.length * 2;
      else {
        var hit = 0;
        kt.forEach(function (w) { if (qt.some(function (x) { return x === w || lev1(x, w); })) hit++; });
        if (hit === kt.length && kt.length > 1) s = 5 + kt.length * 2;
        else if (kt.length === 1 && hit === 1) s = 2.5;
        else if (hit > 0 && kt.length > 1) s = hit * 1.2 / kt.length * 2;
      }
      if (s > best) best = s;
    }
    return best;
  }
  function find(list, raw) {
    var qn = norm(raw), qt = toks(raw), best = null, bs = 0;
    list.forEach(function (e) { var s = score(e, qn, qt); if (s > bs) { bs = s; best = e; } });
    return bs >= 3 ? best : null;
  }

  function html(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'); }

  function sectionAnswer(sec) {
    return { t: sec.icon + ' **' + sec.title + '**\n' + sec.what + (sec.tip ? '\n💡 ' + sec.tip : ''), acts: [{ l: '🧭 Show me', a: 'goto:' + sec.id }], f: sec.ask || [] };
  }

  function answer(raw, ctx) {
    raw = String(raw || '').trim();
    var t = norm(raw);
    if (!t) return null;
    var A_ = AC();

    /* 1) what Tayyab wrote himself in the admin panel always wins */
    var admin = (Array.isArray(A_.qa) ? A_.qa : []).filter(function (x) { return x && x.q && x.a; }).map(function (x) {
      var k = [x.q].concat(String(x.k || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean));
      return { k: k, a: x.a, custom: true };
    });
    var m = find(admin, raw);
    if (m) return { t: m.a, acts: [], f: [] };

    /* 2) built-in knowledge about the site */
    var secs = ctx && ctx.sections ? ctx.sections : build();
    var kbHit = find(KB, raw);
    var secHit = find(secs.map(function (s) {
      return { k: [s.title, s.id], sec: s };
    }), raw);
    if (kbHit && (!secHit || score(kbHit, t, toks(raw)) >= score(secHit, t, toks(raw)))) {
      var acts = typeof kbHit.acts === 'function' ? kbHit.acts() : (kbHit.acts || []);
      return { t: kbHit.a(), acts: acts.filter(function (x) { return x; }), f: kbHit.f || [] };
    }
    if (secHit) return sectionAnswer(secHit.sec);

    /* 3) small talk */
    if (A_.smallTalk !== false) {
      var sm = smallTalk(raw, t);
      if (sm) return { t: sm.t, acts: sm.acts || [], f: [] };
    }

    /* 4) honest fallback: say what I do know and offer to ask him */
    return {
      t: 'Hmm, I’m not sure about that one. 🌸 I know this website inside out, so try asking about the playlist, photos, diary, plans, games or reminders. Or send the question straight to ' + him() + ' and he’ll answer you himself.',
      acts: [{ l: '💌 Ask Tayyab', a: 'ask:' + raw }],
      f: ['What is this website?', 'Where should I start?'],
      miss: true
    };
  }

  function suggestions(secId) {
    var s = build().filter(function (x) { return x.id === secId; })[0];
    var base = ['What is this website?', 'What does Tayyab see?', 'How do I plan a date?', 'How do I turn on reminders?', 'Can Tayyab read my diary?', 'Tell me a secret'];
    var arr = (s && s.ask ? s.ask : []).concat(base);
    var seen = {}, out = [];
    arr.forEach(function (q) { if (!seen[q]) { seen[q] = 1; out.push(q); } });
    return out.slice(0, 6);
  }

  W.AgentBrain = {
    sections: build, tiles: tiles, answer: answer, run: run, overlayOpen: overlayOpen, suggestions: suggestions,
    overview: overview, html: html, her: her, KB: KB, norm: norm, find: find
  };
})();
