const express = require('express'), http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { Server } = require('socket.io');
const { MAPS } = require('./maps.js');
const app = express();
const PUB = path.join(__dirname, 'public');
app.get('/health', (q, r) => r.send('ok'));
// Entrega o index.html ORIGINAL sem alterar o arquivo: só acrescenta a tag do /extras.js no fim da página.
// (Se o extras.js não existir ou falhar, o jogo original continua funcionando normalmente.)
app.get(['/', '/index.html'], (q, r, next) => {
  let h; try { h = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8'); } catch (e) { return next(); }
  if (!h.includes('/extras.js')) { const i = h.lastIndexOf('</body>'), tag = '<script src="/extras.js"></script>'; h = i >= 0 ? h.slice(0, i) + tag + h.slice(i) : h + tag; }
  r.set('Cache-Control', 'no-cache'); r.type('html').send(h);
});
app.use(express.static(PUB));
const srv = http.createServer(app), io = new Server(srv);

// ======================= AJUSTES (valores fáceis de mudar) =======================
const CFG = {
  respawn: 3000,          // ms para reaparecer
  maxDist: 120,           // alcance máximo do tiro (m)
  matchKillsFFA: 15,      // eliminações para vencer a partida (cada um por si). 0 = partida sem fim (como antes)
  matchKillsTeam: 30,     // eliminações somadas da equipe para vencer. 0 = sem fim
  intermission: 8000,     // ms entre o fim de uma partida e o início da próxima
  minPlayMs: 45000,       // tempo mínimo na partida para contar partida/vitória/recompensa
  assistWindow: 8000,     // ms: dano nesse intervalo antes da morte conta como assistência
  assistMinDmg: 20,       // dano mínimo para a assistência valer
  scoreKill: 100, scoreAssist: 40,   // pontuação do placar
  matchCoinCapPerDay: 150,           // limite diário de moedas ganhas por objetivos de partida
  botMax: 4,              // bots por sala
  botGlobalMax: 12,       // bots no servidor inteiro (protege o plano gratuito)
  maxProfiles: 20000
};
// Moedas virtuais (sem dinheiro real). Missões diárias: progresso zera todo dia (fuso de Brasília).
const MISSIONS = [
  { id: 'k10', text: 'Elimine 10 inimigos', s: 'k', goal: 10, reward: 40 },
  { id: 'k25', text: 'Elimine 25 inimigos', s: 'k', goal: 25, reward: 100 },
  { id: 'a5', text: 'Faça 5 assistências', s: 'a', goal: 5, reward: 40 },
  { id: 'm3', text: 'Jogue 3 partidas', s: 'm', goal: 3, reward: 60 },
  { id: 'w1', text: 'Vença 1 partida', s: 'w', goal: 1, reward: 80 },
  { id: 'ks3', text: '3 eliminações com a sniper', s: 'ks', goal: 3, reward: 50 }
];
// Objetivos de partida: pagos automaticamente ao fim de cada partida (respeitando o limite diário acima)
const MATCH_OBJ = [
  { id: 'k5', text: '5 eliminações na partida', s: 'k', goal: 5, reward: 15 },
  { id: 'a2', text: '2 assistências na partida', s: 'a', goal: 2, reward: 10 },
  { id: 'win', text: 'Vencer a partida', s: 'win', goal: 1, reward: 30 }
];
// Itens: price>0 = comprável; req = desbloqueio grátis ao atingir a meta (s: k eliminações, m partidas, w vitórias, a assistências)
// São só visuais: não mudam dano, precisão nem velocidade.
const CATALOG = [
  { id: 'w_default', kind: 'w', name: 'Padrão', price: 0, c: null },
  { id: 'w_sand', kind: 'w', name: 'Areia', price: 0, req: { s: 'k', n: 25 }, c: { main: 0xb59a68, acc: 0x7a6a48 } },
  { id: 'w_forest', kind: 'w', name: 'Floresta', price: 0, req: { s: 'm', n: 3 }, c: { main: 0x4b5a2a, acc: 0x2e3a1c } },
  { id: 'w_arctic', kind: 'w', name: 'Ártico', price: 120, c: { main: 0xdfe6ea, acc: 0x8a9aa6 } },
  { id: 'w_night', kind: 'w', name: 'Noturno', price: 150, c: { main: 0x2a3a66, acc: 0x161d33 } },
  { id: 'w_crimson', kind: 'w', name: 'Carmesim', price: 200, c: { main: 0x9a1c1c, acc: 0x4a1414 } },
  { id: 'w_neon', kind: 'w', name: 'Neon', price: 300, c: { main: 0x14b8c8, acc: 0x1a2a3a, shine: 1 } },
  { id: 'w_gold', kind: 'w', name: 'Ouro', price: 500, c: { main: 0xd4a017, acc: 0x8a6a10, shine: 1 } },
  { id: 'o_default', kind: 'o', name: 'Floresta', price: 0, c: { base: '#4a5232', blobs: ['#5d6a3c', '#2f3820', '#7a7550', '#3a2f20'], sleeve: 0x3a4a3a } },
  { id: 'o_desert', kind: 'o', name: 'Deserto', price: 0, req: { s: 'k', n: 10 }, c: { base: '#b39b6c', blobs: ['#c8b383', '#8f7a4c', '#a58d5e', '#6e5c38'], sleeve: 0xa38a5a } },
  { id: 'o_urban', kind: 'o', name: 'Urbano', price: 0, req: { s: 'm', n: 5 }, c: { base: '#6b6f73', blobs: ['#8a8e92', '#44484c', '#575b60', '#2c2f33'], sleeve: 0x575b60 } },
  { id: 'o_snow', kind: 'o', name: 'Neve', price: 120, c: { base: '#d8dde0', blobs: ['#f2f5f6', '#aeb7bd', '#c4ccd1', '#8f9aa1'], sleeve: 0xc4ccd1 } },
  { id: 'o_night', kind: 'o', name: 'Noturno', price: 250, c: { base: '#1f2430', blobs: ['#2a3042', '#12151d', '#343c52', '#0b0d12'], sleeve: 0x2a3042 } },
  { id: 'o_elite', kind: 'o', name: 'Elite', price: 600, c: { base: '#3b3320', blobs: ['#d4a017', '#8a6a10', '#5a4a18', '#f0d060'], sleeve: 0x8a6a10 } }
];
// Armas (o servidor é quem manda no dano e na cadência): dano por projétil, ms entre tiros, projéteis, dispersão (rad)
const WPN = [
  { dmg: 25, rate: 160, pel: 1, spread: 0 },      // 0 pistola
  { dmg: 20, rate: 110, pel: 1, spread: .008 },   // 1 fuzil
  { dmg: 14, rate: 75, pel: 1, spread: .015 },    // 2 SMG
  { dmg: 14, rate: 750, pel: 6, spread: .07 },    // 3 escopeta
  { dmg: 90, rate: 1100, pel: 1, spread: 0 }      // 4 sniper
];
// Dificuldade dos bots: err = erro de mira (rad), react = tempo de reação (ms), rate = multiplicador da cadência (maior = mais lento),
// spd = velocidade (m/s), burst/pause = rajadas e pausas, sight = alcance de visão (m), turn = rapidez ao virar
const DIFF = {
  easy: { err: .085, react: 900, rate: 2.0, spd: 3.4, burst: [1, 3], pause: [700, 1500], sight: 30, turn: 5 },
  med: { err: .045, react: 550, rate: 1.45, spd: 4.2, burst: [2, 5], pause: [400, 1000], sight: 40, turn: 8 },
  hard: { err: .022, react: 300, rate: 1.15, spd: 5, burst: [3, 7], pause: [250, 600], sight: 50, turn: 12 }
};
const DIFFN = { easy: 'fácil', med: 'médio', hard: 'difícil' };
const WMAG = [12, 30, 25, 6, 5], WREL = [1200, 1800, 1500, 2200, 2600], WRANGE = [32, 45, 30, 18, 70], WPREF = [14, 18, 12, 6, 30];
const BOT_NAMES = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Eco', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet'];
const STEP = .6, BR = .45;
const rooms = {};
let botSeq = 0;

