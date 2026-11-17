// تحميل OpenCV.js (حوالي 10MB) عند الحاجة بس — كملف منفصل بدون ما يدخل بالـ bundle
import opencvUrl from '@techstark/opencv-js/dist/opencv.js?url';

let loading = null;

// ملاحظة: كائن Emscripten فيه then() بترجّع نفسها، فممنوع نعمله await أو resolve مباشرة (بيعلق المتصفح).
// لهيك منستنى لحد ما cv.Mat يكون جاهز، ومنرجّع true بس، والمستخدم بياخد window.cv.
export function loadOpenCV() {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    if (window.cv?.Mat) { resolve(true); return; }

    const waitReady = () => {
      const started = Date.now();
      const tick = () => {
        if (window.cv?.Mat) { resolve(true); return; }
        if (Date.now() - started > 60000) { loading = null; reject(new Error('timeout')); return; }
        setTimeout(tick, 100);
      };
      const cv = window.cv;
      if (cv && !cv.Mat && typeof cv.then === 'function') {
        cv.then(mod => { if (mod?.Mat) window.cv = mod; });   // ما منرجّع mod حتى ما يصير loop
      }
      tick();
    };

    const s = document.createElement('script');
    s.src = opencvUrl;
    s.async = true;
    s.onload = waitReady;
    s.onerror = () => { loading = null; reject(new Error('load failed')); };
    document.head.appendChild(s);
  });
  return loading;
}
