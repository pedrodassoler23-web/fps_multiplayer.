const express = require('express'), http = require('http'), { Server } = require('socket.io');
const app = express();
app.use(express.static(__dirname + '/public'));
app.get('/health', (q, r) => r.send('ok'));
const srv = http.createServer(app), io = new Server(srv);

// =====================================================================
//  MAPA (160 x 160, de -80 a +80)
//  BOXES  = colisão + bloqueia tiros:  [x, y(centro), z, largura, altura, profundidade, tipo, variante]
//  DECOR  = só visual (sem colisão), mesmo formato
//  TREES  = [x, z, escala]   FIRES = [x, y, z, escala]
// =====================================================================
const T = { CRATE: 0, CONC: 1, PLASTER: 2, BRICK: 3, TIN: 4, ROOF: 5, CAR: 6, BARK: 7, CONT: 9, TIRE: 10, ROAD: 11, FLOOR: 12, BARREL: 13, SLAB: 14, ROAD2: 15, HIT: 99 };
const BOXES = [], DECOR = [], TREES = [], FIRES = [], KEEP = [], ROADS = [];
let seed = 20261009;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const ri = (a, b) => a + rnd() * (b - a);
const r2 = n => Math.round(n * 100) / 100;
const box = (x, y, z, w, h, d, t = 0, v = 0) => BOXES.push([x, y, z, w, h, d].map(r2).concat([t, v]));
const deco = (x, y, z, w, h, d, t = 0, v = 0) => DECOR.push([x, y, z, w, h, d].map(r2).concat([t, v]));
const keep = (x, z, w, d) => KEEP.push([x, z, w, d]);
const road = (x, z, w, d, t) => { deco(x, .03, z, w, .06, d, t); ROADS.push([x, z, w, d]); };

const SPAWNS = [[-10, -10], [10, 10], [-10, 10], [10, -10], [0, -20], [0, 20], [-20, 0], [20, 0],
  [-34, -34], [34, 34], [-34, 34], [34, -34], [-46, 0], [46, 0], [0, -46], [0, 46], [-34, 0], [34, 0]];

// parede reta com aberturas. ax: 'x' (comprimento em x) ou 'z'.
// gaps: [deslocamento do centro, largura, 'door'|'gate'|'win', altura mínima, altura máxima]
function wall(ax, cx, cz, len, h, th, type, gaps = []) {
  gaps = gaps.slice().sort((a, b) => a[0] - b[0]);
  const put = (a, b, y0, y1) => {
    if (b - a < .05 || y1 - y0 < .05) return;
    const c = (a + b) / 2, l = b - a, y = (y0 + y1) / 2, hh = y1 - y0;
    ax === 'x' ? box(cx + c, y, cz, l, hh, th, type) : box(cx, y, cz + c, th, hh, l, type);
  };
  const lintel = (a, b, y0, y1) => { const c = (a + b) / 2, l = b - a, y = (y0 + y1) / 2, hh = y1 - y0; ax === 'x' ? deco(cx + c, y, cz, l, hh, th, type) : deco(cx, y, cz + c, th, hh, l, type); };
  let cur = -len / 2;
  for (const [o, w, k, lo = .9, hi = 2.1] of gaps) {
    const a = o - w / 2, b = o + w / 2; put(cur, a, 0, h);
    if (k === 'win') { put(a, b, 0, lo); put(a, b, hi, h); } else lintel(a, b, hi, h); // porta/portão: vão livre, só o topo é visual
    cur = b;
  }
  put(cur, len / 2, 0, h);
}

