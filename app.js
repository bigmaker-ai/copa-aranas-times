/* SITE DOS TIMES · Copa Aranãs: página estática (GitHub Pages) + banco na Cloudflare (site-times/worker).
 * Cada time tem a sua senha, pedida ao abrir o link (e lembrada neste aparelho). Tudo salva sozinho, por jogador.
 * Pra transmissão, o botão 📡 abre a página /receber-time do PC com tudo no endereço (o site é https e não
 * enxerga o PC na rede); o link longo no WhatsApp também leva tudo, então o PC não depende do banco. */
const API = /^(127\.0\.0\.1|localhost)$/.test(location.hostname) ? 'http://127.0.0.1:8787' : 'https://copa-times.copa-aranas-times-api.workers.dev';
let CODIGO = '';
const POSICOES = [['GK', 'Goleiro'], ['LT', 'Lateral'], ['DF', 'Defesa'], ['MF', 'Meio'], ['FW', 'Ataque']];
const FORMACOES = ['4-3-3', '4-2-3-1', '4-4-2', '4-1-4-1', '3-5-2', '3-4-3', '5-3-2', '4-2-2-2'];
/* acima disso não vai como link: vai como arquivo (o texto longo demais pode não abrir no WhatsApp) */
const LIMITE_LINK = 20000;
const PC_PADRAO = 'https://copa-aranas.local:4443';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ler = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const grava = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const baseUrl = () => location.origin + location.pathname;
const linkDoTime = (slug) => `${baseUrl()}?time=${slug}`;

function toast(txt, bom) {
  const t = $('toast');
  t.textContent = txt;
  t.className = bom ? 'toast bom' : 'toast';
  t.hidden = false;
  clearTimeout(toast.h);
  toast.h = setTimeout(() => { t.hidden = true; }, 4500);
}
function abreSheet(html) { $('toast').hidden = true; $('sheet-box').innerHTML = html; $('sheet').hidden = false; }
function fechaSheet() { $('sheet').hidden = true; }
$('sheet').addEventListener('click', (e) => { if (e.target === $('sheet')) fechaSheet(); });

/* ── o pacote: JSON comprimido dentro do link ── */
const b64url = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
async function fecha(obj) {
  const puro = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === 'undefined') return 'p' + b64url(puro);
  const s = new Blob([puro]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return 'z' + b64url(new Uint8Array(await new Response(s).arrayBuffer()));
}
async function abre(txt) {
  const bytes = Uint8Array.from(atob(txt.slice(1).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  if (txt[0] === 'p') return JSON.parse(new TextDecoder().decode(bytes));
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return JSON.parse(await new Response(s).text());
}

/* ── mesma ordem dos lugares no campo do app da transmissão ── */
const lerp = (a, b, t) => a + (b - a) * t;
function lugares(form) {
  const rows = form.split('-').map(Number).filter((n) => n > 0);
  const out = [{ x: 0.5, y: 0.93, pos: 'GK' }];
  rows.forEach((count, r) => {
    const y = rows.length === 1 ? 0.5 : lerp(0.76, 0.1, r / (rows.length - 1));
    for (let i = 0; i < count; i++) {
      // na linha de defesa com 4 ou 5, as pontas são os laterais
      const pos = r === 0 ? (count >= 4 && (i === 0 || i === count - 1) ? 'LT' : 'DF') : r === rows.length - 1 ? 'FW' : 'MF';
      out.push({ x: count === 1 ? 0.5 : lerp(0.13, 0.87, i / (count - 1)), y, pos });
    }
  });
  return out;
}

/* ═══ tela do time ═══ */
let T, chave, jogs, E, aba = 'jogadores';

function montaEstado(rasc) {
  const r = rasc || {};
  jogs = T.players.map((p) => {
    const ed = r.ed?.[p.orig] || {};
    return { id: p.orig, o: p.orig, num0: p.number, nome0: p.name, pos0: p.position || '', foto: p.photo || '', num: ed.num ?? String(p.number), nome: ed.nome ?? p.name, pos: ed.pos ?? (p.position || ''), f: ed.f || '', x: !!ed.x, rest: !!ed.rest };
  });
  for (const n of r.novos || []) jogs.push({ id: n.id, o: null, foto: '', num: n.num ?? '', nome: n.nome ?? '', pos: n.pos ?? '', f: n.f || '', x: !!n.x });
  E = { form: FORMACOES.includes(r.esc?.form) ? r.esc.form : '4-3-3', tit: Array.isArray(r.esc?.tit) && r.esc.tit.length === 11 ? r.esc.tit : Array(11).fill(null), res: r.esc?.res || [], tec: r.esc?.tec ?? '' };
  limpaEsc();
}
/* quem saiu do elenco não fica na escalação */
function limpaEsc() {
  const vale = new Set(jogs.filter((j) => !j.x).map((j) => j.id));
  E.tit = E.tit.map((id) => (vale.has(id) ? id : null));
  E.res = E.res.filter((id) => vale.has(id) && !E.tit.includes(id));
}
function mudouCampos(j) {
  if (j.o == null) return false;
  return String(j.num).trim() !== String(j.num0) || j.nome.trim().toUpperCase() !== j.nome0.toUpperCase() || j.pos !== j.pos0;
}
const mexido = (j) => j.o == null || j.x || !!j.f || mudouCampos(j);
/* ── salvar: o que mudou vai pro banco ~1 s depois; o que não foi fica neste celular até conseguir ── */
const registro = (j) => ({ num: String(j.num), nome: j.nome, pos: j.pos, f: j.f, x: !!j.x, rest: !!j.rest, novo: j.o == null });
let noBanco = new Map(), escNoBanco = '', ultimoAt = 0, timerSalva = null, salvando = false, deNovo = false, estadoSalvo = 'salvo';
const chavePend = () => `${chave}.pend`;
function sujos() {
  const jogadores = jogs.filter((j) => JSON.stringify(registro(j)) !== noBanco.get(j.id)).map((j) => ({ id: j.id, dados: registro(j) }));
  const esc = JSON.stringify(E) !== escNoBanco ? E : null;
  return { jogadores, esc };
}
function mostraEstado(e) {
  estadoSalvo = e;
  const el = $('estado-salvo');
  if (el) el.textContent = { salvo: '✔ Tudo salvo', salvando: 'Salvando…', sem: '⚠️ Sem internet: guardado neste celular' }[e];
}
function guarda() {
  pronto = null;
  vezPreparo++;
  const d = sujos();
  grava(chavePend(), d);
  mostraEstado('salvando');
  clearTimeout(timerSalva);
  timerSalva = setTimeout(salvaAgora, 900);
}
/* responde se está tudo no banco */
async function salvaAgora(keepalive) {
  clearTimeout(timerSalva);
  if (salvando) { deNovo = true; return false; }
  const d = sujos();
  if (!d.jogadores.length && !d.esc) { grava(chavePend(), null); mostraEstado('salvo'); return true; }
  salvando = true;
  mostraEstado('salvando');
  const textos = new Map(d.jogadores.map((x) => [x.id, JSON.stringify(x.dados)]));
  const textoEsc = d.esc ? JSON.stringify(d.esc) : null;
  let ok = false;
  try {
    const r = await fetch(`${API}/t/${T.slug}/salvar`, { method: 'POST', keepalive: !!keepalive, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ c: CODIGO, ...d }) });
    ok = r.ok && (await r.json()).ok;
  } catch { /* sem internet */ }
  salvando = false;
  if (ok) {
    for (const [id, t] of textos) noBanco.set(id, t);
    if (textoEsc) escNoBanco = textoEsc;
    const resto = sujos();
    grava(chavePend(), resto.jogadores.length || resto.esc ? resto : null);
    if (deNovo || resto.jogadores.length || resto.esc) { deNovo = false; return salvaAgora(); }
    mostraEstado('salvo');
    return true;
  }
  deNovo = false;
  grava(chavePend(), sujos());
  mostraEstado('sem');
  timerSalva = setTimeout(salvaAgora, 15000);
  return false;
}
async function botaoSalvar() {
  const ok = await salvaAgora();
  if (!ok && estadoSalvo === 'sem') return toast('Sem internet: ficou guardado neste celular e sobe sozinho quando a internet voltar.');
  toast(temErro() ? '✔ Salvo. Só falta corrigir o que está em vermelho.' : '✔ Salvo', !temErro());
}
function aplicaRegistro(id, dados) {
  let j = porId(id);
  if (!j) {
    j = { id, o: null, foto: '', num: '', nome: '', pos: '', f: '', x: false };
    jogs.push(j);
  }
  Object.assign(j, { num: dados.num ?? j.num, nome: dados.nome ?? j.nome, pos: dados.pos ?? j.pos, f: dados.f || '', x: !!dados.x, rest: !!dados.rest });
}
/* o que outra pessoa salvou aparece aqui, sem atrapalhar quem está digitando */
let redesenhaDepois = false;
function redesenha() {
  const digitando = document.activeElement?.matches?.('input, textarea');
  if (digitando || !$('sheet').hidden) { redesenhaDepois = true; return; }
  redesenhaDepois = false;
  if (aba === 'jogadores') desenhaJogadores(); else desenhaEscalacao();
}
async function buscaNovidades() {
  if (document.hidden || !T) return;
  let r;
  try { r = await fetch(`${API}/t/${T.slug}?c=${encodeURIComponent(CODIGO)}&desde=${ultimoAt}`).then((x) => x.json()); } catch { return; }
  if (!r.ok) return;
  ultimoAt = r.agora;
  const pend = sujos();
  const meus = new Set(pend.jogadores.map((x) => x.id));
  let mudou = false;
  for (const l of r.jogadores) {
    const t = JSON.stringify(l.dados);
    if (meus.has(l.id) || noBanco.get(l.id) === t) continue;
    aplicaRegistro(l.id, l.dados);
    noBanco.set(l.id, JSON.stringify(registro(porId(l.id))));
    mudou = true;
  }
  if (r.esc && !pend.esc && JSON.stringify(r.esc) !== escNoBanco) { E = r.esc; limpaEsc(); escNoBanco = JSON.stringify(E); mudou = true; }
  if (mudou) { pronto = null; vezPreparo++; redesenha(); } else if (redesenhaDepois) redesenha();
}
const porId = (id) => jogs.find((j) => j.id === id);
const fotoDe = (j) => j.f || j.foto;
const cardDe = (id) => [...$('corpo').querySelectorAll('[data-card]')].find((x) => x.dataset.card === id);

