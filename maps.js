// maps.js — define os 3 mapas (colisões, decoração, nascimentos). Usado pelo server.js.
// Caixa sólida: [x, y(centro), z, largura, altura, profundidade, tipoMaterial, variante]
// Tipos: 0 madeira 1 concreto 2 reboco 3 tijolo 4 chapa 5 militar 6 carro 7 madeira escura 8 sacos
//        9 contêiner 10 preto 11 asfalto 13 contêiner pequeno 14 concreto(chão/teto) 15 aço 16 liso 17 munição 18 areia 19 sacos de areia
// IMPORTANTE: a colisão do jogo olha só a "pegada" (x,z) e o topo da caixa, então nada sólido pode ficar
// flutuando. Telhados, vigas e tubulações aéreas vão em `decor` (visual, sem colisão).
const T = { WOOD: 0, CONC: 1, STUCCO: 2, BRICK: 3, TIN: 4, MIL: 5, CAR: 6, DWOOD: 7, BAG: 8, CONT: 9, BLACK: 10, ASPH: 11, CONTS: 13, CONCF: 14, STEEL: 15, PLAIN: 16, AMMO: 17, SAND: 18, BAGS: 19 };

function cut(a, b, gaps) {
  const g = gaps.map(([p, q]) => [Math.max(a, p), Math.min(b, q)]).filter(([p, q]) => q > p).sort((x, y) => x[0] - y[0]);
  const out = []; let c = a;
  for (const [p, q] of g) { if (p - c > .05) out.push([c, p]); c = Math.max(c, q); }
  if (b - c > .05) out.push([c, b]); return out;
}
function Builder() {
  const boxes = [], decor = [], fires = [], api = { boxes, decor, fires };
  api.b = (x, z, w, d, h, t, v = 0, y0 = 0) => boxes.push([x, +(y0 + h / 2).toFixed(2), z, w, h, d, t, v]);
  api.dec = (x, z, w, d, h, t, v = 0, y0 = 0) => decor.push([x, +(y0 + h / 2).toFixed(2), z, w, h, d, t, v]);
  api.fire = (x, y, z, k) => fires.push([x, y, z, k]);
  api.wx = (z, x1, x2, h, t, v = 0, th = .5, gaps = []) => { for (const [a, b] of cut(x1, x2, gaps)) api.b((a + b) / 2, z, b - a, th, h, t, v); };
  api.wz = (x, z1, z2, h, t, v = 0, th = .5, gaps = []) => { for (const [a, b] of cut(z1, z2, gaps)) api.b(x, (a + b) / 2, th, b - a, h, t, v); };
  // construção com portas (n/s/e/w = lista de deslocamentos da porta) e telhado decorativo
  api.room = (cx, cz, w, d, h, t, v = 0, doors = {}, o = {}) => {
    const dw = 2.2, gp = (c, arr = []) => arr.map(off => [c + off - dw / 2, c + off + dw / 2]);
    api.wx(cz - d / 2, cx - w / 2, cx + w / 2, h, t, v, .5, gp(cx, doors.n)); api.wx(cz + d / 2, cx - w / 2, cx + w / 2, h, t, v, .5, gp(cx, doors.s));
    api.wz(cx - w / 2, cz - d / 2, cz + d / 2, h, t, v, .5, gp(cz, doors.w)); api.wz(cx + w / 2, cz - d / 2, cz + d / 2, h, t, v, .5, gp(cz, doors.e));
    api.dec(cx, cz, w + .8, d + .8, .35, o.roofT === undefined ? T.CONCF : o.roofT, o.roofV || 0, h);
  };
  // torre de vigia: base maciça + escada de degraus de 0,5 m (dá para subir andando) + guarda-corpo
  api.tower = (cx, cz, dir = 1) => {
    api.b(cx, cz, 4, 4, 3.5, T.MIL, 1);
    for (let i = 1; i <= 6; i++) api.b(cx, cz + dir * (2 + (i - .5) * .8), 2, .8, 3.5 - .5 * i, T.CONC, 1);
    api.b(cx, cz - dir * 1.9, 4, .2, 1, T.STEEL, 0, 3.5); api.b(cx - 1.9, cz, .2, 4, 1, T.STEEL, 0, 3.5); api.b(cx + 1.9, cz, .2, 4, 1, T.STEEL, 0, 3.5);
    for (const [px, pz] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) api.dec(cx + px, cz + pz, .2, .2, 3.1, T.STEEL, 0, 3.5);
    api.dec(cx, cz, 5, 5, .3, T.TIN, 0, 6.6);
  };
  api.crates = (x, z) => { api.b(x, z, 1.2, 1.2, 1.2, T.WOOD, 0); api.b(x + .15, z + .1, .9, .9, 2.1, T.WOOD, 0); };
  api.border = (L, h, t, v, th) => {
    api.b(0, -(L + th / 2), 2 * L + 2 * th, th, h, t, v); api.b(0, L + th / 2, 2 * L + 2 * th, th, h, t, v);
    api.b(-(L + th / 2), 0, th, 2 * L, h, t, v); api.b(L + th / 2, 0, th, 2 * L, h, t, v);
  };
  return api;
}

