// Pieceful Patchers client script
// - Mobile nav toggle
// - Load site content into home page from content/site.json
// - Render events from content/events.json on events page
// - Spotlight image local preview dropzone
// - Members-only simple gate
// - Footer year

(function(){
  function qs(sel, root=document){ return root.querySelector(sel); }
  function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

  function setYear(){
    var y = qs('#year');
    if (y) y.textContent = new Date().getFullYear();
  }

  // Members must re-login on every page load
  function isMembersUnlocked(){ return false; }

  // Render Member Resources page
  async function hydrateResourcesPage(){
    var list = qs('#resources-list');
    var notice = qs('#res-locked');
    if (!list) return; // not on resources page
    var membersContent = qs('#members-content');
    var unlockedLocal = membersContent && !membersContent.classList.contains('hidden');
    var unlocked = isMembersUnlocked() || unlockedLocal;
    if (!unlocked){
      if (notice) notice.style.display = 'block';
      return;
    }
    var data = await fetchJSON('content/resources.json');
    if (!data || !Array.isArray(data.items)) return;
    list.innerHTML = data.items.map(function(item){
      var t = String(item.title || 'Resource');
      var u = String(item.url || '#');
      return '<a class="card" href="'+encodeURI(u)+'">'+escapeHTML(t)+'</a>';
    }).join('');
  }

  // Render Newsletters page with auto-archive (older than 6 months)
  async function hydrateNewslettersPage(){
    var cur = qs('#news-current');
    var arch = qs('#news-archive');
    if (!cur && !arch) return; // not on newsletters page
    var data = await fetchJSON('content/newsletters.json');
    if (!data || !Array.isArray(data.items)) return;

    function parseDateLoose(val){
      if (!val) return null;
      // Support YYYY-MM, YYYY-MM-DD, and Month YYYY
      if (/^\d{4}-\d{2}$/.test(val)) return new Date(val + '-01');
      var d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }

    var items = data.items.map(function(n){
      var d = parseDateLoose(String(n.date||''));
      return {
        title: String(n.title||'Newsletter'),
        url: String(n.url||'#'),
        dateStr: String(n.date||''),
        time: d ? d.getTime() : 0
      };
    }).sort(function(a,b){ return b.time - a.time; });

    var now = new Date();
    var cutoff = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).getTime();
    var current = items.filter(function(it){ return it.time >= cutoff && it.time > 0; });
    var archive = items.filter(function(it){ return !(it.time >= cutoff && it.time > 0); });

    // Ensure at least one item appears under current
    if (current.length === 0 && items.length > 0){
      current = [items[0]];
      archive = items.slice(1);
    }

    function renderList(ul, arr){
      if (!ul || !Array.isArray(arr)) return;
      ul.innerHTML = arr.map(function(n){
        return '<li><a href="'+encodeURI(n.url)+'">'+escapeHTML(n.title)+'</a>'+(n.dateStr ? ' <span class="tiny">('+escapeHTML(n.dateStr)+')</span>' : '')+'</li>';
      }).join('');
    }

    renderList(cur, current);
    renderList(arch, archive);
  }

  async function hydrateNavLabels(){
    var nav = document.querySelector('.site-nav');
    if (!nav) return;
    var data = await fetchJSON('content/site.json');
    if (!data || !data.nav) return;
    var labels = data.nav;
    var map = {
      'index.html': labels.homeLabel,
      'about.html': labels.aboutLabel,
      'events.html': labels.eventsLabel,
      'gallery.html': labels.galleryLabel,
      'membership.html': labels.membershipLabel,
      'spotlight.html': labels.spotlightLabel,
      '#members': labels.membersLabel,
      'contact.html': labels.contactLabel
    };
    document.querySelectorAll('.site-nav a').forEach(function(a){
      try{
        var href = a.getAttribute('href') || '';
        if (href.includes('#members-heading')) {
          if (map['#members']) a.textContent = map['#members'];
        } else {
          var file = href.split('/').pop();
          if (map[file]) a.textContent = map[file];
        }
      }catch(_e){}
    });
  }

  function setupNav(){
    var btn = qs('.nav-toggle');
    var nav = qs('.site-nav');
    if (!btn || !nav) return;
    btn.addEventListener('click', function(){
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });
    // Close on outside click (mobile)
    document.addEventListener('click', function(e){
      if (!nav.classList.contains('open')) return;
      if (e.target === btn || btn.contains(e.target) || nav.contains(e.target)) return;
      nav.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  async function fetchJSON(path){
    try{
      const res = await fetch(path, { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP '+res.status);
      return await res.json();
    }catch(err){
      console.warn('Failed to load', path, err);
      return null;
    }
  }

  async function hydrateHome(){
    // Only run on home page where these elements exist
    var line1 = qs('.hero-title-line1');
    var line2 = qs('.hero-title-line2');
    var featuredTagline = qs('#featured-tagline');
    var meetingLine = qs('#meeting-line');
    var spotlightBio = qs('#spotlight-bio');
    var spotlightImg = qs('#spotlight-image');
    if (!line1 && !line2 && !featuredTagline && !meetingLine && !spotlightBio && !spotlightImg) return;

    var data = await fetchJSON('content/site.json');
    if (!data) return;

    if (data.siteName){
      var logo = qs('.logo');
      if (logo) logo.textContent = data.siteName;
      document.title = data.siteName + ' | Home';
    }
    if (data.heroLine1 && line1) line1.textContent = data.heroLine1;
    if (data.heroLine2 && line2) line2.textContent = data.heroLine2;
    if (data.featuredTagline && featuredTagline) featuredTagline.textContent = data.featuredTagline;
    if (data.meetingLine && meetingLine){
      // If the element already includes a leading label, replace only the text content
      meetingLine.textContent = data.meetingLine;
    }
    if (data.spotlightBio && spotlightBio) spotlightBio.textContent = data.spotlightBio;
    if (data.spotlightImage && spotlightImg){
      spotlightImg.src = data.spotlightImage;
    }
  }

  async function hydrateEventsPage(){
    var eventsWrap = qs('.events');
    if (!eventsWrap) return; // not on events page
    var eventsData = await fetchJSON('content/events.json');
    if (!eventsData || !Array.isArray(eventsData.items)) return;
    if (eventsData.items.length === 0) return;

    eventsWrap.innerHTML = eventsData.items.map(function(ev){
      var safe = {
        title: String(ev.title || ''),
        date: String(ev.date || ''),
        location: String(ev.location || ''),
        description: String(ev.description || '')
      };
      return (
        '<article class="event">'+
          '<h3>'+escapeHTML(safe.title)+'</h3>'+
          (safe.date ? '<p><strong>Date:</strong> '+escapeHTML(safe.date)+'</p>' : '')+
          (safe.location ? '<p><strong>Location:</strong> '+escapeHTML(safe.location)+'</p>' : '')+
          (safe.description ? '<p>'+escapeHTML(safe.description)+'</p>' : '')+
        '</article>'
      );
    }).join('');
  }

  function escapeHTML(str){
    return str.replace(/[&<>"']/g, function(ch){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]);
    });
  }

  function setupSpotlightUpload(){
    var dz = qs('#spotlight-dropzone');
    var input = qs('#spotlight-upload');
    var img = qs('#spotlight-image');
    if (!dz || !input || !img) return;

    function preview(file){
      if (!file || !file.type || !file.type.startsWith('image/')) return;
      var reader = new FileReader();
      reader.onload = function(e){ img.src = e.target.result; };
      reader.readAsDataURL(file);
    }

    dz.addEventListener('click', function(){ input.click(); });
    input.addEventListener('change', function(){ preview(input.files[0]); });
    dz.addEventListener('dragover', function(e){ e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', function(){ dz.classList.remove('drag'); });
    dz.addEventListener('drop', function(e){ e.preventDefault(); dz.classList.remove('drag'); preview(e.dataTransfer.files[0]); });
  }

  function setupMembersGate(){
    var gate = qs('#members-gate');
    var input = qs('#members-password');
    var enterBtn = qs('#members-enter');
    var error = qs('#members-error');
    var content = qs('#members-content');
    var caps = qs('#members-caps');
    var show = qs('#members-show');
    var logoutBtn = qs('#members-logout');
    if (!gate || !input || !enterBtn || !content) return;

    // Option A: plain password (visible client-side)
    var PASSWORD = 'Quilt2025';
    // Option B: hashed password (still client-visible but not plaintext). Example for 'patchwork' shown.
    // Generate your own with: crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourpass')) then hex.
    var PASSWORD_HASH = null; // e.g., 'e3b0c44298fc1c149afbf4c8996fb924...' (64 hex chars)

    var MAX_ATTEMPTS = 5;
    var LOCK_MS = 30000; // 30s lockout after too many attempts
    var attempts = 0;
    var lockedUntil = 0;

    function unlock(){
      content.classList.remove('hidden');
      gate.classList.add('hidden');
      // If on resources page, render list immediately post-unlock
      try { hydrateResourcesPage(); } catch(_e) {}
    }
    function lock(){
      content.classList.add('hidden');
      gate.classList.remove('hidden');
    }

    function setDisabled(disabled){
      enterBtn.disabled = !!disabled;
      input.disabled = !!disabled;
    }

    function showError(msg){
      if (!error) return;
      error.textContent = msg || 'Incorrect password. Please try again.';
      error.style.display = 'inline';
    }
    function hideError(){ if (error) error.style.display = 'none'; }

    if (show) {
      show.addEventListener('change', function(){
        input.type = this.checked ? 'text' : 'password';
      });
    }
    if (input) {
      input.addEventListener('keydown', function(e){
        if (caps) caps.style.display = e.getModifierState && e.getModifierState('CapsLock') ? 'inline' : 'none';
        if (e.key === 'Enter') {
          e.preventDefault();
          enterBtn.click();
        }
      });
      input.addEventListener('input', hideError);
    }

    async function sha256Hex(str){
      const buf = new TextEncoder().encode(str);
      const hash = await crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
    }

    function checkLocked(){
      var now = Date.now();
      if (now < lockedUntil){
        var remaining = Math.ceil((lockedUntil - now)/1000);
        showError('Too many attempts. Try again in '+remaining+'s');
        setDisabled(true);
        return true;
      }
      setDisabled(false);
      return false;
    }

    async function tryLogin(){
      if (checkLocked()) return;
      var val = (input.value || '').trim();
      hideError();
      let ok = false;
      try {
        if (PASSWORD_HASH){
          var hex = await sha256Hex(val);
          ok = hex === PASSWORD_HASH;
        } else {
          ok = (val === PASSWORD);
        }
      } catch(_e) { ok = false; }

      if (ok){
        attempts = 0;
        unlock();
        input.value = '';
      } else {
        attempts++;
        if (attempts >= MAX_ATTEMPTS){
          lockedUntil = Date.now() + LOCK_MS;
          checkLocked();
        } else {
          showError('Incorrect password. Attempts left: '+(MAX_ATTEMPTS - attempts));
        }
      }
    }

    enterBtn.addEventListener('click', function(){
      tryLogin();
    });

    if (logoutBtn){
      logoutBtn.addEventListener('click', function(){
        lock();
        hideError();
      });
    }
  }

  // Copy mailto form content to clipboard on submit (best-effort)
  function setupWaitlistClipboard(){
    var form = qs('form[name="waitlist"]');
    if (!form) return;
    form.addEventListener('submit', function(){
      try{
        var fd = new FormData(form);
        var lines = [];
        fd.forEach(function(v,k){ lines.push(k+': '+v); });
        var text = lines.join('\n');
        navigator.clipboard && navigator.clipboard.writeText(text);
      }catch(_e){ /* noop */ }
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    setYear();
    setupNav();
    hydrateNavLabels();
    hydrateHome();
    hydrateEventsPage();
    hydrateResourcesPage();
    hydrateNewslettersPage();
    setupSpotlightUpload();
    setupMembersGate();
    setupWaitlistClipboard();
  });
})();


// Active link highlight
const links = document.querySelectorAll('.site-nav a');
links.forEach(link => {
  if (link.href === window.location.href) link.classList.add('active');
});

// Footer year
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Lightbox for gallery
(function(){
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.querySelector('.lightbox-image');
  const closeBtn = document.querySelector('.lightbox-close');
  const gallery = document.getElementById('gallery');
  if (!lightbox || !lightboxImg || !closeBtn || !gallery) return;

  gallery.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    e.preventDefault();
    lightboxImg.src = a.getAttribute('href');
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
  });

  function close(){
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    lightboxImg.src = '';
  }
  closeBtn.addEventListener('click', close);
  lightbox.addEventListener('click', (e)=>{ if (e.target === lightbox) close(); });
  document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') close(); });
})();

// CMS content loader: inject values from content/site.json into the DOM
(function(){
  document.addEventListener('DOMContentLoaded', () => {
    fetch('content/site.json', { cache: 'no-store' })
      .then((r)=> r.ok ? r.json() : null)
      .then((data)=>{
        if (!data) return;
        // Site name / logo
        const logo = document.querySelector('.logo');
        if (logo && data.siteName) logo.textContent = data.siteName;

        // Navigation labels (based on hrefs)
        if (data.nav) {
          const map = [
            { sel: 'a[href="index.html"]', key: 'homeLabel' },
            { sel: 'a[href="about.html"]', key: 'aboutLabel' },
            { sel: 'a[href="events.html"]', key: 'eventsLabel' },
            { sel: 'a[href="gallery.html"]', key: 'galleryLabel' },
            { sel: 'a[href="membership.html"]', key: 'membershipLabel' },
            { sel: 'a[href="spotlight.html"]', key: 'spotlightLabel' },
            { sel: 'a[href="index.html#members-heading"]', key: 'membersLabel' },
            { sel: 'a[href="contact.html"]', key: 'contactLabel' }
          ];
          map.forEach(({sel,key})=>{
            const a = document.querySelector(sel);
            if (a && data.nav[key]) a.textContent = data.nav[key];
          });
        }
        // Hero
        const l1 = document.querySelector('.hero .hero-title-line1');
        const l2 = document.querySelector('.hero .hero-title-line2');
        const hp = document.querySelector('.hero + p, .hero .container > p');
        if (l1 && data.heroLine1) l1.textContent = data.heroLine1;
        if (l2 && data.heroLine2) l2.textContent = data.heroLine2;
        if (hp && data.heroParagraph) hp.textContent = data.heroParagraph;

        // Featured tagline
        const ft = document.getElementById('featured-tagline');
        if (ft && data.featuredTagline) ft.textContent = data.featuredTagline;
        // Featured quilts
        const grid = document.querySelector('.featured-grid');
        if (grid && data.featuredImages) {
          if (Array.isArray(data.featuredImages)) {
            grid.innerHTML = data.featuredImages.map(item => {
              const src = String((item && item.src) || '');
              const cap = String((item && item.caption) || '');
              const alt = cap || 'Featured quilt';
              if (!src) return '';
              return '<figure class="card"><img src="'+src+'" alt="'+escapeHTML(alt)+'" />'+(cap? '<figcaption class="tiny">'+escapeHTML(cap)+'</figcaption>':'' )+'</figure>';
            }).join('');
          } else {
            // Legacy object keys (img1, img2, img3)
            const imgs = grid.querySelectorAll('figure img');
            const arr = [data.featuredImages.img1, data.featuredImages.img2, data.featuredImages.img3];
            imgs.forEach((el, i)=>{ if (arr[i]) el.src = arr[i]; });
          }
        }

        // Spotlight
        const sb = document.getElementById('spotlight-bio');
        if (sb && data.spotlightBio) sb.textContent = data.spotlightBio;
        const si = document.getElementById('spotlight-image');
        if (si && data.spotlightImage) si.src = data.spotlightImage;

        // Contact email (update all mailto links)
        if (data.contactEmail) {
          document.querySelectorAll('a[href^="mailto:"]').forEach(a=>{
            a.href = `mailto:${data.contactEmail}`;
            a.textContent = data.contactEmail;
          });
        }

        // Meeting line
        const ml = document.getElementById('meeting-line');
        if (ml && data.meetingLine) {
          // keep the <strong> label if present
          const strong = ml.querySelector('strong');
          if (strong) {
            strong.nextSibling && strong.parentNode.removeChild(strong.nextSibling);
            strong.insertAdjacentText('afterend', ' ' + data.meetingLine.replace(/^\s*Monthly Meeting:\s*/i, ''));
          } else {
            ml.textContent = data.meetingLine;
          }
        }
      })
      .catch(()=>{});

    // Load events list
    const eventsMount = document.getElementById('events-list');
    if (eventsMount) {
      fetch('content/events.json', { cache: 'no-store' })
        .then(r=> r.ok ? r.json() : null)
        .then(json=>{
          if (!json || !Array.isArray(json.items)) return;
          const frag = document.createDocumentFragment();
          json.items.forEach(ev=>{
            const art = document.createElement('article');
            art.className = 'event';
            const h3 = document.createElement('h3'); h3.textContent = ev.title || 'Event';
            const p1 = document.createElement('p'); p1.innerHTML = `<strong>Date:</strong> ${ev.date || ''}`;
            const p2 = document.createElement('p'); p2.innerHTML = `<strong>Location:</strong> ${ev.location || ''}`;
            const p3 = document.createElement('p'); p3.textContent = ev.description || '';
            art.append(h3,p1,p2,p3);
            frag.appendChild(art);
          });
          // Clear and insert
          eventsMount.innerHTML = '';
          eventsMount.appendChild(frag);
        })
        .catch(()=>{});
    }
  });
})();

// (Legacy members-only gate removed; using enhanced non-persistent gate)

// Spotlight image drop/choose preview (local only)
(function(){
  const dz = document.getElementById('spotlight-dropzone');
  const fileInput = document.getElementById('spotlight-upload');
  const img = document.getElementById('spotlight-image');
  if (!dz || !fileInput || !img) return;

  function preview(file){
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e)=>{ img.src = e.target.result; };
    reader.readAsDataURL(file);
  }

  dz.addEventListener('dragover', (e)=>{ e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', ()=> dz.classList.remove('drag'));
  dz.addEventListener('drop', (e)=>{
    e.preventDefault(); dz.classList.remove('drag');
    const file = e.dataTransfer.files?.[0];
    preview(file);
  });
  dz.addEventListener('click', ()=> fileInput.click());
  fileInput.addEventListener('change', ()=>{ preview(fileInput.files?.[0]); });
})();

// Mailto form handlers (no third-party services)
(function(){
  const RECIPIENT = 'inaminute083@yahoo.com';

  async function openMailTo(subject, body, redirect = 'thank-you.html'){
    const mailto = `mailto:${encodeURIComponent(RECIPIENT)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    // Try copying a helpful template to the clipboard as a fallback
    const clip = [
      `To: ${RECIPIENT}`,
      `Subject: ${subject}`,
      '',
      body
    ].join('\n');
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(clip);
      } else {
        const ta = document.createElement('textarea');
        ta.value = clip;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      // Notify the user
      alert('Your email app will open. We also copied your message to the clipboard as a backup. If your mail app does not open, paste into a new email to '+RECIPIENT+'.');
    } catch (e) {
      // Even if copying fails, continue with mailto and redirect
    }
    // Open the user's default mail app
    window.location.href = mailto;
    // After a short delay, navigate to thank-you page
    setTimeout(()=>{ window.location.href = redirect; }, 1200);
  }

  // Contact form
  const contactForm = document.querySelector('form[name="contact"]');
  if (contactForm) {
    contactForm.addEventListener('submit', (e)=>{
      e.preventDefault();
      const name = contactForm.querySelector('input[name="name"]').value.trim();
      const email = contactForm.querySelector('input[name="email"]').value.trim();
      const message = contactForm.querySelector('textarea[name="message"]').value.trim();

      const subject = `Website Contact from ${name || 'Unknown'}`;
      const body = [
        `Name: ${name}`,
        `Email: ${email}`,
        '',
        'Message:',
        message
      ].join('\n');

      openMailTo(subject, body);
    });
  }

  // Waitlist form
  const waitlistForm = document.querySelector('form[name="waitlist"]');
  if (waitlistForm) {
    waitlistForm.addEventListener('submit', (e)=>{
      e.preventDefault();
      const get = (sel) => (waitlistForm.querySelector(sel)?.value || '').trim();
      const fullName = get('input[name="full_name"]');
      const email = get('input[name="email"]');
      const addr1 = get('input[name="address_line1"]');
      const addr2 = get('input[name="address_line2"]');
      const city = get('input[name="city"]');
      const state = get('input[name="state"]');
      const zip = get('input[name="zip"]');
      const referral = get('select[name="referral"]');
      const notes = get('textarea[name="notes"]');

      const subject = `New Waitlist Entry: ${fullName || 'Unknown'}`;
      const bodyLines = [
        `Full Name: ${fullName}`,
        `Email: ${email}`,
        `Address Line 1: ${addr1}`,
        `Address Line 2: ${addr2}`,
        `City: ${city}`,
        `State/Province: ${state}`,
        `ZIP/Postal: ${zip}`,
        `Heard About Us: ${referral}`,
        '',
        'Additional Notes:',
        notes
      ];
      openMailTo(subject, bodyLines.join('\n'));
    });
  }

  // Membership form
  const membershipForm = document.querySelector('form[name="membership"]');
  if (membershipForm) {
    membershipForm.addEventListener('submit', (e)=>{
      e.preventDefault();
      const get = (sel) => (membershipForm.querySelector(sel)?.value || '').trim();
      const name = get('input[name="name"]');
      const email = get('input[name="email"]');
      const level = membershipForm.querySelector('select[name="level"]')?.value || '';

      const subject = `Membership Application: ${name || 'Unknown'}`;
      const body = [
        `Name: ${name}`,
        `Email: ${email}`,
        `Experience Level: ${level}`
      ].join('\n');

      openMailTo(subject, body);
    });
  }
})();
