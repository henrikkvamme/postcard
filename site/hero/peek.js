// The peek: a small card that floats above a way tile while the mouse is on it (or the keyboard's focus). It
// shows the way's vehicle as a live paper model (the kit's art/3d) at a three-quarter view that sways a little,
// over ground that slides under it: rails and ties, a road, the strokes of a calm sea, or clouds under a plane.
// A way through the night shows at dusk, with stars. Under the model: the kind, the carrier, the times and the fare.
// A phone has no hover, so it never shows there. three.js loads only when a card with tiles first shows.
const HOVER = matchMedia('(hover: hover) and (pointer: fine)');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ART = '/kit/art/3d/';
const INK = '#1d2a4a', PAPER = '#f4f2ea';
const BY_MODE = { train: 'train-hs', bus: 'coach', coach: 'coach', car: 'car', taxi: 'taxi', ferry: 'ferry', plane: 'plane' };
const W = 280, H = 150;

let index = {};
const indexP = fetch(ART + 'index.json').then((r) => r.ok ? r.json() : []).then((l) => { index = Object.fromEntries(l.map((m) => [m.name, m])); }).catch(() => {});
let threeP = null;
const loadThree = () => threeP ??= Promise.all([import('three'), import('three/addons/loaders/GLTFLoader.js')]).then(([T3, { GLTFLoader }]) => ({ T3, loader: new GLTFLoader() }));
// Warm up only after the page has loaded, the browser is idle and the mouse has moved, so three.js and the
// models never compete with the first paint and the chart.
let warmGate = null;
const gate = () => Promise.all([
  new Promise((r) => document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true })),
  new Promise((r) => addEventListener('pointermove', r, { once: true, passive: true })),
]).then(() => new Promise((r) => (window.requestIdleCallback || setTimeout)(r, { timeout: 2000 })));
const glbs = new Map();
const loadModel = (name) => { if (!glbs.has(name)) glbs.set(name, loadThree().then(({ loader }) => loader.loadAsync(ART + name + '.glb')).then((g) => g.scene)); return glbs.get(name); };

// The model for a way: the segment's own vehicle, else a night train for a train through the night, else by mode.
export function modelOf(j, night) {
  const s = j.segments.reduce((a, b) => (b.b - b.a > a.b - a.a ? b : a));
  return [s.vehicle, s.mode === 'train' && night && 'train-night', BY_MODE[s.mode]].find((n) => n && (index[n] || !Object.keys(index).length)) || 'train-hs';
}
const groundOf = (name) => name === 'plane' ? 'sky' : name.startsWith('train') ? 'rail' : name === 'ferry' ? 'sea' : 'road';