// ---------- casa abandonada ----------
function house(cx, cz, w, d, door) {
  const h = 3.2, th = .4; keep(cx, cz, w + 4, d + 4);
  const sides = { N: ['x', cx, cz - d / 2, w], S: ['x', cx, cz + d / 2, w], W: ['z', cx - w / 2, cz, d - th], E: ['z', cx + w / 2, cz, d - th] };
  const dOff = ri(-1.5, 1.5);
  for (const k in sides) {
    const [ax, x, z, len] = sides[k], g = [];
    if (k === door) g.push([dOff, 1.8, 'door', 0, 2.3]);
    for (const f of len > 8 ? [-.3, .3] : [0]) { const o = f * len; if ((k !== door || Math.abs(o - dOff) > 2.4) && rnd() < .85) g.push([o, 1.4, 'win', .9, 2.1]); }
    wall(ax, x, z, len, h, th, T.PLASTER, g);
  }
  deco(cx, .03, cz, w - .4, .06, d - .4, T.FLOOR);
  // divisória interna nas casas maiores
  if (w >= 9) {
    if (door === 'N' || door === 'S') wall('x', cx, cz + (door === 'N' ? 1 : -1) * d * .12, w - th, h, .3, T.PLASTER, [[ri(-w / 4, w / 4), 1.6, 'door', 0, 2.3]]);
    else wall('z', cx + (door === 'W' ? 1 : -1) * w * .12, cz, d - th, h, .3, T.PLASTER, [[ri(-d / 4, d / 4), 1.6, 'door', 0, 2.3]]);
  }
  // caixa/móvel no fundo
  const sgn = () => rnd() < .5 ? -1 : 1, back = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] }[door];
  box(cx + (back[0] ? back[0] * (w / 2 - 1.1) : sgn() * (w / 2 - 1.1)), .5, cz + (back[1] ? back[1] * (d / 2 - 1.1) : sgn() * (d / 2 - 1.1)), 1.2, 1, 1.2, T.CRATE);
  // telhado (às vezes quebrado)
  if (rnd() < .35) { deco(cx - w / 4 - .2, h + .2, cz, w / 2 + .4, .4, d + .8, T.ROOF); deco(cx - w / 4 - .2, h + .6, cz, w / 2 - 1, .4, d - 1.5, T.ROOF); }
  else { deco(cx, h + .2, cz, w + .8, .4, d + .8, T.ROOF); deco(cx, h + .6, cz, w - 1.5, .4, d - 1.5, T.ROOF); deco(cx, h + 1, cz, w - 4, .4, d - 4, T.ROOF); }
  deco(cx + w / 4, h + 1.6, cz - d / 4, .8, 2.4, .8, T.BRICK); // chaminé
}

// ---------- prédio grande (fábrica / galpão) ----------
function sideGaps(len, gates) {
  const g = gates.map(([o, w]) => [o, w, 'gate', 0, 4.4]);
  for (let o = -len / 2 + 4; o <= len / 2 - 4; o += 5) if (gates.every(([go, gw]) => Math.abs(o - go) > gw / 2 + 1.6)) g.push([o, 2.2, 'win', 3.2, 4.8]);
  return g;
}
function building(cx, cz, w, d, h, th, type, gates) {
  keep(cx, cz, w + 6, d + 6);
  wall('x', cx, cz - d / 2, w, h, th, type, sideGaps(w, gates.N || []));
  wall('x', cx, cz + d / 2, w, h, th, type, sideGaps(w, gates.S || []));
  wall('z', cx - w / 2, cz, d - th, h, th, type, sideGaps(d - th, gates.W || []));
  wall('z', cx + w / 2, cz, d - th, h, th, type, sideGaps(d - th, gates.E || []));
  deco(cx, .03, cz, w - th, .06, d - th, T.SLAB);
}

// ---------- carro, barril, container ----------
function car(x, z, horiz, v, burn) {
  const L = 4.4, Wd = 1.9, l = horiz ? L : Wd, w = horiz ? Wd : L;
  box(x, .8, z, l, 1.6, w, T.HIT);                    // caixa de colisão (invisível)
  deco(x, .55, z, l, .7, w, T.CAR, v);                // carroceria
  const off = -.1 * L;
  deco(horiz ? x + off : x, 1.15, horiz ? z : z + off, horiz ? L * .5 : Wd - .2, .6, horiz ? Wd - .2 : L * .5, T.CAR, v + 1); // cabine
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    deco(horiz ? x + sx * L * .32 : x + sz * Wd / 2, .35, horiz ? z + sz * Wd / 2 : z + sx * L * .32, horiz ? .7 : .3, .7, horiz ? .3 : .7, T.TIRE);
  if (burn) FIRES.push([x, 1.5, z, 1]);
}
function barrel(x, z, v, burn) { box(x, .55, z, .9, 1.1, .9, T.BARREL, v); if (burn) FIRES.push([x, 1.4, z, .7]); }
function cont(x, z, horiz, v, y = 1.45) { box(x, y, z, horiz ? 6.1 : 2.6, 2.9, horiz ? 2.6 : 6.1, T.CONT, v); }

// ================= montagem do mapa =================