// ---------------- MAPA 1: BASE MILITAR ----------------
function base() {
  const m = Builder(), L = 50; m.border(L, 3.5, T.CONC, 1, 1.2);
  m.room(0, 0, 16, 10, 3.6, T.STUCCO, 0, { n: [0], s: [-5, 5], e: [0], w: [0] });          // quartel-general
  m.b(0, 0, 3, 1, .9, T.WOOD, 0); m.b(-6, -3, 1.4, 1, .9, T.AMMO); m.b(6, 3, 1.4, 1, .9, T.AMMO);
  m.room(-30, -18, 14, 8, 3.2, T.MIL, 0, { s: [-3, 3], e: [0] }); m.room(30, 18, 14, 8, 3.2, T.MIL, 0, { n: [3, -3], w: [0] });   // alojamentos
  m.b(-34, -20, 1.2, 1.2, 1.2, T.WOOD, 0); m.b(34, 20, 1.2, 1.2, 1.2, T.WOOD, 0);
  m.room(-34, 30, 6, 5, 3, T.STUCCO, 1, { e: [0], n: [0] }); m.room(34, -30, 6, 5, 3, T.STUCCO, 1, { w: [0], s: [0] });           // guaritas
  // pátios de contêineres
  m.b(-14, -36, 6, 2.4, 2.6, T.CONT, 0); m.b(-5, -36, 6, 2.4, 2.6, T.CONT, 1); m.b(-22, -32, 2.4, 6, 2.6, T.CONT, 2);
  m.b(14, 36, 6, 2.4, 2.6, T.CONT, 3); m.b(5, 36, 6, 2.4, 2.6, T.CONT, 0); m.b(22, 32, 2.4, 6, 2.6, T.CONT, 4);
  m.b(-8, -22, 6, 2.4, 2.6, T.CONT, 4); m.b(8, 22, 6, 2.4, 2.6, T.CONT, 2); m.b(-20, 12, 2.4, 6, 2.6, T.CONT, 1); m.b(20, -12, 2.4, 6, 2.6, T.CONT, 3);
  // barricadas e muros baixos
  m.b(-20, -6, 5, .9, 1.1, T.BAG, 0); m.b(20, 6, 5, .9, 1.1, T.BAG, 0); m.b(-8, 12, 4, .9, 1.1, T.BAG, 1); m.b(8, -12, 4, .9, 1.1, T.BAG, 1);
  m.b(-12, -10, 3, .8, 1.1, T.CONC, 1); m.b(12, 10, 3, .8, 1.1, T.CONC, 1); m.b(10, -24, 3, .8, 1.1, T.CONC, 1); m.b(-10, 24, 3, .8, 1.1, T.CONC, 1);
  m.b(26, -4, .8, 3, 1.1, T.CONC, 1); m.b(-26, 4, .8, 3, 1.1, T.CONC, 1);
  m.crates(-16, 18); m.crates(16, -18); m.crates(0, -24); m.crates(0, 24);
  m.b(-3, -15, 1.4, 1, .9, T.AMMO); m.b(3, 15, 1.4, 1, .9, T.AMMO); m.b(-44, 8, 1.4, 1, .9, T.AMMO); m.b(44, -8, 1.4, 1, .9, T.AMMO);
  m.b(-24, 4, .7, .7, 1, T.PLAIN, 2); m.fire(-24, 1.1, 4, .6); m.b(24, -4, .7, .7, 1, T.PLAIN, 2); m.fire(24, 1.1, -4, .6);
  m.tower(-42, -42, 1); m.tower(42, 42, -1); m.tower(-42, 42, -1); m.tower(42, -42, 1);
  return { name: 'Base Militar', theme: 'base', lim: L, ...pack(m), trees: [], spawns: [[-40, -28], [40, 28], [-40, 28], [40, -28], [0, -42], [0, 42], [-44, 0], [44, 0]] };
}

