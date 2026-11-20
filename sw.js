/* Service worker da Consultoria Acadêmica: recebe as notificações enviadas pelo servidor
   (mesmo com o sistema fechado) e abre a tela certa ao tocar no aviso. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Consultoria Acadêmica', body: e.data ? e.data.text() : '' }; }
  var title = d.title || 'Consultoria Acadêmica';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    tag: d.tag || 'consultoria',
    renotify: true,
    requireInteraction: !!d.urgent,
    icon: '/assets/icon-192.png',
    badge: '/assets/badge-96.png',
    lang: 'pt-BR',
    data: { url: d.url || '/#/painel' }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = new URL((e.notification.data && e.notification.data.url) || '/#/painel', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.url.indexOf(self.location.origin) === 0 && 'focus' in c) { c.navigate ? c.navigate(url).catch(function () {}) : null; return c.focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
