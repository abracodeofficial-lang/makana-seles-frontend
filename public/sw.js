// Service Worker — استقبال إشعارات الجهاز (Web Push) حتى لو تبويب النظام مسكّر

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() }; }

  event.waitUntil(
    self.registration.showNotification(data.title || 'نظام مكانة', {
      body:     data.body || '',
      icon:     '/favicon.svg',
      badge:    '/favicon.svg',
      dir:      'rtl',
      lang:     'ar',
      tag:      data.tag || undefined,
      renotify: !!data.tag,
      requireInteraction: true,   // يضل ظاهر لحد ما الموظف يشوفه
      data:     { url: data.url || '/' },
    })
  );
});

// الضغط على الإشعار: يفتح النظام على الصفحة المطلوبة (أو يركّز على تبويب مفتوح)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const tab of tabs) {
      if (new URL(tab.url).origin === self.location.origin) {
        await tab.focus();
        if ('navigate' in tab) await tab.navigate(url);
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
