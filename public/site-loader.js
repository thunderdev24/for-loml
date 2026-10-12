/* Loads content.js (or, in admin preview, the unsaved draft) and fills the page.
   Everything on the site comes from window.SITE; edit it with admin.html. */
(function () {
  var base = window.SITE_CONTENT || {};
  var preview = /[?&]preview=1/.test(location.search);
  var locked = !!window.SITE_LOCK && !preview;   // logins are on: photos / story / proposal need a login
  var PROT = ['memories', 'story', 'proposalScenes', 'yesScenes', 'noTexts'];
  var PROT_TEXT = ['proposalTitle', 'proposalSub', 'proposalYes', 'proposalFinal'];
  window.SITE_LOCKED = locked;
  if (locked) {
    // keep the built-in copies aside; they are only used after a successful login
    var stash = { text: {} };
    base.text = base.text || {};
    PROT.forEach(function (k) { if (base[k] !== undefined) { stash[k] = base[k]; delete base[k]; } });
    PROT_TEXT.forEach(function (k) { if (base.text[k] !== undefined) { stash.text[k] = base.text[k]; delete base.text[k]; } });
    window.SITE_PROT_DEFAULT = stash;
  }
  var C = window.SITE_LIVE || base;          // content saved from the admin panel wins
  Object.keys(base).forEach(function (k) {   // fill anything missing with the defaults
    if (C[k] === undefined) C[k] = base[k];
    else if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]))
      Object.keys(base[k]).forEach(function (j) { if (C[k][j] === undefined) C[k][j] = base[k][j]; });
  });
  if (locked) {
    // empty placeholders so the page works until she logs in
    C.memories = []; C.story = { pages: [] }; C.proposalScenes = []; C.yesScenes = []; C.noTexts = ['No'];
  }
  if (preview) {
    try {
      var d = JSON.parse(localStorage.getItem('ifraDraft') || 'null');
      if (d) C = d;
    } catch (e) { }
  }
  C.text = C.text || {};
  C.settings = C.settings || {};
  C.settings.notifyOn = !!window.SITE_NOTIFY;
  window.SITE = C;

  document.querySelectorAll('[data-t]').forEach(function (el) {
    var v = C.text[el.getAttribute('data-t')];
    if (v != null) el.innerHTML = v;
  });
  if (C.text.pageTitle) document.title = C.text.pageTitle;

  // playlist
  var sel = document.getElementById('songSelect');
  var music = document.getElementById('bgMusic');
  if (sel && C.songs && C.songs.length) {
    sel.innerHTML = '';
    C.songs.forEach(function (s) {
      var o = document.createElement('option');
      o.value = s.file; o.textContent = s.label;
      sel.appendChild(o);
    });
    var src = music && music.querySelector('source');
    if (src) { src.removeAttribute('type'); src.src = C.songs[0].file; }
  }

  // "Open when..." envelopes
  var sec = document.querySelector('.letters-section');
  if (sec && C.envelopes) {
    C.envelopes.forEach(function (e) {
      var env = document.createElement('div');
      env.className = 'envelope'; env.tabIndex = 0; env.setAttribute('role', 'button');
      var t = document.createElement('div'); t.className = 'env-title';
      var sp = document.createElement('span'); sp.textContent = e.emoji || '💌';
      t.appendChild(sp); t.appendChild(document.createTextNode(' ' + (e.title || '')));
      var b = document.createElement('div'); b.className = 'env-body'; b.innerHTML = e.body || '';
      env.appendChild(t); env.appendChild(b); sec.appendChild(env);
    });
  }

  if (preview) {
    var tag = document.createElement('div');
    tag.textContent = 'PREVIEW (unsaved draft)';
    tag.style.cssText = 'position:fixed;left:50%;bottom:6px;transform:translateX(-50%);z-index:99999;background:#000b;color:#fff;font:12px sans-serif;padding:3px 10px;border-radius:10px;pointer-events:none';
    document.body.appendChild(tag);
  }
})();