// --- arena central (original) ---
[[0, 2, -14, 12, 4, 1], [0, 2, 14, 12, 4, 1], [-14, 2, 0, 1, 4, 12], [14, 2, 0, 1, 4, 12]].forEach(b => box(...b, T.CONC));
[[-6, .6, -4, 2, 1.2, 2], [6, .6, 4, 2, 1.2, 2], [0, .6, 0, 2, 1.2, 2], [-6, .6, 6, 2, 1.2, 2], [6, .6, -6, 2, 1.2, 2]].forEach((b, i) => box(...b, i % 2 ? T.CONT : T.CRATE, i));
[[-22, 2, -22, 8, 4, 1], [22, 2, 22, 8, 4, 1], [22, 2, -22, 1, 4, 8], [-22, 2, 22, 1, 4, 8]].forEach(b => box(...b, T.CONC));
keep(0, 0, 52, 52);

// --- ruas (grade em volta da arena) ---
road(0, 46, 160, 8, T.ROAD); road(0, -46, 160, 8, T.ROAD);
road(-46, 0, 8, 84, T.ROAD2); road(46, 0, 8, 84, T.ROAD2);
for (const sx of [-1, 1]) for (const sz of [-1, 1]) road(sx * 46, sz * 65, 8, 30, T.ROAD2);

// --- casas ---
for (const x of [-34, -17, 0, 17, 34]) { house(x, -60, 9, 8, 'S'); house(x, 60, 9, 8, 'N'); }
house(-72, -62, 9, 8, 'E'); house(-58, -72, 9, 8, 'S'); house(-72, 62, 9, 8, 'E'); house(-58, 72, 9, 8, 'N');

// --- fábrica abandonada (leste) ---
{
  const cx = 65, cz = 0;
  building(cx, cz, 24, 40, 6, .6, T.BRICK, { N: [[0, 5]], S: [[0, 5]], W: [[-10, 5], [10, 5]], E: [[0, 5]] });
  for (let k = 0; ; k++) { const zc = cz - 17 + k * 7; if (zc > cz + 18) break; if ((k + 1) % 3 === 0) continue; deco(cx, 6.15, zc, 25, .3, 5, T.TIN); } // telhado com buracos
  for (const px of [-6, 6]) for (const pz of [-15, -5, 5, 15]) box(cx + px, 3, cz + pz, 1, 6, 1, T.CONC);                                           // pilares
  box(cx + 8, .6, cz - 8, 6, 1.2, 1.5, T.CONT, 1); box(cx - 8, .6, cz + 6, 1.5, 1.2, 6, T.CONT, 2);                                                 // esteiras
  box(cx + 9, 2, cz + 14, 3.4, 4, 3.4, T.CONT, 2); box(cx - 9, 2, cz - 14, 3.4, 4, 3.4, T.CONT, 0);                                                 // tanques
  box(cx - 9, .7, cz - 3, 1.4, 1.4, 1.4, T.CRATE); box(cx + 9, .7, cz + 3, 1.4, 1.4, 1.4, T.CRATE);
  box(62, 11, -26, 3, 22, 3, T.BRICK); keep(62, -26, 5, 5);                                                                                          // chaminé
}

// --- galpão enferrujado (oeste) ---
{
  const cx = -65, cz = 0;
  building(cx, cz, 22, 36, 5, .3, T.TIN, { N: [[0, 5.5]], S: [[0, 5.5]], E: [[-8, 5.5], [8, 5.5]] });
  deco(cx, 5.15, cz - 10, 22.6, .3, 14, T.TIN); deco(cx, 5.15, cz + 11, 22.6, .3, 12, T.TIN);                                                      // telhado com vão
  box(cx - 6, 1.2, cz - 10, 1.4, 2.4, 9, T.CRATE); box(cx - 6, 1.2, cz + 10, 1.4, 2.4, 9, T.CRATE); box(cx + 3, 1.2, cz, 1.4, 2.4, 9, T.CRATE);    // prateleiras
  box(cx - 8, .7, cz + 1, 1.4, 1.4, 1.4, T.CRATE); box(cx + 7, 2, cz - 12, 3.4, 4, 3.4, T.CONT, 1);
}

// --- pátio de containers (nordeste) ---
keep(65, -65, 28, 28);
cont(58, -74, 1, 0); cont(58, -74, 1, 0, 4.35); cont(58, -69.5, 1, 1); cont(58, -65, 1, 2); cont(70, -74, 1, 2); cont(70, -70, 1, 0); cont(75, -60, 0, 1); cont(66, -58, 0, 2);
// --- cemitério de carros (sudeste) ---
keep(65, 65, 28, 28);

