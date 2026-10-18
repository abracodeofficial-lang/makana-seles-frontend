// إشعارات الجهاز (Web Push): تسجيل الـ Service Worker والاشتراك وربطه بحساب الموظف
import { pushApi } from '../api/services';

export const pushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// iPhone/iPad: الإشعارات بتشتغل بس إذا النظام مضاف للشاشة الرئيسية
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

const urlBase64ToUint8Array = (base64) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
};

const registration = () => navigator.serviceWorker.register('/sw.js');

// يشترك (أو يجدد الاشتراك الموجود) ويبعته للسيرفر
async function subscribe() {
  const reg = await registration();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { data } = await pushApi.publicKey();
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.data.public_key),
    });
  }
  await pushApi.subscribe(sub.toJSON());
  return sub;
}

// بيطلب الإذن (لازم يكون من ضغطة زر) وبعدين بيشترك
export async function enablePush() {
  if (!pushSupported()) throw new Error('المتصفح لا يدعم الإشعارات');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('denied');
  return subscribe();
}

// عند فتح النظام: لو الإذن معطى مسبقاً، منتأكد إن الاشتراك مربوط بالحساب الحالي
export async function syncPush() {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  try { await subscribe(); } catch { /* ما منزعج المستخدم */ }
}

// عند تسجيل الخروج: نوقف الإشعارات عن هذا الجهاز للحساب الحالي
export async function disablePush() {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await pushApi.unsubscribe(sub.endpoint).catch(() => {});
      await sub.unsubscribe();
    }
  } catch { /* تجاهل */ }
}
