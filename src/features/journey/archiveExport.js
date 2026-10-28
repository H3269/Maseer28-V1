const encoder = new TextEncoder();

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
  }
  return (crc ^ -1) >>> 0;
}
function u16(value) { return [value & 255, (value >>> 8) & 255]; }
function u32(value) { return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]; }
function concat(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size); let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}
function zipStore(files) {
  const local = [], central = []; let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name), data = file.data instanceof Uint8Array ? file.data : encoder.encode(file.data);
    const crc = crc32(data);
    const head = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)]);
    local.push(head, name, data);
    const cent = new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]);
    central.push(cent, name); offset += head.length + name.length + data.length;
  }
  const centralData = concat(central), localData = concat(local);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(centralData.length), ...u32(localData.length), ...u16(0)]);
  return concat([localData, centralData, end]);
}
function safeName(value) { return String(value || 'مسیر').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '-').slice(0, 48); }
function dateLabel(value) {
  if (!value) return 'ثبت نشده';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'ثبت نشده' : date.toLocaleDateString('fa-IR');
}
function wrapText(ctx, text, maxWidth) {
  const words = String(text || '—').split(/\s+/); const lines = []; let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : ['—'];
}
function makePdf(archive, index) {
  const W = 1240, H = 1754, margin = 86, lineHeight = 43;
  const p = archive.profileData || {};
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const pages = []; let y = 0;
  function newPage() {
    if (y) pages.push(canvas.toDataURL('image/jpeg', 0.88).split(',')[1]);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); ctx.direction = 'rtl'; ctx.textAlign = 'right';
    ctx.fillStyle = '#174e49'; ctx.font = 'bold 40px sans-serif'; ctx.fillText('آرشیو مسیر ۲۸ روزه', W - margin, 100);
    ctx.fillStyle = '#64716e'; ctx.font = '24px sans-serif'; ctx.fillText(`مسیر ${index + 1} · ${p.problem || 'بدون عنوان'}`, W - margin, 148);
    ctx.strokeStyle = '#d8e5e1'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(margin, 180); ctx.lineTo(W - margin, 180); ctx.stroke();
    y = 230;
  }
  function write(text, options = {}) {
    const { bold = false, size = 27, color = '#243b38', gap = 10 } = options;
    ctx.font = `${bold ? 'bold ' : ''}${size}px sans-serif`; ctx.fillStyle = color;
    const lines = wrapText(ctx, text, W - margin * 2);
    for (const line of lines) {
      if (y > H - margin - lineHeight) newPage();
      ctx.fillText(line, W - margin, y); y += lineHeight;
    }
    y += gap;
  }
  newPage();
  write(`نام: ${p.name || '—'}    مسئله: ${p.problem || '—'}    کد: ${p.code || '—'}`, { size: 24 });
  write(`تاریخ شروع: ${dateLabel(archive.startedAt)}    تاریخ بایگانی: ${dateLabel(archive.archivedAt)}`, { size: 23, color: '#64716e' });
  write(`پیشرفت: ${(archive.completed || []).length} از ۲۸ روز    امتیاز شروع: ${archive.assessmentData?.score ?? '—'}    امتیاز پایان: ${archive.final?.score ?? '—'}`, { size: 23, color: '#64716e', gap: 22 });
  const entries = Object.entries(archive.answers || {}).sort(([a], [b]) => Number(a) - Number(b));
  if (!entries.length) write('برای این مسیر پاسخی ثبت نشده است.', { size: 25 });
  for (const [day, answer] of entries) {
    const daily = archive.daily?.[day];
    write(`روز ${day}`, { bold: true, size: 30, color: '#176b63', gap: 3 });
    write(`پاسخ ثبت‌شده: ${answer || '—'}`, { size: 25, gap: 3 });
    write(`شدت درگیری: ${daily?.score ?? '—'} از ۱۰    بازخورد: ${daily?.feedbackText || daily?.feedback || '—'}`, { size: 22, color: '#586a66', gap: 20 });
  }
  pages.push(canvas.toDataURL('image/jpeg', 0.88).split(',')[1]);
  return jpegPagesToPdf(pages, W, H);
}
function b64bytes(value) { const raw = atob(value); const out = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i); return out; }
function jpegPagesToPdf(base64Pages, width, height) {
  const objects = []; const offsets = [0];
  const add = (bytes) => { objects.push(bytes instanceof Uint8Array ? bytes : encoder.encode(bytes)); return objects.length; };
  const catalogId = add(''); const pagesId = add(''); const pageIds = [];
  for (const b64 of base64Pages) {
    const jpg = b64bytes(b64); const imageId = add(concat([encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`), jpg, encoder.encode('\nendstream')]));
    const content = encoder.encode(`q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`);
    const contentId = add(concat([encoder.encode(`<< /Length ${content.length} >>\nstream\n`), content, encoder.encode('\nendstream')]));
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`); pageIds.push(pageId);
  }
  objects[pagesId - 1] = encoder.encode(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  objects[catalogId - 1] = encoder.encode(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const chunks = [encoder.encode('%PDF-1.4\n%âãÏÓ\n')]; let length = chunks[0].length;
  objects.forEach((obj, i) => { offsets.push(length); const prefix = encoder.encode(`${i + 1} 0 obj\n`), suffix = encoder.encode('\nendobj\n'); chunks.push(prefix, obj, suffix); length += prefix.length + obj.length + suffix.length; });
  const xrefAt = length; let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  chunks.push(encoder.encode(xref)); return concat(chunks);
}
export async function exportArchivesZip(archives) {
  const files = [];
  for (let i = 0; i < archives.length; i += 1) {
    const archive = archives[i];
    files.push({ name: `${String(i + 1).padStart(2, '0')}-${safeName(archive.profileData?.problem)}.pdf`, data: makePdf(archive, i) });
  }
  const zip = zipStore(files);
  return new Blob([zip], { type: 'application/zip' });
}