function repetidos() {
  const c = {};
  for (const j of jogs) { if (j.x) continue; const n = String(j.num).trim(); if (n) c[Number(n)] = (c[Number(n)] || 0) + 1; }
  return c;
}
const numValido = (v) => /^\d{1,3}$/.test(String(v).trim());

function desenhaTime() {
  $('app').innerHTML = `
    <div class="topo">
      <div class="time"><img src="${esc(T.logo)}" alt="" onerror="this.style.visibility='hidden'"><div><b>${esc(T.name)}</b><span class="muted">${esc(T.city || '')}</span></div><button class="eng" id="eng" aria-label="Mais opções">⚙️</button></div>
      <div class="abas">
        <button data-aba="jogadores" class="${aba === 'jogadores' ? 'on' : ''}">👥 Jogadores</button>
        <button data-aba="escalacao" class="${aba === 'escalacao' ? 'on' : ''}">📋 Escalação</button>
      </div>
    </div>
    <div id="corpo"></div>
    <div class="rodape"><p class="estado-salvo" id="estado-salvo"></p><button class="grande" id="salvar">💾 Salvar</button></div>`;
  document.querySelectorAll('[data-aba]').forEach((b) => { b.onclick = () => { aba = b.dataset.aba; pronto = null; vezPreparo++; desenhaTime(); scrollTo(0, 0); }; });
  $('salvar').onclick = botaoSalvar;
  mostraEstado(estadoSalvo);
  $('eng').onclick = abreEngrenagem;
  if (aba === 'jogadores') desenhaJogadores(); else desenhaEscalacao();
}

