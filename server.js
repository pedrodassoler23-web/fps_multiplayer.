const express = require('express'), http = require('http'), { Server } = require('socket.io');
const { MAPS } = require('./maps.js');
const app = express();
app.use(express.static(__dirname + '/public'));
app.get('/health', (q, r) => r.send('ok'));
const srv = http.createServer(app), io = new Server(srv);

// Armas (o servidor é quem manda no dano e na cadência): dano por projétil, ms entre tiros, projéteis, dispersão (rad)
const WPN = [
  { dmg: 25, rate: 160, pel: 1, spread: 0 },      // 0 pistola
  { dmg: 20, rate: 110, pel: 1, spread: .008 },   // 1 fuzil
  { dmg: 14, rate: 75, pel: 1, spread: .015 },    // 2 SMG
  { dmg: 14, rate: 750, pel: 6, spread: .07 },    // 3 escopeta
  { dmg: 90, rate: 1100, pel: 1, spread: 0 }      // 4 sniper
];
const RESPAWN = 3000, MAXD = 120;
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
const num = (v, lo, hi, def = 0) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };
const cleanName = s => (s || 'Jogador').toString().replace(/[<>&"'`]/g, '').trim().slice(0, 14) || 'Jogador';

// nascimento: escolhe entre os pontos do mapa um dos mais distantes dos inimigos vivos (equilibra o início)
function spawnFor(R, me) {
  const sp = MAPS[R.map].spawns, foes = Object.values(R.p).filter(q => q !== me && !q.dead && (R.mode !== 'team' || q.team !== me.team));
  const sc = sp.map(s => ({ s, v: foes.length ? Math.min(...foes.map(q => Math.hypot(q.x - s[0], q.z - s[1]))) : Math.random() * 10 }));
  sc.sort((a, b) => b.v - a.v); return sc[Math.random() * Math.min(3, sc.length) | 0].s;
}

io.on('connection', sock => {
  let R = null, P = null;
  function enter(c, name, cb) {
    R = rooms[c]; const M = MAPS[R.map], all = Object.values(R.p);
    const team = R.mode === 'team' ? (all.filter(p => p.team === 0).length <= all.filter(p => p.team === 1).length ? 0 : 1) : -1;
    P = { id: sock.id, room: c, name: cleanName(name), team, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, c: 0, w: 0, rl: 0, hp: 100, k: 0, d: 0, last: 0, dead: false };
    const sp = spawnFor(R, P); P.x = sp[0]; P.z = sp[1];
    R.p[sock.id] = P; sock.join(c);
    cb({ ok: true, code: c, id: sock.id, mode: R.mode, max: R.max, x: P.x, z: P.z, team, map: R.map, mapName: M.name, theme: M.theme, lim: M.lim, boxes: M.boxes, decor: M.decor, trees: M.trees, fires: M.fires });
  }
  sock.on('create', (o, cb) => {
    if (typeof cb !== 'function') return; o = o || {};
    const c = code();
    rooms[c] = { p: {}, mode: o.mode === 'team' ? 'team' : 'ffa', max: Math.min(Math.max(+o.max || 4, 2), 8), map: MAPS[o.map] ? o.map : 'base' };
    enter(c, o.name, cb);
  });
  sock.on('join', (o, cb) => {
    if (typeof cb !== 'function') return; o = o || {};
    const c = (o.code || '').toString().toUpperCase().trim(), r = rooms[c];
    if (!r) return cb({ ok: false, msg: 'Sala não encontrada' });
    if (Object.keys(r.p).length >= r.max) return cb({ ok: false, msg: 'Sala cheia' });
    enter(c, o.name, cb);
  });
  sock.on('state', s => {
    if (!P || P.dead || !s) return; const L = MAPS[R.map].lim;
    P.x = num(s.x, -L, L); P.z = num(s.z, -L, L); P.y = num(s.y, 0, 8); P.yaw = num(s.yaw, -1e4, 1e4); P.pitch = num(s.pitch, -1.5, 1.5);
    P.c = s.c ? 1 : 0; P.rl = s.rl ? 1 : 0; P.w = num(s.w, 0, WPN.length - 1) | 0;
  });
  sock.on('shoot', s => {
    if (!P || P.dead || !s) return; const w = num(s.w, 0, WPN.length - 1) | 0, W = WPN[w], M = MAPS[R.map], L = M.lim;
    const now = Date.now(); if (now - P.last < W.rate * .85) return; P.last = now;
    P.x = num(s.x, -L, L); P.z = num(s.z, -L, L); P.y = num(s.y, 0, 8); P.c = s.c ? 1 : 0; P.w = w;
    const yaw = num(s.yaw, -1e4, 1e4), pit = num(s.pitch, -1.5, 1.5), o = [P.x, P.y + (P.c ? 1.1 : 1.6), P.z];
    const dmg = new Map(); let tracer = null;
    for (let k = 0; k < W.pel; k++) {
      const yy = yaw + (k ? (Math.random() - .5) * 2 * W.spread : 0) + (W.pel === 1 ? (Math.random() - .5) * 2 * W.spread : 0), pp = pit + (k ? (Math.random() - .5) * 2 * W.spread : 0) + (W.pel === 1 ? (Math.random() - .5) * 2 * W.spread : 0);
      const d = [-Math.sin(yy) * Math.cos(pp), Math.sin(pp), -Math.cos(yy) * Math.cos(pp)];
      let wall = MAXD; for (const b of M.boxes) { const t = ray(o, d, [b[0], b[1], b[2]], [b[3], b[4], b[5]]); if (t >= 0 && t < wall) wall = t; }
      if (wall > 0 && d[1] < -1e-6) { const tg = -o[1] / d[1]; if (tg > 0 && tg < wall) wall = tg; }   // chão
      let best = null, bt = wall;
      for (const q of Object.values(R.p)) {
        if (q === P || q.dead || (R.mode === 'team' && q.team === P.team)) continue;
        const h = q.c ? 1.3 : 1.8, t = ray(o, d, [q.x, q.y + h / 2, q.z], [0.8, h, 0.8]); if (t >= 0 && t < bt) { bt = t; best = q; }
      }
      if (best) dmg.set(best, (dmg.get(best) || 0) + W.dmg);
      if (k === 0) tracer = { e: [o[0] + d[0] * bt, o[1] + d[1] * bt, o[2] + d[2] * bt], h: best ? 1 : 0 };
    }
    io.to(P.room).emit('shot', { id: P.id, o, e: tracer.e, h: tracer.h, w });
    for (const [q, total] of dmg) {
      q.hp -= total; io.to(q.id).emit('hurt', q.hp, P.x, P.z); sock.emit('hitmark');
      if (q.hp <= 0 && !q.dead) {
        q.dead = true; q.d++; P.k++; io.to(P.room).emit('feed', `${P.name} eliminou ${q.name}`);
        setTimeout(() => { if (!R.p[q.id]) return; const sp = spawnFor(R, q); Object.assign(q, { x: sp[0], z: sp[1], y: 0, hp: 100, dead: false, c: 0, rl: 0 }); io.to(q.id).emit('respawn', { x: sp[0], z: sp[1] }); }, RESPAWN);
      }
    }
  });
  sock.on('disconnect', () => {
    if (!R || !P) return; delete R.p[sock.id];
    if (!Object.keys(R.p).length) delete rooms[P.room]; else io.to(P.room).emit('feed', `${P.name} saiu`);
  });
});

setInterval(() => {
  for (const c in rooms) io.to(c).emit('snap', Object.values(rooms[c].p).map(p => ({ id: p.id, n: p.name, t: p.team, x: p.x, y: p.y, z: p.z, r: p.yaw, pt: p.pitch, c: p.c, w: p.w, rl: p.rl, hp: p.hp, k: p.k, d: p.d })));
}, 50);

srv.listen(process.env.PORT || 3000, () => console.log('Servidor rodando'));
