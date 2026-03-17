// ── Cache & State ──────────────────────────────────────────────
const cache = new Map();
let trail = [];

// ── API Helpers ────────────────────────────────────────────────
const enc = s => encodeURIComponent(s);
const W_REST    = t => `https://en.wikipedia.org/api/rest_v1/page/summary/${enc(t)}`;
const W_RELATED = t => `https://en.wikipedia.org/api/rest_v1/page/related/${enc(t)}`;
const W_PARSE   = t => `https://en.wikipedia.org/w/api.php?action=parse&page=${enc(t)}&prop=text&format=json&origin=*&disableeditsection=1`;
const W_SEARCH  = q => `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${enc(q)}&format=json&origin=*&srlimit=6&srinfo=&srprop=snippet`;

function fetchJSON(url) {
  if (cache.has(url)) return Promise.resolve(cache.get(url));
  return fetch(url)
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(d => { cache.set(url, d); return d; });
}

// ── Load Article ───────────────────────────────────────────────
async function loadArticle(rawTitle, fromHistory = false) {
  const title = rawTitle.replace(/_/g, ' ');

  if (!fromHistory) {
    if (trail[trail.length - 1] !== title) trail.push(title);
  }
  renderTrail();

  const bodyEl  = document.getElementById('article-body') || document.getElementById('full-article');
  const titleEl = document.getElementById('title');
  const sumEl   = document.getElementById('summary');
  const pathsEl = document.getElementById('path-list');

  titleEl.textContent = title;
  sumEl.textContent   = '';
  bodyEl.innerHTML    = shimmerLines(6);
  pathsEl.innerHTML   = [1,2,3,4].map(() => `<div class="path-shimmer"></div>`).join('');

  // All three requests fire in parallel
  const [summaryRes, contentRes, relatedRes] = await Promise.allSettled([
    fetchJSON(W_REST(rawTitle)),
    fetchJSON(W_PARSE(rawTitle)),
    fetchJSON(W_RELATED(rawTitle)),
  ]);

  // 1. Summary
  if (summaryRes.status === 'fulfilled') {
    const d = summaryRes.value;
    titleEl.textContent = d.title || title;
    sumEl.textContent   = d.extract || '';
  }

  // 2. Body
  if (contentRes.status === 'fulfilled') {
    const d = contentRes.value;
    if (d?.parse?.text?.['*']) {
      bodyEl.innerHTML = d.parse.text['*'];
      bodyEl.classList.remove('article-enter');
      void bodyEl.offsetWidth; // force reflow for animation restart
      bodyEl.classList.add('article-enter');
      requestAnimationFrame(() => postProcess(bodyEl));
    } else {
      bodyEl.innerHTML = `<p>Article content unavailable.</p>`;
    }
  } else {
    bodyEl.innerHTML = `<p>Could not load article.</p>`;
  }

  // 3. Related / sidebar paths
  let pages = [];
  if (relatedRes.status === 'fulfilled' && relatedRes.value?.pages?.length) {
    pages = relatedRes.value.pages.slice(0, 5);
  } else {
    pages = await searchFallback(title);
  }
  renderPaths(pages);
}

// ── Post-Process Wikipedia HTML ────────────────────────────────
function postProcess(root) {
  // Strip Wikipedia clutter
  root.querySelectorAll([
    '.mw-editsection', '.reflist', 'sup.reference', '.infobox',
    '.ambox', '.navbox', '.hatnote', '.metadata', '.side-box',
    '.noprint', '.mw-empty-elt', 'style', '.toc'
  ].join(',')).forEach(el => el.remove());

  // Fix relative image URLs
  root.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') || '';
    if (!src.startsWith('http'))
      img.src = src.startsWith('//') ? `https:${src}` : `https://en.wikipedia.org${src}`;
    img.loading = 'lazy';
  });

  // Intercept all links
  root.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (href.startsWith('/wiki/') && !href.includes(':')) {
      a.onclick = e => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadArticle(decodeURIComponent(href.slice(6)));
      };
    } else if (href.startsWith('#')) {
      a.onclick = e => {
        e.preventDefault();
        document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' });
      };
    } else {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
  });
}

// ── Render Sidebar Paths ───────────────────────────────────────
function renderPaths(pages) {
  const el = document.getElementById('path-list');
  if (!pages.length) {
    el.innerHTML = `<p>No paths found.</p>`;
    return;
  }
  el.innerHTML = '';
  pages.forEach(page => {
    const div = document.createElement('div');
    div.className = 'path';
    div.style.cursor = 'pointer';
    div.innerHTML = `<h3>${page.displaytitle || page.title}</h3><p>${page.description || 'Continue your dive...'}</p>`;
    div.onclick = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      loadArticle(page.title);
    };
    el.appendChild(div);
  });
}

// ── Trail (breadcrumb) ─────────────────────────────────────────
function renderTrail() {
  const nav = document.getElementById('history');
  if (!nav) return;
  nav.innerHTML = '';
  trail.forEach((t, i) => {
    const span = document.createElement('span');
    span.textContent = t;
    span.className = 'history-item';
    span.style.cursor = i === trail.length - 1 ? 'default' : 'pointer';
    span.onclick = () => {
      if (i === trail.length - 1) return;
      trail = trail.slice(0, i + 1);
      loadArticle(t, true);
    };
    nav.appendChild(span);
    if (i < trail.length - 1) nav.append(' ↓ ');
  });
  nav.scrollLeft = nav.scrollWidth;
}

// ── Search ─────────────────────────────────────────────────────
async function searchFallback(query) {
  try {
    const data = await fetchJSON(W_SEARCH(query));
    return (data?.query?.search || [])
      .filter(r => r.title.toLowerCase() !== query.toLowerCase())
      .slice(0, 5)
      .map(r => ({
        title: r.title,
        displaytitle: r.title,
        description: r.snippet.replace(/<[^>]+>/g, '') + '…'
      }));
  } catch { return []; }
}

// ── Utils ──────────────────────────────────────────────────────
function shimmerLines(n) {
  const widths = [95, 88, 92, 70, 85, 60];
  return `<div class="loading-shimmer">
    ${Array.from({ length: n }, (_, i) =>
      `<div class="shimmer-line" style="width:${widths[i % widths.length]}%;animation-delay:${i * 80}ms"></div>`
    ).join('')}
  </div>`;
}

// ── Init ───────────────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
loadArticle(params.get('article') || 'India');