/* ── 👥 jogadores ── */
function cardJogador(j, rep) {
  const n = String(j.num).trim();
  const ruim = !numValido(n) || rep[Number(n)] > 1;
  const f = fotoDe(j);
  return `<div class="jog ${mexido(j) ? 'mudou' : ''} ${ruim || !j.nome.trim() ? 'erro' : ''}" data-card="${esc(j.id)}">
    <div>
      <button class="foto" data-foto="${esc(j.id)}" aria-label="Trocar foto">${f ? `<img src="${esc(f)}" alt="" loading="lazy">` : '📷'}<small>foto</small></button>
      <div class="linha">
        <input class="num ${ruim ? 'ruim' : ''}" data-num="${esc(j.id)}" value="${esc(j.num)}" inputmode="numeric" maxlength="3" placeholder="Nº" aria-label="Número">
      </div>
    </div>
    <div>
      <textarea data-nome="${esc(j.id)}" rows="1" maxlength="40" placeholder="Nome do jogador" aria-label="Nome">${esc(j.nome)}</textarea>
      <div class="pos">${POSICOES.map(([v, t]) => `<button data-pos="${esc(j.id)}" data-v="${v}" class="${j.pos === v ? 'on' : ''}">${t}</button>`).join('')}</div>
      <button class="lixo" data-exclui="${esc(j.id)}">🗑 Excluir</button>
    </div>
  </div>`;
}
function desenhaJogadores() {
  const rep = repetidos();
  const ordem = jogs.filter((j) => j.o != null && !j.x).sort((a, b) => a.num0 - b.num0);
  const novos = jogs.filter((j) => j.o == null && !j.x);
  $('corpo').innerHTML = `
    <p class="dica">Corrija o que estiver errado. Toque na foto para trocar. Tudo salva sozinho.</p>
    <button class="novo" id="novo">＋ Adicionar jogador</button>
    ${novos.slice().reverse().map((j) => cardJogador(j, rep)).join('')}
    ${ordem.map((j) => cardJogador(j, rep)).join('')}`;
  $('novo').onclick = () => {
    jogs.push({ id: `n${Date.now().toString(36)}`, o: null, foto: '', num: '', nome: '', pos: '', f: '', x: false });
    guarda();
    desenhaJogadores();
    $('corpo').querySelector('.jog input.num')?.focus();
  };
  const c = $('corpo');
  c.querySelectorAll('[data-num]').forEach((i) => { i.oninput = () => { const j = porId(i.dataset.num); j.num = i.value.replace(/\D/g, ''); i.value = j.num; guarda(); marcaErros(); }; });
  c.querySelectorAll('[data-nome]').forEach((i) => {
    ajustaAltura(i);
    i.oninput = () => { i.value = i.value.replace(/\s*\n\s*/g, ' '); porId(i.dataset.nome).nome = i.value; ajustaAltura(i); guarda(); marcaErros(); };
  });
  c.querySelectorAll('[data-pos]').forEach((b) => { b.onclick = () => {
    const j = porId(b.dataset.pos);
    j.pos = b.dataset.v;
    guarda();
    cardDe(j.id).querySelectorAll('.pos button').forEach((x) => x.classList.toggle('on', x.dataset.v === j.pos));
    marcaErros();
  }; });
  c.querySelectorAll('[data-foto]').forEach((b) => { b.onclick = () => pedeFoto(porId(b.dataset.foto)); });
  c.querySelectorAll('[data-exclui]').forEach((b) => { b.onclick = () => {
    const j = porId(b.dataset.exclui);
    j.x = true;
    j.rest = false;
    limpaEsc(); guarda(); desenhaJogadores();
    toast(`${j.nome.trim() || 'Jogador'} foi para a lixeira (⚙️ no topo).`, true);
  }; });
}
/* o nome aparece inteiro, em quantas linhas precisar */
function ajustaAltura(t) { t.style.height = 'auto'; t.style.height = `${t.scrollHeight + 2}px`; }
addEventListener('resize', () => document.querySelectorAll('[data-nome]').forEach(ajustaAltura));

/* sem redesenhar a lista enquanto digita (o teclado do celular fecharia) */
function marcaErros() {
  const rep = repetidos();
  for (const j of jogs) {
    if (j.x) continue;
    const card = cardDe(j.id);
    if (!card) continue;
    const n = String(j.num).trim();
    const ruim = !numValido(n) || rep[Number(n)] > 1;
    card.classList.toggle('erro', ruim || !j.nome.trim());
    card.classList.toggle('mudou', mexido(j));
    card.querySelector('input.num')?.classList.toggle('ruim', ruim);
  }
}

/* ── foto: quadrada e pequena, porque viaja dentro do link ── */
let fotoDoJogador = null;
function pedeFoto(j) {
  fotoDoJogador = j;
  abreSheet(`<h3>Foto de ${esc(j.nome || 'jogador novo')}</h3>
    <button class="grande" id="f-cam">📷 Tirar foto</button>
    <button class="grande sec" id="f-gal">🖼 Escolher da galeria</button>
    ${j.f ? '<button class="grande sec" id="f-tira">↩ Voltar para a foto anterior</button>' : ''}`);
  $('f-cam').onclick = () => $('in-camera').click();
  $('f-gal').onclick = () => $('in-galeria').click();
  if (j.f) $('f-tira').onclick = () => { j.f = ''; guarda(); fechaSheet(); desenhaJogadores(); };
}
function reduzFoto(file) {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(img.src); ko(new Error('foto')); };
    img.onload = () => {
      const lado = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = c.height = 220;
      // o rosto costuma estar em cima: em foto em pé, corta de baixo (igual o app da transmissão)
      c.getContext('2d').drawImage(img, (img.width - lado) / 2, 0, lado, lado, 0, 0, 220, 220);
      URL.revokeObjectURL(img.src);
      ok(c.toDataURL('image/jpeg', 0.6));
    };
    img.src = URL.createObjectURL(file);
  });
}
for (const id of ['in-camera', 'in-galeria']) {
  $(id).addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !fotoDoJogador) return;
    try {
      fotoDoJogador.f = await reduzFoto(f);
      guarda();
      fechaSheet();
      desenhaJogadores();
    } catch { toast('Não consegui abrir essa foto.'); }
  });
}

