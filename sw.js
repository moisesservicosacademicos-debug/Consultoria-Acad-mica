/* Service worker da Consultoria Acadêmica: recebe as notificações enviadas pelo servidor
   (mesmo com o sistema fechado) e abre a tela certa ao tocar no aviso. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Consultoria Acadêmica', body: e.data ? e.data.text() : '' }; }
  var title = d.title || 'Consultoria Acadêmica';
  var msg = { type: 'ca-push', title: title, body: d.body || '', tag: d.tag || 'consultoria', url: d.url || '#/painel' };
  e.waitUntil(Promise.all([
    self.registration.showNotification(title, {
      body: d.body || '',
      tag: d.tag || 'consultoria',
      renotify: true,
      requireInteraction: !!d.urgent,
      icon: '/assets/icon-192.png',
      badge: '/assets/badge-96.png',
      lang: 'pt-BR',
      data: { url: d.url || '#/painel' }
    }),
    // Avisa também as janelas abertas do sistema: confirma o teste e mostra o alerta
    // dentro da tela mesmo quando o Windows/Mac segura o balão de notificação.
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      list.forEach(function (c) { try { c.postMessage(msg); } catch (x) {} });
    })
  ]));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var raw = ((e.notification.data && e.notification.data.url) || '#/painel').replace(/^\//, '');
  var url = new URL(raw, self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.url.indexOf(self.registration.scope) === 0 && 'focus' in c) { c.navigate ? c.navigate(url).catch(function () {}) : null; return c.focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