// ---------------- MAPA 2: COMPLEXO INDUSTRIAL ----------------
function industrial() {
  const m = Builder(), L = 44; m.border(L, 4.5, T.TIN, 0, 1.2);
  m.room(-24, -22, 22, 14, 6, T.TIN, 0, { n: [-6], s: [-6, 8], e: [0], w: [0] }, { roofT: T.TIN });     // galpão A
  m.b(-26, -25.5, 12, 1.2, 2.4, T.STEEL, 0); m.b(-26, -21.5, 12, 1.2, 2.4, T.STEEL, 0); m.crates(-16, -18);
  m.room(24, 22, 22, 14, 6, T.TIN, 0, { s: [6], n: [6, -8], w: [0], e: [0] }, { roofT: T.TIN });         // galpão B
  m.b(26, 25.5, 12, 1.2, 2.4, T.STEEL, 0); m.b(26, 21.5, 12, 1.2, 2.4, T.STEEL, 0); m.crates(16, 18);
  m.room(0, 0, 8, 6, 3.2, T.MIL, 2, { n: [0], s: [0], e: [0], w: [0] });                               // cabine de controle
  m.b(-9, -4, 5, 3, 3, T.STEEL, 1); m.b(9, 4, 5, 3, 3, T.STEEL, 1); m.b(-9, 9, 3.5, 3.5, 5, T.PLAIN, 1); m.b(9, -9, 3.5, 3.5, 5, T.PLAIN, 1);   // máquinas e tanques
  m.wx(9, 12, 36, 4, T.CONC, 1, .5); m.wx(12.5, 12, 36, 4, T.CONC, 1, .5); m.wx(-9, -36, -12, 4, T.CONC, 1, .5); m.wx(-12.5, -36, -12, 4, T.CONC, 1, .5);   // corredores estreitos
  m.b(0, -34, 26, .6, .55, T.PLAIN, 1); m.b(0, 34, 26, .6, .55, T.PLAIN, 1);                           // tubulações no chão (dá para pisar)
  m.dec(0, -10, 40, .5, .5, T.PLAIN, 1, 4.8); m.dec(0, 10, 40, .5, .5, T.PLAIN, 1, 4.8); m.dec(-10, 0, .5, 40, .5, T.PLAIN, 1, 5.4);
  m.dec(0, -30, 40, 2, .25, T.STEEL, 0, 4.8); m.b(-20, -30, .7, .7, 4.8, T.STEEL, 0); m.b(20, -30, .7, .7, 4.8, T.STEEL, 0);
  m.dec(0, 30, 40, 2, .25, T.STEEL, 0, 4.8); m.b(-20, 30, .7, .7, 4.8, T.STEEL, 0); m.b(20, 30, .7, .7, 4.8, T.STEEL, 0);
  m.crates(-16, 6); m.crates(16, -6); m.crates(0, -18); m.crates(0, 18); m.crates(30, -24); m.crates(-30, 24);
  m.b(36, -26, 2.4, 6, 2.6, T.CONT, 2); m.b(-36, 26, 2.4, 6, 2.6, T.CONT, 3); m.b(-6, 22, 6, 2.4, 2.6, T.CONT, 1); m.b(6, -22, 6, 2.4, 2.6, T.CONT, 4);
  m.b(-18, 0, .7, .7, 1, T.PLAIN, 2); m.fire(-18, 1.1, 0, .6); m.b(18, 0, .7, .7, 1, T.PLAIN, 2); m.fire(18, 1.1, 0, .6);
  m.b(-3, 14, 1.4, 1, .9, T.AMMO); m.b(3, -14, 1.4, 1, .9, T.AMMO);
  return { name: 'Complexo Industrial', theme: 'industrial', lim: L, ...pack(m), trees: [], spawns: [[-40, 2], [40, -2], [0, -40], [0, 40], [-38, -8], [38, 8], [-14, 20], [14, -20]] };
}

