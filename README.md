const express = require('express'), http = require('http'), { Server } = require('socket.io');
const app = express();
const fs = require('fs'), path = require('path');
const PUB = path.join(__dirname, 'public');
const INDEX = [path.join(PUB, 'index.html'), path.join(__dirname, 'index.html')].find(f => fs.existsSync(f));
console.log('index.html encontrado em:', INDEX || 'NENHUM LUGAR');
app.use(express.static(PUB));
app.get('/health', (q, r) => r.send('ok'));
app.get('/', (q, r) => INDEX ? r.sendFile(INDEX) : r.status(500).send('ERRO: index.html nao encontrado no repositorio. Crie o arquivo public/index.html no GitHub.'));
const srv = http.createServer(app), io = new Server(srv);

// Mapa: [x, y(centro), z, largura, altura, profundidade]
const BOXES = [
  [0, 2, -14, 12, 4, 1], [0, 2, 14, 12, 4, 1], [-14, 2, 0, 1, 4, 12], [14, 2, 0, 1, 4, 12],
  [-6, 0.6, -4, 2, 1.2, 2], [6, 0.6, 4, 2, 1.2, 2], [0, 0.6, 0, 2, 1.2, 2], [-6, 0.6, 6, 2, 1.2, 2], [6, 0.6, -6, 2, 1.2, 2],
  [-22, 2, -22, 8, 4, 1], [22, 2, 22, 8, 4, 1], [22, 2, -22, 1, 4, 8], [-22, 2, 22, 1, 4, 8]
];
const SPAWNS = [[-10, -10], [10, 10], [-10, 10], [10, -10], [0, -20], [0, 20], [-20, 0], [20, 0]];
const LIM = 40, DMG = 25, RATE = 140, RESPAWN = 3000;
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
    cb({ ok: true, code: c, id: sock.id, boxes: BOXES, mode: R.mode, max: R.max, x: P.x, z: P.z, team });
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
    let wall = 80; for (const b of BOXES) { const t = ray(o, d, [b[0], b[1], b[2]], [b[3], b[4], b[5]]); if (t >= 0 && t < wall) wall = t; }
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
