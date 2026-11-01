/* SITE DOS TIMES · Copa Aranãs: página estática (GitHub Pages), sem servidor e sem conta.
 * As alterações viajam DENTRO do link que o treinador manda no WhatsApp (#d=…); quem aplica no sistema é
 * a página /receber-time do PC da transmissão, aberta pelo botão 📡 (o site é https e não enxerga o PC na rede). */
const POSICOES = [['GK', 'Goleiro'], ['DF', 'Defesa'], ['MF', 'Meio'], ['FW', 'Ataque']];
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
  const out = [{ x: 0.5, y: 0.93 }];
  rows.forEach((count, r) => {
    const y = rows.length === 1 ? 0.5 : lerp(0.76, 0.1, r / (rows.length - 1));
    for (let i = 0; i < count; i++) out.push({ x: count === 1 ? 0.5 : lerp(0.13, 0.87, i / (count - 1)), y });
  });
  return out;
}

/* ═══ tela do time ═══ */
let T, chave, jogs, E, aba = 'jogadores';

function montaEstado(rasc) {
  const r = rasc || {};
  jogs = T.players.map((p) => {
    const ed = r.ed?.[p.orig] || {};
    return { id: p.orig, o: p.orig, num0: p.number, nome0: p.name, pos0: p.position || '', foto: p.photo || '', num: ed.num ?? String(p.number), nome: ed.nome ?? p.name, pos: ed.pos ?? (p.position || ''), f: ed.f || '', x: !!ed.x };
  });
  for (const n of r.novos || []) jogs.push({ id: n.id, o: null, foto: '', num: n.num ?? '', nome: n.nome ?? '', pos: n.pos ?? '', f: n.f || '', x: false });
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
function guarda() {
  const ed = {}, novos = [];
  for (const j of jogs) {
    if (j.o == null) novos.push({ id: j.id, num: j.num, nome: j.nome, pos: j.pos, f: j.f });
    else if (mexido(j)) ed[j.o] = { num: j.num, nome: j.nome, pos: j.pos, f: j.f, x: j.x };
  }
  if (!grava(chave, { ed, novos, esc: E })) toast('Sem espaço para guardar neste celular: envie logo o que já fez.');
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
    <div class="rodape"><button class="grande" id="enviar">✅ Salvar e enviar por WhatsApp</button></div>`;
  document.querySelectorAll('[data-aba]').forEach((b) => { b.onclick = () => { aba = b.dataset.aba; desenhaTime(); scrollTo(0, 0); }; });
  $('enviar').onclick = preparaEnvio;
  $('eng').onclick = abreEngrenagem;
  if (aba === 'jogadores') desenhaJogadores(); else desenhaEscalacao();
}

/* ── 👥 jogadores ── */
function cardJogador(j, rep) {
  if (j.x) return `<div class="saiu" data-card="${esc(j.id)}"><span>🗑 ${esc(j.nome)} vai sair do time</span><button data-desfaz="${esc(j.id)}">Desfazer</button></div>`;
  const n = String(j.num).trim();
  const ruim = !numValido(n) || rep[Number(n)] > 1;
  const f = fotoDe(j);
  return `<div class="jog ${mexido(j) ? 'mudou' : ''} ${ruim || !j.nome.trim() ? 'erro' : ''}" data-card="${esc(j.id)}">
    <div>
      <button class="foto" data-foto="${esc(j.id)}" aria-label="Trocar foto">${f ? `<img src="${esc(f)}" alt="" loading="lazy">` : '📷'}<small>foto</small></button>
      <div class="linha">
        <input class="num ${ruim ? 'ruim' : ''}" data-num="${esc(j.id)}" value="${esc(j.num)}" inputmode="numeric" maxlength="3" placeholder="Nº" aria-label="Número">
        <button class="lixo" data-tira="${esc(j.id)}" aria-label="Tirar do time">🗑</button>
      </div>
    </div>
    <div>
      <textarea data-nome="${esc(j.id)}" rows="1" maxlength="40" placeholder="Nome do jogador" aria-label="Nome">${esc(j.nome)}</textarea>
      <div class="pos">${POSICOES.map(([v, t]) => `<button data-pos="${esc(j.id)}" data-v="${v}" class="${j.pos === v ? 'on' : ''}">${t}</button>`).join('')}</div>
    </div>
  </div>`;
}
function desenhaJogadores() {
  const rep = repetidos();
  const ordem = jogs.filter((j) => j.o != null).sort((a, b) => a.num0 - b.num0);
  const novos = jogs.filter((j) => j.o == null);
  $('corpo').innerHTML = `
    <p class="dica">Corrija o que estiver errado. Toque na foto para trocar. O que você não mexer continua igual.</p>
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
  c.querySelectorAll('[data-tira]').forEach((b) => { b.onclick = () => {
    const j = porId(b.dataset.tira);
    if (j.o == null) jogs = jogs.filter((x) => x !== j); else j.x = true;
    limpaEsc(); guarda(); desenhaJogadores();
  }; });
  c.querySelectorAll('[data-desfaz]').forEach((b) => { b.onclick = () => { porId(b.dataset.desfaz).x = false; guarda(); desenhaJogadores(); }; });
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
      return `<button class="slot ${j ? 'tem' : ''}" data-slot="${i}" style="left:${(p.x * 100).toFixed(1)}%;top:${(p.y * 100).toFixed(1)}%"><i>${j ? (f ? `<img src="${esc(f)}" alt="">` : esc(j.num)) : '＋'}</i><span>${j ? `${esc(j.num)} ${esc(curto(j))}` : (i === 0 ? 'Goleiro' : '')}</span></button>`;
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
  const peso = (j) => (i === 0 ? (j.pos === 'GK' ? 0 : 1) : (j.pos === 'GK' ? 1 : 0));
  const lista = jogs.filter((j) => !j.x).sort((a, b) => peso(a) - peso(b) || Number(a.num) - Number(b.num));
  abreSheet(`<h3>${i === 0 ? 'Quem é o goleiro?' : 'Quem joga aqui?'}</h3>
    ${atual ? '<button class="grande sec" id="vazio" style="margin-bottom:10px">Deixar este lugar vazio</button>' : ''}
    ${lista.map((j) => { const f = fotoDe(j); const em = E.tit.includes(j.id);
      return `<button class="op" data-esc="${esc(j.id)}">${f ? `<img src="${esc(f)}" alt="" loading="lazy">` : `<span class="sem">${esc(j.num)}</span>`}<span><b>${esc(j.num)} · ${esc(j.nome)}</b>${em ? '<small>já está no campo: troca de lugar</small>' : ''}</span></button>`; }).join('')}`);
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
function montaPacote() {
  const jogadores = [];
  for (const j of jogs) {
    if (!mexido(j)) continue;
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
  if (n) pac.esc = { form: E.form, tit: E.tit.map((id) => (id ? Number(porId(id).num) : null)), res: E.res.map((id) => Number(porId(id).num)), tec: E.tec.trim() };
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
  if (x) l.push(`🗑 ${x} tirado${x > 1 ? 's' : ''} do time`);
  if (f) l.push(`📷 ${f} foto${f > 1 ? 's' : ''} nova${f > 1 ? 's' : ''}`);
  if (p.esc) l.push(`📋 Escalação ${p.esc.form}: ${p.esc.tit.filter((n) => n != null).length} de 11`);
  return l;
}
/* ── o que vai junto: imagem da escalação e planilha ── */
const nomeArquivo = (t) => t.replace(/[\\/:*?"<>|]/g, '').trim();
const POS_NOME = { GK: 'Goleiro', DF: 'Defesa', MF: 'Meio-campo', FW: 'Ataque' };
function abasDaPlanilha() {
  const situacao = (j) => (j.x ? 'Saiu do time' : E.tit.includes(j.id) ? 'Titular' : E.res.includes(j.id) ? 'Reserva' : '');
  const alteracao = (j) => (j.x ? 'Tirado' : j.o == null ? 'Novo' : [mudouCampos(j) ? 'Corrigido' : '', j.f ? 'Foto nova' : ''].filter(Boolean).join(' + '));
  const celNum = (j) => (numValido(j.num) ? Number(j.num) : j.num);
  const lista = jogs.slice().sort((a, b) => Number(a.x) - Number(b.x) || Number(a.num) - Number(b.num));
  const abas = [{
    nome: 'Elenco', larguras: [7, 42, 14, 14, 20], titulos: [0],
    linhas: [['Nº', 'Nome', 'Posição', 'Situação', 'Alteração'], ...lista.map((j) => [celNum(j), j.nome.trim().toUpperCase(), POS_NOME[j.pos] || '', situacao(j), alteracao(j)])],
  }];
  if (E.tit.some(Boolean)) {
    const lin = (j, f) => [f, celNum(j), j.nome.trim().toUpperCase(), POS_NOME[j.pos] || ''];
    const titulares = E.tit.filter(Boolean).map(porId), reservas = E.res.map(porId);
    abas.unshift({
      nome: 'Escalação', larguras: [12, 7, 42, 14], titulos: [3],
      linhas: [['Time', T.name], ['Formação', E.form], ['Técnico', E.tec.trim()], ['Função', 'Nº', 'Nome', 'Posição'], ...titulares.map((j) => lin(j, 'Titular')), ...reservas.map((j) => lin(j, 'Reserva'))],
    });
  }
  return abas;
}
async function montaAnexos() {
  const lista = [];
  if (E.tit.some(Boolean)) {
    const png = await gerarImagemEscalacao({
      time: T.name, logo: T.logo, formacao: E.form, tecnico: E.tec.trim(), slots: lugares(E.form),
      titulares: E.tit.map((id) => { const j = id && porId(id); return j ? { number: j.num, nome: curto(j), photo: fotoDe(j) } : null; }),
      reservas: E.res.map(porId).map((j) => ({ number: j.num, nome: curto(j) })),
    });
    lista.push(new File([png], nomeArquivo(`Escalação ${T.name}.png`), { type: 'image/png' }));
  }
  const abas = abasDaPlanilha();
  const xlsx = new File([gerarXlsx(abas)], nomeArquivo(`Time ${T.name}.xlsx`), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const csv = new File([gerarCsv(abas.find((a) => a.nome === 'Elenco'))], nomeArquivo(`Time ${T.name}.csv`), { type: 'text/csv' });
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
/* alguns celulares não deixam compartilhar .xlsx: aí vai o .csv, que o Excel também abre */
async function mandaArquivos(arqs) {
  const comXlsx = [...arqs.lista, arqs.xlsx, ...(arqs.extra || [])];
  const comCsv = [...arqs.lista, arqs.csv, ...(arqs.extra || [])];
  const pode = navigator.canShare?.({ files: comXlsx }) ? comXlsx : navigator.canShare?.({ files: comCsv }) ? comCsv : null;
  if (pode) {
    try { await navigator.share({ files: pode }); return true; } catch (e) { if (e?.name === 'AbortError') return false; }
  }
  for (const f of comXlsx) { baixa(f); await new Promise((r) => setTimeout(r, 400)); }
  toast('Arquivos baixados: agora mande no WhatsApp.', true);
  return true;
}
async function mandaLink(link) {
  const texto = `Time ${T.name}: alterações para a transmissão da Copa Aranãs. Toque no link para abrir:\n${link}`;
  if (navigator.share) {
    try { await navigator.share({ text: texto }); return true; } catch (e) { if (e?.name === 'AbortError') return false; }
  }
  // o wa.me não aguenta texto muito longo: aí copia
  if (texto.length < 6000) { window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank'); return true; }
  await copia(link);
  return true;
}
const arquivoDosDados = (d) => new File([`Alterações do time ${T.name} para a transmissão da Copa Aranãs.\nAbra ${baseUrl()} e toque em "Abrir arquivo recebido".\n\n#d=${d}\n`], nomeArquivo(`Time ${T.name} (abrir no site).txt`), { type: 'text/plain' });

async function preparaEnvio() {
  if (!confere()) return;
  const p = montaPacote();
  if (!p.jogadores.length && !p.esc) return toast('Você ainda não alterou nada.');
  abreSheet('<h3>Preparando…</h3>');
  const d = await fecha(p);
  const arqs = await montaAnexos();
  const n = p.esc ? p.esc.tit.filter((x) => x != null).length : 11;
  const link = `${linkDoTime(T.slug)}#d=${d}`;
  const cabe = link.length <= LIMITE_LINK;
  const oQue = arqs.lista.length ? 'imagem e planilha' : 'planilha';
  const topo = `<h3>Tudo pronto</h3>
    <div class="resumo">${linhasResumo(p).map((l) => `<div>${esc(l)}</div>`).join('')}</div>
    ${n < 11 ? `<p class="aviso">⚠️ A escalação está com ${n} de 11: ela só entra na transmissão quando tiver os 11.</p>` : ''}`;
  if (cabe) {
    // o WhatsApp pode descartar o texto quando vai junto com arquivos: por isso o link vai primeiro, sozinho
    abreSheet(`${topo}<button class="grande" id="e-link">📲 1 de 2 · Enviar alterações</button>
      <button class="grande sec" id="e-arq">🖼 2 de 2 · Enviar ${oQue}</button>`);
    $('sheet-box').dataset.link = link;
    $('e-link').onclick = async () => {
      if (!(await mandaLink(link))) return;
      $('e-link').className = 'grande sec';
      $('e-link').textContent = '✔ Alterações enviadas';
      $('e-arq').className = 'grande';
    };
    $('e-arq').onclick = async () => { if (await mandaArquivos(arqs)) { $('e-arq').className = 'grande sec'; $('e-arq').textContent = `✔ ${oQue[0].toUpperCase()}${oQue.slice(1)} enviada${arqs.lista.length ? 's' : ''}`; } };
  } else {
    // com muitas fotos não cabe em link: as alterações vão num arquivo, junto com o resto
    arqs.extra = [arquivoDosDados(d)];
    abreSheet(`${topo}<button class="grande" id="e-arq">📲 Enviar por WhatsApp</button>`);
    $('sheet-box').dataset.link = link;
    $('e-arq').onclick = () => mandaArquivos(arqs);
  }
}

/* ⚙️ o que não é o dia a dia do treinador: copiar o link e enviar direto pro PC da transmissão */
async function abreEngrenagem() {
  if (!confere()) return;
  const p = montaPacote();
  if (!p.jogadores.length && !p.esc) return toast('Você ainda não alterou nada.');
  const d = await fecha(p);
  const link = `${linkDoTime(T.slug)}#d=${d}`;
  const f = formPc(d);
  abreSheet(`<h3>Mais opções</h3>
    <p class="muted" style="margin:0 0 12px">No mesmo Wi-Fi da transmissão, com o app ligado, envie direto para o sistema:</p>
    ${f.html}
    <div style="height:14px"></div>
    <button class="grande sec" id="e-copia">🔗 Copiar link</button>`);
  f.liga();
  $('e-copia').onclick = () => (link.length <= LIMITE_LINK ? copia(link) : toast('Com essas fotos o link fica grande demais: use o botão verde, que envia como arquivo.'));
}

async function copia(txt) {
  try { await navigator.clipboard.writeText(txt); toast('Link copiado: cole no WhatsApp.', true); }
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
  const js = p.jogadores || [];
  const titulo = (j) => (j.o ? (j.o.split('|')[1] || j.nome || '') : j.nome);
  const POS = Object.fromEntries(POSICOES);
  const det = (j) => (j.x ? 'sai do time' : [j.num !== undefined ? `nº ${j.num}` : '', j.o && j.nome ? `nome: ${j.nome}` : '', j.pos ? POS[j.pos] || j.pos : '', j.f ? 'foto nova' : ''].filter(Boolean).join(' · '));
  $('app').innerHTML = `<h1>${esc(p.nome || p.slug)}</h1><p class="sub">O treinador enviou estas alterações.</p>
    <div class="resumo">${linhasResumo(p).map((l) => `<div>${esc(l)}</div>`).join('')}</div>
    ${js.map((j) => `<div class="op">${j.f ? `<img src="${esc(j.f)}" alt="">` : `<span class="sem">${j.x ? '🗑' : j.o ? '✏️' : '＋'}</span>`}<span><b>${esc(titulo(j))}</b><small>${esc(det(j))}</small></span></div>`).join('')}
    <div style="height:18px"></div>${f.html}
    <p class="muted" style="font-size:14px">Precisa estar no mesmo Wi-Fi do PC da transmissão, com o app ligado.</p>`;
  f.liga();
}

/* ═══ lista de times ═══ */
async function telaInicio() {
  const times = await fetch('times.json').then((r) => r.json());
  $('app').innerHTML = `<h1>Times da Copa Aranãs</h1><p class="sub">Escolha o time e mande o link dele para o treinador.</p>
    <button class="grande sec" id="abrir-arq" style="margin-bottom:14px">📂 Abrir arquivo recebido</button>
    ${times.map((t) => `<div class="cartao"><a href="?time=${esc(t.slug)}"><img src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><span><b>${esc(t.name)}</b><small>${t.jogadores} jogadores</small></span></a><button data-link="${esc(t.slug)}" data-nome="${esc(t.name)}">📲 Mandar link</button></div>`).join('')}`;
  $('abrir-arq').onclick = () => $('in-arquivo').click();
  document.querySelectorAll('[data-link]').forEach((b) => { b.onclick = async () => {
    const link = linkDoTime(b.dataset.link);
    const texto = `Treinador do ${b.dataset.nome}: confira os jogadores e a escalação, corrija o que precisar e me mande de volta. É só tocar no botão verde no final.\n${link}`;
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
  montaEstado(ler(chave));
  desenhaTime();
})();