// ---------------- MAPA 3: DESERTO MILITAR ----------------
function desert() {
  const m = Builder(), L = 60; m.border(L, 4, T.SAND, 0, 3);
  const dune = (cx, cz, w, d, v) => { m.b(cx, cz, w, d, .5, T.SAND, v); m.b(cx, cz, w * .7, d * .7, 1, T.SAND, v); m.b(cx, cz, w * .4, d * .4, 1.5, T.SAND, v); };
  dune(-40, -34, 24, 16, 0); dune(42, 36, 24, 16, 1); dune(40, -40, 18, 12, 1); dune(-44, 38, 18, 12, 0); dune(-12, 48, 16, 10, 1); dune(12, -48, 16, 10, 0);
  m.wx(-11, -15, 15, 3, T.STUCCO, 1, .6, [[-2.5, 2.5]]); m.wx(11, -15, 15, 3, T.STUCCO, 1, .6, [[-2.5, 2.5]]);        // posto avançado murado
  m.wz(-15, -11, 11, 3, T.STUCCO, 1, .6, [[-2.5, 2.5]]); m.wz(15, -11, 11, 3, T.STUCCO, 1, .6, [[-2.5, 2.5]]);
  m.room(-7, -3, 8, 6, 3.2, T.STUCCO, 1, { s: [0], e: [0] }); m.room(7, 3, 8, 6, 3.2, T.STUCCO, 2, { n: [0], w: [0] });
  m.tower(12, -8, 1); m.crates(-11, 6); m.b(-2, 8, 1.4, 1, .9, T.AMMO);
  // veículos abandonados
  const car = (x, z, v) => { m.b(x, z, 4.4, 1.9, 1, T.CAR, v); m.b(x + .2, z, 2.2, 1.7, .8, T.CAR, v, 1); for (const [dx, dz] of [[-1.4, -1], [1.4, -1], [-1.4, 1], [1.4, 1]]) m.dec(x + dx, z + dz, .8, .3, .8, T.BLACK); };
  const truck = (x, z, v) => { m.b(x, z, 6, 2.5, 2.4, T.CAR, v); m.b(x + 4, z, 2, 2.3, 1.9, T.CAR, v); for (const dx of [-2, 0, 2, 4]) for (const dz of [-1.3, 1.3]) m.dec(x + dx, z + dz, .9, .35, .9, T.BLACK); };
  car(-24, 14, 0); car(26, -16, 1); car(-8, -36, 2); car(14, 34, 3); car(30, 22, 1); m.fire(30, 1.4, 22, 1.2); truck(-34, -6, 1); truck(30, 2, 0);
  // barreiras, ninhos de sacos e caixas
  const nest = (x, z) => { m.b(x, z, 4, .9, 1.1, T.BAGS, 0); m.b(x - 2, z + 1.5, .9, 2.4, 1.1, T.BAGS, 0); m.b(x + 2, z + 1.5, .9, 2.4, 1.1, T.BAGS, 0); };
  nest(-20, -16); nest(20, 16); nest(-30, 18); nest(32, -24); nest(0, -28); nest(0, 28);
  m.b(-14, -24, .8, 4, 1.1, T.CONC, 1); m.b(14, 24, .8, 4, 1.1, T.CONC, 1); m.b(-26, 6, 4, .8, 1.1, T.CONC, 1); m.b(26, -6, 4, .8, 1.1, T.CONC, 1); m.b(-48, -8, .8, 4, 1.1, T.CONC, 1); m.b(48, 8, .8, 4, 1.1, T.CONC, 1);
  m.crates(-18, 30); m.crates(18, -30); m.crates(-44, -16); m.crates(44, 16);
  m.b(-5, 20, .7, .7, 1, T.PLAIN, 2); m.b(5, -20, .7, .7, 1, T.PLAIN, 2);
  m.tower(-50, 24, -1); m.tower(50, -24, 1);
  return { name: 'Deserto Militar', theme: 'desert', lim: L, ...pack(m), trees: [], spawns: [[-52, 0], [52, 0], [0, -52], [0, 52], [-50, -22], [50, 22], [-26, 48], [26, -48]] };
}
function pack(m) { return { boxes: m.boxes, decor: m.decor, fires: m.fires }; }

const MAPS = { base: base(), industrial: industrial(), desert: desert() };
module.exports = { MAPS, T };
