// Ground vehicles as small engraved cut-outs, drawn in navy ink on paper, side view, facing right.
// The plane is a 3D model (art/airplane.glb); these ride trains, buses, cars, ferries and walks.
const INK = '#1d2a4a', CARD = '#fbfaf5', RED = '#b8322a';
const W = 120, H = 60; // drawn at 2x; shown about 34 px tall

const draw = {
  train(g) { // a locomotive and one carriage on rails
    g.beginPath(); g.moveTo(4, 47); g.lineTo(116, 47); g.stroke();
    body(g, 6, 18, 52, 24, 3); body(g, 62, 14, 52, 28, 3, true);
    for (let x = 12; x < 52; x += 10) win(g, x, 22, 6, 7);
    for (let x = 70; x < 98; x += 9) win(g, x, 19, 6, 7);
    g.beginPath(); g.moveTo(108, 14); g.quadraticCurveTo(116, 18, 116, 32); g.lineTo(108, 32); g.closePath(); g.stroke();
    stripe(g, 6, 34, 108);
    for (const x of [14, 46, 70, 104]) wheel(g, x, 44, 4);
  },
  bus(g) {
    g.beginPath(); g.moveTo(4, 50); g.lineTo(116, 50); g.stroke();
    body(g, 10, 14, 100, 30, 6);
    for (let x = 18; x < 94; x += 13) win(g, x, 19, 10, 10);
    win(g, 98, 19, 9, 15); stripe(g, 10, 34, 100);
    for (const x of [28, 92]) wheel(g, x, 44, 6);
  },
  coach(g) { draw.bus(g); },
  car(g) {
    g.beginPath(); g.moveTo(8, 50); g.lineTo(112, 50); g.stroke();
    g.beginPath(); g.moveTo(14, 42); g.lineTo(14, 32); g.quadraticCurveTo(16, 28, 30, 27); g.lineTo(44, 16); g.lineTo(78, 16);
    g.lineTo(92, 27); g.quadraticCurveTo(106, 28, 108, 34); g.lineTo(108, 42); g.closePath(); fillStroke(g);
    win(g, 48, 19, 13, 8); win(g, 64, 19, 13, 8); hatch(g, 16, 33, 90, 7);
    for (const x of [32, 90]) wheel(g, x, 43, 7);
  },
  taxi(g) { draw.car(g); g.fillStyle = INK; g.fillRect(56, 10, 12, 5); },
  ferry(g) {
    g.beginPath(); g.moveTo(2, 50); for (let x = 2; x <= 118; x += 8) g.quadraticCurveTo(x + 2, 47, x + 4, 50), g.quadraticCurveTo(x + 6, 53, x + 8, 50); g.stroke();
    g.beginPath(); g.moveTo(6, 30); g.lineTo(114, 30); g.lineTo(104, 46); g.lineTo(14, 46); g.closePath(); fillStroke(g); hatch(g, 16, 38, 86, 7);
    body(g, 24, 14, 70, 16, 2); for (let x = 30; x < 88; x += 9) win(g, x, 18, 5, 5);
    body(g, 60, 4, 12, 10, 1); g.fillStyle = RED; g.fillRect(60, 4, 12, 4);
  },
  walk(g) {
    g.beginPath(); g.arc(60, 12, 6, 0, 7); fillStroke(g);
    g.beginPath(); g.moveTo(60, 18); g.lineTo(58, 36); g.moveTo(58, 36); g.lineTo(50, 52); g.moveTo(58, 36); g.lineTo(68, 52);
    g.moveTo(59, 24); g.lineTo(50, 32); g.moveTo(59, 24); g.lineTo(69, 30); g.stroke();
  },
};
draw.mixed = draw.bus;

function fillStroke(g) { g.fillStyle = CARD; g.fill(); g.stroke(); }
function body(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); fillStroke(g); }
function win(g, x, y, w, h) { g.fillStyle = 'rgba(29,42,74,.18)'; g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h); }
function stripe(g, x, y, w) { g.fillStyle = RED; g.fillRect(x + 1, y, w - 2, 3); }
function wheel(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = CARD; g.fill(); g.stroke(); g.beginPath(); g.arc(x, y, r * .3, 0, 7); g.fillStyle = INK; g.fill(); }
// Engraver's shading: fine diagonal lines.
function hatch(g, x, y, w, h) { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.lineWidth = .8; g.globalAlpha = .45;
  for (let i = -h; i < w; i += 3) { g.beginPath(); g.moveTo(x + i, y + h); g.lineTo(x + i + h, y); g.stroke(); } g.restore(); }

const cache = {};
// A deck.gl icon for a mode. left: mirror it, so it faces left.
export function vehicleIcon(mode, left = false) {
  const key = (draw[mode] ? mode : 'mixed') + (left ? '-l' : '');
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.lineWidth = 1.8; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round';
  if (left) { g.translate(W, 0); g.scale(-1, 1); }
  // A paper halo, so the cut-out reads on any ground.
  g.shadowColor = 'rgba(248,246,239,.95)'; g.shadowBlur = 0;
  (draw[mode] || draw.mixed)(g);
  return cache[key] = { url: c.toDataURL(), id: key, width: W, height: H, anchorY: H - 6, mask: false };
}

// The same drawing as an <img> for the HUD, for example in a legend or a timeline row.
export function vehicleImg(mode, h = 18) { const i = vehicleIcon(mode); return `<img src="${i.url}" alt="${mode}" style="height:${h}px;width:auto;vertical-align:middle">`; }