// ======================= PERFIS (moedas, inventário, estatísticas) =======================
const ITEM = Object.create(null); CATALOG.forEach(i => ITEM[i.id] = i);
const MISSION = Object.create(null); MISSIONS.forEach(m => MISSION[m.id] = m);
const int = (v, lo = 0, hi = 1e9) => { v = Math.floor(+v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo; };
const rnd = (a, b) => a + Math.random() * (b - a);
const dayKey = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const newDay = () => ({ key: dayKey(), k: 0, a: 0, m: 0, w: 0, ks: 0, mc: 0, claimed: {} });
const newProf = () => ({ coins: 0, owned: ['w_default', 'o_default'], eq: { w: 'w_default', o: 'o_default' }, st: { k: 0, d: 0, a: 0, m: 0, w: 0 }, day: newDay(), seen: Date.now() });
const rollDay = p => { if (p.day.key !== dayKey()) p.day = newDay(); };
function cleanProf(o) {   // aceita só campos conhecidos e valores válidos (usado ao carregar o arquivo e ao restaurar backup)
  const p = newProf(); if (!o || typeof o !== 'object') return p;
  p.coins = int(o.coins);
  if (Array.isArray(o.owned)) for (const id of o.owned) if (typeof id === 'string' && ITEM[id] && !p.owned.includes(id)) p.owned.push(id);
  if (o.eq && typeof o.eq === 'object') for (const k of ['w', 'o']) { const id = o.eq[k]; if (typeof id === 'string' && ITEM[id] && ITEM[id].kind === k && p.owned.includes(id)) p.eq[k] = id; }
  if (o.st && typeof o.st === 'object') for (const k of ['k', 'd', 'a', 'm', 'w']) p.st[k] = int(o.st[k]);
  if (o.day && typeof o.day === 'object' && o.day.key === dayKey()) {
    for (const k of ['k', 'a', 'm', 'w', 'ks', 'mc']) p.day[k] = int(o.day[k]);
    if (o.day.claimed && typeof o.day.claimed === 'object') for (const m of MISSIONS) if (o.day.claimed[m.id]) p.day.claimed[m.id] = 1;
  }
  return p;
}
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data'), FILE = path.join(DATA_DIR, 'players.json');
const DB = { secret: '', players: Object.create(null) }; let nProf = 0, dirty = false, warned = false;
try {
  const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (j && typeof j === 'object') {
    if (typeof j.secret === 'string') DB.secret = j.secret;
    for (const t in (j.players || {})) if (/^[a-f0-9]{32}$/.test(t)) { const p = cleanProf(j.players[t]); p.seen = int(j.players[t].seen, 0, 4e12) || Date.now(); DB.players[t] = p; nProf++; }
  }
} catch (e) { }
if (!DB.secret) { DB.secret = crypto.randomBytes(24).toString('hex'); dirty = true; }
const SECRET = process.env.SAVE_SECRET || DB.secret;
function saveNow() {
  if (!dirty) return; dirty = false;
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(DB)); fs.renameSync(tmp, FILE); }
  catch (e) { dirty = true; if (!warned) { warned = true; console.log('Não foi possível salvar os perfis:', e.message); } }
}
setInterval(saveNow, 5000);
for (const sg of ['SIGTERM', 'SIGINT']) process.on(sg, () => { saveNow(); process.exit(0); });
// Cópia assinada do perfil (guardada no aparelho): se o servidor perder o arquivo (plano gratuito), o perfil volta
// sem permitir edição, porque só o servidor conhece o segredo da assinatura.
const sign = s => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
function makeBak(tok, p) { const s = JSON.stringify({ t: tok, p }); return { s, h: sign(s) }; }
function readBak(tok, b) {
  try {
    if (!b || typeof b.s !== 'string' || typeof b.h !== 'string' || b.s.length > 20000) return null;
    const a = Buffer.from(sign(b.s)), c = Buffer.from(b.h); if (a.length !== c.length || !crypto.timingSafeEqual(a, c)) return null;
    const j = JSON.parse(b.s); return j.t === tok ? cleanProf(j.p) : null;
  } catch (e) { return null; }
}
function profView(tok, p, full, sess) {
  rollDay(p);
  const v = {
    coins: p.coins, owned: p.owned, eq: p.eq, st: p.st, sess: sess || null, cap: CFG.matchCoinCapPerDay,
    day: { mc: p.day.mc }, bak: makeBak(tok, p),
    missions: MISSIONS.map(m => ({ id: m.id, text: m.text, goal: m.goal, reward: m.reward, prog: Math.min(m.goal, p.day[m.s] || 0), claimed: p.day.claimed[m.id] ? 1 : 0 }))
  };
  if (full) { v.tok = tok; v.cat = CATALOG; v.mobj = MATCH_OBJ; }
  return v;
}
function checkUnlocks(p) { const got = []; for (const it of CATALOG) if (it.req && !p.owned.includes(it.id) && (p.st[it.req.s] || 0) >= it.req.n) { p.owned.push(it.id); got.push(it.id); } if (got.length) dirty = true; return got; }
function notify(P) { if (P.bot || !P.prof) return; dirty = true; io.to(P.id).emit('x:profile', profView(P.tok, P.prof, false, P.sess)); }
function addStat(P, k, n = 1) {
  if (P.sess) P.sess[k] = (P.sess[k] || 0) + n;
  const p = P.prof; if (!p) return; rollDay(p); p.st[k] = (p.st[k] || 0) + n; if (k !== 'd') p.day[k] = (p.day[k] || 0) + n; dirty = true;
}
function afterStats(P) { if (P.bot || !P.prof) return; const g = checkUnlocks(P.prof); if (g.length) io.to(P.id).emit('x:unlock', g); notify(P); }

