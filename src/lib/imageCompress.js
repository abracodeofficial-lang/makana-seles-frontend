// ضغط الصور داخل المتصفح: أي صيغة بيقدر المتصفح يفتحها ← WebP تحت حجم معيّن
// بنحافظ على نسبة الأبعاد دائماً (الشكل ما بيتغير)، وبنفضّل تقليل الجودة بشكل خفيف قبل تصغير الأبعاد.

const MAX_Q = 0.92;   // أعلى جودة منجرّبها (فوقها الحجم بيكبر بدون فرق مرئي)
const STEPS = 7;      // خطوات البحث الثنائي عن الجودة

let webpSupport = null;
export async function supportsWebpEncode() {
  if (webpSupport !== null) return webpSupport;
  const c = document.createElement('canvas');
  c.width = c.height = 2;
  const b = await new Promise(r => c.toBlob(r, 'image/webp', 0.8));
  webpSupport = !!b && b.type === 'image/webp';
  return webpSupport;
}

async function decode(file) {
  try {
    // from-image: بيحترم دوران صور الموبايل (EXIF) حتى ما تطلع الصورة مقلوبة
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // احتياط لبعض الصيغ (مثل SVG)
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      const w = img.naturalWidth || 1024, h = img.naturalHeight || 1024;
      return await createImageBitmap(img, { resizeWidth: w, resizeHeight: h });
    } finally { URL.revokeObjectURL(url); }
  }
}

function render(bitmap, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas;
}

const encode = (canvas, q) => new Promise((res, rej) =>
  canvas.toBlob(b => (b ? res(b) : rej(new Error('encode failed'))), 'image/webp', q));

/**
 * @param {File} file
 * @param {{ targetBytes:number, maxSide:number|null, minQuality:number }} opts
 * @returns {Promise<{blob:Blob,width:number,height:number,origWidth:number,origHeight:number,quality:number,resized:boolean}>}
 */
export async function compressToWebp(file, { targetBytes, maxSide = null, minQuality = 0.7 }) {
  const bitmap = await decode(file);
  const origWidth = bitmap.width, origHeight = bitmap.height;
  try {
    let scale = maxSide ? Math.min(1, maxSide / Math.max(origWidth, origHeight)) : 1;

    for (let attempt = 0; attempt < 12; attempt++) {
      const w = Math.max(1, Math.round(origWidth * scale));
      const h = Math.max(1, Math.round(origHeight * scale));
      const canvas = render(bitmap, w, h);

      // أعلى جودة أول: إذا ضمن الحد خلص (أغلب الصور الصغيرة بتخلص هون بمحاولة وحدة)
      let best = await encode(canvas, MAX_Q);
      let bestQ = MAX_Q;
      if (best.size > targetBytes) {
        // هل الأبعاد هاي بتوصل للحد أصلاً بأقل جودة مسموحة؟
        const atMin = await encode(canvas, minQuality);
        if (atMin.size > targetBytes) {
          // لا ← نصغّر الأبعاد بنفس النسبة دفعة وحدة تقريباً ونعيد
          const ratio = Math.sqrt(targetBytes / atMin.size) * 0.97;
          scale *= Math.min(0.95, Math.max(0.3, ratio));
          continue;
        }
        // بحث ثنائي عن أعلى جودة بتعطي حجم تحت الحد
        let lo = minQuality, hi = MAX_Q, found = atMin, foundQ = minQuality;
        for (let i = 0; i < STEPS - 1; i++) {
          const mid = (lo + hi) / 2;
          const b = await encode(canvas, mid);
          if (b.size <= targetBytes) { found = b; foundQ = mid; lo = mid; } else { hi = mid; }
        }
        best = found; bestQ = foundQ;
      }

      return {
        blob: best, width: w, height: h, origWidth, origHeight,
        quality: Math.round(bestQ * 100), resized: w !== origWidth || h !== origHeight,
      };
    }
    throw new Error('ما قدرنا نوصل للحجم المطلوب');
  } finally {
    bitmap.close?.();
  }
}

export function webpName(name) {
  const base = String(name || 'image').replace(/\.[^.]+$/, '') || 'image';
  return `${base}.webp`;
}

export function formatBytes(n) {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

// ── ZIP بسيط بدون ضغط (WebP أصلاً مضغوط) — بدون مكتبات خارجية ──
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** @param {{name:string, blob:Blob}[]} files */
export async function makeZip(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  for (const f of files) {
    const data = new Uint8Array(await f.blob.arrayBuffer());
    const name = enc.encode(f.name);
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);          // UTF-8 للأسماء العربية
    local.setUint16(8, 0, true);               // بدون ضغط
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(local, name, data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, dosTime, true);
    cd.setUint16(14, dosDate, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, data.length, true);
    cd.setUint32(24, data.length, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true);
    central.push(cd, name);

    offset += 30 + name.length + data.length;
  }

  const cdSize = central.reduce((s, p) => s + p.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
