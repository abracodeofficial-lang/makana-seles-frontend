import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Eraser, Undo2, Wand2, Loader2 } from 'lucide-react';
import { Btn, Modal } from '../../components/ui';
import { loadOpenCV } from '../../lib/opencv';

const MAX_UNDO = 15;

/**
 * محرر إزالة العلامات: الفرشاة بتحدد المنطقة، و OpenCV (inpaint) بيعبّيها من اللي حواليها.
 * الشغل كله على نسخة بالدقة الأصلية؛ العرض بس مصغّر.
 */
export default function WatermarkEraser({ file, onClose, onSave }) {
  const fullRef    = useRef(null);   // canvas بالدقة الأصلية
  const viewRef    = useRef(null);   // العرض
  const maskRef    = useRef(null);   // تحديد الفرشاة (بدقة العرض)
  const wrapRef    = useRef(null);
  const drawing    = useRef(null);
  const historyRef = useRef([]);
  const [ready, setReady]     = useState(false);
  const [cvState, setCvState] = useState('loading');   // loading | ready | error
  const [brush, setBrush]     = useState(24);
  const [busy, setBusy]       = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [edited, setEdited]   = useState(false);
  const [size, setSize]       = useState({ w: 0, h: 0 });

  useEffect(() => {
    loadOpenCV().then(() => setCvState('ready')).catch(() => setCvState('error'));
  }, []);

  const redraw = useCallback(() => {
    const full = fullRef.current, view = viewRef.current;
    if (!full || !view) return;
    const ctx = view.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, view.width, view.height);
    ctx.drawImage(full, 0, 0, view.width, view.height);
  }, []);

  // تحميل الصورة وتجهيز أحجام العرض
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
        if (cancelled) return;
        const full = document.createElement('canvas');
        full.width = bmp.width; full.height = bmp.height;
        full.getContext('2d').drawImage(bmp, 0, 0);
        bmp.close?.();
        fullRef.current = full;

        const maxW = Math.min(wrapRef.current?.clientWidth || 900, 1100);
        const maxH = Math.round(window.innerHeight * 0.6);
        const scale = Math.min(1, maxW / full.width, maxH / full.height);
        const w = Math.max(1, Math.round(full.width * scale)), h = Math.max(1, Math.round(full.height * scale));
        setSize({ w, h });
        setReady(true);
      } catch {
        toast.error('ما قدرنا نفتح الصورة');
        onClose();
      }
    })();
    return () => { cancelled = true; };
  }, [file]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready) return;
    [viewRef.current, maskRef.current].forEach(c => { c.width = size.w; c.height = size.h; });
    redraw();
  }, [ready, size, redraw]);

  // ── الفرشاة ──
  const point = (e) => {
    const r = maskRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (maskRef.current.width / r.width), y: (e.clientY - r.top) * (maskRef.current.height / r.height) };
  };
  const stroke = (a, b) => {
    const ctx = maskRef.current.getContext('2d');
    ctx.strokeStyle = '#ff2d2d'; ctx.fillStyle = '#ff2d2d';
    ctx.lineWidth = brush; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  };
  const onDown = (e) => {
    if (busy) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e);
    drawing.current = p;
    stroke(p, p);
    setHasMask(true);
  };
  const onMove = (e) => {
    if (!drawing.current) return;
    const p = point(e);
    stroke(drawing.current, p);
    drawing.current = p;
  };
  const onUp = () => { drawing.current = null; };
  const clearMask = () => {
    const m = maskRef.current;
    m.getContext('2d').clearRect(0, 0, m.width, m.height);
    setHasMask(false);
  };

  // ── الإزالة ──
  const apply = async () => {
    if (!hasMask || cvState !== 'ready') return;
    setBusy(true);
    await new Promise(r => setTimeout(r, 30));   // خلّي مؤشر التحميل يظهر
    const cv = window.cv;
    const mats = [];
    try {
      const full = fullRef.current, mask = maskRef.current;
      const sx = full.width / mask.width, sy = full.height / mask.height;

      // حدود التحديد على العرض
      const md = mask.getContext('2d').getImageData(0, 0, mask.width, mask.height).data;
      let x0 = mask.width, y0 = mask.height, x1 = -1, y1 = -1;
      for (let y = 0; y < mask.height; y++) for (let x = 0; x < mask.width; x++) {
        if (md[(y * mask.width + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < 0) return;

      // منطقة العمل بالدقة الأصلية + هامش حتى الخوارزمية تشوف اللي حوالين العلامة
      const pad = Math.round(Math.max(24, brush * sx * 2));
      const X0 = Math.max(0, Math.floor(x0 * sx) - pad), Y0 = Math.max(0, Math.floor(y0 * sy) - pad);
      const X1 = Math.min(full.width, Math.ceil((x1 + 1) * sx) + pad), Y1 = Math.min(full.height, Math.ceil((y1 + 1) * sy) + pad);
      const W = X1 - X0, H = Y1 - Y0;

      const fctx = full.getContext('2d');
      const before = fctx.getImageData(X0, Y0, W, H);

      // قناع بالدقة الأصلية لنفس المنطقة
      const mc = document.createElement('canvas');
      mc.width = W; mc.height = H;
      const mctx = mc.getContext('2d');
      mctx.drawImage(mask, X0 / sx, Y0 / sy, W / sx, H / sy, 0, 0, W, H);
      const mData = mctx.getImageData(0, 0, W, H).data;
      const maskBytes = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) maskBytes[i] = mData[i * 4 + 3] > 20 ? 255 : 0;

      const src = cv.matFromImageData(before); mats.push(src);
      const rgb = new cv.Mat(); mats.push(rgb);
      cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
      const m = cv.matFromArray(H, W, cv.CV_8UC1, maskBytes); mats.push(m);
      // توسيع خفيف للقناع حتى ما يضل أثر لحواف العلامة
      const k = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5)); mats.push(k);
      cv.dilate(m, m, k);
      const out = new cv.Mat(); mats.push(out);
      const radius = Math.max(3, Math.min(15, Math.round(brush * sx / 3)));
      cv.inpaint(rgb, m, out, radius, cv.INPAINT_TELEA);
      const rgba = new cv.Mat(); mats.push(rgba);
      cv.cvtColor(out, rgba, cv.COLOR_RGB2RGBA);

      // نحافظ على الشفافية الأصلية (PNG)
      const result = new ImageData(new Uint8ClampedArray(rgba.data), W, H);
      for (let i = 3; i < result.data.length; i += 4) result.data[i] = before.data[i];

      historyRef.current.push({ x: X0, y: Y0, data: before });
      if (historyRef.current.length > MAX_UNDO) historyRef.current.shift();
      setUndoCount(historyRef.current.length);

      fctx.putImageData(result, X0, Y0);
      redraw();
      clearMask();
      setEdited(true);
    } catch {
      toast.error('صار خطأ أثناء الإزالة');
    } finally {
      mats.forEach(mt => { try { mt.delete(); } catch { /* ignore */ } });
      setBusy(false);
    }
  };

  const undo = () => {
    const last = historyRef.current.pop();
    if (!last) return;
    fullRef.current.getContext('2d').putImageData(last.data, last.x, last.y);
    setUndoCount(historyRef.current.length);
    setEdited(historyRef.current.length > 0);
    redraw();
  };

  const save = async () => {
    setBusy(true);
    try {
      // PNG بدون فقدان — الضغط لـ WebP بيصير بعدين بنفس الصفحة
      const blob = await new Promise(r => fullRef.current.toBlob(r, 'image/png'));
      const name = file.name.replace(/\.[^.]+$/, '') + '.png';
      onSave(new File([blob], name, { type: 'image/png' }));
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title="إزالة علامة من الصورة" width="max-w-5xl"
      footer={<>
        <Btn onClick={save} disabled={!edited || busy}>💾 حفظ واعتماد</Btn>
        <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
      </>}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2 text-gray-300">
            <Eraser size={15} /> حجم الفرشاة
            <input type="range" min="4" max="120" value={brush} onChange={e => setBrush(Number(e.target.value))} dir="ltr" />
            <span className="text-xs text-gray-500 w-8">{brush}</span>
          </label>
          <Btn size="sm" onClick={apply} disabled={!hasMask || busy || cvState !== 'ready'}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} إزالة المحدد
          </Btn>
          <Btn size="sm" variant="outline" onClick={clearMask} disabled={!hasMask || busy}>مسح التحديد</Btn>
          <Btn size="sm" variant="outline" onClick={undo} disabled={!undoCount || busy}><Undo2 size={13} /> تراجع</Btn>
          {cvState === 'loading' && <span className="text-xs text-gray-500 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> بنحمّل أداة الإزالة (أول مرة بس)...</span>}
          {cvState === 'error' && <span className="text-xs text-red-400">فشل تحميل أداة الإزالة — حدّث الصفحة</span>}
        </div>

        <div ref={wrapRef} className="w-full flex justify-center bg-gray-900 rounded-lg p-2 overflow-hidden">
          {!ready ? <Loader2 className="animate-spin text-gray-500 my-16" /> : (
            <div className="relative" style={{ width: size.w, maxWidth: '100%', aspectRatio: `${size.w} / ${size.h}` }} dir="ltr">
              <canvas ref={viewRef} className="absolute inset-0 w-full h-full" />
              <canvas ref={maskRef} className="absolute inset-0 w-full h-full opacity-50"
                style={{ touchAction: 'none', cursor: busy ? 'wait' : 'crosshair' }}
                onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
            </div>
          )}
        </div>

        <p className="text-xs text-gray-500">
          لوّن فوق العلامة بالأحمر واضغط "إزالة المحدد". بتقدر تعيدها أكتر من مرة على أجزاء. أحسن نتيجة: لوجو أو نص صغير فوق خلفية بسيطة.
          استخدمها على صوركم أو صور عندكم حق تعدّلوا عليها.
        </p>
      </div>
    </Modal>
  );
}
