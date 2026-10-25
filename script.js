(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = (n) => String(n).padStart(2, '0');
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const smooth = (v) => v * v * (3 - 2 * v);
  const mod = (a, n) => ((a % n) + n) % n;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
  };

  // Hallway doors, in walking order. Each opens the matching classic section.
  const ROOMS = [
    { id: 'experience', title: 'Experience', line: 'Three jobs, one support desk.', icon: 'W' },
    { id: 'about', title: 'About', line: 'Who is behind the headset.', icon: 'A' },
    { id: 'skills', title: 'Skills', line: 'The tools on the desk.', icon: 'S' },
    { id: 'languages', title: 'Languages', line: 'Four ways to say hello.', icon: 'L' },
    { id: 'education', title: 'Education', line: 'The paper trail, pinned up.', icon: 'E' },
    { id: 'contact', title: 'Contact', line: 'Knock, and say hello.', icon: 'C' },
  ];
  const N = ROOMS.length;

  // ================= SOUND =================
  const soundBtn = $('#soundBtn');
  let soundOn = store.get('yd-sound') === '1';
  let actx = null;

  function audio() {
    if (!soundOn) return null;
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, dur, { type = 'sine', vol = 0.05, when = 0, to = null } = {}) {
    const a = audio();
    if (!a) return;
    const t = a.currentTime + when;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function noise(dur, { freq = 800, to = null, q = 1, vol = 0.06, when = 0 } = {}) {
    const a = audio();
    if (!a) return;
    const t = a.currentTime + when;
    const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(a.destination);
    src.start(t);
  }
  const sfx = {
    tick() { tone(1200, 0.04, { type: 'triangle', vol: 0.02 }); },
    step() { tone(130, 0.16, { vol: 0.07, to: 70 }); noise(0.12, { freq: 300, vol: 0.03 }); },
    shutter() { noise(0.55, { freq: 900, to: 2600, q: 0.7, vol: 0.07 }); },
    whoosh() { noise(0.8, { freq: 300, to: 1500, q: 0.6, vol: 0.06 }); },
    door() { tone(210, 0.7, { type: 'sawtooth', vol: 0.015, to: 140 }); noise(0.25, { freq: 500, vol: 0.04, when: 0.05 }); },
    room() { tone(660, 0.2, { type: 'triangle', vol: 0.04 }); tone(990, 0.35, { type: 'triangle', vol: 0.035, when: 0.1 }); },
  };

  function paintSound() {
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    soundBtn.setAttribute('aria-label', soundOn ? 'Turn sound off' : 'Turn sound on');
    $('.sound-label', soundBtn).textContent = soundOn ? 'Sound on' : 'Sound off';
  }
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    store.set('yd-sound', soundOn ? '1' : '0');
    paintSound();
    sfx.room();
  });
  paintSound();

  // ================= CURSOR =================
  const cursor = $('#cursor');
  if (matchMedia('(pointer: fine)').matches && !reduced) {
    root.classList.add('custom-cursor');
    let x = -100, y = -100, hot = false, queued = false;
    const paint = () => {
      queued = false;
      cursor.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${hot ? 1.25 : 1}) rotate(${hot ? -8 : 0}deg)`;
      cursor.style.setProperty('--cursor-fill', hot ? '#ff4d1c' : '#f4f1ea');
    };
    window.addEventListener('pointermove', (e) => {
      x = e.clientX;
      y = e.clientY;
      hot = !!e.target.closest?.('a, button, [role="button"], .hot');
      if (!queued) { queued = true; requestAnimationFrame(paint); }
    }, { passive: true });
    document.addEventListener('mouseleave', () => { x = y = -100; paint(); });
  }

  // ================= VIEW (walk-through vs classic) =================
  const viewBtn = $('#viewBtn');
  const explorerText = $('#explorerText');
  let view = store.get('yd-view') || (reduced ? 'classic' : 'hall');

  function applyView() {
    root.dataset.view = view;
    viewBtn.textContent = view === 'hall' ? 'Classic view' : 'Walk-through view';
    explorerText.textContent = view === 'hall'
      ? 'Scroll, press the down arrow or click the door to walk into the house. The window jumps to About, the mailbox to Contact.'
      : 'Click the door to see my work. The window opens About, the mailbox opens Contact.';
  }
  viewBtn.addEventListener('click', () => {
    if (hallActive) exitHall();
    view = view === 'hall' ? 'classic' : 'hall';
    store.set('yd-view', view);
    applyView();
    window.scrollTo({ top: 0, behavior: 'instant' });
    sfx.tick();
  });
  applyView();

  // ================= REVEALS =================
  ['.skills', '.langs', '.certs', '.stats', '.chips'].forEach((sel) => {
    $$(sel).forEach((list) => [...list.children].forEach((c, i) => c.style.setProperty('--d', `${(i % 6) * 0.07}s`)));
  });

  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      revealIO.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  const sketchIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('on');
      sketchIO.unobserve(e.target);
    });
  }, { threshold: 0.3 });

  function startReveals() {
    $$('#classic .reveal').forEach((el) => revealIO.observe(el));
    $$('#classic .sketch').forEach((el) => sketchIO.observe(el));
  }

  // Experience "Details" toggles (also work inside cloned rooms)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-details]');
    if (!btn) return;
    const details = btn.closest('.sheet-body').querySelector('.details');
    const open = details.hidden;
    details.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Close －' : 'Details ＋';
    sfx.tick();
  });

  // ================= INTRO / LOADER =================
  const intro = $('#intro');
  let landed = false;

  function startLanding() {
    if (landed) return;
    landed = true;
    document.body.classList.add('ready');
    $$('.hero .sketch').forEach((s, i) => setTimeout(() => s.classList.add('on'), 150 + i * 120));
    startReveals();
  }

  if (reduced) {
    intro.remove();
    startLanding();
  } else {
    const bar = $('#introBar');
    const pct = $('#introPct');
    const t0 = performance.now();
    let fontsReady = false;
    let loaded = document.readyState === 'complete';
    let shown = 0;
    let finished = false;

    window.addEventListener('load', () => { loaded = true; });
    const fontLoad = document.fonts?.load ? document.fonts.load('190px "Anton"') : Promise.resolve();
    Promise.race([fontLoad, new Promise((r) => setTimeout(r, 1500))]).then(() => {
      fontsReady = true;
      intro.classList.add('go');
    });

    const finish = () => {
      if (finished) return;
      finished = true;
      bar.style.width = '100%';
      pct.textContent = '100';
      setTimeout(() => {
        intro.classList.add('out');
        setTimeout(startLanding, 180);
        setTimeout(() => intro.remove(), 900);
      }, 260);
    };

    const tick = (now) => {
      if (finished) return;
      const elapsed = now - t0;
      const cap = !fontsReady ? 45 : loaded ? 100 : 88;
      const target = Math.min(cap, (elapsed / 2300) * 100);
      shown += (target - shown) * 0.14;
      if (target >= 100 && shown > 99.4) shown = 100;
      bar.style.width = `${shown}%`;
      pct.textContent = String(Math.round(shown)).padStart(3, '0');
      if (shown >= 100 || elapsed > 7000) return finish();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    intro.addEventListener('click', finish);
  }

  // ================= HALLWAY =================
  const hall = $('#hall');
  const persp = $('.hall-persp', hall);
  const world = $('#hallWorld');
  const entrance = $('#entrance');
  const card = $('#hallCard');
  const segs = [];

  const DOOR_SVG = '<svg viewBox="0 0 100 200" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="#111" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="14" width="72" height="74"/><rect x="19" y="19" width="62" height="64" stroke-width="1.2"/><rect x="14" y="108" width="72" height="78"/><rect x="19" y="113" width="62" height="68" stroke-width="1.2"/><path d="M22 80l14-14M22 70l8-8M22 60l4-4M22 178l20-22M22 166l12-14M22 154l6-6" stroke-width=".8" opacity=".5"/><circle cx="84" cy="102" r="5" fill="#ff4d1c"/></g></svg>';
  const LAMP_SVG = '<svg viewBox="0 0 100 130" aria-hidden="true"><g fill="none" stroke="#111" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M50 0v52"/><path d="M22 98q0-46 28-46t28 46z" fill="#fffdf8"/><circle cx="50" cy="104" r="9" fill="#ff4d1c"/><path d="M30 122l-8 6M50 124v6M70 122l8 6" stroke="#ff4d1c"/></g></svg>';
  const TABLE_SVG = '<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 56h84M14 56v44M86 56v44M14 74h72"/><path d="M50 56V36M50 46l-12-8M50 42l12-10M50 38v-14"/><path d="M42 56l2-8h12l2 8" fill="#fffdf8"/></g></svg>';
  const FRAMES = [
    '<path d="M14 70l22-26 16 16 14-12 20 22"/><circle cx="70" cy="30" r="7" fill="#ff4d1c"/>',
    '<path d="M30 62q0-32 20-32t20 32"/><rect x="24" y="56" width="10" height="16" rx="3" fill="#fffdf8"/><rect x="66" y="56" width="10" height="16" rx="3" fill="#fffdf8"/><path d="M74 70q-2 10-14 10" stroke="#ff4d1c"/>',
    '<path d="M22 30h56v30H44l-12 10V60H22z" fill="#fffdf8"/><path d="M32 42h36M32 50h20" stroke-width="2"/>',
    '<path d="M50 18l9 20 22 2-17 14 5 22-19-12-19 12 5-22-17-14 22-2z" fill="#ff4d1c"/>',
    '<rect x="28" y="22" width="44" height="56" fill="#fffdf8"/><path d="M36 36h28M36 46h28M36 56h16" stroke-width="2"/><path d="M50 64l6 6 12-12" stroke="#ff4d1c"/>',
    '<circle cx="50" cy="50" r="26" fill="#fffdf8"/><path d="M50 50V32M50 50l12 8"/>',
  ];
  const frameSVG = (v) => `<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="#111" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="88" height="88" fill="#fffdf8" stroke-width="5"/>${FRAMES[v % FRAMES.length]}</g></svg>`;
  const arrowSVG = (flip) => `<svg viewBox="0 0 100 40" aria-hidden="true"><g fill="none" stroke="#ff4d1c" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"${flip ? ' transform="translate(100 0) scale(-1 1)"' : ''}><path d="M4 22q40-14 86-2M70 4l22 16-20 16"/></g></svg>`;

  const div = (cls, html = '') => {
    const d = document.createElement('div');
    d.className = cls;
    d.innerHTML = html;
    return d;
  };

  ROOMS.forEach((r, n) => {
    const side = n % 2 === 0 ? -1 : 1; // which wall this door slides toward
    const seg = div('seg');
    const floor = div('floor', '<div class="rug"></div><div class="shade-x"></div>');
    const ceil = div('ceil');
    const walls = [-1, 1].map((e) => {
      const w = div('wall', `<div class="hatch"></div><div class="shade-y"></div><div class="frame">${frameSVG(e === -1 ? n : n + 3)}</div><div class="vent" style="${e === -1 ? 'left' : 'right'}:10%"></div>`);
      if (e === side) {
        const arrow = div('arrow', arrowSVG(e === 1));
        arrow.style[e === -1 ? 'right' : 'left'] = '12%';
        w.append(arrow);
      } else {
        w.append(div('table', TABLE_SVG));
      }
      w.dataset.side = e;
      return w;
    });
    const lamp = div('lamp', `<span class="glow"></span>${LAMP_SVG}`);
    const door = div('door3d', `<div class="tag">${r.title}</div><div class="dshadow"></div><div class="dframe"></div><div class="dglow"></div>`);
    const panel = div('panel', `<div class="wood"></div><div class="light"></div>${DOOR_SVG}<span class="num">${pad(n + 1)}</span>`);
    panel.setAttribute('role', 'button');
    panel.setAttribute('aria-label', `Door ${n + 1}: ${r.title}`);
    panel.style.transformOrigin = side === -1 ? '0% 50%' : '100% 50%';
    if (side === 1) $('svg', panel).style.transform = 'scaleX(-1)';
    panel.addEventListener('click', () => {
      if (locked) return;
      if (mod(Math.round(T), N) === n && Math.abs(p - Math.round(p)) < 0.05) openDoor();
      else goToRoom(n);
    });
    door.append(panel);
    seg.append(floor, ceil, ...walls, lamp, door);
    world.append(seg);
    segs.push({ seg, floor, ceil, walls, lamp, door, panel, side, rug: $('.rug', floor), tag: $('.tag', door), num: $('.num', panel) });
  });

  // floating dust
  const motes = $('#motes');
  for (let i = 0; i < 18; i++) {
    const m = document.createElement('span');
    const size = 2 + Math.random() * 3;
    m.className = 'mote';
    m.style.cssText = `left:${20 + Math.random() * 60}%;top:${15 + Math.random() * 60}%;width:${size}px;height:${size}px;--dx:${(Math.random() - 0.5) * 80}px;--dy:${-20 - Math.random() * 60}px;--dur:${6 + Math.random() * 6}s;--delay:${-Math.random() * 8}s`;
    motes.append(m);
  }

  // HUD: dots + map
  const dots = $('#hallDots');
  const mapList = $('#mapList');
  ROOMS.forEach((r, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" aria-label="Go to door ${i + 1}: ${r.title}"><span></span></button>`;
    li.firstChild.addEventListener('click', () => goToRoom(i));
    dots.append(li);
    const mi = document.createElement('li');
    mi.innerHTML = `<button type="button"><span class="mi">${r.icon}</span><span>${pad(i + 1)} ${r.title}</span></button>`;
    mi.firstChild.addEventListener('click', () => { toggleMap(false); goToRoom(i); });
    mapList.append(mi);
  });
  const mapBtn = $('#mapBtn');
  const doorMap = $('#doorMap');
  function toggleMap(force) {
    const open = force ?? doorMap.hidden;
    doorMap.hidden = !open;
    mapBtn.setAttribute('aria-expanded', String(open));
  }
  mapBtn.addEventListener('click', () => { toggleMap(); sfx.tick(); });
  document.addEventListener('click', (e) => {
    if (!doorMap.hidden && !e.target.closest('.map-wrap')) toggleMap(false);
  });

  // geometry (in px, derived from the viewport like a camera rig)
  let G;
  function layout() {
    const w = innerWidth;
    const h = innerHeight;
    G = { D: 0.62 * h, HW: Math.max(0.62 * w, 0.35 * h), FH: 0.27 * h, CH: 0.42 * h, Hd: 0.48 * h, Wd: Math.min(0.24 * h, 0.5 * w), P: 1.1 * h };
    const { D, HW, FH, CH, Hd, Wd, P } = G;
    persp.style.perspective = `${P}px`;
    segs.forEach((s) => {
      Object.assign(s.floor.style, { width: `${2 * HW}px`, height: `${D}px`, left: `${-HW}px`, top: `${-D / 2}px`, transform: `translate3d(0,${FH}px,${D / 2}px) rotateX(90deg)` });
      s.floor.style.setProperty('--plank', `${D / 5}px`);
      s.floor.style.setProperty('--board', `${(2 * HW) / 16}px`);
      Object.assign(s.rug.style, { width: `${1.7 * Wd}px`, left: `calc(50% - ${0.85 * Wd}px)` });
      Object.assign(s.ceil.style, { width: `${2 * HW}px`, height: `${D}px`, left: `${-HW}px`, top: `${-D / 2}px`, transform: `translate3d(0,${-CH}px,${D / 2}px) rotateX(-90deg)` });
      s.walls.forEach((w) => {
        const e = Number(w.dataset.side);
        Object.assign(w.style, { width: `${D}px`, height: `${FH + CH}px`, left: `${-D / 2}px`, top: `${-(FH + CH) / 2}px`, transform: `translate3d(${e * HW}px,${(FH - CH) / 2}px,${D / 2}px) rotateY(${-90 * e}deg)` });
        $('.frame', w).style.height = `${0.38 * D * (100 / 120)}px`;
      });
      Object.assign(s.lamp.style, { width: `${0.3 * Wd}px`, height: `${0.39 * Wd}px`, left: `${-0.15 * Wd}px`, top: `${-CH}px`, transform: `translate3d(0,0,${D / 2}px)` });
      Object.assign(s.door.style, { left: `${-Wd / 2}px`, top: `${FH - Hd}px`, width: `${Wd}px`, height: `${Hd}px` });
      s.tag.style.fontSize = `${0.17 * Wd}px`;
      s.num.style.fontSize = `${0.34 * Wd}px`;
    });
    render();
  }

  // motion state: p = position along the hall (1 unit = 1 door)
  let p = 0, T = 0, V = 0, raf = 0, last = 0;
  let hallActive = false, roomOpen = false, locked = false;
  let opening = null, openV = 0, doorBase = 0, blockUntil = 0;
  let hudCur = -1, hudStill = null;

  function render() {
    if (!G) return;
    const { D, HW } = G;
    const amp = reduced ? 0 : 2.6 * clamp(Math.abs(V) / 2.5);
    world.style.transform = amp > 0.05
      ? `translate3d(${Math.sin(p * Math.PI * 3) * amp * 0.7}px,${Math.sin(p * Math.PI * 6) * amp}px,0) rotate(${Math.sin(p * Math.PI * 3) * amp * 0.03}deg)`
      : '';

    segs.forEach((s, n) => {
      const i = mod(n - p + 1, N) - 1;
      const fade = clamp((4.2 - i) / 1.4);
      const o = clamp((i + 0.9) / 0.5) * fade;
      if (o < 0.01) { s.seg.style.visibility = 'hidden'; return; }
      s.seg.style.visibility = 'visible';
      s.seg.style.transform = `translate3d(0,0,${-i * D}px)`;
      s.seg.style.setProperty('--o', o.toFixed(3));

      const u = i >= 0 ? smooth(clamp(i / 1.6)) : smooth(clamp(-i / 0.8));
      let m = s.side * HW * (0.55 + 0.4 * u);
      let rot = -s.side * (35 + 55 * u);
      if (opening === n) { m *= 1 - openV; rot *= 1 - openV; }
      s.door.style.transform = `translate3d(${m}px,0,0) rotateY(${rot}deg)`;
      s.door.style.setProperty('--o', (clamp((i + 0.85) / 0.4) * fade).toFixed(3));
    });

    // while a door is opening the camera moves past it, so keep the HUD on that door
    const cur = opening ?? mod(Math.round(p), N);
    const still = opening !== null || Math.abs(p - Math.round(p)) < 0.04;
    if (cur !== hudCur || still !== hudStill) {
      hudCur = cur;
      hudStill = still;
      const r = ROOMS[cur];
      $('#hallCount').textContent = `${pad(cur + 1)} / ${pad(N)}`;
      $$('button', dots).forEach((b, i) => {
        if (i === cur) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      });
      $$('button', mapList).forEach((b, i) => {
        if (i === cur) b.setAttribute('aria-current', 'location'); else b.removeAttribute('aria-current');
        const here = $('.here', b);
        if (i === cur && !here) b.insertAdjacentHTML('beforeend', '<span class="here">You are here</span>');
        if (i !== cur && here) here.remove();
      });
      $('#hallKicker').textContent = `Door ${pad(cur + 1)} of ${pad(N)}`;
      $('#hallTitle').textContent = r.title;
      $('#hallLine').textContent = r.line;
      card.classList.toggle('moving', !still);
      $('#hallLive').textContent = still ? `Door ${cur + 1} of ${N}: ${r.title}. ${r.line}` : '';
    }
  }

  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    const a = T - p;
    if (Math.abs(a) < 8e-4 && Math.abs(V) < 0.01) {
      p = T;
      V = 0;
      raf = 0;
      render();
      return;
    }
    V += (100 * a - 15.6 * V) * dt; // spring toward the target door
    p += V * dt;
    render();
    raf = requestAnimationFrame(frame);
  }
  function goTo(t) {
    T = t;
    if (reduced) { p = T; render(); return; }
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function step(dir) {
    if (locked || performance.now() < blockUntil) return;
    T = dir > 0 ? Math.floor(T + 0.001) + 1 : Math.ceil(T - 0.001) - 1;
    goTo(T);
    sfx.step();
  }
  function goToRoom(n) {
    if (locked) return;
    const t = Math.round(T);
    T = t + mod(n - t + N / 2, N) - N / 2;
    goTo(T);
    sfx.step();
  }

  function tween(from, to, ms, onUpdate) {
    if (reduced || ms === 0) { onUpdate(to); return; }
    const start = performance.now();
    const run = (now) => {
      const k = clamp((now - start) / ms);
      onUpdate(from + (to - from) * smooth(k));
      if (k < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  }

  function openDoor() {
    if (locked || roomOpen) return;
    locked = true;
    doorBase = Math.round(T);
    goTo(doorBase);
    const n = mod(doorBase, N);
    opening = n;
    const s = segs[n];
    s.panel.style.transform = `translateZ(2px) rotateY(${105 * s.side}deg)`;
    sfx.door();
    tween(0, 1, 500, (v) => { openV = v; render(); });
    setTimeout(() => goTo(doorBase + 0.85), reduced ? 0 : 450);
    setTimeout(() => showRoom(n), reduced ? 0 : 1050);
  }

  // ================= ROOMS =================
  const room = $('#room');
  const roomBody = $('#roomBody');
  const roomBack = $('#roomBack');

  function showRoom(n) {
    const r = ROOMS[n];
    const src = $(`#sec-${r.id}`);
    const clone = src.cloneNode(true);
    clone.removeAttribute('id');
    $$('[id]', clone).forEach((x) => x.removeAttribute('id'));
    [clone, ...$$('.reveal, .rise', clone)].forEach((x) => x.classList.remove('in'));
    $$('.sketch', clone).forEach((x) => x.classList.remove('on'));
    roomBody.replaceChildren(clone);
    room.setAttribute('aria-label', `${r.title} room`);
    $('#roomLabel').textContent = `Door ${pad(n + 1)}/${pad(N)} · ${r.title}`;
    room.hidden = false;
    room.scrollTop = 0;
    roomOpen = true;
    hall.inert = true;
    sfx.room();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      room.classList.add('show');
      [clone, ...$$('.reveal, .rise', clone)].forEach((x) => x.classList.add('in'));
      setTimeout(() => $$('.sketch', clone).forEach((x) => x.classList.add('on')), 200);
    }));
    roomBack.focus({ preventScroll: true });
  }

  function closeRoom(instant = false) {
    if (!roomOpen) return;
    roomOpen = false;
    room.classList.remove('show');
    const s = segs[opening];
    setTimeout(() => { room.hidden = true; roomBody.replaceChildren(); }, instant ? 0 : 450);
    if (s) s.panel.style.transform = 'translateZ(2px)';
    hall.inert = !hallActive;
    goTo(doorBase);
    const finish = () => { opening = null; openV = 0; locked = false; render(); $('#openDoorBtn').focus({ preventScroll: true }); };
    if (instant) { finish(); return; }
    setTimeout(() => tween(1, 0, 400, (v) => { openV = v; render(); }), 700);
    setTimeout(finish, 1200);
  }
  roomBack.addEventListener('click', () => closeRoom());

  // ================= ENTER / EXIT =================
  const doorBtn = $('#doorBtn');

  function enterHall(index = 0, openAfter = false) {
    if (hallActive) return;
    hallActive = true;
    toggleMap(false);
    root.classList.add('in-hall');
    entrance.classList.add('leaving');
    hall.classList.add('active');
    hall.inert = false;
    hall.setAttribute('aria-hidden', 'false');
    locked = false;
    blockUntil = performance.now() + 700;
    V = 0;
    p = reduced ? index : index - 0.9;
    T = index;
    hudCur = -1;
    render();
    goTo(index);
    sfx.whoosh();
    if (openAfter) setTimeout(openDoor, reduced ? 0 : 900);
    else setTimeout(() => $('#openDoorBtn').focus({ preventScroll: true }), 700);
  }

  function exitHall() {
    if (!hallActive) return;
    if (roomOpen) closeRoom(true);
    hallActive = false;
    toggleMap(false);
    hall.classList.remove('active');
    hall.inert = true;
    hall.setAttribute('aria-hidden', 'true');
    entrance.classList.remove('leaving');
    root.classList.remove('in-hall');
    setTimeout(() => doorBtn.classList.remove('lift'), 400);
  }
  $('#hallExit').addEventListener('click', exitHall);
  $('#openDoorBtn').addEventListener('click', openDoor);
  $('#nextDoorBtn').addEventListener('click', () => step(1));
  $('#prevDoorBtn').addEventListener('click', () => step(-1));

  // landing hotspots
  const scrollToSec = (id) => $(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  doorBtn.addEventListener('click', () => {
    if (view !== 'hall') return scrollToSec('#sec-experience');
    if (hallActive) return;
    doorBtn.classList.add('lift');
    sfx.shutter();
    setTimeout(() => enterHall(0), reduced ? 0 : 480);
  });
  $('#windowBtn').addEventListener('click', () => (view === 'hall' ? enterHall(1, true) : scrollToSec('#sec-about')));
  $('#mailBtn').addEventListener('click', () => (view === 'hall' ? enterHall(5, true) : scrollToSec('#sec-contact')));
  $$('.hot').forEach((h) => h.addEventListener('pointerenter', sfx.tick));
  const scene = $('#scene');
  $('#mailBtn').addEventListener('pointerenter', () => scene.classList.add('mail-hover'));
  $('#mailBtn').addEventListener('pointerleave', () => scene.classList.remove('mail-hover'));

  $$('.topnav [data-room]').forEach((a) => a.addEventListener('click', (e) => {
    if (view !== 'hall') return;
    e.preventDefault();
    enterHall(Number(a.dataset.room), true);
  }));
  $('.topnav .brand').addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });

  // ================= INPUT =================
  const atBottom = () => window.scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
  const wheel = { acc: 0, t: 0, lastStep: 0 };

  window.addEventListener('wheel', (e) => {
    if (!landed || view !== 'hall') return;
    if (!hallActive) {
      if (e.deltaY > 12 && atBottom()) enterHall(0);
      return;
    }
    if (roomOpen || e.ctrlKey) return;
    e.preventDefault();
    const now = performance.now();
    if (now - wheel.t > 200) wheel.acc = 0;
    wheel.t = now;
    wheel.acc += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    if (Math.abs(wheel.acc) > 40 && now - wheel.lastStep > 380) {
      step(Math.sign(wheel.acc));
      wheel.acc = 0;
      wheel.lastStep = now;
    }
  }, { passive: false });

  let touchY = null;
  window.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
  hall.addEventListener('touchmove', (e) => { if (!roomOpen) e.preventDefault(); }, { passive: false });
  window.addEventListener('touchend', (e) => {
    if (touchY === null || !landed || view !== 'hall' || roomOpen) return;
    const dy = touchY - e.changedTouches[0].clientY;
    touchY = null;
    if (!hallActive) { if (dy > 50 && atBottom()) enterHall(0); return; }
    if (Math.abs(dy) > 40) step(dy > 0 ? 1 : -1);
  }, { passive: true });

  window.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || !landed) return;
    const onControl = e.target.closest?.('a, button, input, textarea, select');
    if (roomOpen) {
      if (e.key === 'Escape') closeRoom();
      return;
    }
    if (hallActive) {
      if (e.key === 'Escape') { toggleMap(false); return; }
      let dir = 0;
      if (['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key)) dir = 1;
      else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) dir = -1;
      else if (e.key === ' ' && !onControl) dir = e.shiftKey ? -1 : 1;
      else if (e.key === 'Enter' && !onControl) { e.preventDefault(); openDoor(); return; }
      if (dir) { e.preventDefault(); step(dir); }
      return;
    }
    if (view === 'hall' && ['ArrowDown', 'PageDown'].includes(e.key) && atBottom()) {
      e.preventDefault();
      enterHall(0);
    }
  });

  window.addEventListener('resize', layout);
  layout();
})();
