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

  // Hospitality & Dark Horse page renderer
  async function hydrateHospitalityPage(){
    var grid = qs('#hospitality-grid');
    var titleEl = qs('#hosp-title');
    if (!grid) return;
    var data = await fetchJSON('content/hospitality.json');
    if (!data) return;
    if (titleEl && data.title) titleEl.textContent = data.title;
    var months = Array.isArray(data.months) ? data.months : [];
    grid.innerHTML = months.map(function(m){
      var label = String(m.label||'');
      var items = Array.isArray(m.items) ? m.items : [];
      var lines = items.concat(Array(Math.max(0, 6 - items.length)).fill(''));
      return (
        '<div class="hosp-card">'+
          '<h3>'+escapeHTML(label)+'</h3>'+
          '<ol>'+ lines.map(function(line){ return '<li>'+escapeHTML(String(line||''))+'</li>'; }).join('') +'</ol>'+
        '</div>'
      );
    }).join('');
  }

  // On-demand loader for jsPDF
  var jsPdfReady = null;
  function ensureJsPdf(){
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (jsPdfReady) return jsPdfReady;
    jsPdfReady = new Promise(function(resolve, reject){
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = function(){
        try { resolve(window.jspdf.jsPDF); } catch(e){ reject(e); }
      };
      s.onerror = function(){ reject(new Error('Failed to load jsPDF')); };
      document.head.appendChild(s);
    });
    return jsPdfReady;
  }

  // Build a PDF from images found in a panel's gallery
  async function generatePdfForPanel(panel, filename){
    try{
      var JS = await ensureJsPdf();
      var doc = new JS({ unit: 'pt', format: 'letter' }); // 612x792pt
      var pageW = doc.internal.pageSize.getWidth();
      var pageH = doc.internal.pageSize.getHeight();
      var margin = 36; // 0.5in
      var maxW = pageW - margin*2;
      var y = margin;

      // Optional title at top
      var titleEl = panel.querySelector('h3');
      if (titleEl){
        doc.setFont('helvetica','bold');
        doc.setFontSize(14);
        doc.text(titleEl.textContent.trim(), margin, y);
        y += 18;
      }

      var figs = Array.from(panel.querySelectorAll('.panel-gallery figure'));
      if (figs.length === 0){ alert('No images found to include in the PDF.'); return; }

      // For readability: 1 image per page with caption
      for (var i=0;i<figs.length;i++){
        var imgEl = figs[i].querySelector('img');
        var caption = (figs[i].querySelector('figcaption')?.textContent || '').trim();
        if (!imgEl) continue;

        // Draw image onto canvas to get data URL
        var dataUrl = await imageToDataUrl(imgEl);
        // Compute scaled size
        var naturalW = imgEl.naturalWidth || 1000;
        var naturalH = imgEl.naturalHeight || 1000;
        var scale = Math.min(maxW / naturalW, (pageH - margin*2 - 24) / naturalH);
        var drawW = Math.max(1, Math.floor(naturalW * scale));
        var drawH = Math.max(1, Math.floor(naturalH * scale));

        // New page except first
        if (i>0) doc.addPage();
        y = margin;
        doc.addImage(dataUrl, 'JPEG', (pageW - drawW)/2, y, drawW, drawH);
        y += drawH + 12;
        if (caption){
          doc.setFont('helvetica','normal');
          doc.setFontSize(11);
          doc.text(caption, margin, y);
        }
      }

      doc.save(filename || 'section.pdf');
    }catch(err){
      console.warn('PDF generation failed', err);
      alert('Sorry, PDF generation failed.');
    }
  }

  function imageToDataUrl(img){
    return new Promise(function(resolve, reject){
      try{
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var w = img.naturalWidth || img.width; var h = img.naturalHeight || img.height;
        canvas.width = w; canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        // Use JPEG for better size
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      }catch(e){ reject(e); }
    });
  }

  // Local-only preview for adding more Featured quilts on Home
  function setupFeaturedDropzone(){
    var dz = qs('#featured-dropzone');
    var input = qs('#featured-upload');
    var grid = qs('.featured-grid');
    if (!dz || !input || !grid) return;

    function addPreview(file){
      if (!file || !file.type || !file.type.startsWith('image/')) return;
      var reader = new FileReader();
      reader.onload = function(e){
        var fig = document.createElement('figure'); fig.className = 'card';
        var img = document.createElement('img'); img.src = e.target.result; img.alt = file.name;
        var cap = document.createElement('figcaption'); cap.className = 'tiny'; cap.textContent = file.name;
        fig.appendChild(img); fig.appendChild(cap);
        grid.appendChild(fig);
        try{ if (window._ppSyncFeaturedSlideshow) window._ppSyncFeaturedSlideshow(); }catch(_e){}
      };
      reader.readAsDataURL(file);
    }

    dz.addEventListener('click', function(){ input.click(); });
    input.addEventListener('change', function(){ Array.from(input.files||[]).forEach(addPreview); });
    dz.addEventListener('dragover', function(e){ e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', function(){ dz.classList.remove('drag'); });
    dz.addEventListener('drop', function(e){ e.preventDefault(); dz.classList.remove('drag'); var files = e.dataTransfer.files||[]; Array.from(files).forEach(addPreview); });
  }

  // Members must re-login on every page load
  function isMembersUnlocked(){ return false; }

  // Render Members-only tabbed sections on resources page
  async function hydrateResourcesPage(){
    var tabsNav = qs('#member-tabs-nav');
    var tabsContent = qs('#member-sections');
    var notice = qs('#res-locked');
    if (!tabsNav || !tabsContent) return; // not on resources page
    var membersContent = qs('#members-content');
    var unlockedLocal = membersContent && !membersContent.classList.contains('hidden');
    var unlocked = isMembersUnlocked() || unlockedLocal;
    if (!unlocked){ if (notice) notice.style.display = 'block'; return; }

    // Hide notice if any
    if (notice) notice.style.display = 'none';

    // Load tabs data
    var data = await fetchJSON('content/member_sections.json');
    if (!data || !Array.isArray(data.sections)) return;

    // Build tabs
    tabsNav.innerHTML = '';
    tabsContent.innerHTML = '';

    data.sections.forEach(function(section, idx){
      var id = String(section.id || ('sec'+idx));
      var title = String(section.title || ('Section '+(idx+1)));
      var desc = section.description ? String(section.description) : '';
      var images = Array.isArray(section.images) ? section.images : [];
      var files = Array.isArray(section.pdfs) ? section.pdfs : [];
      var allowDrop = section.allowLocalDrop === true;

      // Tab button
      var btn = document.createElement('button');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-controls', id);
      btn.textContent = title;
      if (idx === 0) btn.setAttribute('aria-selected','true'); else btn.setAttribute('aria-selected','false');
      tabsNav.appendChild(btn);

      // Panel
      var panel = document.createElement('section');
      panel.className = 'tab-panel'+(idx===0?' active':'');
      panel.id = id;
      panel.setAttribute('role','tabpanel');
      panel.setAttribute('tabindex','0');

      var header = document.createElement('div');
      header.className = 'panel-header';
      var h3 = document.createElement('h3'); h3.textContent = title;
      header.appendChild(h3);
      panel.appendChild(header);

      if (desc){
        var p = document.createElement('p'); p.textContent = desc; panel.appendChild(p);
      }

      // Gallery (with special grouping for Patterns tab)
      function createFigure(obj){
        var fig = document.createElement('figure'); fig.className = 'card';
        var link = document.createElement('a'); link.href = String(obj.src||''); link.target = '_blank'; link.rel = 'noopener noreferrer';
        var image = document.createElement('img'); image.src = String(obj.src||''); image.alt = String(obj.caption||'');
        link.appendChild(image);
        var cap = document.createElement('figcaption'); cap.className = 'tiny'; cap.textContent = String(obj.caption||'');
        fig.appendChild(link); fig.appendChild(cap);
        return fig;
      }

      if ((section.id||'').toLowerCase() === 'patterns'){
        var groups = [
          { title: 'Flower Name Pin', match: function(c){ c=c.toLowerCase(); return c.includes('flower') && c.includes('pin'); } },
          { title: 'Crayola on Fabric', match: function(c){ c=c.toLowerCase(); return c.includes('crayola') && c.includes('fabric'); } }
        ];
        var used = new Set();
        groups.forEach(function(g){
          var items = images.filter(function(it, idx){ var ok = g.match(String(it.caption||'')); if (ok) used.add(idx); return ok; });
          if (items.length === 0) return;
          var bubble = document.createElement('div'); bubble.className = 'group-bubble';
          var h4 = document.createElement('h4'); h4.textContent = g.title; bubble.appendChild(h4);
          var gal = document.createElement('div'); gal.className = 'group-gallery';
          items.forEach(function(it){ gal.appendChild(createFigure(it)); });
          bubble.appendChild(gal);
          var gActions = document.createElement('div'); gActions.className = 'group-actions';
          // Print group
          var gPrint = document.createElement('button'); gPrint.type='button'; gPrint.className='btn'; gPrint.textContent='Print group';
          gPrint.addEventListener('click', function(){
            try{
              document.body.classList.add('printing-panel');
              qsa('#member-sections .tab-panel').forEach(function(p){ p.classList.remove('print-target'); });
              // Temporarily attach a clone with only this group's gallery
              var temp = panel.cloneNode(false); var h3c = panel.querySelector('h3'); if (h3c) temp.appendChild(h3c.cloneNode(true));
              var wrap = document.createElement('div'); wrap.className='panel-gallery';
              Array.from(gal.children).forEach(function(f){ wrap.appendChild(f.cloneNode(true)); });
              temp.appendChild(wrap);
              // Mark and print
              panel.appendChild(temp); temp.classList.add('print-target');
              setTimeout(function(){ window.print(); }, 50);
              window.onafterprint = function(){ document.body.classList.remove('printing-panel'); temp.remove(); window.onafterprint=null; };
            }catch(_e){}
          });
          gActions.appendChild(gPrint);
          // PDF group
          var gPdf = document.createElement('button'); gPdf.type='button'; gPdf.className='btn'; gPdf.textContent='Generate PDF';
          gPdf.addEventListener('click', function(){
            var temp = panel.cloneNode(false); var h3c = panel.querySelector('h3'); if (h3c) temp.appendChild(h3c.cloneNode(true));
            var wrap = document.createElement('div'); wrap.className='panel-gallery';
            Array.from(gal.children).forEach(function(f){ wrap.appendChild(f.cloneNode(true)); });
            temp.appendChild(wrap);
            generatePdfForPanel(temp, g.title + '.pdf');
          });
          gActions.appendChild(gPdf);
          bubble.appendChild(gActions);
          panel.appendChild(bubble);
        });
        // Render any leftover images not matched into groups
        var leftovers = images.filter(function(_it, idx){ return !used.has(idx); });
        if (leftovers.length){
          var bubbleOther = document.createElement('div'); bubbleOther.className='group-bubble';
          var h4o = document.createElement('h4'); h4o.textContent='Other'; bubbleOther.appendChild(h4o);
          var galO = document.createElement('div'); galO.className='group-gallery';
          leftovers.forEach(function(it){ galO.appendChild(createFigure(it)); });
          bubbleOther.appendChild(galO);
          panel.appendChild(bubbleOther);
        }
      } else {
        var gallery = document.createElement('div');
        gallery.className = 'panel-gallery';
        images.forEach(function(img){ gallery.appendChild(createFigure(img)); });
        panel.appendChild(gallery);
      }

      // Local dropzone (client-only preview, no upload)
      if (allowDrop){
        var dz = document.createElement('div'); dz.className = 'dropzone'; dz.textContent = 'Drop images here or click to add (local preview only)';
        var input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.multiple = true; input.style.display='none';
        dz.addEventListener('click', function(){ input.click(); });
        function addPreview(file){
          if (!file || !file.type || !file.type.startsWith('image/')) return;
          var reader = new FileReader();
          reader.onload = function(e){
            var fig = document.createElement('figure'); fig.className = 'card';
            var image = document.createElement('img'); image.src = e.target.result; image.alt = file.name;
            var cap = document.createElement('figcaption'); cap.className = 'tiny'; cap.textContent = file.name;
            fig.appendChild(image); fig.appendChild(cap); gallery.prepend(fig);
          };
          reader.readAsDataURL(file);
        }
        dz.addEventListener('dragover', function(e){ e.preventDefault(); dz.classList.add('drag'); });
        dz.addEventListener('dragleave', function(){ dz.classList.remove('drag'); });
        dz.addEventListener('drop', function(e){ e.preventDefault(); dz.classList.remove('drag'); var files = e.dataTransfer.files||[]; Array.from(files).forEach(addPreview); });
        input.addEventListener('change', function(){ Array.from(input.files||[]).forEach(addPreview); });
        panel.appendChild(dz);
        panel.appendChild(input);
      }

      // Actions: files, print, and PDF generation
      var actions = document.createElement('div'); actions.className = 'panel-actions';
      // File links (PDFs)
      if (files.length){
        files.forEach(function(f){
          var a = document.createElement('a'); a.className = 'btn'; a.textContent = String(f.title||'Download');
          var href = String(f.url||'#');
          if (href === '#'){
            a.href = '#'; a.setAttribute('role','button'); a.addEventListener('click', function(e){ e.preventDefault();
              // Filter images by keywords from the link title (e.g., 'Crayola on Fabric')
              var titleText = (f.title||'').replace(/\(pdf\)/ig,'').trim();
              var keywords = titleText.toLowerCase().split(/[^a-z0-9]+/).filter(function(w){ return w && w.length>2; });
              var figsAll = Array.from(panel.querySelectorAll('.panel-gallery figure'));
              var figs = figsAll.filter(function(fig){
                var cap = (fig.querySelector('figcaption')?.textContent||'').toLowerCase();
                return keywords.every(function(k){ return cap.includes(k); });
              });
              if (figs.length === 0) figs = figsAll; // fallback to all images
              // Temporarily clone a panel with only selected figs for generation
              var temp = panel.cloneNode(false);
              var h3c = panel.querySelector('h3'); if (h3c) temp.appendChild(h3c.cloneNode(true));
              var wrap = document.createElement('div'); wrap.className = 'panel-gallery';
              figs.forEach(function(fig){ wrap.appendChild(fig.cloneNode(true)); });
              temp.appendChild(wrap);
              generatePdfForPanel(temp, (f.title||'section') + '.pdf');
            });
          } else {
            a.href = href; a.target = '_blank';
          }
          actions.appendChild(a);
        });
      }
      // Print button for this panel
      var printBtn = document.createElement('button');
      printBtn.type = 'button';
      printBtn.className = 'btn';
      printBtn.textContent = 'Print this section';
      printBtn.addEventListener('click', function(){
        try {
          document.body.classList.add('printing-panel');
          // mark this panel as print target
          qsa('#member-sections .tab-panel').forEach(function(p){ p.classList.remove('print-target'); });
          panel.classList.add('print-target');
          // Give styles a tick, then print
          setTimeout(function(){ window.print(); }, 50);
          // Cleanup after print event
          window.onafterprint = function(){
            document.body.classList.remove('printing-panel');
            panel.classList.remove('print-target');
            window.onafterprint = null;
          };
        } catch(_e) {}
      });
      actions.appendChild(printBtn);

      // Generate PDF button (from this panel's images)
      var genBtn = document.createElement('button');
      genBtn.type = 'button';
      genBtn.className = 'btn';
      genBtn.textContent = 'Generate PDF';
      genBtn.addEventListener('click', function(){
        generatePdfForPanel(panel, (title || 'section')+'.pdf');
      });
      actions.appendChild(genBtn);

      if (actions.children.length) panel.appendChild(actions);

      tabsContent.appendChild(panel);
    });

    function activateTabById(id){
      var targetBtn = qsa('#member-tabs-nav button').find(function(b){ return b.getAttribute('aria-controls') === id; });
      if (!targetBtn) return;
      qsa('#member-tabs-nav button').forEach(function(b){ b.setAttribute('aria-selected', b===targetBtn ? 'true':'false'); });
      qsa('#member-sections .tab-panel').forEach(function(p){ p.classList.toggle('active', p.id===id); });
    }

    // Tabs behavior (click)
    tabsNav.addEventListener('click', function(e){
      var btn = e.target.closest('button[role="tab"]');
      if (!btn) return;
      var id = btn.getAttribute('aria-controls');
      activateTabById(id);
      // reflect in hash
      try { history.replaceState(null, '', '#tab='+encodeURIComponent(id)); } catch(_e) {}
    });

    // Preselect via hash (#tab=patterns)
    function readDesiredTab(){
      var m = (location.hash || '').match(/#tab=([^&]+)/);
      return m ? decodeURIComponent(m[1]) : null;
    }
    var desired = readDesiredTab();
    if (desired) activateTabById(desired);

    window.addEventListener('hashchange', function(){
      var d = readDesiredTab();
      if (d) activateTabById(d);
    });
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
      // Append cache-busting query to ensure we always fetch the latest JSON from the server/CDN
      var ts = Date.now();
      var url = path + (path.indexOf('?') === -1 ? ('?v='+ts) : ('&v='+ts));
      const res = await fetch(url, { cache: 'no-cache' });
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
    // Render Featured quilts from site.json so CMS edits show on homepage
    var featuredGrid = qs('.featured-grid');
    var slideImg = qs('#featured-slide');
    var slideCap = qs('#featured-slide-caption');
    var btnPrev = qs('#feat-prev');
    var btnNext = qs('#feat-next');
    if (featuredGrid) {
      // Build list from either the fixed slots (featured1..3) or the featuredImages list
      var fixed = ['featured1','featured2','featured3']
        .map(function(k){ return data && data[k] ? data[k] : null; })
        .filter(Boolean);
      var listFromConfig = [];
      if (Array.isArray(data.featuredImages)) {
        listFromConfig = data.featuredImages.slice();
      } else if (data.featuredImages && typeof data.featuredImages === 'object') {
        try {
          listFromConfig = Object.values(data.featuredImages).map(function(v){
            if (v && typeof v === 'object') return v; // already {src, caption}
            return { src: String(v||''), caption: '' };
          }).filter(function(it){ return it && it.src; });
        } catch(_e) { listFromConfig = []; }
      }
      var list = (fixed.length ? fixed : listFromConfig);
      if (list.length) {
        try{
          var ts = Date.now();
          featuredGrid.innerHTML = list.map(function(item){
            var src = String(item.src||'').trim();
            var cap = String(item.caption||'').trim();
            if (!src) return '';
            var bust = src + (src.indexOf('?')===-1 ? ('?v='+ts) : ('&v='+ts));
            return (
              '<figure class="card">'+
                '<img src="'+encodeURI(bust)+'" alt="'+escapeHTML(cap || 'Featured quilt')+'" />'+
                '<figcaption class="tiny">'+escapeHTML(cap || '')+'</figcaption>'+
              '</figure>'
            );
          }).join('');
          // TEMP DEBUG STRIP: show source and URLs used
          try{
            var used = list.map(function(it){ return String(it && it.src || '').trim(); }).filter(Boolean);
            var srcName = fixed.length ? 'featured1/2/3' : (Array.isArray(data.featuredImages) ? 'featuredImages(array)' : (data.featuredImages ? 'featuredImages(object)' : 'none'));
            var box = document.getElementById('featured-debug');
            if (!box){
              box = document.createElement('div'); box.id = 'featured-debug';
              box.setAttribute('role','status');
              box.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:2147483600;background:#111;color:#fff;font:12px/1.4 monospace;padding:.5rem .6rem;border-radius:6px;opacity:.85;max-width:60vw;word-break:break-all;';
              document.body.appendChild(box);
            }
            box.textContent = '[Featured debug] source='+srcName+' | count='+used.length+' | urls='+used.join(', ');
          }catch(_e){}
          // Slideshow setup (if elements present)
          if (slideImg && slideCap && (btnPrev || btnNext)){
            var idx = 0;
            var timer = null;
            function show(i){
              if (!list.length) return;
              idx = (i + list.length) % list.length;
              var cur = list[idx] || {};
              var src = String(cur.src||'');
              var cap = String(cur.caption||'');
              if (src){ var bust = src + (src.indexOf('?')===-1 ? ('?v='+Date.now()) : ('&v='+Date.now())); slideImg.src = bust; }
              slideCap.textContent = cap || '';
            }
            function next(){ show(idx+1); }
            function prev(){ show(idx-1); }
            function restart(){ if (timer) clearInterval(timer); timer = setInterval(next, 5000); }
            // Keep slideshow in sync with the grid contents (including local previews)
            function syncFromGrid(){
              try{
                var figs = Array.from(document.querySelectorAll('.featured-grid figure'));
                var updated = figs.map(function(fig){
                  var img = fig.querySelector('img');
                  var cap = fig.querySelector('figcaption');
                  return { src: img ? img.getAttribute('src') : '', caption: cap ? cap.textContent : '' };
                }).filter(function(it){ return it.src; });
                if (updated.length){ list = updated; show(Math.min(idx, list.length-1)); restart(); }
              }catch(_e){}
            }
            // Expose sync globally for dropzone hook
            window._ppSyncFeaturedSlideshow = syncFromGrid;

            btnNext && btnNext.addEventListener('click', function(e){ e.preventDefault(); next(); restart(); });
            btnPrev && btnPrev.addEventListener('click', function(e){ e.preventDefault(); prev(); restart(); });
            show(0); restart();
            // Initial sync after first render
            syncFromGrid();
          }
        }catch(_e){ /* no-op */ }
      }
    }
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
      // If on resources page, render tabs immediately post-unlock
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
    hydrateHospitalityPage();
    hydrateResourcesPage();
    hydrateNewslettersPage();
    setupSpotlightUpload();
    setupFeaturedDropzone();
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
