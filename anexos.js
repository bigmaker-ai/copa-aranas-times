/* ANEXOS do envio: planilha do Excel (.xlsx feito aqui mesmo, sem biblioteca) e imagem da escalação. */

/* ── .zip sem compressão: é o que existe dentro de um .xlsx ── */
const TABELA_CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = TABELA_CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zipar(arquivos) {
  const enc = new TextEncoder();
  const partes = [], central = [];
  let pos = 0;
  const cabecalho = (tam, preenche) => { const v = new DataView(new ArrayBuffer(tam)); preenche(v); return new Uint8Array(v.buffer); };
  for (const [nome, texto] of arquivos) {
    const n = enc.encode(nome), d = enc.encode(texto), crc = crc32(d);
    const local = cabecalho(30, (v) => { v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint16(12, 0x21, true); v.setUint32(14, crc, true); v.setUint32(18, d.length, true); v.setUint32(22, d.length, true); v.setUint16(26, n.length, true); });
    const cen = cabecalho(46, (v) => { v.setUint32(0, 0x02014b50, true); v.setUint16(4, 20, true); v.setUint16(6, 20, true); v.setUint16(8, 0x0800, true); v.setUint16(14, 0x21, true); v.setUint32(16, crc, true); v.setUint32(20, d.length, true); v.setUint32(24, d.length, true); v.setUint16(28, n.length, true); v.setUint32(42, pos, true); });
    partes.push(local, n, d);
    central.push(cen, n);
    pos += local.length + n.length + d.length;
  }
  const tamCentral = central.reduce((s, c) => s + c.length, 0);
  const fim = cabecalho(22, (v) => { v.setUint32(0, 0x06054b50, true); v.setUint16(8, arquivos.length, true); v.setUint16(10, arquivos.length, true); v.setUint32(12, tamCentral, true); v.setUint32(16, pos, true); });
  return new Blob([...partes, ...central, fim]);
}