// ======================= UTILIDADES DO JOGO ORIGINAL =======================
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
const humansOf = R => Object.values(R.p).filter(p => !p.bot);
const score = p => p.k * CFG.scoreKill + p.a * CFG.scoreAssist;
const matchLimit = R => R.mode === 'team' ? CFG.matchKillsTeam : CFG.matchKillsFFA;
const roomInfo = R => ({ owner: R.owner, ownerName: R.p[R.owner] ? R.p[R.owner].name : '', bots: R.nb || 0, diff: R.diff, botMax: CFG.botMax, lim: matchLimit(R), mode: R.mode });
const pickItem = kind => { const l = CATALOG.filter(i => i.kind === kind); return l[Math.random() * l.length | 0].id; };

// nascimento: escolhe entre os pontos do mapa um dos mais distantes dos inimigos vivos (equilibra o início)
function spawnFor(R, me) {
  const sp = MAPS[R.map].spawns, foes = Object.values(R.p).filter(q => q !== me && !q.dead && (R.mode !== 'team' || q.team !== me.team));
  const sc = sp.map(s => ({ s, v: foes.length ? Math.min(...foes.map(q => Math.hypot(q.x - s[0], q.z - s[1]))) : Math.random() * 10 }));
  sc.sort((a, b) => b.v - a.v); return sc[Math.random() * Math.min(3, sc.length) | 0].s;
}
function respawn(R, q, force) {
  if (!R.p[q.id] || (!force && !q.dead)) return;
  clearTimeout(q.respT); const sp = spawnFor(R, q);
  Object.assign(q, { x: sp[0], z: sp[1], y: 0, hp: 100, dead: false, c: 0, rl: 0 }); q.dm.clear();
  if (q.bot) botReset(q); else io.to(q.id).emit('respawn', { x: sp[0], z: sp[1] });
}