/* ── 📋 escalação ── */
const curto = (j) => (j.nome.trim().split(' ')[0] || '').toUpperCase();
function desenhaEscalacao() {
  limpaEsc();
  const L = lugares(E.form);
  const n = E.tit.filter(Boolean).length;
  const fora = jogs.filter((j) => !j.x && !E.tit.includes(j.id)).sort((a, b) => Number(a.num) - Number(b.num));
  const tecs = (T.coaches || []).map((c) => `<option value="${esc(c.name)}">`).join('');
  $('corpo').innerHTML = `
    <div class="forms">${FORMACOES.map((f) => `<button data-form="${f}" class="${f === E.form ? 'on' : ''}">${f}</button>`).join('')}</div>
    <div class="campo">${L.map((p, i) => {
      const j = E.tit[i] ? porId(E.tit[i]) : null;
      const f = j && fotoDe(j);
      return `<button class="slot ${j ? 'tem' : ''}" data-slot="${i}" style="left:${(p.x * 100).toFixed(1)}%;top:${(p.y * 100).toFixed(1)}%"><i>${j ? (f ? `<img src="${esc(f)}" alt="">` : esc(j.num)) : '＋'}</i><span>${j ? `${esc(j.num)} ${esc(curto(j))}` : esc(POS_NOME[p.pos])}</span></button>`;
    }).join('')}</div>
    <p class="conta ${n === 11 ? 'ok' : ''}">${n === 11 ? '✔ Time completo: 11 de 11' : `${n} de 11 titulares · toque em cada lugar`}</p>
    <h2>Reservas (toque para marcar)</h2>
    <div class="reservas">${fora.map((j) => `<button data-res="${esc(j.id)}" class="${E.res.includes(j.id) ? 'on' : ''}">${esc(j.num)} ${esc(curto(j))}</button>`).join('') || '<span class="muted">Ninguém de fora.</span>'}</div>
    <h2>Técnico</h2>
    <input class="tec" id="tec" list="tecs" value="${esc(E.tec)}" placeholder="Nome do técnico" maxlength="40"><datalist id="tecs">${tecs}</datalist>`;
  const c = $('corpo');
  c.querySelectorAll('[data-form]').forEach((b) => { b.onclick = () => { E.form = b.dataset.form; guarda(); desenhaEscalacao(); }; });
  c.querySelectorAll('[data-slot]').forEach((b) => { b.onclick = () => escolheLugar(Number(b.dataset.slot)); });
  c.querySelectorAll('[data-res]').forEach((b) => { b.onclick = () => { const id = b.dataset.res; E.res = E.res.includes(id) ? E.res.filter((x) => x !== id) : [...E.res, id]; b.classList.toggle('on'); guarda(); }; });
  $('tec').oninput = (e) => { E.tec = e.target.value; guarda(); };
}
function escolheLugar(i) {
  const atual = E.tit[i];
  const pos = lugares(E.form)[i].pos;
  // primeiro quem joga na posição deste lugar; depois todos os outros, pelo número da camisa
  const todos = jogs.filter((j) => !j.x).sort((a, b) => Number(a.num) - Number(b.num));
  const daPosicao = todos.filter((j) => j.pos === pos), outros = todos.filter((j) => j.pos !== pos);
  const item = (j) => { const f = fotoDe(j); const em = E.tit.includes(j.id);
    return `<button class="op" data-esc="${esc(j.id)}">${f ? `<img src="${esc(f)}" alt="" loading="lazy">` : `<span class="sem">${esc(j.num)}</span>`}<span><b>${esc(j.num)} · ${esc(j.nome)}</b>${em ? '<small>já está no campo: troca de lugar</small>' : ''}</span></button>`; };
  abreSheet(`<h3>${esc(POS_NOME[pos])}: quem joga aqui?</h3>
    ${atual ? '<button class="grande sec" id="vazio" style="margin-bottom:10px">Deixar este lugar vazio</button>' : ''}
    ${daPosicao.length ? `<h2>${esc(POS_NOME[pos])}</h2>${daPosicao.map(item).join('')}` : `<p class="aviso" id="sem-pos">Nenhum jogador marcado como ${esc(POS_NOME[pos])}. Marque na aba Jogadores que ele aparece primeiro aqui.</p>`}
    ${outros.length ? `<h2>${daPosicao.length ? 'Os outros, por número' : 'Todos, por número'}</h2>${outros.map(item).join('')}` : ''}`);
  if (atual) $('vazio').onclick = () => { E.tit[i] = null; guarda(); fechaSheet(); desenhaEscalacao(); };
  $('sheet-box').querySelectorAll('[data-esc]').forEach((b) => { b.onclick = () => {
    const id = b.dataset.esc, ja = E.tit.indexOf(id);
    if (ja >= 0) E.tit[ja] = E.tit[i];
    E.tit[i] = id;
    E.res = E.res.filter((x) => x !== id);
    guarda(); fechaSheet(); desenhaEscalacao();
  }; });
}

/* ── ✅ enviar ── */
/* modo: 'jogadores' = só a lista · 'escalacao' = a escalação · 'tudo' = os dois (⚙️ enviar direto pro PC).
 * A escalação leva junto as correções do elenco: ela aponta pros números novos e pros jogadores novos. */