// --- carros queimados: [x, z, deitado em x?, cor, pegando fogo?] ---
[[-30, 44, 1, 0, 1], [-8, 48, 1, 1, 0], [15, 44.5, 1, 2, 1], [38, 48, 1, 3, 0], [-60, 44, 1, 1, 1], [62, 48, 1, 2, 0],
 [-40, -44, 1, 0, 1], [-12, -48, 1, 1, 0], [20, -44.5, 1, 2, 1], [-68, -47, 1, 3, 1], [70, -44, 1, 0, 0],
 [-44, -22, 0, 2, 1], [-48, 16, 0, 0, 0], [-45, 32, 0, 1, 1], [44, -30, 0, 1, 0], [48, -10, 0, 0, 1], [45, 26, 0, 2, 0],
 [-30, -12, 1, 3, 0], [30, 12, 1, 1, 1], [12, -34, 0, 2, 0], [-14, 32, 0, 0, 0],
 [56, 57, 1, 0, 1], [67, 56, 1, 1, 0], [57, 63, 1, 2, 0], [68, 62, 1, 3, 1], [58, 69, 1, 0, 0], [69, 68, 1, 1, 1], [75, 75, 0, 2, 0], [75, 59, 0, 3, 0]]
  .forEach(c => car(...c));
// --- barris: [x, z, cor, fogo?] ---
[[52, -24, 0, 1], [52, 26, 1, 0], [79, -12, 2, 0], [-52, 22, 0, 1], [-52, -24, 1, 0], [60, 52, 1, 0], [72, 66, 0, 1], [64, 76, 2, 0]].forEach(b => barrel(...b));

// --- cobertura espalhada (caixotes) ---
function free(x, z, m) {
  if (Math.abs(x) > 77 || Math.abs(z) > 77) return false;
  for (const [kx, kz, kw, kd] of KEEP) if (Math.abs(x - kx) < kw / 2 + m && Math.abs(z - kz) < kd / 2 + m) return false;
  for (const [rx, rz, rw, rd] of ROADS) if (Math.abs(x - rx) < rw / 2 + 1 && Math.abs(z - rz) < rd / 2 + 1) return false;
  for (const b of BOXES) if (Math.abs(x - b[0]) < b[3] / 2 + m && Math.abs(z - b[2]) < b[5] / 2 + m) return false;
  for (const s of SPAWNS) if (Math.hypot(x - s[0], z - s[1]) < 3) return false;
  return true;
}
for (let i = 0, n = 0; i < 600 && n < 28; i++) {
  const x = ri(-76, 76), z = ri(-76, 76); if (!free(x, z, 1.5)) continue;
  box(x, .7, z, 1.4, 1.4, 1.4, T.CRATE); n++;
  if (rnd() < .5 && free(x + 1.5, z, .8)) box(x + 1.5, .7, z, 1.4, 1.4, 1.4, T.CRATE);
}
// --- árvores (tronco tem colisão; copa é visual) ---
for (let i = 0, n = 0; i < 1500 && n < 90; i++) {
  const x = ri(-76, 76), z = ri(-76, 76); if (!free(x, z, 2.2)) continue;
  if (TREES.some(t => Math.hypot(t[0] - x, t[1] - z) < 5)) continue;
  const s = r2(ri(.9, 1.5)); TREES.push([r2(x), r2(z), s]); box(x, 2 * s, z, .7, 4 * s, .7, T.BARK); n++;
}
// --- cerca em volta (visual) ---
// (o cliente desenha; o limite real é LIM)

const LIM = 80, DMG = 25, RATE = 140, RESPAWN = 3000;
const rooms = {};

function ray(o, d, c, s) {
  let a = 0, b = 1e9;
  for (let i = 0; i < 3; i++) {
    const lo = c[i] - s[i] / 2 - o[i], hi = c[i] + s[i] / 2 - o[i];
    if (Math.abs(d[i]) < 1e-9) { if (lo > 0 || hi < 0) return -1; }
    else { let t1 = lo / d[i], t2 = hi / d[i]; if (t1 > t2) [t1, t2] = [t2, t1]; a = Math.max(a, t1); b = Math.min(b, t2); if (a > b) return -1; }
  }
  return a;
}
const code = () => { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s; do { s = ''; for (let i = 0; i < 5; i++) s += A[Math.random() * A.length | 0]; } while (rooms[s]); return s; };
const spawn = () => SPAWNS[Math.random() * SPAWNS.length | 0];