// ======================= TIRO (usado por jogadores e bots) =======================
function fireShot(R, P, w, yaw, pit) {
  const W = WPN[w], M = MAPS[R.map], o = [P.x, P.y + (P.c ? 1.1 : 1.6), P.z], dmg = new Map(); let tracer = null;
  for (let k = 0; k < W.pel; k++) {
    const yy = yaw + (k ? (Math.random() - .5) * 2 * W.spread : 0) + (W.pel === 1 ? (Math.random() - .5) * 2 * W.spread : 0), pp = pit + (k ? (Math.random() - .5) * 2 * W.spread : 0) + (W.pel === 1 ? (Math.random() - .5) * 2 * W.spread : 0);
    const d = [-Math.sin(yy) * Math.cos(pp), Math.sin(pp), -Math.cos(yy) * Math.cos(pp)];
    let wall = CFG.maxDist; for (const b of M.boxes) { const t = ray(o, d, [b[0], b[1], b[2]], [b[3], b[4], b[5]]); if (t >= 0 && t < wall) wall = t; }
    if (wall > 0 && d[1] < -1e-6) { const tg = -o[1] / d[1]; if (tg > 0 && tg < wall) wall = tg; }   // chão
    let best = null, bt = wall;
    for (const q of Object.values(R.p)) {
      if (q === P || q.dead || (R.mode === 'team' && q.team === P.team) || (P.bot && q.bot && R.mode !== 'team')) continue;
      const h = q.c ? 1.3 : 1.8, t = ray(o, d, [q.x, q.y + h / 2, q.z], [0.8, h, 0.8]); if (t >= 0 && t < bt) { bt = t; best = q; }
    }
    if (best) dmg.set(best, (dmg.get(best) || 0) + W.dmg);
    if (k === 0) tracer = { e: [o[0] + d[0] * bt, o[1] + d[1] * bt, o[2] + d[2] * bt], h: best ? 1 : 0 };
  }
  io.to(R.code).emit('shot', { id: P.id, o, e: tracer.e, h: tracer.h, w });
  for (const [q, total] of dmg) hurt(R, P, q, total, w);
}
function hurt(R, P, q, total, w) {
  if (q.dead) return;
  q.hp -= total;
  if (!q.bot) io.to(q.id).emit('hurt', q.hp, P.x, P.z);
  else { q.ai.lx = P.x; q.ai.lz = P.z; q.ai.lt = Date.now(); }   // o bot reage a quem atirou nele
  if (!P.bot) io.to(P.id).emit('hitmark');
  const e = q.dm.get(P.id) || { t: 0, d: 0 }; e.t = Date.now(); e.d += total; q.dm.set(P.id, e);
  if (q.hp <= 0) onKill(R, P, q, w);
}
function onKill(R, P, q, w) {
  if (q.dead) return;   // evita contar a mesma eliminação duas vezes
  q.dead = true; q.d++; P.k++; q.rl = 0;
  if (R.mode === 'team' && P.team >= 0) R.tk[P.team]++;
  const now = Date.now(), assists = [];
  for (const [id, e] of q.dm) if (id !== P.id && R.p[id] && now - e.t <= CFG.assistWindow && e.d >= CFG.assistMinDmg) assists.push(R.p[id]);
  q.dm.clear();
  io.to(R.code).emit('feed', `${P.name} eliminou ${q.name}`);
  for (const a of assists) { a.a++; if (!a.bot) { addStat(a, 'a'); afterStats(a); } }
  if (!P.bot) { addStat(P, 'k'); if (w === 4 && P.prof) { rollDay(P.prof); P.prof.day.ks++; } afterStats(P); }
  if (!q.bot) { addStat(q, 'd'); afterStats(q); }
  q.respT = setTimeout(() => respawn(R, q), CFG.respawn);
  checkMatchEnd(R, P);
}

// ======================= PARTIDAS (fim, vitória, recompensas) =======================
function checkMatchEnd(R, killer) {
  const lim = matchLimit(R); if (!lim || R.over) return;
  if (R.mode === 'team') { if (killer.team >= 0 && R.tk[killer.team] >= lim) endMatch(R, { team: killer.team }); }
  else if (killer.k >= lim) endMatch(R, { p: killer });
}
function endMatch(R, w) {
  const now = Date.now(); R.over = now + CFG.intermission;
  const all = Object.values(R.p);
  const rows = all.map(p => ({ n: p.name, t: p.team, k: p.k, d: p.d, a: p.a, sc: score(p), b: p.bot ? 1 : 0 })).sort((x, y) => y.sc - x.sc);
  const title = R.mode === 'team' ? (w.team === 0 ? 'EQUIPE VERMELHA VENCEU' : 'EQUIPE AZUL VENCEU') : `${w.p.name} VENCEU`;
  io.to(R.code).emit('x:end', { title, rows, ms: CFG.intermission, mode: R.mode });
  for (const p of humansOf(R)) {
    const win = R.mode === 'team' ? p.team === w.team : p === w.p;
    if (!p.prof) { io.to(p.id).emit('x:reward', { win, coins: 0, lines: [], msg: 'Perfil não carregado: sem recompensas.' }); continue; }
    if (all.length < 2 || now - p.since < CFG.minPlayMs) { io.to(p.id).emit('x:reward', { win, coins: 0, lines: [], msg: `Jogue pelo menos ${Math.round(CFG.minPlayMs / 1000)} s na partida para contar.` }); continue; }
    addStat(p, 'm'); if (win) addStat(p, 'w');
    let gain = 0; const lines = [], st = { k: p.k, a: p.a, win: win ? 1 : 0 };
    for (const ob of MATCH_OBJ) if ((st[ob.s] || 0) >= ob.goal) { gain += ob.reward; lines.push(`${ob.text}: +${ob.reward}`); }
    rollDay(p.prof); const left = Math.max(0, CFG.matchCoinCapPerDay - p.prof.day.mc), paid = Math.min(gain, left);
    p.prof.day.mc += paid; p.prof.coins += paid; dirty = true;
    io.to(p.id).emit('x:reward', { win, coins: paid, lines, msg: paid < gain ? 'Limite diário de moedas por partidas atingido.' : '' });
    afterStats(p);
  }
  setTimeout(() => newRound(R), CFG.intermission);
}
function newRound(R) {
  if (rooms[R.code] !== R) return;
  R.over = 0; R.tk = [0, 0]; const now = Date.now();
  for (const p of Object.values(R.p)) { clearTimeout(p.respT); p.k = p.d = p.a = 0; p.since = now; respawn(R, p, true); }
  io.to(R.code).emit('x:round', {}); io.to(R.code).emit('x:room', roomInfo(R));
}

