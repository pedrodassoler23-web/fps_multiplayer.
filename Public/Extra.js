/* extras.js — inventário/skins, missões/moedas, placar completo, estatísticas e controle de bots.
   O servidor injeta este arquivo no fim do index.html (o index.html em si NÃO é alterado).
   Usa as variáveis do jogo (sock, models, others, setPause...). O menu inicial não é tocado. */
(function () {
  'use strict';
  try { init(); } catch (e) { console.error('extras.js falhou (o jogo base continua normal):', e); }

  function init() {
    if (typeof sock === 'undefined' || typeof models === 'undefined' || typeof THREE === 'undefined') { console.warn('extras.js: jogo base não encontrado'); return; }

    let PF = null, CAT = [], ITEMS = {}, MOBJ = [], SNAP = [], RM = null, END = null, REW = null;
    let tab = 'w', hubOpen = false, sbOpen = false, xPaused = false, sbT = 0, hbT = 0, endT = 0, toastT = 0, selBots = 2, selDiff = 'med';
    const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const hex6 = n => (n >>> 0).toString(16).padStart(6, '0'), hexc = n => '#' + hex6(n);
    const NOUN = { k: 'eliminações', m: 'partidas', w: 'vitórias', a: 'assistências' };

    // ---------- Visual ----------
    const css = `
#xcoin{position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:7;display:none;background:#000a;border:1px solid #ffe08a88;color:#ffe08a;padding:3px 12px;font-size:12px;font-weight:700;letter-spacing:1px;touch-action:manipulation;white-space:nowrap}
#board{pointer-events:auto!important;touch-action:manipulation}
#board::after{content:"toque: placar completo";display:block;font-size:9px;opacity:.6;margin-top:3px}
#xtoast{position:fixed;left:50%;top:92px;transform:translateX(-50%);z-index:35;display:none;background:#000d;border:1px solid #fff4;padding:6px 12px;font-size:13px;pointer-events:none;max-width:90vw;text-align:center}
.xp{position:fixed;inset:0;z-index:30;display:none;overflow-y:auto;background:#0a0e06f5;padding:12px}
.xp,.xp *,#xsb,#xsb *,#xend,#xend *{touch-action:pan-y}
.xp button,#xsb button,#xcoin{touch-action:manipulation}
.xin{width:min(430px,100%);margin:0 auto;display:flex;flex-direction:column;gap:10px}
.xh{display:flex;align-items:center;gap:8px}.xh h2{margin:0;font-size:20px;letter-spacing:3px;color:var(--sand);flex:1}
.xw{color:#ffe08a;font-weight:700;font-size:15px}
.xtabs{display:flex;gap:4px}.xtabs button{flex:1;padding:9px 2px;font-size:11px;letter-spacing:1px;font-weight:700;border-radius:3px;border:1px solid var(--line);background:#1c2214;color:#9aa57a}
.xtabs button.on{background:#3c4a22;color:#fff;border-color:#9bb25a}
.xgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.xc{background:#1c2214;border:1px solid var(--line);padding:6px;display:flex;flex-direction:column;gap:5px}
.xc.eq{border-color:#7bd34a;box-shadow:inset 0 0 0 1px #7bd34a}.xc.lk{opacity:.8}
.xc canvas{width:100%;height:auto;background:#0d100a;display:block}
.xn{font-size:13px;font-weight:700;letter-spacing:1px}
.xs{font-size:10px;letter-spacing:1px;font-weight:700}.xs.on{color:#7bd34a}.xs.ok{color:#c9d68a}.xs.lock{color:#e09090}
.xr{font-size:11px;color:#aab38c;min-height:28px}
.xb{padding:9px 6px;font-size:12px;font-weight:700;letter-spacing:1px;border-radius:3px;border:1px solid var(--line);background:#2a3320;color:var(--sand)}
.xb.pri{background:linear-gradient(#6f8438,#4b5a2a);color:#fff;border-color:#9bb25a}.xb.gold{background:#5a4510;color:#ffe08a;border-color:#ffe08a88}.xb:disabled{opacity:.4}
.xm{background:#1c2214;border:1px solid var(--line);padding:8px;display:flex;flex-direction:column;gap:5px;font-size:13px}
.xbar{height:8px;background:#0009;border:1px solid #fff3}.xbar i{display:block;height:100%;background:#7bd34a}
.xrow{display:flex;justify-content:space-between;gap:8px}
.xsm{font-size:11px;color:#9aa57a}
.xp select{width:100%;padding:10px;font-size:15px;border-radius:3px;border:1px solid var(--line);background:#1c2214;color:#fff;touch-action:manipulation}
#xsb,#xend{position:fixed;left:50%;transform:translateX(-50%);background:#0a0e06f0;border:1px solid var(--line);border-left:4px solid var(--ol2);padding:8px;width:min(440px,96vw);max-height:72vh;overflow-y:auto;display:none}
#xsb{top:62px;z-index:25}#xend{top:50%;transform:translate(-50%,-50%);z-index:31;border-left-width:4px}
.xt{width:100%;border-collapse:collapse;font-size:12px}.xt th{font-size:10px;letter-spacing:1px;color:#9aa57a;text-align:right;padding:3px}.xt th:first-child,.xt td:first-child{text-align:left}
.xt td{padding:4px 3px;text-align:right;border-top:1px solid #ffffff14}.xt tr.me td{background:#6f843833;font-weight:700}.xt tr.tm td{background:#ffffff10;font-weight:700;letter-spacing:1px}
.xsh{display:flex;align-items:center;gap:8px;margin-bottom:6px}.xsh b{flex:1;letter-spacing:2px}`;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    document.body.insertAdjacentHTML('beforeend', `
<div class="ui" id="xcoin">🪙 --</div><div class="ui" id="xtoast"></div>
<div class="ui xp" id="xhub"><div class="xin" id="xhubin"></div></div>
<div class="ui" id="xsb"></div><div class="ui" id="xend"></div>`);

    // ---------- Servidor: perfil ----------
    function hello() { let bak = null; try { bak = JSON.parse(LS.get('fpsBak') || 'null'); } catch (e) { } sock.emit('x:hello', { tok: LS.get('fpsTok') || '', bak }); }
    sock.on('connect', hello); if (sock.connected) hello();
    sock.on('x:profile', v => {
      if (!v || typeof v !== 'object' || !v.eq) return;
      if (v.cat) { CAT = v.cat; ITEMS = {}; CAT.forEach(i => ITEMS[i.id] = i); }
      if (v.mobj) MOBJ = v.mobj;
      if (v.tok) LS.set('fpsTok', v.tok);
      if (v.bak) LS.set('fpsBak', JSON.stringify(v.bak));
      PF = v; applyMine(); updChip(); if (hubOpen) renderHub();
    });
    sock.on('x:unlock', ids => { toast('Desbloqueado: ' + (ids || []).map(i => ITEMS[i] ? ITEMS[i].name : i).join(', ') + '!'); });
    sock.on('x:room', r => { RM = r; if (hubOpen && tab === 'b') renderHub(); });
    sock.on('x:end', d => { END = d; REW = null; renderEnd(); clearTimeout(endT); endT = setTimeout(hideEnd, d.ms || 8000); });
    sock.on('x:reward', r => { REW = r; if (END) renderEnd(); });
    sock.on('x:round', () => { hideEnd(); toast('Nova partida!'); });
    function call(ev, data, okMsg) {
      const cb = (err, r) => { if (err) { toast('Sem resposta do servidor'); return; } if (r && !r.ok) toast(r.msg || 'Erro'); else if (r && r.ok) { if (r.coins) toast('+' + r.coins + ' 🪙'); else if (okMsg) toast(okMsg); } };
      if (sock.timeout) sock.timeout(5000).emit(ev, data, cb); else sock.emit(ev, data, r => cb(null, r));
    }
    function toast(t) { const e = $('xtoast'); e.textContent = t; e.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => { e.style.display = 'none'; }, 2800); }
    function updChip() { $('xcoin').textContent = '🪙 ' + (PF ? PF.coins : '--'); }

    // ---------- Skins: arma em 1ª pessoa, arma e roupa dos outros jogadores ----------
    const lum = h => ((h >> 16 & 255) + (h >> 8 & 255) + (h & 255)) / 3;
    function skinPart(p, c) {   // peças escuras demais (cano, mira, pente) ou claras demais mantêm a cor original
      if (!c) return { col: p[6], sh: p[7] };
      const L = lum(p[6]); if (L < 40 || L > 200) return { col: p[6], sh: p[7] };
      return p[7] ? { col: c.main, sh: c.shine ? 1 : p[7] } : { col: c.acc, sh: c.shine ? 1 : 0 };
    }
    function applyMine() {
      if (!PF || !ITEMS[PF.eq.w]) return;
      const ws = ITEMS[PF.eq.w], os = ITEMS[PF.eq.o];
      models.forEach((g, i) => MODELS[i].forEach((p, j) => { const m = g.children[j]; if (!m) return; const r = skinPart(p, ws.c); m.material = gunMat(r.col, r.sh); }));
      if (os && os.c && os.c.sleeve !== undefined) sleeveM.color.setHex(os.c.sleeve);
    }
    function camoCanvas(c, size) {
      const cv = document.createElement('canvas'); cv.width = cv.height = size || 128; const x = cv.getContext('2d'), k = cv.width / 128;
      x.fillStyle = c.base; x.fillRect(0, 0, cv.width, cv.height);
      for (const col of c.blobs) for (let i = 0; i < 24; i++) { x.fillStyle = col; x.beginPath(); x.ellipse(rnd(0, 115) * k, rnd(0, 128) * k, rnd(5, 14) * k, rnd(4, 10) * k, rnd(0, 3), 0, 7); x.fill(); }
      return cv;
    }
    const OT = {}, GS = {};
    function outfitMat(id) {
      const it = ITEMS[id]; if (!it || !it.c || id === 'o_default') return matSold; if (OT[id]) return OT[id];
      const cv = camoCanvas(it.c), x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(121, 0, 7, 128);   // faixa branca = peças lisas só com a cor do vértice
      const t = new THREE.CanvasTexture(cv); t.generateMipmaps = false; t.minFilter = t.magFilter = THREE.LinearFilter;
      return OT[id] = new THREE.MeshLambertMaterial({ map: t, vertexColors: true });
    }
    function gunGeoSkin(w, id) {
      const k = w + id; if (GS[k]) return GS[k]; const it = ITEMS[id], c = it && it.c;
      return GS[k] = mergeGeos(MODELS[w].map(p => { const r = skinPart(p, c); return bx(p[0], p[1], p[2], p[3], p[4], p[5], r.col, 0); }));
    }
    const _setW3 = window.setW3;   // quando o jogo troca a arma de um soldado, reaplica a skin dele
    window.setW3 = function (g, w) { _setW3(g, w); const u = g.userData; if (u.xw && u.xw !== 'w_default' && ITEMS[u.xw]) u.gm.geometry = gunGeoSkin(w, u.xw); };
    function applyOutfit(g, id) { const mat = outfitMat(id); g.traverse(o => { if (o.isMesh) o.material = mat; }); }
    sock.on('snap', s => {
      SNAP = s; const n = performance.now();
      for (const p of s) {
        if (p.id === myId || !p.oc) continue; const g = others[p.id]; if (!g) continue; const u = g.userData;
        if (u.xo !== p.oc) { u.xo = p.oc; applyOutfit(g, p.oc); }
        if (u.xw !== p.ws) { u.xw = p.ws; window.setW3(g, u.w >= 0 ? u.w : 0); }
      }
      if (sbOpen && n - sbT > 400) { sbT = n; renderSB(); }
      if (hubOpen && tab === 'm' && n - hbT > 800) { hbT = n; renderHub(); }
    });

    // ---------- Pré-visualizações (desenhadas, sem modelos novos) ----------
    function prevW(c) {
      const cv = document.createElement('canvas'); cv.width = 120; cv.height = 60; const x = cv.getContext('2d');
      const main = c ? hexc(c.main) : '#2d3a2d', acc = c ? hexc(c.acc) : '#3b2f22';
      x.fillStyle = acc; x.fillRect(4, 22, 18, 18); x.fillRect(48, 34, 10, 18);
      x.fillStyle = main; x.fillRect(18, 20, 66, 15);
      x.fillStyle = '#111'; x.fillRect(84, 23, 30, 5); x.fillStyle = '#1a1a1a'; x.fillRect(62, 34, 9, 14);
      if (c && c.shine) { x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(20, 21, 62, 3); }
      return cv;
    }
    function prevO(c) {
      const cv = document.createElement('canvas'); cv.width = 120; cv.height = 60; const x = cv.getContext('2d'), pat = x.createPattern(camoCanvas(c, 64), 'repeat');
      x.fillStyle = pat; x.fillRect(38, 24, 44, 34); x.fillRect(28, 26, 10, 24); x.fillRect(82, 26, 10, 24);
      x.fillStyle = '#d9a77e'; x.beginPath(); x.arc(60, 17, 8, 0, 7); x.fill();
      x.fillStyle = pat; x.beginPath(); x.arc(60, 15, 11, Math.PI, 0); x.fill();
      x.fillStyle = '#2c3126'; x.fillRect(44, 30, 32, 16); return cv;
    }

    // ---------- Painel: inventário / missões / status / bots ----------
    function openHub(t) {
      if (!inRoom) return; if (t) tab = t;
      if (!paused) { setPause(true); xPaused = true; } else xPaused = false;
      hubOpen = true; $('xhub').style.display = 'block'; renderHub();
    }
    function closeHub() { hubOpen = false; $('xhub').style.display = 'none'; if (xPaused) { xPaused = false; setPause(false); } }
    function reqText(it) { const cur = PF ? (PF.st[it.req.s] || 0) : 0; return it.req.s === 'k' ? `Faça ${it.req.n} eliminações (${Math.min(cur, it.req.n)}/${it.req.n})` : it.req.s === 'm' ? `Jogue ${it.req.n} partidas (${Math.min(cur, it.req.n)}/${it.req.n})` : `${it.req.n} ${NOUN[it.req.s]} (${Math.min(cur, it.req.n)}/${it.req.n})`; }
    function card(it) {
      const own = PF.owned.includes(it.id), eq = PF.eq[it.kind] === it.id; let state, act = '';
      if (eq) { state = '<span class="xs on">✔ EQUIPADO</span>'; if (!it.id.endsWith('_default')) act = `<button class="xb" data-a="eq" data-k="${it.kind}" data-id="">DESEQUIPAR</button>`; }
      else if (own) { state = '<span class="xs ok">DESBLOQUEADO</span>'; act = `<button class="xb pri" data-a="eq" data-k="${it.kind}" data-id="${it.id}">EQUIPAR</button>`; }
      else { state = '<span class="xs lock">🔒 BLOQUEADO</span>'; act = it.price > 0 ? `<button class="xb gold" data-a="buy" data-id="${it.id}" ${PF.coins < it.price ? 'disabled' : ''}>COMPRAR 🪙${it.price}</button>` : `<div class="xr">${esc(it.req ? reqText(it) : 'Indisponível')}</div>`; }
      return `<div class="xc ${eq ? 'eq' : ''} ${own ? '' : 'lk'}"><canvas data-p="${it.id}" width="120" height="60"></canvas><div class="xn">${esc(it.name)}</div>${state}${act}</div>`;
    }
    function renderHub() {
      const box = $('xhubin'); if (!PF) { box.innerHTML = '<div class="xh"><h2>INVENTÁRIO</h2><button class="xb" id="xclose">FECHAR</button></div><div class="xm">Perfil indisponível (sem conexão com o servidor ou servidor desatualizado).</div>'; return; }
      const tabs = [['w', 'ARMAS'], ['o', 'ROUPAS'], ['m', 'MISSÕES'], ['s', 'STATUS'], ['b', 'BOTS']].map(([k, n]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('');
      let body = '';
      if (tab === 'w' || tab === 'o') {
        body = `<div class="xsm">${tab === 'w' ? 'Skins de arma' : 'Roupas militares'} são só visuais: não mudam dano, precisão nem velocidade. Itens grátis se desbloqueiam jogando; os outros custam moedas (missões e vitórias dão moedas).</div><div class="xgrid">${CAT.filter(i => i.kind === tab).map(card).join('')}</div>`;
      } else if (tab === 'm') {
        const me = SNAP.find(p => p.id === myId) || {}, mp = { k: me.k || 0, a: me.a || 0, win: 0 };
        body = `<div class="xsm">Missões diárias (zeram todo dia). Cada recompensa só pode ser resgatada uma vez.</div>` + PF.missions.map(m => {
          const done = m.prog >= m.goal, btn = m.claimed ? '<button class="xb" disabled>RESGATADA</button>' : done ? `<button class="xb gold" data-a="claim" data-id="${m.id}">RESGATAR 🪙${m.reward}</button>` : `<div class="xsm" style="text-align:center">🪙${m.reward}</div>`;
          return `<div class="xm"><div class="xrow"><b>${esc(m.text)}</b><span>${m.prog}/${m.goal}</span></div><div class="xbar"><i style="width:${m.prog / m.goal * 100}%"></i></div>${btn}</div>`;
        }).join('') + `<div class="xsm" style="margin-top:4px">Objetivos desta partida (pagos sozinhos quando ela termina; hoje: ${PF.day.mc}/${PF.cap} 🪙 de partidas)${RM && RM.lim ? ` • a partida acaba com ${RM.lim} eliminações${RM.mode === 'team' ? ' da equipe' : ''}` : ''}</div>` +
          MOBJ.map(o => { const v = Math.min(o.goal, mp[o.s] || 0); return `<div class="xm"><div class="xrow"><b>${esc(o.text)}</b><span>${v}/${o.goal}</span></div><div class="xbar"><i style="width:${v / o.goal * 100}%"></i></div><div class="xsm">Recompensa: 🪙${o.reward}</div></div>`; }).join('');
      } else if (tab === 's') {
        const S = PF.sess || { k: 0, d: 0, a: 0, m: 0, w: 0 }, T = PF.st, kd = o => (o.d ? (o.k / o.d).toFixed(2) : o.k.toFixed(2));
        const r = (n, a, b) => `<tr><td>${n}</td><td>${a}</td><td>${b}</td></tr>`;
        body = `<table class="xt"><tr><th></th><th>SESSÃO</th><th>TOTAL</th></tr>${r('Eliminações', S.k, T.k)}${r('Mortes', S.d, T.d)}${r('Assistências', S.a, T.a)}${r('Partidas', S.m, T.m)}${r('Vitórias', S.w, T.w)}${r('K/D', kd(S), kd(T))}</table><div class="xsm">Sessão = desde que o app conectou. Total = salvo no perfil. Partidas e vitórias só contam em partidas que terminam (limite de eliminações).</div>`;
      } else {
        const own = RM && RM.owner === myId;
        body = RM ? `<div class="xm"><div class="xrow"><b>Sala ${esc(roomCode)}</b><span>Bots: ${RM.bots}</span></div><div class="xsm">Dificuldade atual: ${esc({ easy: 'fácil', med: 'médio', hard: 'difícil' }[RM.diff] || RM.diff)}. Bots aparecem no placar marcados com [BOT].</div></div>` +
          (own ? `<div class="xm"><div class="xsm">QUANTIDADE (0 a ${RM.botMax})</div><select id="xbn">${Array.from({ length: RM.botMax + 1 }, (_, i) => `<option value="${i}">${i}</option>`).join('')}</select><div class="xsm">DIFICULDADE</div><select id="xbd"><option value="easy">Fácil</option><option value="med">Médio</option><option value="hard">Difícil</option></select><button class="xb pri" data-a="bots">APLICAR</button></div>` : `<div class="xm">Só o dono da sala${RM.ownerName ? ' (' + esc(RM.ownerName) + ')' : ''} controla os bots.</div>`) : '<div class="xm">Entre numa sala para usar bots.</div>';
      }
      box.innerHTML = `<div class="xh"><h2>INVENTÁRIO</h2><span class="xw">🪙 ${PF.coins}</span><button class="xb" id="xclose">FECHAR</button></div><div class="xtabs">${tabs}</div>${body}`;
      box.querySelectorAll('canvas[data-p]').forEach(cv => { const it = ITEMS[cv.dataset.p]; if (!it) return; const src = it.kind === 'w' ? prevW(it.c) : prevO(it.c); cv.getContext('2d').drawImage(src, 0, 0); });
      if ($('xbn')) { $('xbn').value = selBots = Math.min(selBots, RM.botMax); $('xbd').value = selDiff; $('xbn').onchange = e => { selBots = +e.target.value; }; $('xbd').onchange = e => { selDiff = e.target.value; }; }
    }
    $('xhub').addEventListener('click', e => {
      const t = e.target.closest('[data-t]'); if (t) { tab = t.dataset.t; renderHub(); return; }
      if (e.target.closest('#xclose')) { closeHub(); return; }
      const b = e.target.closest('button[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a;
      if (a === 'eq') call('x:equip', { kind: b.dataset.k, id: b.dataset.id || null });
      else if (a === 'buy') call('x:buy', { id: b.dataset.id }, 'Comprado!');
      else if (a === 'claim') call('x:claim', { id: b.dataset.id });
      else if (a === 'bots') call('x:bots', { n: selBots, diff: selDiff }, 'Bots atualizados');
    });
    $('xhub').addEventListener('mousedown', e => e.stopPropagation());
    // painéis com rolagem: impede que o controle de câmera do jogo bloqueie o arrastar para rolar
    for (const id of ['xhub', 'xsb', 'xend']) $(id).addEventListener('touchmove', e => e.stopPropagation(), { passive: true });

    // ---------- Placar completo (toque no placar pequeno ou TAB) ----------
    function renderSB() {
      const s = SNAP.slice().sort((a, b) => (b.sc || 0) - (a.sc || 0) || b.k - a.k), team = s.some(p => p.t >= 0);
      const row = p => `<tr class="${p.id === myId ? 'me' : ''}"><td style="color:${hexc(teamCol(p.t))}">${esc(p.n)}${p.id === myId ? ' (você)' : ''}</td><td>${p.k}</td><td>${p.d}</td><td>${p.a || 0}</td><td>${p.sc || 0}</td><td>${p.b ? '—' : (p.pg || 0)}</td></tr>`;
      let rows = '';
      if (team) for (const t of [0, 1]) { const g = s.filter(p => p.t === t); if (g.length) rows += `<tr class="tm"><td colspan="6" style="color:${hexc(teamCol(t))}">${t === 0 ? 'EQUIPE VERMELHA' : 'EQUIPE AZUL'} — ${g.reduce((a, p) => a + p.k, 0)} elim.</td></tr>` + g.map(row).join(''); }
      else rows = s.map(row).join('');
      $('xsb').innerHTML = `<div class="xsh"><b>PLACAR</b><button class="xb" id="xsbc">✕</button></div><table class="xt"><tr><th>JOGADOR</th><th>K</th><th>M</th><th>A</th><th>PTS</th><th>MS</th></tr>${rows}</table><div class="xsm">K eliminações • M mortes • A assistências • PTS pontos • MS latência${RM && RM.lim ? ` • meta: ${RM.lim} elim.` : ''}</div>`;
    }
    function toggleSB(on) { sbOpen = on === undefined ? !sbOpen : on; $('xsb').style.display = sbOpen ? 'block' : 'none'; if (sbOpen) renderSB(); }
    $('board').classList.add('ui'); $('board').addEventListener('click', e => { e.stopPropagation(); toggleSB(); });
    $('xsb').addEventListener('click', e => { if (e.target.closest('#xsbc')) toggleSB(false); });
    $('xsb').addEventListener('mousedown', e => e.stopPropagation());
    addEventListener('keydown', e => { if (e.code === 'Tab' && inRoom) { e.preventDefault(); toggleSB(); } });

    // ---------- Fim de partida ----------
    function renderEnd() {
      const e = $('xend'); if (!END) { e.style.display = 'none'; return; }
      const rows = END.rows.slice(0, 8).map(p => `<tr><td style="color:${hexc(teamCol(p.t))}">${esc(p.n)}</td><td>${p.k}</td><td>${p.d}</td><td>${p.a}</td><td>${p.sc}</td></tr>`).join('');
      let rw = '';
      if (REW) rw = `<div class="xm"><b style="color:${REW.win ? '#7bd34a' : '#fff'}">${REW.win ? 'VOCÊ VENCEU!' : 'Fim da partida'}</b>${REW.lines.map(l => `<div>${esc(l)}</div>`).join('')}${REW.coins ? `<div class="xw">+${REW.coins} 🪙</div>` : ''}${REW.msg ? `<div class="xsm">${esc(REW.msg)}</div>` : ''}</div>`;
      e.innerHTML = `<div class="xsh"><b>${esc(END.title)}</b></div><table class="xt"><tr><th>JOGADOR</th><th>K</th><th>M</th><th>A</th><th>PTS</th></tr>${rows}</table>${rw}<div class="xsm">Nova partida em instantes...</div>`;
      e.style.display = 'block';
    }
    function hideEnd() { END = null; REW = null; $('xend').style.display = 'none'; }

    // ---------- Entradas na interface existente (o menu inicial não muda) ----------
    const chip = $('xcoin'); chip.addEventListener('click', e => { e.stopPropagation(); openHub(); }); chip.addEventListener('mousedown', e => e.stopPropagation());
    const pb = document.createElement('button'); pb.id = 'xOpen'; pb.textContent = 'INVENTÁRIO / MISSÕES'; const anchor = $('bCfg2'); if (anchor) anchor.after(pb); else $('pause').appendChild(pb);
    pb.addEventListener('click', e => { e.stopPropagation(); openHub(); });
    setInterval(() => { chip.style.display = inRoom && !paused ? 'block' : 'none'; }, 300);
    // latência: mede o tempo de ida e volta e informa o servidor (aparece no placar)
    setInterval(() => { if (!inRoom || !sock.connected) return; const t = performance.now(); sock.emit('x:ping', () => sock.emit('x:rtt', Math.round(performance.now() - t))); }, 2000);
    updChip();
  }
})();
