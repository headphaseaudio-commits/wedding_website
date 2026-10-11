(() => {
  'use strict';

  const CFG = window.WEDDING_CONFIG;
  const DICT = window.I18N;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ───────────── Language ───────────── */

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }
  };

  function initialLang() {
    const q = new URLSearchParams(location.search).get('lang');
    if (q && DICT[q]) return q;
    const saved = store.get('lang');
    if (saved && DICT[saved]) return saved;
    return (navigator.language || 'en').toLowerCase().startsWith('pl') ? 'pl' : 'en';
  }

  let lang = initialLang();
  const t = (key, vars = {}) => {
    const s = DICT[lang][key] ?? DICT.en[key] ?? key;
    return typeof s === 'string' ? s.replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? '') : s;
  };

  function applyLang(next) {
    lang = next;
    document.documentElement.lang = lang;
    document.title = t('meta.title');
    $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    $$('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    $$('[data-lang-only]').forEach(el => { el.hidden = el.dataset.langOnly !== lang; });
    $$('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    $('.lang').dataset.active = lang;

    renderDeadline();
    renderCountdown();
    updateCalendarLink();
    refreshErrors();
    if (lastReply) renderThanks(lastReply);

    store.set('lang', lang);
    const url = new URL(location.href);
    url.searchParams.set('lang', lang);
    history.replaceState(null, '', url);
  }

  $$('.lang button').forEach(b => b.addEventListener('click', () => applyLang(b.dataset.lang)));

  /* ───────────── Deadline & contact ───────────── */

  function renderDeadline() {
    const el = $('#rsvp-deadline');
    if (!CFG.rsvpDeadline) { el.textContent = t('rsvp.deadlineNone'); return; }
    const d = new Date(CFG.rsvpDeadline + 'T12:00:00');
    const date = new Intl.DateTimeFormat(lang === 'pl' ? 'pl-PL' : 'en-GB',
      { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    el.textContent = t('rsvp.deadline', { date });
  }

  if (CFG.contactEmail) {
    const a = $('#contact-link');
    a.href = 'mailto:' + CFG.contactEmail;
    a.textContent = CFG.contactEmail;
    $('#contact').hidden = false;
  }

  /* ───────────── Countdown ───────────── */

  const target = new Date(CFG.weddingStart).getTime();
  const plural = (key, n) => {
    const forms = t(key);
    if (lang === 'pl') {
      if (n === 1) return forms[0];
      const d = n % 10, dd = n % 100;
      return (d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14)) ? forms[1] : forms[2];
    }
    return n === 1 ? forms[0] : forms[1];
  };

  function renderCountdown() {
    let diff = Math.max(0, target - Date.now());
    if (diff === 0) {
      $('.countdown').hidden = true;
      $('.countdown__done').hidden = false;
      return;
    }
    const parts = {
      d: Math.floor(diff / 864e5),
      h: Math.floor(diff / 36e5) % 24,
      m: Math.floor(diff / 6e4) % 60,
      s: Math.floor(diff / 1e3) % 60
    };
    for (const [k, v] of Object.entries(parts)) {
      $(`[data-cd="${k}"]`).textContent = k === 'd' ? v : String(v).padStart(2, '0');
      $(`[data-cd-label="${k}"]`).textContent = plural('cd.' + k, v);
    }
  }
  setInterval(renderCountdown, 1000);

  /* ───────────── Calendar ───────────── */

  const toUTC = iso => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const LOCATION = 'Kościół Chrześcijan Baptystów, Fryderyka Chopina 55, 67-200 Głogów, Poland';

  function updateCalendarLink() {
    const p = new URLSearchParams({
      action: 'TEMPLATE',
      text: t('cal.title'),
      dates: `${toUTC(CFG.weddingStart)}/${toUTC(CFG.weddingEnd)}`,
      details: t('cal.details'),
      location: LOCATION
    });
    $('#cal-google').href = 'https://calendar.google.com/calendar/render?' + p;
  }

  $('#cal-ics').addEventListener('click', () => {
    const esc = s => s.replace(/[\\,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//stephanie-jakub//wedding//EN', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:wedding-2027-06-05@stephanie-jakub',
      'DTSTAMP:' + toUTC(new Date().toISOString()),
      'DTSTART:' + toUTC(CFG.weddingStart),
      'DTEND:' + toUTC(CFG.weddingEnd),
      'SUMMARY:' + esc(t('cal.title')),
      'DESCRIPTION:' + esc(t('cal.details')),
      'LOCATION:' + esc(LOCATION),
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'stephanie-jakub-wedding.ics' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  /* ───────────── RSVP form ───────────── */

  const form = $('#rsvp-form');
  const groups = { yes: $('#g-yes'), no: $('#g-no') };
  const email = $('#f-email');
  const submitBtn = $('#submit');
  const shownErrors = new Map(); // element id → i18n key, so errors re-translate on language switch
  let lastReply = null;

  if (!CFG.rsvpEndpoint) $('#demo-note').hidden = false;

  const attending = () => form.elements.attending.value;

  function setOpen(group, open) {
    group.dataset.open = String(open);
    // Keep collapsed fields out of the tab order.
    $$('input, textarea, button', group).forEach(el => { el.tabIndex = open ? 0 : -1; });
  }
  setOpen(groups.yes, false);
  setOpen(groups.no, false);

  form.addEventListener('change', e => {
    if (e.target.name !== 'attending') return;
    const v = attending();
    setOpen(groups.yes, v === 'yes');
    setOpen(groups.no, v === 'no');
    email.required = v === 'yes';
    showError('e-attending', null);
    if (v === 'yes') burst(e.target.closest('.choice__opt'));
  });

  $$('.chip--toggle').forEach(chip => chip.addEventListener('click', () => {
    chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true'));
  }));

  function showError(id, key) {
    const el = $('#' + id);
    if (key) shownErrors.set(id, key); else shownErrors.delete(id);
    el.textContent = key ? t(key) : '';
    const field = el.closest('.field');
    if (field) field.classList.toggle('has-error', !!key);
  }
  function refreshErrors() {
    shownErrors.forEach((key, id) => { $('#' + id).textContent = t(key); });
  }

  $('#f-name').addEventListener('input', () => showError('e-name', null));
  email.addEventListener('input', () => showError('e-email', null));

  function validate() {
    let firstBad = null;
    const flag = (id, key, focusEl) => { showError(id, key); if (key && !firstBad) firstBad = focusEl; };

    const name = $('#f-name').value.trim();
    flag('e-name', name.length < 2 ? 'err.name' : null, $('#f-name'));
    flag('e-attending', attending() ? null : 'err.attending', form.querySelector('[name=attending]'));
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim());
    flag('e-email', attending() === 'yes' && !emailOk ? 'err.email' : null, email);

    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    showError('e-form', null);
    if (!validate()) return;

    const yes = attending() === 'yes';
    const payload = {
      lang,
      name: $('#f-name').value.trim(),
      attending: attending(),
      email: yes ? email.value.trim() : '',
      diet: yes ? $$('.chip--toggle[aria-pressed="true"]').map(c => c.dataset.diet) : [],
      allergies: yes ? $('#f-allergies').value.trim() : '',
      notes: yes ? $('#f-notes').value.trim() : '',
      message: yes ? '' : $('#f-message').value.trim(),
      website: $('#f-website').value // honeypot
    };

    submitBtn.disabled = true;
    submitBtn.classList.add('is-loading');
    $('.btn__label', submitBtn).textContent = t('rsvp.sending');

    try {
      if (CFG.rsvpEndpoint) {
        // text/plain keeps this a "simple" CORS request, which Apps Script accepts without a preflight.
        const res = await fetch(CFG.rsvpEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || res.status);
      } else {
        await new Promise(r => setTimeout(r, 600));
        console.info('[RSVP preview] would send:', payload);
      }
      lastReply = { name: payload.name.split(/\s+/)[0], attending: payload.attending };
      renderThanks(lastReply);
      form.hidden = true;
      $('#thanks').hidden = false;
      $('#thanks').focus({ preventScroll: true });
      $('#thanks').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      celebrate(yes);
    } catch (err) {
      console.error(err);
      showError('e-form', 'err.network');
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove('is-loading');
      $('.btn__label', submitBtn).textContent = t('rsvp.submit');
    }
  });

  function renderThanks({ name, attending }) {
    const k = attending === 'yes' ? 'yes' : 'no';
    $('#thanks-title').textContent = t(`thanks.${k}Title`);
    $('#thanks-body').textContent = t(`thanks.${k}Body`, { name });
    $('#thanks').dataset.kind = k;
  }

  $('#again').addEventListener('click', () => {
    form.reset();
    $$('.chip--toggle').forEach(c => c.setAttribute('aria-pressed', 'false'));
    setOpen(groups.yes, false);
    setOpen(groups.no, false);
    email.required = false;
    lastReply = null;
    $('#thanks').hidden = true;
    form.hidden = false;
    $('#f-name').focus();
  });

  /* ───────────── Speak Polish phrases ───────────── */

  if ('speechSynthesis' in window) {
    $$('.say').forEach(btn => btn.addEventListener('click', () => {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(btn.dataset.say);
      u.lang = 'pl-PL';
      u.rate = 0.85;
      const pl = speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith('pl'));
      if (pl) u.voice = pl;
      speechSynthesis.speak(u);
      btn.classList.add('is-speaking');
      u.onend = u.onerror = () => btn.classList.remove('is-speaking');
    }));
  } else {
    $$('.say').forEach(b => { b.disabled = true; });
  }

  /* ───────────── Scroll: depth, nav, reveal ───────────── */

  const root = document.documentElement;
  const nav = $('#nav');
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const max = Math.max(1, root.scrollHeight - innerHeight);
      root.style.setProperty('--depth', Math.min(1, scrollY / max).toFixed(3));
      nav.classList.toggle('is-scrolled', scrollY > 40);
      ticking = false;
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    $$('.reveal').forEach(el => io.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('is-in'));
  }

  /* ───────────── Bubbles ───────────── */

  const canvas = $('#bubbles');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  const bubbles = [];
  const pops = [];

  function resize() {
    DPR = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  const ambientCount = () => Math.round(Math.min(40, (W * H) / 38000));

  function makeBubble(x, y, r, burstVy) {
    return {
      x, y, r,
      vy: burstVy ?? -(0.25 + Math.random() * 0.55) * (1 + r / 14),
      phase: Math.random() * Math.PI * 2,
      wobble: 0.3 + Math.random() * 0.8,
      alpha: 0.35 + Math.random() * 0.4
    };
  }
  function spawnAmbient(anywhere) {
    const r = 2 + Math.random() ** 2 * 14;
    bubbles.push(makeBubble(Math.random() * W, anywhere ? Math.random() * H : H + r + Math.random() * 40, r));
  }

  function drawBubble(b) {
    ctx.globalAlpha = b.alpha;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fill();
    ctx.lineWidth = Math.max(0.8, b.r / 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();
    if (b.r > 4) {
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.28, Math.PI * 1.1, Math.PI * 1.75);
      ctx.lineWidth = Math.max(1, b.r / 6);
      ctx.stroke();
    }
  }

  /* Fish schools: simple boids that cruise across the screen and scatter from the pointer. */

  const pointer = { x: -9999, y: -9999 };
  const schools = [];
  const rnd = Math.random;

  function makeSchool(far, onScreen) {
    const dir = rnd() < 0.5 ? 1 : -1;
    const n = Math.round((far ? 14 : 9) * (W < 700 ? 0.6 : 1));
    const y = H * (0.15 + rnd() * 0.7);
    const x0 = onScreen ? W * (0.2 + rnd() * 0.6) : dir > 0 ? -60 : W + 60;
    const s = {
      dir, far, y,
      size: far ? 13 + rnd() * 3 : 22 + rnd() * 6,
      speed: far ? 0.5 + rnd() * 0.2 : 0.85 + rnd() * 0.3,
      color: far ? 'rgba(38,82,96,0.17)' : 'rgba(30,70,84,0.3)',
      tx: x0, drift: rnd() * 100, fish: []
    };
    for (let i = 0; i < n; i++) {
      s.fish.push({
        x: x0 - dir * rnd() * 110, y: y + (rnd() - 0.5) * 60,
        vx: dir * s.speed, vy: 0, phase: rnd() * 6.3, scale: 0.8 + rnd() * 0.4
      });
    }
    return s;
  }

  function updateSchool(s, dt) {
    s.tx += s.dir * s.speed * dt;
    s.drift += 0.005 * dt;
    const ty = s.y + Math.sin(s.drift) * 50;
    const n = s.fish.length;
    let cx = 0, cy = 0, avx = 0, avy = 0;
    for (const f of s.fish) { cx += f.x; cy += f.y; avx += f.vx; avy += f.vy; }
    cx /= n; cy /= n; avx /= n; avy /= n;
    const sep = s.size * 2.2;
    const maxV = s.speed * 3, minV = s.speed * 0.6;

    for (const f of s.fish) {
      let ax = (s.tx - f.x) * 0.0005 + (cx - f.x) * 0.0015 + (avx - f.vx) * 0.04;
      let ay = (ty - f.y) * 0.0008 + (cy - f.y) * 0.0015 + (avy - f.vy) * 0.04;
      for (const g of s.fish) {
        if (g === f) continue;
        const dx = f.x - g.x, dy = f.y - g.y, d = Math.hypot(dx, dy);
        if (d > 0 && d < sep) { ax += dx / d * (1 - d / sep) * 0.12; ay += dy / d * (1 - d / sep) * 0.12; }
      }
      const px = f.x - pointer.x, py = f.y - pointer.y, pd = Math.hypot(px, py);
      if (pd < 140 && pd > 0) { const k = (1 - pd / 140) * 0.7; ax += px / pd * k; ay += py / pd * k; }

      f.vx += ax * dt; f.vy += ay * dt;
      const v = Math.hypot(f.vx, f.vy) || 1;
      if (v > maxV) { f.vx *= maxV / v; f.vy *= maxV / v; }
      else if (v < minV) { f.vx *= minV / v; f.vy *= minV / v; }
      f.x += f.vx * dt; f.y += f.vy * dt;
      f.phase += (0.12 + v * 0.1) * dt;
    }
  }

  const schoolGone = s => s.fish.every(f => s.dir > 0 ? f.x > W + 60 : f.x < -60);

  function drawFish(f, s) {
    const L = s.size * f.scale;
    const a = Math.atan2(f.vy, f.vx);
    const w = Math.sin(f.phase) * L * 0.09;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(a);
    if (Math.cos(a) < 0) ctx.scale(1, -1); // keep the dorsal fin on top
    ctx.beginPath();
    ctx.moveTo(L * 0.5, 0);
    ctx.bezierCurveTo(L * 0.35, -L * 0.21, -L * 0.1, -L * 0.2, -L * 0.3, -L * 0.04 + w * 0.4);
    ctx.lineTo(-L * 0.52, -L * 0.19 + w);
    ctx.quadraticCurveTo(-L * 0.43, w * 0.8, -L * 0.52, L * 0.19 + w);
    ctx.lineTo(-L * 0.3, L * 0.04 + w * 0.4);
    ctx.bezierCurveTo(-L * 0.1, L * 0.2, L * 0.35, L * 0.21, L * 0.5, 0);
    if (!s.far) { // dorsal and pelvic fins
      ctx.moveTo(L * 0.08, -L * 0.17); ctx.lineTo(-L * 0.12, -L * 0.3); ctx.lineTo(-L * 0.16, -L * 0.14);
      ctx.moveTo(L * 0.02, L * 0.16); ctx.lineTo(-L * 0.08, L * 0.25); ctx.lineTo(-L * 0.1, L * 0.14);
    }
    ctx.fill();
    ctx.restore();
  }

  function drawSchools(dt) {
    ctx.globalAlpha = 1;
    for (let i = 0; i < schools.length; i++) {
      const s = schools[i];
      updateSchool(s, dt);
      ctx.fillStyle = s.color;
      for (const f of s.fish) drawFish(f, s);
      if (schoolGone(s)) schools[i] = makeSchool(s.far, false);
    }
  }

  /* Jellyfish: pulse to swim upward, drift with a slow tilt, nudged away by the pointer. */

  const jellies = [];

  function makeJelly(far, onScreen) {
    const size = far ? 22 + rnd() * 10 : 36 + rnd() * 18;
    return {
      far, size,
      x: W * (0.05 + rnd() * 0.9),
      y: onScreen ? H * (0.2 + rnd() * 0.8) : H + size * 3,
      vx: 0, vy: 0,
      tilt: (rnd() - 0.5) * 0.5,
      wander: rnd() * 100,
      phase: rnd() * 6.3,
      rate: 0.022 + rnd() * 0.012,
      color: far ? 'rgba(38,82,96,0.14)' : 'rgba(30,70,84,0.24)'
    };
  }

  function updateJelly(j, dt) {
    j.phase += j.rate * dt;
    j.wander += 0.003 * dt;
    j.tilt += Math.sin(j.wander) * 0.002 * dt;
    j.tilt = Math.max(-0.6, Math.min(0.6, j.tilt));
    const thrust = Math.max(0, Math.cos(j.phase)) * (j.far ? 0.012 : 0.018); // push on each contraction
    j.vx += Math.sin(j.tilt) * thrust * dt;
    j.vy += (-Math.cos(j.tilt) * thrust + 0.002) * dt; // slight sink between pulses
    const px = j.x - pointer.x, py = j.y - pointer.y, pd = Math.hypot(px, py);
    if (pd < 160 && pd > 0) { const k = (1 - pd / 160) * 0.05; j.vx += px / pd * k * dt; j.vy += py / pd * k * dt; }
    const drag = Math.pow(0.97, dt);
    j.vx *= drag; j.vy *= drag;
    j.x += j.vx * dt; j.y += j.vy * dt;
  }

  function drawJelly(j) {
    const c = (1 + Math.sin(j.phase)) / 2; // 0 relaxed … 1 contracted
    const rx = j.size * 0.5 * (1 - 0.16 * c);
    const ry = j.size * 0.42 * (1 + 0.14 * c);
    ctx.save();
    ctx.translate(j.x, j.y);
    ctx.rotate(j.tilt);
    ctx.fillStyle = ctx.strokeStyle = j.color;

    // Bell with a scalloped rim
    ctx.beginPath();
    ctx.moveTo(-rx, 0);
    ctx.bezierCurveTo(-rx, -ry * 1.35, rx, -ry * 1.35, rx, 0);
    const lobes = 6;
    for (let k = lobes; k > 0; k--) {
      const x1 = -rx + (2 * rx * k) / lobes, x0 = -rx + (2 * rx * (k - 1)) / lobes;
      ctx.quadraticCurveTo((x0 + x1) / 2, ry * 0.18, x0, 0);
    }
    ctx.fill();

    // Trailing tentacles and frilly oral arms
    ctx.lineCap = 'round';
    const t = j.phase;
    const strand = (x0, len, width, amp, seed) => {
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x0, ry * 0.05);
      for (let y = 0; y <= len; y += 4) {
        ctx.lineTo(x0 * (1 - 0.15 * y / len) + Math.sin(t * 1.3 - y * 0.06 + seed) * amp * (y / len), y);
      }
      ctx.stroke();
    };
    for (let i = 0; i < 5; i++) {
      strand(-rx * 0.8 + (1.6 * rx * i) / 4, j.size * (1.4 + 0.25 * Math.sin(i * 2.1)), Math.max(0.8, j.size * 0.03), j.size * 0.14, i);
    }
    strand(-rx * 0.15, j.size * 0.9, j.size * 0.08, j.size * 0.08, 7);
    strand(rx * 0.15, j.size * 0.8, j.size * 0.08, j.size * 0.08, 9);
    ctx.restore();
  }

  function drawJellies(dt) {
    for (let i = 0; i < jellies.length; i++) {
      const j = jellies[i];
      updateJelly(j, dt);
      drawJelly(j);
      const out = j.y < -j.size * 3 || j.x < -j.size * 2 || j.x > W + j.size * 2;
      if (out) jellies[i] = makeJelly(j.far, false);
    }
  }

  let last = performance.now();
  let running = true;
  function frame(now) {
    const dt = Math.min(3, (now - last) / 16.67);
    last = now;
    ctx.clearRect(0, 0, W, H);
    drawJellies(dt);
    drawSchools(dt);

    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.phase += 0.02 * dt;
      b.y += b.vy * dt;
      if (b.vy < -0.3 && b.burst) b.vy *= 0.985; // burst bubbles slow down to cruising speed
      b.x += Math.sin(b.phase) * b.wobble * 0.4 * dt;
      if (b.y < -b.r - 10) { bubbles.splice(i, 1); continue; }
      drawBubble(b);
    }
    while (bubbles.filter(b => !b.burst).length < ambientCount()) spawnAmbient(false);

    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      p.t += 0.06 * dt;
      if (p.t >= 1) { pops.splice(i, 1); continue; }
      ctx.globalAlpha = (1 - p.t) * 0.9;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + p.spin;
        const r1 = p.r * (1 + p.t * 0.6), r2 = p.r * (1.2 + p.t * 1.3);
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1);
        ctx.lineTo(p.x + Math.cos(a) * r2, p.y + Math.sin(a) * r2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    if (running) requestAnimationFrame(frame);
  }

  function spawnAt(x, y, n = 7) {
    for (let k = 0; k < n; k++) {
      const b = makeBubble(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 20,
        2 + Math.random() * 9, -(1.5 + Math.random() * 2.5));
      b.burst = true;
      b.alpha = 0.7;
      bubbles.push(b);
    }
  }

  // Burst from an element's centre (used on "yes" and on success).
  function burst(el, n = 14) {
    if (reduceMotion || !el) return;
    const r = el.getBoundingClientRect();
    spawnAt(r.left + r.width / 2, r.top + r.height / 2, n);
  }

  function celebrate(yes) {
    if (reduceMotion) return;
    burst($('#thanks'), yes ? 40 : 12);
  }

  if (!reduceMotion) {
    resize();
    for (let i = 0; i < ambientCount(); i++) spawnAmbient(true);
    schools.push(makeSchool(true, true), makeSchool(false, true));
    if (W > 900) schools.push(makeSchool(true, false), makeSchool(false, false));
    schools.sort((a, b) => b.far - a.far); // far schools drawn first
    jellies.push(makeJelly(true, true), makeJelly(false, true));
    if (W > 900) jellies.push(makeJelly(true, true), makeJelly(false, false));
    jellies.sort((a, b) => b.far - a.far);

    addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { pointer.x = pointer.y = -9999; });
    addEventListener('resize', resize);
    requestAnimationFrame(frame);

    document.addEventListener('visibilitychange', () => {
      running = !document.hidden;
      if (running) { last = performance.now(); requestAnimationFrame(frame); }
    });

    // Tap anywhere that isn't a control: pop the bubble under your finger, or blow new ones.
    document.addEventListener('pointerdown', e => {
      pointer.x = e.clientX; pointer.y = e.clientY;
      if (e.pointerType !== 'mouse') setTimeout(() => { pointer.x = pointer.y = -9999; }, 700);
      if (e.target.closest('input, textarea, select, button, a, label, .card--form')) return;
      const hit = bubbles.findIndex(b => Math.hypot(b.x - e.clientX, b.y - e.clientY) < b.r + 8);
      if (hit > -1) {
        const b = bubbles.splice(hit, 1)[0];
        pops.push({ x: b.x, y: b.y, r: Math.max(6, b.r), t: 0, spin: Math.random() });
      } else {
        spawnAt(e.clientX, e.clientY);
      }
    }, { passive: true });
  } else {
    canvas.remove();
  }

  /* ───────────── Go ───────────── */
  applyLang(lang);
})();