// ======================= BOTS =======================
function blockedAt(M, x, z, y) {
  if (Math.abs(x) > M.lim - .6 || Math.abs(z) > M.lim - .6) return true;
  for (const b of M.boxes) { const top = b[1] + b[4] / 2; if (y >= top - STEP) continue; if (Math.abs(x - b[0]) < b[3] / 2 + BR && Math.abs(z - b[2]) < b[5] / 2 + BR) return true; }
  return false;
}
function groundAt(M, x, z, y) { let g = 0; for (const b of M.boxes) { const top = b[1] + b[4] / 2; if (Math.abs(x - b[0]) < b[3] / 2 + .2 && Math.abs(z - b[2]) < b[5] / 2 + .2 && y >= top - STEP) g = Math.max(g, top); } return g; }
function los(M, ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz); if (L < .01) return true;
  const o = [ax, ay, az], d = [dx / L, dy / L, dz / L];
  for (const b of M.boxes) { const t = ray(o, d, [b[0], b[1], b[2]], [b[3], b[4], b[5]]); if (t >= 0 && t < L - .3) return false; }
  return true;
}
function stepBot(M, b, dx, dz, spd, dt) {   // anda desviando de obstáculos (testa a direção e desvios)
  const m = Math.hypot(dx, dz); if (m < 1e-6) return false; dx /= m; dz /= m;
  for (const off of [0, .6, -.6, 1.2, -1.2, 2, -2]) {
    const c = Math.cos(off), s = Math.sin(off), nx = dx * c - dz * s, nz = dx * s + dz * c, px = b.x + nx * spd * dt, pz = b.z + nz * spd * dt;
    if (!blockedAt(M, px, pz, b.y)) { b.x = px; b.z = pz; return true; }
  }
  return false;
}
function findCover(M, b, tg) {   // ponto atrás de um obstáculo, em linha com o inimigo
  let best = null, bd = 1e9;
  for (const x of M.boxes) {
    const h = x[4], base = x[1] - h / 2; if (h < 1 || base > .5 || x[3] > 30 || x[5] > 30) continue;
    const dist = Math.hypot(x[0] - b.x, x[2] - b.z); if (dist > 25 || dist >= bd) continue;
    let ex = x[0] - tg.x, ez = x[2] - tg.z; const el = Math.hypot(ex, ez) || 1; ex /= el; ez /= el;
    const r = Math.max(x[3], x[5]) / 2 + .9, px = x[0] + ex * r, pz = x[2] + ez * r;
    if (blockedAt(M, px, pz, 0)) continue;
    if (los(M, tg.x, tg.y + 1.6, tg.z, px, 1, pz)) continue;
    bd = dist; best = [px, pz];
  }
  return best;
}
function pickWp(R, b) {
  const M = MAPS[R.map], hs = Object.values(R.p).filter(q => !q.bot && !q.dead && (R.mode !== 'team' || q.team !== b.team));
  for (let i = 0; i < 12; i++) {
    let x, z;
    if (hs.length && Math.random() < .5) { const h = hs[Math.random() * hs.length | 0]; x = h.x + rnd(-12, 12); z = h.z + rnd(-12, 12); }   // procura jogadores
    else { x = rnd(-M.lim + 4, M.lim - 4); z = rnd(-M.lim + 4, M.lim - 4); }
    if (!blockedAt(M, x, z, 0)) return [x, z];
  }
  const s = M.spawns[Math.random() * M.spawns.length | 0]; return [s[0], s[1]];
}
function botReset(b) {
  b.w = Math.random() * 4 | 0; b.ammo = WMAG[b.w]; b.rl = 0; b.c = 0;
  b.ai = { perAt: 0, tgt: null, seen: 0, lt: 0, lx: 0, lz: 0, dist: 1e9, adf: 3, str: 1, strT: 0, wp: null, wpUntil: 0, cover: null, coverUntil: 0, coverCool: 0, relAt: 0, burst: 0, pause: 0, chk: 0, cx: b.x, cz: b.z, unstick: 0, uang: 0 };
}
function addBot(R) {
  const used = new Set(Object.values(R.p).map(p => p.name)), nm = BOT_NAMES.find(n => !used.has('[BOT] ' + n)) || ('Bot' + (botSeq + 1)), id = 'bot_' + (++botSeq), all = Object.values(R.p);
  const team = R.mode === 'team' ? (all.filter(p => p.team === 0).length <= all.filter(p => p.team === 1).length ? 0 : 1) : -1;
  const b = { id, room: R.code, bot: 1, name: '[BOT] ' + nm, team, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, c: 0, w: 1, rl: 0, hp: 100, k: 0, d: 0, a: 0, last: 0, dead: false, dm: new Map(), ping: 0, since: Date.now(), ws: pickItem('w'), oc: pickItem('o') };
  const sp = spawnFor(R, b); b.x = sp[0]; b.z = sp[1]; R.p[id] = b; botReset(b); return b;
}
function setBots(R, n, diff) {
  R.diff = diff; const bots = Object.values(R.p).filter(p => p.bot); let total = 0;
  for (const c in rooms) total += Object.values(rooms[c].p).filter(p => p.bot).length;
  n = Math.min(n, CFG.botMax, Math.max(0, CFG.botGlobalMax - (total - bots.length)));
  while (bots.length > n) { const b = bots.pop(); clearTimeout(b.respT); delete R.p[b.id]; }
  while (bots.length < n) bots.push(addBot(R));
  R.nb = n; io.to(R.code).emit('feed', n ? `Bots: ${n} (${DIFFN[diff]})` : 'Bots desativados'); io.to(R.code).emit('x:room', roomInfo(R));
}
function botThink(R, b, now, dt) {
  const M = MAPS[R.map], D = DIFF[R.diff] || DIFF.med, A = b.ai; if (b.dead || R.over) return;
  if (b.rl && now >= A.relAt) { b.rl = 0; b.ammo = WMAG[b.w]; }
  if (now - A.perAt > 150) {   // percepção: quem está visível e quem está por perto
    A.perAt = now; let best = null, bd = 1e9, near = null, nd = 1e9;
    for (const q of Object.values(R.p)) {
      if (q === b || q.dead || (R.mode === 'team' ? q.team === b.team : q.bot)) continue;
      const dist = Math.hypot(q.x - b.x, q.z - b.z); if (dist < nd) { nd = dist; near = q; }
      if (dist <= D.sight && dist < bd && los(M, b.x, b.y + (b.c ? 1.1 : 1.6), b.z, q.x, q.y + (q.c ? .8 : 1.1), q.z)) { bd = dist; best = q; }
    }
    if (best) { if (A.tgt !== best) A.seen = now; A.tgt = best; A.lx = best.x; A.lz = best.z; A.lt = now; } else A.tgt = null;
    if (!best && near && nd < 11) { A.lx = near.x; A.lz = near.z; A.lt = now; }   // ouviu passos por perto
    A.dist = best ? bd : 1e9;
  }
  const tg = A.tgt && !A.tgt.dead && R.p[A.tgt.id] ? A.tgt : null;
  let mx = 0, mz = 0, spd = D.spd;
  if (tg && now > A.coverCool && (b.hp <= 40 || (b.rl && A.dist < 25))) { const cp = findCover(M, b, tg); if (cp) { A.cover = cp; A.coverUntil = now + rnd(3000, 5500); } A.coverCool = now + 9000; }
  if (now < A.unstick) { mx = Math.cos(A.uang); mz = Math.sin(A.uang); b.c = 0; }
  else if (A.cover && now < A.coverUntil) {
    const dx = A.cover[0] - b.x, dz = A.cover[1] - b.z;
    if (Math.hypot(dx, dz) > .8) { mx = dx; mz = dz; spd = D.spd * 1.2; b.c = 0; } else b.c = 1;   // chegou na cobertura: agacha
  } else {
    A.cover = null; b.c = 0;
    if (tg) {
      const dx = tg.x - b.x, dz = tg.z - b.z, dd = Math.hypot(dx, dz) || 1, nx = dx / dd, nz = dz / dd, pref = WPREF[b.w];
      if (now > A.strT) { A.str = Math.random() < .5 ? 1 : -1; A.strT = now + rnd(700, 1800); }
      if (dd > pref * 1.25) { mx = nx; mz = nz; }
      else if (dd < Math.max(3, pref * .45)) { mx = -nx - nz * A.str * .5; mz = -nz + nx * A.str * .5; }   // ameaça muito perto: recua
      else { mx = -nz * A.str; mz = nx * A.str; spd *= .7; }                                              // desvia de lado
    } else if (A.lt && now - A.lt < 7000 && Math.hypot(A.lx - b.x, A.lz - b.z) > 2) { mx = A.lx - b.x; mz = A.lz - b.z; }   // procura a última posição
    else {
      if (!A.wp || now > A.wpUntil || Math.hypot(A.wp[0] - b.x, A.wp[1] - b.z) < 2) { A.wp = pickWp(R, b); A.wpUntil = now + rnd(8000, 14000); }
      mx = A.wp[0] - b.x; mz = A.wp[1] - b.z; spd = D.spd * .8;
    }
  }
  if (now - A.chk > 1000) {   // preso? troca de rota
    if ((mx || mz) && now >= A.unstick && Math.hypot(b.x - A.cx, b.z - A.cz) < .6) { A.wp = null; A.cover = null; A.str *= -1; A.strT = now + 1200; A.unstick = now + 700; A.uang = rnd(0, 6.28); }
    A.cx = b.x; A.cz = b.z; A.chk = now;
  }
  const moved = (mx || mz) ? stepBot(M, b, mx, mz, spd, dt) : false;
  const g = groundAt(M, b.x, b.z, b.y); b.y = b.y < g ? g : Math.max(g, b.y - 14 * dt);
  let ty = null;
  if (tg) ty = Math.atan2(-(tg.x - b.x), -(tg.z - b.z)); else if (mx || mz) ty = Math.atan2(-mx, -mz);
  if (ty !== null) { let df = ty - b.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); b.yaw += df * Math.min(1, dt * D.turn); A.adf = Math.abs(df); }
  const pt = tg ? Math.atan2((tg.y + (tg.c ? .8 : 1.1)) - (b.y + (b.c ? 1.1 : 1.6)), Math.hypot(tg.x - b.x, tg.z - b.z)) : 0;
  b.pitch += (pt - b.pitch) * Math.min(1, dt * 8);
  if (tg && !b.rl && A.dist <= WRANGE[b.w] && now - A.seen >= D.react && now >= A.pause && now - b.last >= WPN[b.w].rate * D.rate && A.adf < .12) {
    if (b.ammo <= 0) { b.rl = 1; A.relAt = now + WREL[b.w]; }
    else {
      if (A.burst <= 0) A.burst = Math.round(rnd(D.burst[0], D.burst[1]));
      b.last = now; b.ammo--; A.burst--; if (A.burst <= 0) A.pause = now + rnd(D.pause[0], D.pause[1]);
      const e = D.err * (moved ? 1.5 : 1);
      fireShot(R, b, b.w, b.yaw + (Math.random() - .5) * 2 * e, b.pitch + (Math.random() - .5) * 2 * e);
    }
  }
  if (!b.rl && (b.ammo <= 0 || (!tg && b.ammo < WMAG[b.w] * .4))) { b.rl = 1; A.relAt = now + WREL[b.w]; }
}
let lastBot = Date.now();
setInterval(() => {
  const now = Date.now(), dt = Math.min(.2, (now - lastBot) / 1000); lastBot = now;
  for (const c in rooms) { const R = rooms[c]; if (!R.nb) continue; for (const q of Object.values(R.p)) if (q.bot) { try { botThink(R, q, now, dt); } catch (e) { console.log('Erro no bot:', e.message); } } }
}, 50);