io.on('connection', sock => {
  let R = null, P = null;
  function enter(c, name, cb) {
    R = rooms[c];
    const n = (name || 'Jogador').toString().slice(0, 14);
    const team = R.mode === 'team' ? (Object.values(R.p).filter(p => p.team === 0).length <= Object.values(R.p).filter(p => p.team === 1).length ? 0 : 1) : -1;
    const sp = spawn();
    P = { id: sock.id, name: n, team, x: sp[0], y: 0, z: sp[1], yaw: 0, hp: 100, k: 0, d: 0, last: 0, dead: false };
    R.p[sock.id] = P; sock.join(c);
    cb({ ok: true, code: c, id: sock.id, boxes: BOXES, decor: DECOR, trees: TREES, fires: FIRES, mode: R.mode, max: R.max, x: P.x, z: P.z, team });
  }
  sock.on('create', (o, cb) => {
    const c = code();
    rooms[c] = { p: {}, mode: o.mode === 'team' ? 'team' : 'ffa', max: Math.min(Math.max(+o.max || 4, 2), 8) };
    enter(c, o.name, cb);
  });
  sock.on('join', (o, cb) => {
    const c = (o.code || '').toUpperCase().trim(), r = rooms[c];
    if (!r) return cb({ ok: false, msg: 'Sala não encontrada' });
    if (Object.keys(r.p).length >= r.max) return cb({ ok: false, msg: 'Sala cheia' });
    enter(c, o.name, cb);
  });
  sock.on('state', s => {
    if (!P || P.dead) return;
    P.x = Math.max(-LIM, Math.min(LIM, +s.x || 0)); P.z = Math.max(-LIM, Math.min(LIM, +s.z || 0));
    P.y = Math.max(0, Math.min(6, +s.y || 0)); P.yaw = +s.yaw || 0;
  });
  sock.on('shoot', s => {
    if (!P || P.dead) return;
    const now = Date.now(); if (now - P.last < RATE) return; P.last = now;
    P.x = Math.max(-LIM, Math.min(LIM, +s.x || 0)); P.z = Math.max(-LIM, Math.min(LIM, +s.z || 0)); P.y = Math.max(0, Math.min(6, +s.y || 0));
    const yaw = +s.yaw || 0, pit = Math.max(-1.5, Math.min(1.5, +s.pitch || 0));
    const o = [P.x, P.y + 1.6, P.z], d = [-Math.sin(yaw) * Math.cos(pit), Math.sin(pit), -Math.cos(yaw) * Math.cos(pit)];
    let wall = 150; for (const b of BOXES) { const t = ray(o, d, [b[0], b[1], b[2]], [b[3], b[4], b[5]]); if (t >= 0 && t < wall) wall = t; }
    let best = null, bt = wall;
    for (const q of Object.values(R.p)) {
      if (q === P || q.dead || (R.mode === 'team' && q.team === P.team)) continue;
      const t = ray(o, d, [q.x, q.y + 0.9, q.z], [0.8, 1.8, 0.8]); if (t >= 0 && t < bt) { bt = t; best = q; }
    }
    io.to(P.room || [...sock.rooms][1]).emit('shot', { id: P.id, o, e: [o[0] + d[0] * bt, o[1] + d[1] * bt, o[2] + d[2] * bt] });
    if (best) {
      best.hp -= DMG; io.to(best.id).emit('hurt', best.hp); sock.emit('hitmark');
      if (best.hp <= 0) {
        best.dead = true; best.d++; P.k++;
        const room = [...sock.rooms][1];
        io.to(room).emit('feed', `${P.name} eliminou ${best.name}`);
        setTimeout(() => { if (!R.p[best.id]) return; const sp = spawn(); Object.assign(best, { x: sp[0], z: sp[1], y: 0, hp: 100, dead: false }); io.to(best.id).emit('respawn', { x: sp[0], z: sp[1] }); }, RESPAWN);
      }
    }
  });
  sock.on('disconnect', () => {
    if (!R || !P) return; delete R.p[sock.id];
    const c = Object.keys(rooms).find(k => rooms[k] === R);
    if (!Object.keys(R.p).length) delete rooms[c]; else io.to(c).emit('feed', `${P.name} saiu`);
  });
});

setInterval(() => {
  for (const c in rooms) io.to(c).emit('snap', Object.values(rooms[c].p).map(p => ({ id: p.id, n: p.name, t: p.team, x: p.x, y: p.y, z: p.z, r: p.yaw, hp: p.hp, k: p.k, d: p.d })));
}, 50);

srv.listen(process.env.PORT || 3000, () => console.log('Servidor rodando'));
