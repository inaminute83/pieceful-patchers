// Mobile nav toggle
const navToggle = document.querySelector('.nav-toggle');
const siteNav = document.querySelector('.site-nav');
if (navToggle && siteNav) {
  navToggle.addEventListener('click', () => {
    const open = siteNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

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
  });
})();

// Members-only simple gate
(function(){
  const PASSWORD = 'Quilt2025';
  const gate = document.getElementById('members-gate');
  const input = document.getElementById('members-password');
  const button = document.getElementById('members-enter');
  const content = document.getElementById('members-content');
  const error = document.getElementById('members-error');
  if (!gate || !input || !button || !content) return;

  function showContent(){
    gate.classList.add('hidden');
    content.classList.remove('hidden');
    if (error) error.style.display = 'none';
  }

  // Persist unlock for convenience
  if (localStorage.getItem('membersUnlocked') === '1') {
    showContent();
    return;
  }

  function handleEnter(){
    if (input.value === PASSWORD) {
      localStorage.setItem('membersUnlocked', '1');
      showContent();
    } else {
      if (error) error.style.display = 'inline';
      input.focus();
      input.select();
    }
  }

  button.addEventListener('click', handleEnter);
  input.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') handleEnter(); });
})();

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