// ======================= CONEXÕES =======================
io.on('connection', sock => {
  let R = null, P = null; sock.data.sess = { k: 0, d: 0, a: 0, m: 0, w: 0 };
  function enter(c, name, cb) {
    R = rooms[c]; const M = MAPS[R.map], all = Object.values(R.p);
    const team = R.mode === 'team' ? (all.filter(p => p.team === 0).length <= all.filter(p => p.team === 1).length ? 0 : 1) : -1;
    P = { id: sock.id, room: c, name: cleanName(name), team, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, c: 0, w: 0, rl: 0, hp: 100, k: 0, d: 0, a: 0, last: 0, dead: false, dm: new Map(), ping: 0, since: Date.now(), sess: sock.data.sess, tok: sock.data.tok || '', prof: sock.data.prof || null };
    P.ws = P.prof ? P.prof.eq.w : 'w_default'; P.oc = P.prof ? P.prof.eq.o : 'o_default';
    const sp = spawnFor(R, P); P.x = sp[0]; P.z = sp[1];
    R.p[sock.id] = P; sock.join(c); if (!R.owner || !R.p[R.owner]) R.owner = sock.id;
    cb({ ok: true, code: c, id: sock.id, mode: R.mode, max: R.max, x: P.x, z: P.z, team, map: R.map, mapName: M.name, theme: M.theme, lim: M.lim, boxes: M.boxes, decor: M.decor, trees: M.trees, fires: M.fires });
    io.to(c).emit('x:room', roomInfo(R));
  }
  sock.on('create', (o, cb) => {
    if (typeof cb !== 'function') return; o = o || {};
    const c = code();
    rooms[c] = { code: c, p: {}, mode: o.mode === 'team' ? 'team' : 'ffa', max: Math.min(Math.max(+o.max || 4, 2), 8), map: MAPS[o.map] ? o.map : 'base', owner: null, nb: 0, diff: 'med', over: 0, tk: [0, 0] };
    enter(c, o.name, cb);
  });
  sock.on('join', (o, cb) => {
    if (typeof cb !== 'function') return; o = o || {};
    const c = (o.code || '').toString().toUpperCase().trim(), r = rooms[c];
    if (!r) return cb({ ok: false, msg: 'Sala não encontrada' });
    if (humansOf(r).length >= r.max) return cb({ ok: false, msg: 'Sala cheia' });
    enter(c, o.name, cb);
  });
  sock.on('state', s => {
    if (!P || P.dead || !s) return; const L = MAPS[R.map].lim;
    P.x = num(s.x, -L, L); P.z = num(s.z, -L, L); P.y = num(s.y, 0, 8); P.yaw = num(s.yaw, -1e4, 1e4); P.pitch = num(s.pitch, -1.5, 1.5);
    P.c = s.c ? 1 : 0; P.rl = s.rl ? 1 : 0; P.w = num(s.w, 0, WPN.length - 1) | 0;
  });
  sock.on('shoot', s => {
    if (!P || P.dead || !s || R.over) return; const w = num(s.w, 0, WPN.length - 1) | 0, W = WPN[w], L = MAPS[R.map].lim;
    const now = Date.now(); if (now - P.last < W.rate * .85) return; P.last = now;
    P.x = num(s.x, -L, L); P.z = num(s.z, -L, L); P.y = num(s.y, 0, 8); P.c = s.c ? 1 : 0; P.w = w;
    fireShot(R, P, w, num(s.yaw, -1e4, 1e4), num(s.pitch, -1.5, 1.5));
  });

  // ---- perfil, loja, missões ----
  const reply = (cb, r) => { if (typeof cb === 'function') cb(r); };
  const push = () => { const p = sock.data.prof; if (p) { dirty = true; sock.emit('x:profile', profView(sock.data.tok, p, false, sock.data.sess)); } };
  sock.on('x:hello', o => {
    o = o && typeof o === 'object' ? o : {};
    let tok = typeof o.tok === 'string' && /^[a-f0-9]{32}$/.test(o.tok) ? o.tok : crypto.randomBytes(16).toString('hex'), p = DB.players[tok];
    if (!p) { if (nProf >= CFG.maxProfiles) return; p = readBak(tok, o.bak) || newProf(); DB.players[tok] = p; nProf++; }
    p.seen = Date.now(); rollDay(p); checkUnlocks(p); dirty = true; sock.data.tok = tok; sock.data.prof = p;
    if (P && !P.bot) { P.tok = tok; P.prof = p; P.sess = sock.data.sess; P.ws = p.eq.w; P.oc = p.eq.o; }
    sock.emit('x:profile', profView(tok, p, true, sock.data.sess));
  });
  sock.on('x:buy', (o, cb) => {
    const p = sock.data.prof, it = o && typeof o.id === 'string' ? ITEM[o.id] : null;
    if (!p || !it) return reply(cb, { ok: false, msg: 'Item inválido' });
    if (p.owned.includes(it.id)) return reply(cb, { ok: false, msg: 'Você já tem este item' });
    if (!(it.price > 0)) return reply(cb, { ok: false, msg: 'Este item é desbloqueado jogando' });
    if (p.coins < it.price) return reply(cb, { ok: false, msg: 'Moedas insuficientes' });
    p.coins -= it.price; p.owned.push(it.id); push(); reply(cb, { ok: true });
  });
  sock.on('x:equip', (o, cb) => {
    const p = sock.data.prof; o = o || {}; if (!p) return reply(cb, { ok: false, msg: 'Perfil indisponível' });
    const kind = o.kind === 'o' ? 'o' : 'w', id = typeof o.id === 'string' ? o.id : (kind === 'w' ? 'w_default' : 'o_default'), it = ITEM[id];   // sem id = desequipar (volta ao padrão)
    if (!it || it.kind !== kind || !p.owned.includes(id)) return reply(cb, { ok: false, msg: 'Item não desbloqueado' });
    p.eq[kind] = id; if (P && !P.bot) { P.ws = p.eq.w; P.oc = p.eq.o; } push(); reply(cb, { ok: true });
  });
  sock.on('x:claim', (o, cb) => {
    const p = sock.data.prof, m = o && typeof o.id === 'string' ? MISSION[o.id] : null;
    if (!p || !m) return reply(cb, { ok: false, msg: 'Missão inválida' });
    rollDay(p); if (p.day.claimed[m.id]) return reply(cb, { ok: false, msg: 'Recompensa já resgatada' });
    if ((p.day[m.s] || 0) < m.goal) return reply(cb, { ok: false, msg: 'Missão incompleta' });
    p.day.claimed[m.id] = 1; p.coins += m.reward; push(); reply(cb, { ok: true, coins: m.reward });
  });
  // ---- bots (só o dono da sala) e latência ----
  sock.on('x:bots', (o, cb) => {
    o = o || {}; if (!R || !P || R.owner !== sock.id) return reply(cb, { ok: false, msg: 'Só o dono da sala controla os bots' });
    setBots(R, int(o.n, 0, CFG.botMax), DIFF[o.diff] ? o.diff : 'med'); reply(cb, { ok: true });
  });
  sock.on('x:ping', cb => reply(cb, 1));
  sock.on('x:rtt', v => { if (P) P.ping = int(v, 0, 2000); });

  sock.on('disconnect', () => {
    if (!R || !P) return; clearTimeout(P.respT); delete R.p[sock.id];
    const hs = humansOf(R);
    if (!hs.length) { delete rooms[P.room]; return; }
    if (R.owner === sock.id) R.owner = hs[0].id;
    io.to(P.room).emit('feed', `${P.name} saiu`); io.to(P.room).emit('x:room', roomInfo(R));
  });
});

setInterval(() => {
  for (const c in rooms) io.to(c).emit('snap', Object.values(rooms[c].p).map(p => ({ id: p.id, n: p.name, t: p.team, x: p.x, y: p.y, z: p.z, r: p.yaw, pt: p.pitch, c: p.c, w: p.w, rl: p.rl, hp: p.hp, k: p.k, d: p.d, a: p.a, sc: score(p), pg: p.ping, b: p.bot ? 1 : 0, ws: p.ws, oc: p.oc })));
}, 50);

srv.listen(process.env.PORT || 3000, () => console.log('Servidor rodando'));