function montaPacote(modo) {
  const jogadores = [];
  for (const j of jogs) {
    if (!mexido(j)) continue;
    if (j.o == null && j.x) continue;
    if (j.o == null) { jogadores.push({ num: Number(j.num), nome: j.nome.trim().toUpperCase(), pos: j.pos, ...(j.f ? { f: j.f } : {}) }); continue; }
    if (j.x) { jogadores.push({ o: j.o, nome: j.nome0, x: true }); continue; }
    const p = { o: j.o };
    if (String(j.num).trim() !== String(j.num0)) p.num = Number(j.num);
    if (j.nome.trim().toUpperCase() !== j.nome0.toUpperCase()) p.nome = j.nome.trim().toUpperCase();
    if (j.pos !== j.pos0) p.pos = j.pos;
    if (j.f) p.f = j.f;
    jogadores.push(p);
  }
  const n = E.tit.filter(Boolean).length;
  const pac = { v: 1, slug: T.slug, nome: T.name, t: Date.now(), jogadores };
  // voltou da lixeira: se o sistema já tinha tirado, traz de volta
  const voltaram = jogs.filter((j) => j.rest && !j.x).map((j) => j.o);
  if (voltaram.length) pac.restaurar = voltaram;
  if (modo === 'escalacao') {
    const linha = (id, f) => { const j = porId(id); return [Number(j.num), j.nome.trim().toUpperCase(), f]; };
    pac.listaTitulo = 'Escalação';
    pac.lista = [...E.tit.filter(Boolean).map((id) => linha(id, 'Titular')), ...E.res.map((id) => linha(id, 'Reserva'))];
  } else {
    pac.lista = jogs.filter((j) => !j.x).sort((a, b) => Number(a.num) - Number(b.num)).map((j) => [Number(j.num), j.nome.trim().toUpperCase(), j.pos]);
  }
  if (n && modo !== 'jogadores') pac.esc = { form: E.form, tit: E.tit.map((id) => (id ? Number(porId(id).num) : null)), res: E.res.map((id) => Number(porId(id).num)), tec: E.tec.trim() };
  return pac;
}
function confere() {
  const rep = repetidos();
  const ruins = jogs.filter((j) => !j.x && (!numValido(j.num) || rep[Number(j.num)] > 1 || !j.nome.trim()));
  if (!ruins.length) return true;
  aba = 'jogadores';
  desenhaTime();
  const j = ruins[0];
  cardDe(j.id)?.scrollIntoView({ block: 'center' });
  toast(!j.nome.trim() ? 'Falta o nome de um jogador.' : !numValido(j.num) ? `Falta o número de ${j.nome}.` : `O número ${j.num} está repetido. Cada jogador precisa de um número só dele.`);
  return false;
}
function linhasResumo(p) {
  const js = p.jogadores || [];
  const c = js.filter((j) => j.o != null && !j.x).length, nv = js.filter((j) => j.o == null).length, x = js.filter((j) => j.x).length, f = js.filter((j) => j.f).length;
  const l = [];
  if (c) l.push(`✏️ ${c} jogador${c > 1 ? 'es' : ''} corrigido${c > 1 ? 's' : ''}`);
  if (nv) l.push(`➕ ${nv} jogador${nv > 1 ? 'es' : ''} novo${nv > 1 ? 's' : ''}`);
  if (x) l.push(`🗑 ${x} excluído${x > 1 ? 's' : ''}`);
  if (p.restaurar?.length) l.push(`↩ ${p.restaurar.length} restaurado${p.restaurar.length > 1 ? 's' : ''}`);
  if (f) l.push(`📷 ${f} foto${f > 1 ? 's' : ''} nova${f > 1 ? 's' : ''}`);
  if (p.esc) l.push(`📋 Escalação ${p.esc.form}: ${p.esc.tit.filter((n) => n != null).length} de 11`);
  else if (p.lista) l.push(`👥 Lista com ${p.lista.length} jogador${p.lista.length > 1 ? 'es' : ''}`);
  return l;
}
/* ── o que vai junto: imagem da escalação e planilha ── */
const nomeArquivo = (t) => t.replace(/[\\/:*?"<>|]/g, '').trim();
const POS_NOME = { GK: 'Goleiro', LT: 'Lateral', DF: 'Defesa', MF: 'Meio-campo', FW: 'Ataque' };
function abasDaPlanilha(modo) {
  const celNum = (j) => (numValido(j.num) ? Number(j.num) : j.num);
  const lista = jogs.filter((j) => !j.x).sort((a, b) => Number(a.num) - Number(b.num));
  if (modo === 'jogadores') return [{
    nome: 'Elenco', larguras: [7, 42, 14], titulos: [0],
    linhas: [['Nº', 'Nome', 'Posição'], ...lista.map((j) => [celNum(j), j.nome.trim().toUpperCase(), POS_NOME[j.pos] || ''])],
  }];
  const lin = (j, f) => [f, celNum(j), j.nome.trim().toUpperCase(), POS_NOME[j.pos] || ''];
  const titulares = E.tit.filter(Boolean).map(porId), reservas = E.res.map(porId);
  return [{
    nome: 'Escalação', larguras: [12, 7, 42, 14], titulos: [3],
      linhas: [['Time', T.name], ['Formação', E.form], ['Técnico', E.tec.trim()], ['Função', 'Nº', 'Nome', 'Posição'], ...titulares.map((j) => lin(j, 'Titular')), ...reservas.map((j) => lin(j, 'Reserva'))],
  }];
}
async function montaAnexos(d, modo) {
  const lista = [];
  if (modo === 'jogadores') {
    const png = await gerarImagemJogadores({
      time: T.name, logo: T.logo,
      jogadores: jogs.filter((j) => !j.x).sort((a, b) => Number(a.num) - Number(b.num)).map((j) => ({ number: j.num, nome: j.nome.trim().toUpperCase(), posicao: POS_NOME[j.pos] || '', photo: fotoDe(j) })),
    });
    lista.push(new File([png], nomeArquivo(`Jogadores ${T.name}.png`), { type: 'image/png' }));
  } else {
    const png = await gerarImagemEscalacao({
      time: T.name, logo: T.logo, formacao: E.form, tecnico: E.tec.trim(), slots: lugares(E.form),
      titulares: E.tit.map((id) => { const j = id && porId(id); return j ? { number: j.num, nome: curto(j), photo: fotoDe(j) } : null; }),
      reservas: E.res.map(porId).map((j) => ({ number: j.num, nome: curto(j) })),
    });
    lista.push(new File([png], nomeArquivo(`Escalação ${T.name}.png`), { type: 'image/png' }));
  }
  const abas = abasDaPlanilha(modo);
  // aba escondida com as alterações: se o WhatsApp perder o link, a planilha abre no site ("Abrir arquivo recebido")
  const xlsx = new File([gerarXlsx(d ? [...abas, { nome: 'dados', oculta: true, larguras: [10], linhas: [[`#d=${d}`]] }] : abas)], nomeArquivo(`Time ${T.name}.xlsx`), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const csv = new File([gerarCsv(abas[0])], nomeArquivo(`Time ${T.name}.csv`), { type: 'text/csv' });
  return { lista, xlsx, csv };
}
function baixa(file) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
const arquivoDosDados = (d) => new File([`Alterações do time ${T.name} para a transmissão da Copa Aranãs.\nAbra ${baseUrl()} e toque em "Abrir arquivo recebido".\n\n#d=${d}\n`], nomeArquivo(`Time ${T.name} (abrir no site).txt`), { type: 'text/plain' });

/* tudo de uma vez: imagem + planilha + link. Responde: 'ok', 'cancelou', 'sem-toque' (o navegador quer outro toque)
 * ou o motivo de não ter dado certo */
async function mandaTudo(arqs, texto, d) {
  const comXlsx = [...arqs.lista, arqs.xlsx, ...(arqs.extra || [])];
  // alguns celulares não aceitam .xlsx: vai .csv, que o Excel também abre, e as alterações num .txt
  const comCsv = [...arqs.lista, arqs.csv, ...(arqs.extra || [arquivoDosDados(d)])];
  const files = navigator.canShare?.({ files: comXlsx }) ? comXlsx : navigator.canShare?.({ files: comCsv }) ? comCsv : null;
  if (!files) return 'navegador sem compartilhar arquivos';
  try { await navigator.share({ files, text: texto }); return 'ok'; } catch (e) {
    if (e?.name === 'AbortError') return 'cancelou';
    if (e?.name === 'NotAllowedError') return 'sem-toque';
    return e?.name || 'erro';
  }
}
async function mandaLink(link) {
  const texto = `Time ${T.name}: alterações para a transmissão da Copa Aranãs. Toque no link para abrir:\n${link}`;
  if (navigator.share) {
    try { await navigator.share({ text: texto }); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  // o wa.me não aguenta texto muito longo: aí copia
  if (texto.length < 6000) { window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank'); return; }
  await copia(link);
}

/* tudo pronto ANTES do toque: o navegador (principalmente o iPhone) só abre o compartilhamento se ele
 * vier direto do toque. Sem isso, teria que pedir um segundo toque. */
let pronto = null, vezPreparo = 0, timerPreparo = null;
const podeEnviar = (modo) => !temErro() && (modo === 'escalacao' ? E.tit.some(Boolean) : jogs.some((j) => !j.x));
function agendaPreparo(espera = 1200) {
  pronto = null;
  vezPreparo++;
  clearTimeout(timerPreparo);
  timerPreparo = setTimeout(async () => {
    const vez = vezPreparo, modo = aba;
    if (!podeEnviar(modo)) return;
    const e = await montaEnvio(modo);
    if (vez === vezPreparo) pronto = e;
  }, espera);
}
async function montaEnvio(modo) {
  const p = montaPacote(modo);
  const d = await fecha(p);
  const link = `${linkDoTime(T.slug)}#d=${d}`;
  const cabe = link.length <= LIMITE_LINK;
  let arqs = null;
  try { arqs = await montaAnexos(cabe ? d : null, modo); } catch (e) { console.error(e); }
  // com muitas fotos não cabe em link: as alterações vão num arquivo, junto com o resto
  if (arqs && !cabe) arqs.extra = [arquivoDosDados(d)];
  const assunto = `Time ${T.name}: ${modo === 'jogadores' ? 'lista de jogadores' : 'escalação'} para a transmissão da Copa Aranãs.`;
  const n = p.esc ? p.esc.tit.filter((x) => x != null).length : 11;
  return { modo, d, link, cabe, arqs, n, texto: cabe ? `${assunto} Toque no link para abrir:\n${link}` : assunto };
}
function preparaEnvio() {
  if (!confere()) return;
  const modo = aba;
  if (modo === 'escalacao' && !E.tit.some(Boolean)) return toast('Monte a escalação primeiro: toque nos lugares do campo.');
  if (modo === 'jogadores' && !jogs.some((j) => !j.x)) return toast('Adicione os jogadores primeiro.');
  if (pronto?.modo === modo) return enviaPronto(pronto);
  // tocou antes de terminar de preparar
  abreSheet('<h3>Preparando…</h3>');
  vezPreparo++;
  clearTimeout(timerPreparo);
  montaEnvio(modo).then((e) => { pronto = e; enviaPronto(e); });
}
function enviaPronto({ d, link, cabe, arqs, n, texto }) {
  $('sheet-box').dataset.link = link;
  let pediuToque = false;
  const pedeToque = () => {
    abreSheet('<h3>Tudo pronto</h3><button class="grande" id="e-zap">📲 Enviar por WhatsApp</button>');
    $('sheet-box').dataset.link = link;
    $('e-zap').onclick = envia;
  };
  /* quando o navegador não compartilha: um link de verdade pro WhatsApp (abre sempre) e os arquivos para anexar */
  const manual = (motivo) => {
    const wa = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    const linkCabe = cabe && wa.length < 7000;
    abreSheet(`<h3>Enviar pelo WhatsApp</h3>
      <a class="grande" id="m-zap" href="${esc(linkCabe ? wa : 'https://wa.me/')}" target="_blank" rel="noopener">📲 Abrir o WhatsApp${linkCabe ? ' com o link' : ''}</a>
      ${cabe && !linkCabe ? '<button class="grande sec" id="m-copia">🔗 Copiar o link</button>' : ''}
      ${arqs ? '<button class="grande sec" id="m-baixa">⬇️ Baixar imagem e planilha para anexar</button>' : ''}
      <p class="muted" style="font-size:13px;margin:10px 0 0">Este navegador não anexa os arquivos sozinho (${esc(motivo)}).</p>`);
    $('sheet-box').dataset.link = link;
    if (cabe && !linkCabe) $('m-copia').onclick = () => copia(link);
    if (arqs) $('m-baixa').onclick = async () => {
      for (const f of [...arqs.lista, arqs.xlsx, ...(arqs.extra || [])]) { baixa(f); await new Promise((r) => setTimeout(r, 400)); }
      toast('Arquivos baixados: anexe no WhatsApp.', true);
    };
  };
  async function envia() {
    if (!arqs) return manual('não consegui gerar a imagem');
    const r = await mandaTudo(arqs, texto, d);
    if (r === 'cancelou') return fechaSheet();
    // pede um toque só uma vez: se recusar de novo, não fica preso no mesmo botão
    if (r === 'sem-toque' && !pediuToque) { pediuToque = true; return pedeToque(); }
    if (r !== 'ok') return manual(r === 'sem-toque' ? 'permissão negada' : r);
    fechaSheet();
    toast(n < 11 ? `✔ Enviado. A escalação tem ${n} de 11: só entra na transmissão com os 11.` : '✔ Enviado', n >= 11);
  }
  envia();
}

/* ⚙️ o que não é o dia a dia do treinador: lixeira, copiar o link e enviar direto pro PC da transmissão */
function temErro() {
  const rep = repetidos();
  return jogs.some((j) => !j.x && (!numValido(j.num) || rep[Number(j.num)] > 1 || !j.nome.trim()));
}
/* a senha é conferida no banco; neste aparelho vale até fechar o navegador */
let senhaAdm = (() => { try { return sessionStorage.getItem('copa.adm') || ''; } catch { return ''; } })();
function pedeSenha(depois, aoFechar) {
  abreSheet(`<h3>🔒 Digite a senha</h3>
    <form id="f-senha"><input class="tec" id="senha" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Senha" aria-label="Senha">
    <div style="height:10px"></div><button class="grande" type="submit">Entrar</button></form>
    <p class="aviso" id="senha-erro" style="margin:10px 0 0" hidden></p>`);
  $('senha').focus();
  $('f-senha').onsubmit = async (e) => {
    e.preventDefault();
    const senha = $('senha').value.normalize('NFC');
    const botao = $('f-senha').querySelector('button');
    botao.disabled = true;
    botao.textContent = 'Entrando…';
    $('senha-erro').hidden = true;
    let r;
    try { r = await fetch(`${API}/admin/ok`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ senha }) }).then((x) => x.json()); }
    catch { r = { ok: false, error: 'sem internet: não deu para conferir a senha' }; }
    if (!r.ok) { botao.disabled = false; botao.textContent = 'Entrar'; $('senha-erro').textContent = r.error || 'senha errada'; $('senha-erro').hidden = false; return; }
    senhaAdm = senha;
    try { sessionStorage.setItem('copa.adm', senha); } catch { /* só não lembra */ }
    depois();
  };
}
function abreEngrenagem() {
  if (!senhaAdm) return pedeSenha(abreEngrenagem);
  mostraEngrenagem();
}
async function mostraEngrenagem() {
  const qtd = jogs.filter((j) => j.x).length;
  const lixo = `<button class="grande sec" id="g-lixo">🗑 Lixeira${qtd ? ` (${qtd})` : ''}</button>`;
  if (temErro()) {
    abreSheet(`<h3>Mais opções</h3>${lixo}<p class="aviso" style="margin:12px 0">Para enviar, corrija antes o que está em vermelho.</p><button class="grande sec" id="g-erro">Ver o que corrigir</button>`);
    $('g-erro').onclick = () => { fechaSheet(); confere(); };
  } else {
    const d = await fecha(montaPacote('tudo'));
    const link = `${linkDoTime(T.slug)}#d=${d}`;
    const f = formPc(d);
    abreSheet(`<h3>Mais opções</h3>
      <button class="grande" id="g-zap">📲 Enviar ${aba === 'jogadores' ? 'jogadores' : 'escalação'} por WhatsApp</button>
      <button class="grande sec" id="g-time">🔗 Copiar link deste time</button>
      <p class="muted" style="margin:16px 0 8px">No mesmo Wi-Fi da transmissão, com o app ligado:</p>
      ${f.html}
      <div style="height:14px"></div>
      <button class="grande sec" id="e-copia">🔗 Copiar link com os dados</button>
      ${lixo}`);
    f.liga();
    $('g-zap').onclick = preparaEnvio;
    $('g-time').onclick = () => copia(linkDoTime(T.slug));
    $('e-copia').onclick = () => (link.length <= LIMITE_LINK ? copia(link) : toast('Com essas fotos o link fica grande demais: use o WhatsApp, que envia como arquivo.'));
    if (podeEnviar(aba)) agendaPreparo(0);
  }
  $('g-lixo').onclick = abreLixeira;
}
function abreLixeira() {
  const lista = jogs.filter((j) => j.x);
  abreSheet(`<h3>🗑 Lixeira</h3>
    ${lista.length ? lista.map((j) => { const f = fotoDe(j); return `<div class="lix-item">${f ? `<img src="${esc(f)}" alt="">` : `<i class="sem">${esc(j.num)}</i>`}<span><b>${esc(j.num)}</b> · ${esc(j.nome)}</span><button data-volta="${esc(j.id)}">↩ Restaurar</button></div>`; }).join('') : '<p class="muted">A lixeira está vazia.</p>'}
    <div style="height:12px"></div>
    <button class="grande sec" id="l-volta">Voltar</button>`);
  $('l-volta').onclick = mostraEngrenagem;
  $('sheet-box').querySelectorAll('[data-volta]').forEach((b) => { b.onclick = () => {
    const j = porId(b.dataset.volta);
    j.x = false;
    if (j.o != null) j.rest = true;
    guarda();
    if (aba === 'jogadores') desenhaJogadores(); else desenhaEscalacao();
    abreLixeira();
  }; });
}

async function copia(txt, aviso = 'Link copiado: cole no WhatsApp.') {
  try { await navigator.clipboard.writeText(txt); toast(aviso, true); }
  catch { prompt('Copie o link:', txt); }
}

/* ── 📡 no Wi-Fi da transmissão: abre a página do próprio PC, levando tudo no endereço ── */
function vaiProPc(pc, d) { grava('copa.pc', pc); location.href = `${pc}/receber-time#d=${d}`; }
function formPc(d) {
  return { html: `<button class="grande" id="tv-vai">📡 Enviar dados para a transmissão</button>
    <p class="muted" style="margin:14px 0 0;font-size:14px">Não abriu? Digite o número do PC (ele aparece no endereço do app):</p>
    <div class="pc"><input id="tv-ip" inputmode="decimal" placeholder="ex.: 192.168.0.10" value="${esc((ler('copa.pc') || '').match(/^http:\/\/([\d.]+):4000/)?.[1] || '')}"><button id="tv-ip-vai">Abrir</button></div>`,
    liga() {
      $('tv-vai').onclick = () => vaiProPc(ler('copa.pc') || PC_PADRAO, d);
      $('tv-ip-vai').onclick = () => {
        const ip = $('tv-ip').value.trim();
        if (!/^[\d.]{7,15}$/.test(ip)) return toast('Digite só o número, por exemplo 192.168.0.10');
        vaiProPc(`http://${ip}:4000`, d);
      };
    } };
}
/* ═══ link recebido: o operador só confere e manda pro PC ═══ */
async function telaRecebido(d) {
  let p;
  try { p = await abre(d); } catch { $('app').innerHTML = '<h1>Link incompleto</h1><p class="sub">Este link chegou cortado. Peça para enviar de novo.</p>'; return; }
  const f = formPc(d);
  const POS = Object.fromEntries(POSICOES);
  $('app').innerHTML = `<h1>${esc(p.nome || p.slug)}</h1><p class="sub">O treinador enviou ${p.listaTitulo ? 'a escalação' : 'a lista de jogadores'}.</p>
    <div class="resumo">${linhasResumo(p).map((l) => `<div>${esc(l)}</div>`).join('')}</div>
    ${f.html}
    <p class="muted" style="font-size:14px">Precisa estar no mesmo Wi-Fi do PC da transmissão, com o app ligado.</p>
    <h2>${esc(p.listaTitulo || 'Lista completa')} (${(p.lista || []).length})</h2>
    <div class="lista-completa">${(p.lista || []).map(([n, nome, pos]) => `<div><b>${esc(n)}</b><span>${esc(nome)}</span><small>${esc(POS[pos] || pos || '')}</small></div>`).join('')}</div>`;
  f.liga();
}

/* ═══ lista de times ═══ */
function telaInicio() {
  $('app').innerHTML = '<h1>Times da Copa Aranãs</h1><p class="sub">Área do organizador.</p><button class="grande" id="entrar">🔒 Entrar</button>';
  $('entrar').onclick = () => pedeSenha(listaTimes);
  if (senhaAdm) listaTimes();
}
async function listaTimes() {
  fechaSheet();
  const times = await fetch('times.json').then((r) => r.json());
  let r;
  try { r = await fetch(`${API}/admin/codigos`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ senha: senhaAdm, slugs: times.map((t) => t.slug) }) }).then((x) => x.json()); }
  catch { return toast('Sem internet: não deu para abrir a lista.'); }
  if (!r.ok) { senhaAdm = ''; try { sessionStorage.removeItem('copa.adm'); } catch { /* */ } return toast(r.error || 'senha errada'); }
  const senhaDe = (slug) => r.codigos[slug];
  $('app').innerHTML = `<h1>Times da Copa Aranãs</h1><p class="sub">Mande o link e a senha de cada time para o treinador dele.</p>
    <button class="grande sec" id="copia-senhas">📋 Copiar todas as senhas</button>
    <button class="grande sec" id="abrir-arq" style="margin-bottom:14px">📂 Abrir arquivo recebido</button>
    ${times.map((t) => `<div class="cartao"><a href="${esc(linkDoTime(t.slug))}" data-entra="${esc(t.slug)}"><img src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><span><b>${esc(t.name)}</b><small>Senha: <b class="senha-time">${esc(senhaDe(t.slug))}</b> · ${t.jogadores} jogadores</small></span></a><button data-link="${esc(t.slug)}" data-nome="${esc(t.name)}">📲 Mandar</button></div>`).join('')}`;
  $('abrir-arq').onclick = () => $('in-arquivo').click();
  $('copia-senhas').onclick = () => copia(times.map((t) => `${t.name}: ${senhaDe(t.slug)}`).join('\n'), 'Senhas copiadas.');
  // o técnico já entrou com a senha dele: abre o time direto
  document.querySelectorAll('[data-entra]').forEach((a) => { a.onclick = () => { grava(`copa.senha.${a.dataset.entra}`, senhaDe(a.dataset.entra)); }; });
  document.querySelectorAll('[data-link]').forEach((b) => { b.onclick = async () => {
    const texto = `Treinador do ${b.dataset.nome}: confira os jogadores e a escalação e corrija o que precisar. Tudo salva sozinho.\n${linkDoTime(b.dataset.link)}\nSenha: ${senhaDe(b.dataset.link)}`;
    if (navigator.share) { try { await navigator.share({ text: texto }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  }; });
}
$('in-arquivo').addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  const m = /#d=([pz][A-Za-z0-9_-]+)/.exec(await f.text());
  if (!m) return toast('Esse arquivo não é um envio de time.');
  telaRecebido(m[1]);
});

/* ═══ início ═══ */
(async () => {
  const d = new URLSearchParams(location.hash.slice(1)).get('d');
  if (d) return telaRecebido(d);
  const slug = new URLSearchParams(location.search).get('time');
  if (!slug) return telaInicio();
  try {
    T = await fetch(`dados/${encodeURIComponent(slug)}.json`).then((r) => { if (!r.ok) throw 0; return r.json(); });
  } catch { $('app').innerHTML = '<h1>Time não encontrado</h1><p class="sub">Confira o link que você recebeu.</p>'; return; }
  chave = `copa.time.${T.slug}`;
  document.title = `${T.name} · Copa Aranãs`;
  CODIGO = ler(`copa.senha.${T.slug}`) || '';
  if (!CODIGO) return telaSenhaTime();
  abreTime();
})();

/* antes de tudo, a senha do time */
function telaSenhaTime(aviso) {
  $('app').innerHTML = `<div class="entrada">
    ${T.logo ? `<img src="${esc(T.logo)}" alt="" onerror="this.style.visibility='hidden'">` : ''}
    <h1>${esc(T.name)}</h1>
    <p class="sub">Digite a senha do time para entrar.</p>
    <form id="f-time"><input class="tec" id="senha-time" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Senha" aria-label="Senha do time">
    <div style="height:10px"></div><button class="grande" type="submit">Entrar</button></form>
    <p class="aviso" id="time-erro" style="margin:12px 0 0" ${aviso ? '' : 'hidden'}>${esc(aviso || '')}</p>
  </div>`;
  $('f-time').onsubmit = async (e) => {
    e.preventDefault();
    const botao = $('f-time').querySelector('button');
    botao.disabled = true;
    botao.textContent = 'Entrando…';
    $('time-erro').hidden = true;
    let r;
    try { r = await fetch(`${API}/t/${T.slug}/entrar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ senha: $('senha-time').value.trim().normalize('NFC') }) }).then((x) => x.json()); }
    catch { r = { ok: false, error: 'Sem internet: tente de novo.' }; }
    if (!r.ok) { botao.disabled = false; botao.textContent = 'Entrar'; $('time-erro').textContent = r.error || 'senha errada'; $('time-erro').hidden = false; return; }
    CODIGO = r.c;
    grava(`copa.senha.${T.slug}`, CODIGO);
    abreTime();
  };
}
async function abreTime() {
  let r = null;
  try {
    const x = await fetch(`${API}/t/${T.slug}?c=${encodeURIComponent(CODIGO)}`);
    if (x.status === 403) { CODIGO = ''; grava(`copa.senha.${T.slug}`, null); return telaSenhaTime(); }
    r = await x.json();
    grava(`${chave}.banco`, r);
  } catch {
    r = ler(`${chave}.banco`);
    estadoSalvo = 'sem';
  }
  const ed = {}, novos = [];
  for (const l of r?.jogadores || []) { if (l.dados.novo) novos.push({ id: l.id, ...l.dados }); else ed[l.id] = l.dados; }
  montaEstado({ ed, novos, esc: r?.esc });
  noBanco = new Map(jogs.map((j) => [j.id, JSON.stringify(registro(j))]));
  escNoBanco = JSON.stringify(E);
  ultimoAt = r?.agora || 0;
  // o que ficou neste celular sem subir
  const pend = ler(chavePend());
  for (const x of pend?.jogadores || []) aplicaRegistro(x.id, x.dados);
  if (pend?.esc) E = pend.esc;
  limpaEsc();
  desenhaTime();
  if (pend) salvaAgora();
  setInterval(buscaNovidades, 30000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) salvaAgora(true); else buscaNovidades(); });
}