/* abas: [{ nome, larguras: [..], linhas: [[texto ou número, ..]], titulos: [índices das linhas em destaque], oculta }] */
function gerarXlsx(abas) {
  const xml = (t) => String(t).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const CAB = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const folha = (a) => {
    const linhas = a.linhas.map((l, r) => {
      const s = a.titulos?.includes(r) ? ' s="1"' : '';
      const cels = l.map((v, c) => {
        if (v === '' || v == null) return '';
        const ref = String.fromCharCode(65 + c) + (r + 1);
        return typeof v === 'number' ? `<c r="${ref}"${s}><v>${v}</v></c>` : `<c r="${ref}"${s} t="inlineStr"><is><t>${xml(v)}</t></is></c>`;
      }).join('');
      return `<row r="${r + 1}">${cels}</row>`;
    }).join('');
    const cols = a.larguras.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
    return `${CAB}<worksheet xmlns="${NS}"><cols>${cols}</cols><sheetData>${linhas}</sheetData></worksheet>`;
  };
  const arquivos = [
    ['[Content_Types].xml', `${CAB}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `${CAB}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `${CAB}<workbook xmlns="${NS}" xmlns:r="${REL}"><sheets>${abas.map((a, i) => `<sheet name="${xml(a.nome)}" sheetId="${i + 1}"${a.oculta ? ' state="hidden"' : ''} r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `${CAB}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${abas.length + 1}" Type="${REL}/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', `${CAB}<styleSheet xmlns="${NS}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFB7EFB7"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`],
    ...abas.map((a, i) => [`xl/worksheets/sheet${i + 1}.xml`, folha(a)]),
  ];
  return zipar(arquivos);
}
/* quando o celular não deixa compartilhar .xlsx: o mesmo conteúdo em .csv, que o Excel também abre */
function gerarCsv(aba) {
  const cel = (v) => { const t = String(v ?? ''); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  return new Blob(['﻿' + aba.linhas.map((l) => l.map(cel).join(';')).join('\r\n')], { type: 'text/csv' });
}

/* ── imagem da escalação (1080×1350): campo com os titulares, reservas e técnico ── */
const FONTE_ARTE = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
function carregaImg(src) {
  if (!src) return Promise.resolve(null);
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
    setTimeout(() => ok(null), 6000);
  });
}
function textoCabe(ctx, t, x, y, max, size, peso) {
  let s = size;
  do { ctx.font = `${peso} ${s}px ${FONTE_ARTE}`; s -= 2; } while (ctx.measureText(t).width > max && s > 12);
  ctx.fillText(t, x, y);
}
function caminhoRedondo(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
/* e: { time, logo, formacao, tecnico, slots: [{x,y}], titulares: [{number,nome,photo}|null], reservas: [{number,nome}] } */
async function gerarImagemEscalacao(e) {
  const W = 1080, H = 1350, VERDE = '#33e02a';
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(W / 2, H * 0.42, 50, W / 2, H * 0.42, H * 0.8);
  g.addColorStop(0, '#12341c');
  g.addColorStop(0.58, '#07130b');
  g.addColorStop(1, '#030806');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const [logo, ...fotos] = await Promise.all([carregaImg(e.logo), ...e.titulares.map((p) => carregaImg(p?.photo))]);
  if (logo) { const k = Math.min(150 / logo.width, 150 / logo.height); ctx.drawImage(logo, 48 + (150 - logo.width * k) / 2, 40 + (150 - logo.height * k) / 2, logo.width * k, logo.height * k); }
  ctx.textAlign = 'left';
  ctx.fillStyle = VERDE;
  ctx.font = `700 32px ${FONTE_ARTE}`;
  ctx.fillText('ESCALAÇÃO', 220, 74);
  ctx.fillStyle = '#fff';
  textoCabe(ctx, e.time.toUpperCase(), 220, 134, W - 270, 62, 900);
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  textoCabe(ctx, e.formacao, 220, 172, W - 270, 30, 600);
  if (e.tecnico) {
    ctx.font = `700 26px ${FONTE_ARTE}`;
    ctx.fillStyle = VERDE;
    ctx.fillText('TÉCNICO', 220, 212);
    const l = ctx.measureText('TÉCNICO').width + 16;
    ctx.fillStyle = '#fff';
    textoCabe(ctx, e.tecnico.toUpperCase(), 220 + l, 212, W - 270 - l, 28, 700);
  }

  // reservas: mede antes, e o campo vai até onde elas começam
  ctx.font = `600 27px ${FONTE_ARTE}`;
  const linhas = [];
  let atual = '';
  for (const r of e.reservas) {
    const t = `${r.number} ${r.nome}`;
    const prova = atual ? `${atual}  ·  ${t}` : t;
    if (atual && ctx.measureText(prova).width > W - 120) { linhas.push(atual); atual = t; } else atual = prova;
  }
  if (atual) linhas.push(atual);
  if (!linhas.length) linhas.push('—');
  const fx = 50, fy = 232, fw = W - 100, fh = H - fy - (44 + linhas.length * 36 + 22);
  const cg = ctx.createLinearGradient(0, fy, 0, fy + fh);
  cg.addColorStop(0, '#0f4a20');
  cg.addColorStop(1, '#0a3517');
  ctx.fillStyle = cg;
  caminhoRedondo(ctx, fx, fy, fw, fh, 26);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.22)';
  ctx.lineWidth = 3;
  caminhoRedondo(ctx, fx + 20, fy + 20, fw - 40, fh - 40, 10);
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(fx + 20, fy + fh / 2); ctx.lineTo(fx + fw - 20, fy + fh / 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2, fy + fh / 2, 90, 0, Math.PI * 2); ctx.stroke();

  const R = 50;
  e.slots.forEach((s, i) => {
    const p = e.titulares[i];
    const cx = fx + 30 + s.x * (fw - 60);
    const cy = fy + 40 + s.y * (fh - 110);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = '#0b1117';
    ctx.fill();
    ctx.clip();
    const f = fotos[i];
    if (f) {
      const k = Math.max((2 * R) / f.width, (2 * R) / f.height);
      ctx.drawImage(f, cx - (f.width * k) / 2, cy - R, f.width * k, f.height * k);
    } else {
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = `900 46px ${FONTE_ARTE}`;
      ctx.fillText(p ? String(p.number) : '?', cx, cy + 16);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = VERDE;
    ctx.lineWidth = 5;
    ctx.stroke();
    if (!p) return;
    ctx.beginPath();
    ctx.arc(cx + R * 0.78, cy - R * 0.72, 20, 0, Math.PI * 2);
    ctx.fillStyle = VERDE;
    ctx.fill();
    ctx.fillStyle = '#041004';
    ctx.textAlign = 'center';
    ctx.font = `900 22px ${FONTE_ARTE}`;
    ctx.fillText(String(p.number), cx + R * 0.78, cy - R * 0.72 + 8);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,.8)';
    ctx.shadowBlur = 8;
    textoCabe(ctx, p.nome, cx, cy + R + 34, 190, 28, 800);
    ctx.shadowBlur = 0;
  });

  ctx.textAlign = 'left';
  let y = fy + fh + 44;
  ctx.fillStyle = VERDE;
  ctx.font = `700 28px ${FONTE_ARTE}`;
  ctx.fillText('RESERVAS', 60, y);
  ctx.fillStyle = '#fff';
  ctx.font = `600 27px ${FONTE_ARTE}`;
  for (const l of linhas) { y += 36; ctx.fillText(l, 60, y); }
  return new Promise((ok, ko) => cv.toBlob((b) => (b ? ok(b) : ko(new Error('imagem'))), 'image/png'));
}

/* ── imagem do elenco: foto, número, nome inteiro e posição de todos, em 2 colunas ── */
/* e: { time, logo, jogadores: [{ number, nome, posicao, photo }] } */
function quebraNome(ctx, nome, max) {
  const linhas = [];
  let atual = '';
  for (const p of nome.split(' ')) {
    const prova = atual ? `${atual} ${p}` : p;
    if (atual && ctx.measureText(prova).width > max) { linhas.push(atual); atual = p; } else atual = prova;
  }
  if (atual) linhas.push(atual);
  return linhas;
}
async function gerarImagemJogadores(e) {
  const W = 1080, VERDE = '#33e02a', TOPO = 196, M = 40, GAP = 16, CW = (W - M * 2 - GAP) / 2, CH = 124;
  const filas = Math.ceil(e.jogadores.length / 2);
  const H = TOPO + filas * (CH + GAP) + 28;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#12341c');
  g.addColorStop(1, '#040a06');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const [logo, ...fotos] = await Promise.all([carregaImg(e.logo), ...e.jogadores.map((j) => carregaImg(j.photo))]);
  if (logo) { const k = Math.min(130 / logo.width, 130 / logo.height); ctx.drawImage(logo, M + (130 - logo.width * k) / 2, 32 + (130 - logo.height * k) / 2, logo.width * k, logo.height * k); }
  ctx.textAlign = 'left';
  ctx.fillStyle = VERDE;
  ctx.font = `700 32px ${FONTE_ARTE}`;
  ctx.fillText('JOGADORES', 196, 68);
  ctx.fillStyle = '#fff';
  textoCabe(ctx, e.time.toUpperCase(), 196, 128, W - 236, 60, 900);
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.font = `600 28px ${FONTE_ARTE}`;
  ctx.fillText(`${e.jogadores.length} jogadores`, 196, 166);

  e.jogadores.forEach((j, i) => {
    const x = M + (i % 2) * (CW + GAP), y = TOPO + Math.floor(i / 2) * (CH + GAP);
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    caminhoRedondo(ctx, x, y, CW, CH, 16);
    ctx.fill();
    const R = 46, cx = x + 16 + R, cy = y + CH / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = '#0b1117';
    ctx.fill();
    ctx.clip();
    const f = fotos[i];
    if (f) {
      const k = Math.max((2 * R) / f.width, (2 * R) / f.height);
      ctx.drawImage(f, cx - (f.width * k) / 2, cy - R, f.width * k, f.height * k);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = VERDE;
    ctx.lineWidth = 4;
    ctx.stroke();
    // número em destaque, no canto da foto
    ctx.beginPath();
    ctx.arc(cx + R * 0.72, cy - R * 0.68, 22, 0, Math.PI * 2);
    ctx.fillStyle = VERDE;
    ctx.fill();
    ctx.fillStyle = '#041004';
    ctx.textAlign = 'center';
    ctx.font = `900 ${String(j.number).length > 2 ? 18 : 23}px ${FONTE_ARTE}`;
    ctx.fillText(String(j.number), cx + R * 0.72, cy - R * 0.68 + 8);
    // nome inteiro: diminui a letra até caber em 2 linhas
    ctx.textAlign = 'left';
    const tx = cx + R + 22, max = x + CW - 14 - tx;
    let tam = 28, linhas;
    do { ctx.font = `800 ${tam}px ${FONTE_ARTE}`; linhas = quebraNome(ctx, j.nome, max); tam -= 2; } while ((linhas.length > 2 || linhas.some((l) => ctx.measureText(l).width > max)) && tam > 16);
    tam += 2;
    const alt = tam + 5, total = linhas.length * alt + (j.posicao ? 30 : 0);
    let ty = cy - total / 2 + tam - 3;
    ctx.fillStyle = '#fff';
    for (const l of linhas) { ctx.fillText(l, tx, ty); ty += alt; }
    if (j.posicao) {
      ctx.fillStyle = VERDE;
      ctx.font = `700 23px ${FONTE_ARTE}`;
      ctx.fillText(j.posicao, tx, ty + 3);
    }
  });
  return new Promise((ok, ko) => cv.toBlob((b) => (b ? ok(b) : ko(new Error('imagem'))), 'image/png'));
}
