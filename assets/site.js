/* FlowBuild AI: shared behaviour for every page. Load after scrollcraft.js. */
(function () {
  var BOOKING_URL = 'https://links.flowbuildai.ie/widget/booking/MLznN883xY9UeIaBWpgO';
  var GHL_WIDGET = '6a040bc50d6444c6be238ac6';

  if (window.ScrollCraft) ScrollCraft.mount(document.body);

  function dialog(cls, label) {
    var d = document.createElement('dialog');
    d.className = 'modal ' + cls;
    d.setAttribute('aria-label', label);
    d.innerHTML = '<button class="modal__x" type="button" aria-label="Close">×</button><div class="modal__body"></div>';
    d.querySelector('.modal__x').addEventListener('click', function () { d.close(); });
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    document.body.appendChild(d);
    return d;
  }

  // Booking: every [data-book] opens the GHL calendar. The href stays a real
  // link so it still works with JS off or on a blocked dialog.
  var book;
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-book]');
    if (!a || !window.HTMLDialogElement) return;
    e.preventDefault();
    if (!book) {
      book = dialog('modal--book', 'Book a call');
      book.querySelector('.modal__body').style.height = '100%';
      book.querySelector('.modal__body').innerHTML = '<iframe title="Book a call with FlowBuild AI" src="' + BOOKING_URL + '"></iframe>';
    }
    book.showModal();
  });

  // Video testimonials: [data-video] plays a file, [data-yt] a YouTube id.
  // In a fan, a side card first swings to the centre; the centre card plays.
  var vid, fanWide = matchMedia('(min-width: 761px)');
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-video],[data-yt]');
    if (!b || !window.HTMLDialogElement) return;
    e.preventDefault();
    var fan = b.closest('[data-fan]');
    if (fan && fanWide.matches && b.dataset.pos !== 'c') {
      var c = fan.querySelector('[data-pos="c"]');
      c.dataset.pos = b.dataset.pos; b.dataset.pos = 'c';
      return;
    }
    if (!vid) {
      vid = dialog('modal--video', 'Client video');
      vid.addEventListener('close', function () { vid.querySelector('.modal__body').innerHTML = ''; });
    }
    var body = vid.querySelector('.modal__body');
    body.innerHTML = b.dataset.yt
      ? '<iframe title="' + (b.getAttribute('aria-label') || 'Client video') + '" src="https://www.youtube-nocookie.com/embed/' + b.dataset.yt + '?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>'
      : '<video src="' + b.dataset.video + '" controls autoplay playsinline></video>';
    vid.showModal();
  });

  // Client-site windows: each plays its real hero recording while on screen.
  var vids = document.querySelectorAll('.win__vid');
  var conn = navigator.connection || {}, lite = conn.saveData || /(^|-)2g|3g/.test(conn.effectiveType || '');
  if (vids.length && !lite && 'IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          if (!v.src) { v.src = v.dataset.src; v.addEventListener('playing', function () { v.classList.add('ready'); }, { once: true }); }
          var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
        } else v.pause();
      });
    }, { rootMargin: '200px 0px' });
    vids.forEach(function (v) { vio.observe(v); });
  }

  // Mobile menu
  var nav = document.getElementById('nav'), menu = document.getElementById('navMenu');
  if (nav && menu) {
    menu.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      menu.setAttribute('aria-expanded', open);
      menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    nav.addEventListener('click', function (e) { if (e.target.closest('.nav__links a')) nav.classList.remove('open'); });
  }

  // GHL chat widget, loaded once the page is idle so it never competes with first paint.
  function loadChat() {
    if (document.querySelector('script[data-widget-id]')) return;
    var s = document.createElement('script');
    s.src = 'https://widgets.leadconnectorhq.com/loader.js';
    s.setAttribute('data-resources-url', 'https://widgets.leadconnectorhq.com/chat-widget/loader.js');
    s.setAttribute('data-widget-id', GHL_WIDGET);
    s.async = true;
    document.body.appendChild(s);
    swapChatAvatar();
  }

  // GHL's widget shows a personal photo as the agent avatar. Swap it for the
  // FlowBuild mark wherever the widget draws it (it re-renders, so keep watching).
  var AVATAR = '/assets/chat-avatar.png';
  function swapChatAvatar() {
    var tries = 0, t = setInterval(function () {
      var host = document.querySelector('chat-widget');
      if (host && host.shadowRoot) {
        clearInterval(t);
        var root = host.shadowRoot;
        var fix = function () {
          root.querySelectorAll('img[class*="avatar"], img[src*="6a040c6ff07c4898898dd706"]').forEach(function (img) {
            if (img.getAttribute('src') !== AVATAR) { img.src = AVATAR; img.srcset = ''; }
          });
        };
        fix();
        new MutationObserver(fix).observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
      } else if (++tries > 60) clearInterval(t);
    }, 500);
  }
  if (!document.documentElement.hasAttribute('data-no-chat')) {
    addEventListener('load', function () {
      setTimeout(function () { window.requestIdleCallback ? requestIdleCallback(loadChat) : loadChat(); }, 2500);
    });
  }
})();