export function createPeek(host = document.body) {
  const pv = document.createElement('div');
  pv.className = 'pk'; pv.setAttribute('aria-hidden', 'true');
  pv.innerHTML = '<div class="pk-in"><div class="pk-3d"><i class="pk-stars"></i><span class="pk-k"></span></div><div class="pk-t"></div></div>';
  host.append(pv);
  let view = null, viewP = null;

  function makeView() {
    return viewP ??= loadThree().then(({ T3 }) => {
      const renderer = new T3.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(W, H);
      renderer.outputColorSpace = T3.SRGBColorSpace;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = T3.PCFSoftShadowMap;
      pv.querySelector('.pk-3d').prepend(renderer.domElement);
      const scene = new T3.Scene(), camera = new T3.PerspectiveCamera(24, W / H, .1, 100);
      const sun = new T3.DirectionalLight(0xffffff, 1.2);
      sun.position.set(1.2, 9, 2.2); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 6; sun.shadow.bias = -.0004;
      Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 24 }); sun.shadow.camera.updateProjectionMatrix();
      const fill = new T3.HemisphereLight(0xffffff, 0xd8d2c0, .0); scene.add(sun, fill);
      const rig = new T3.Group(); scene.add(rig);
      const floorMat = new T3.ShadowMaterial({ color: new T3.Color(INK), opacity: .13 });
      const floor = new T3.Mesh(new T3.PlaneGeometry(18, 18), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; rig.add(floor);
      const tex = (w, h, paint) => { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); return new T3.CanvasTexture(c); };
      const shade = tex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(29,42,74,.30)'); r.addColorStop(.55, 'rgba(29,42,74,.12)'); r.addColorStop(1, 'rgba(29,42,74,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
      const blobMat = new T3.MeshBasicMaterial({ map: shade, transparent: true, depthWrite: false });
      const blob = new T3.Mesh(new T3.PlaneGeometry(1, 1), blobMat); blob.rotation.x = -Math.PI / 2; blob.position.y = .003; rig.add(blob);
      // A long line is clear at both ends (an alpha map runs along its length).
      const ramp = tex(256, 1, (g) => { const r = g.createLinearGradient(0, 0, 256, 0); r.addColorStop(0, '#000'); r.addColorStop(.3, '#fff'); r.addColorStop(.7, '#fff'); r.addColorStop(1, '#000'); g.fillStyle = r; g.fillRect(0, 0, 256, 1); });
      // A cloud: a few soft white puffs in one sprite.
      const puff = tex(128, 64, (g) => { for (const [x, y, r] of [[40, 38, 22], [64, 30, 28], [90, 38, 20], [64, 42, 24]]) {
        const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, 'rgba(255,255,255,.95)'); q.addColorStop(.6, 'rgba(255,255,255,.7)'); q.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = q; g.fillRect(0, 0, 128, 64); } });
      const ground = new T3.Group(), holder = new T3.Group(), bob = new T3.Group();
      holder.add(bob); rig.add(ground, holder);
      view = { T3, renderer, scene, camera, rig, blob, blobMat, floorMat, fill, ramp, puff, ground, holder, bob, name: null, kind: null, night: null, movers: [], speed: 1, t0: 0, raf: 0 };
      return view;
    });
  }

  // The ground that slides under the vehicle. Lines are ink by day and paper at night.
  function buildGround(kind, w, night) {
    const v = view, { T3 } = v;
    if (v.kind === kind && v.night === night && Math.abs(v.w - w) < 1e-3) return;
    v.ground.clear(); v.movers = []; v.kind = kind; v.w = w; v.night = night;
    const col = new T3.Color(night ? PAPER : INK);
    const flat = (lx, lz, o, long) => {
      const m = new T3.Mesh(new T3.PlaneGeometry(lx, lz), new T3.MeshBasicMaterial({ color: col, transparent: true, opacity: o, depthWrite: false, alphaMap: long ? v.ramp : null }));
      m.rotation.x = -Math.PI / 2; m.position.y = .005; v.ground.add(m); return m;
    };
    const move = (m, o) => v.movers.push({ m, o, x0: m.position.x });
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    if (kind === 'rail') {
      for (const f of [-.3, .3]) flat(8, .03, .6, true).position.z = f * w;
      for (let x = -5; x < 5; x += .3) { const t = flat(.06, w * .9, .45); t.position.x = x; move(t, .45); }
      v.speed = 1.9;
    } else if (kind === 'road') {
      for (const f of [-.85, .85]) flat(8, .025, .45, true).position.z = f * w;
      for (let x = -5; x < 5; x += .75) { const d = flat(.36, .04, .55); d.position.x = x; move(d, .55); }
      v.speed = 1.5;
    } else if (kind === 'sea') {
      for (let n = 0; n < 40; n++) { const d = flat(.14 + rnd() * .4, .02, .4); d.position.set(-5 + rnd() * 10, .005, (rnd() * 2 - 1) * 2.6); move(d, .2 + rnd() * .3); }
      v.speed = .55;
    } else {
      // Sky: clouds drift by under the plane, some near, some far below, and a few thin wind strokes.
      for (let n = 0; n < 9; n++) {
        const s = new T3.Sprite(new T3.SpriteMaterial({ map: v.puff, transparent: true, depthWrite: false, opacity: night ? .28 : .9, color: night ? 0xc9cde0 : 0xffffff }));
        const k = .9 + rnd() * 1.3; s.scale.set(k * 2, k, 1); s.position.set(-5 + rnd() * 10, .15 + rnd() * .5, (rnd() * 2 - 1) * 2.4); v.ground.add(s); move(s, s.material.opacity);
      }
      for (let n = 0; n < 14; n++) { const d = flat(.4 + rnd() * .6, .015, .22); d.position.set(-5 + rnd() * 10, .005, (rnd() * 2 - 1) * 2.6); move(d, .22); }
      v.speed = 2.4;
    }
  }

  const REF = { x: 4.7, y: 1.7, z: 1.4 }, LIFT = 1.1;
  function setModel(name, src, night) {
    const v = view, { T3 } = v, kind = groundOf(name);
    v.floorMat.opacity = night ? .3 : .13; v.blobMat.opacity = night ? .7 : 1;
    v.fill.intensity = night ? .55 : 0; v.fill.color.set(night ? 0x9fb0e0 : 0xffffff);
    if (v.name !== name) {
      v.bob.clear(); v.name = name;
      const m = src.clone(true);
      m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      // The nose is +x. Its length follows its real length, compressed, so a coach reads as a coach next to a train.
      let box = new T3.Box3().setFromObject(m); const s0 = box.getSize(new T3.Vector3()), L = Math.max(s0.x, s0.z);
      m.scale.setScalar(4 * Math.pow(L / 33, .45) / L);
      box = new T3.Box3().setFromObject(m); const c = box.getCenter(new T3.Vector3());
      m.position.set(-c.x, -box.min.y, -c.z);
      v.bob.add(m); v.size = box.getSize(new T3.Vector3());
    }
    const size = v.size, lift = kind === 'sky' ? LIFT : 0;
    v.holder.position.y = lift;
    // A plane's shade on the paper is wider and softer, far below it.
    v.blob.scale.set(size.x * (lift ? 1.6 : 1.25), size.z * (lift ? 1.4 : 2.6), 1);
    buildGround(kind, size.z, night);
    const box = { x: size.x, y: size.y + lift, z: size.z };
    fitCamera(box.x > REF.x || box.y > REF.y || box.z > REF.z ? box : REF);
  }
  // The camera looks down 21 degrees at the middle of the box and steps back until its corners fit, at every angle of the sway.
  const SWAY0 = -.62, SWAY = 12 * Math.PI / 180, SWAY_S = 7;
  function fitCamera(size) {
    const v = view, { T3 } = v, el = 21 * Math.PI / 180, aimAt = new T3.Vector3(0, size.y / 2, 0), dir = new T3.Vector3(0, Math.sin(el), Math.cos(el));
    const hx = size.x / 2, hz = size.z / 2, corners = [];
    for (const a of [SWAY0 - SWAY, SWAY0, SWAY0 + SWAY]) for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, size.y + .04]) {
      const x = sx * hx, z = sz * hz; corners.push(new T3.Vector3(x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)));
    }
    const fits = (d) => { v.camera.position.copy(aimAt).addScaledVector(dir, d); v.camera.lookAt(aimAt); v.camera.updateMatrixWorld();
      return corners.every((q) => { const p = q.clone().project(v.camera); return Math.abs(p.x) <= .82 && Math.abs(p.y) <= .82 && p.z < 1; }); };
    let lo = .5, hi = 60; for (let n = 0; n < 24; n++) { const mid = (lo + hi) / 2; fits(mid) ? hi = mid : lo = mid; } fits(hi);
  }
  const fadeEnds = (x) => { const a = Math.abs(x); return a < 2.2 ? 1 : a > 4 ? 0 : 1 - (a - 2.2) / 1.8; };
  let live = false;
  function frame(now) {
    const v = view; if (!v) return;
    const t = (now - v.t0) / 1000, still = REDUCED;
    v.rig.rotation.y = SWAY0 + (still ? 0 : SWAY * Math.sin(t * Math.PI * 2 / SWAY_S));
    for (const mv of v.movers) { const x = still ? mv.x0 : ((mv.x0 - t * v.speed + 5) % 10 + 10) % 10 - 5;
      mv.m.position.x = x; mv.m.material.opacity = mv.o * fadeEnds(x); }
    const b = v.bob;
    // A ferry rocks on the swell, a coach or a car hums on the road, and a plane rides the air with a slow bank.
    if (still) { b.position.y = 0; b.rotation.set(0, 0, 0); }
    else if (v.kind === 'sea') { b.position.y = Math.sin(t * 1.6) * .03; b.rotation.set(Math.sin(t * 1.1) * .035, 0, Math.sin(t * .8 + 1) * .02); }
    else if (v.kind === 'road') { b.position.y = (Math.sin(t * 9) + 1) * .004; b.rotation.set(0, 0, 0); }
    else if (v.kind === 'sky') { b.position.y = Math.sin(t * 1.3) * .06; b.rotation.set(Math.sin(t * .7) * .06, 0, Math.sin(t * .9 + .5) * .025); }
    else { b.position.y = 0; b.rotation.set(0, 0, 0); }
    v.renderer.render(v.scene, v.camera);
    v.raf = live && !still ? requestAnimationFrame(frame) : 0;
  }

  // The card stands above its tile, centred on it and inside the window. With no room above, it stands beside
  // the box that holds the tile (the trip card), level with the tile, so it never covers the other ways.
  function place(el, jump) {
    const r = el.getBoundingClientRect(), h = pv.offsetHeight || 240, box = (el.closest('.ty-ui') || el).getBoundingClientRect();
    const above = r.top - 12 - h;
    let x, y;
    if (above >= 8) { x = r.left + r.width / 2 - W / 2; y = above; pv.classList.remove('side'); }
    else { x = box.right + 16; y = r.top + r.height / 2 - h / 2; pv.classList.add('side'); }
    x = Math.round(Math.max(12, Math.min(innerWidth - W - 12, x))); y = Math.round(Math.max(8, Math.min(innerHeight - h - 8, y)));
    if (jump) pv.classList.add('jump');
    pv.style.setProperty('--x', x + 'px'); pv.style.setProperty('--y', y + 'px');
    if (jump) { void pv.offsetWidth; pv.classList.remove('jump'); }
  }
  let forKey = null, hideT = 0, stopT = 0;
  // info: { key, kind, title, lines: [html], night }
  async function show(el, j, info, keyboard = false) {
    if (!HOVER.matches && !keyboard) return;
    clearTimeout(hideT); clearTimeout(stopT);
    const fresh = !pv.classList.contains('on');
    forKey = info.key;
    pv.classList.toggle('night', !!info.night);
    pv.querySelector('.pk-k').textContent = info.kind;
    pv.querySelector('.pk-t').innerHTML = `<b>${info.title}</b>${info.lines.map((l) => `<span>${l}</span>`).join('')}`;
    if (fresh) pv.classList.remove('ready');
    pv.classList.add('on');
    place(el, fresh);
    await indexP;
    const name = modelOf(j, info.night);
    const [src] = await Promise.all([loadModel(name), makeView()]).catch(() => []);
    if (forKey !== info.key || !src) return;
    if (fresh || !live) view.t0 = performance.now();
    setModel(name, src, !!info.night);
    pv.classList.add('ready'); live = true;
    if (!view.raf) view.raf = requestAnimationFrame(frame);
  }
  // A short wait before the card goes, so moving from one tile to the next does not flash it.
  function hide(now = false) {
    forKey = null; clearTimeout(hideT);
    const off = () => { pv.classList.remove('on'); clearTimeout(stopT); stopT = setTimeout(() => { if (!pv.classList.contains('on')) live = false; }, 260); };
    if (now) off(); else hideT = setTimeout(off, 90);
  }
  // Load three.js, the viewer and the models of the ways on show, so a hover shows at once.
  async function warm(ways, nightOf = () => false) {
    if (!HOVER.matches) return;
    await (warmGate ??= gate()); await indexP; makeView().catch(() => {});
    for (const j of ways) loadModel(modelOf(j, nightOf(j))).catch(() => {});
  }
  return { show, hide, warm, get key() { return forKey; } };
}
