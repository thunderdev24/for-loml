/* 💖 PLAN A DATE: decoration only (step badges, accent colour per plan type, live summary).
   The planner logic and everything it sends stay in ifra.js; admin → Dates & Plans still controls its content. */
(function () {
  'use strict';
  var fb = document.getElementById('funBody');
  if (!fb) return;

  var ACC = {
    valorant: ['#ff4655', '#ff8a94', 'rgba(255,70,85,.42)'],
    movie: ['#b983ff', '#e0c4ff', 'rgba(185,131,255,.42)'],
    call: ['#ffb86b', '#ffd9a3', 'rgba(255,184,107,.40)'],
    dinner: ['#ff7a59', '#ffb199', 'rgba(255,122,89,.42)']
  };
  var DEFAULT = ['#ff4d6d', '#ff8fa3', 'rgba(255,77,109,.42)'];

  function txt(el) { return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : ''; }

  function update(wrap, ribbon) {
    var act = wrap.querySelector('#planTypeChips .plan-chip.active');
    var type = act ? act.getAttribute('data-type') : '';
    var a = ACC[type] || DEFAULT;
    wrap.style.setProperty('--pa', a[0]); wrap.style.setProperty('--pb', a[1]); wrap.style.setProperty('--pg', a[2]);
    if (!ribbon) return;
    var mode = wrap.querySelector('#subTypeWrap .plan-chip.active');
    var custom = wrap.querySelector('#customPlanTitleInp');
    var name = (type === 'custom' && custom && custom.value.trim()) ? custom.value.trim() : txt(act) || 'Our plan';
    var date = txt(wrap.querySelector('.plan-sec-title[data-n="2"] em'));
    var time = txt(wrap.querySelector('.plan-sec-title[data-n="3"] em'));
    ribbon.innerHTML = '';
    var s = document.createElement('small'); s.textContent = 'Your plan';
    var b = document.createElement('b'); b.textContent = name + (mode ? ' · ' + txt(mode) : '');
    var d = document.createElement('span'); d.textContent = '📅 ' + (date || '—') + '   ⏰ ' + (time || '—');
    ribbon.appendChild(s); ribbon.appendChild(b); ribbon.appendChild(d);
  }

  function enhance() {
    var wrap = fb.querySelector('.planner-wrap');
    var ok = wrap || fb.querySelector('.plan-success-wrap');
    var box = fb.closest ? fb.closest('.fun-box') : null;
    if (box) box.classList.toggle('pl-wide', !!ok);
    if (!wrap || wrap.getAttribute('data-pl')) return;
    wrap.setAttribute('data-pl', '1');

    Array.prototype.forEach.call(wrap.querySelectorAll('.plan-sec-title'), function (t) {
      var m = /^\s*(\d+)\.\s*(.*?)\s*(?:\(([^)]*)\))?\s*$/.exec(t.textContent || '');
      if (!m) return;
      t.textContent = '';
      var i = document.createElement('i'); i.className = 'pl-step'; i.textContent = m[1];
      var s = document.createElement('span'); s.textContent = m[2];
      t.appendChild(i); t.appendChild(s);
      if (m[3]) { var e = document.createElement('em'); e.textContent = m[3]; t.appendChild(e); }
      t.setAttribute('data-n', m[1]);
    });

    var ribbon = document.createElement('div'); ribbon.className = 'pl-sum';
    var send = wrap.querySelector('#planSubmitBtn');
    if (send) wrap.insertBefore(ribbon, send); else wrap.appendChild(ribbon);
    update(wrap, ribbon);

    function later() { setTimeout(function () { if (wrap.isConnected) update(wrap, ribbon); }, 0); }
    wrap.addEventListener('click', later);
    wrap.addEventListener('input', later);
  }

  new MutationObserver(enhance).observe(fb, { childList: true });
  enhance();
})();
