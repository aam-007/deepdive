let historyTrail = [];

async function loadArticle(title, fromHistory = false) {
  const fullArticleContainer = document.getElementById("full-article");
  
  // UI Reset: Ensure the article container is visible and show loading state
  fullArticleContainer.removeAttribute("hidden");
  fullArticleContainer.innerHTML = "<p>Loading full article...</p>";
  
  document.getElementById("paths").style.display = "block";
  document.getElementById("paths").style.opacity = "1";

  if (!fromHistory) {
    historyTrail.push(title);
  }

  renderHistory();

  // 1. Fetch and render summary
  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(summaryUrl);
  const data = await res.json();

  document.getElementById("title").textContent = data.title;
  document.getElementById("summary").textContent = data.extract;

  // 2. Fetch and render navigation links
  const links = await loadLinks(title);
  renderPaths(links);

  // 3. Automatically load the full article body
 
  await loadFullArticle(data.title.replace(/ /g, "_"));
}

async function loadLinks(title) {
  const url =
    `https://en.wikipedia.org/w/api.php` +
    `?action=query` +
    `&prop=links` +
    `&titles=${encodeURIComponent(title)}` +
    `&pllimit=20` +
    `&format=json` +
    `&origin=*`;

  const res = await fetch(url);
  const data = await res.json();

  const pages = data.query.pages;
  const page = pages[Object.keys(pages)[0]];

  return page.links || [];
}

function isUsefulLink(link) {
  const t = link.title;

  // Filter out meta-pages and noise
  if (t.includes(":")) return false;
  if (t.match(/^\d+$/)) return false;
  if (t.startsWith("List of")) return false;
  if (t.includes("(disambiguation)")) return false;
  if (t.length < 5) return false;

  return true;
}

function renderPaths(links) {
  const container = document.getElementById("path-list");
  container.innerHTML = "";

  const useful = links.filter(isUsefulLink).slice(0, 5);

  useful.forEach(link => {
    const div = document.createElement("div");
    div.className = "path";
    div.innerHTML = `<h3>${link.title}</h3>`;
    div.onclick = () => loadArticle(link.title);
    container.appendChild(div);
  });
}

function renderHistory() {
  const nav = document.getElementById("history");
  nav.innerHTML = "";

  historyTrail.forEach((title, index) => {
    const span = document.createElement("span");
    span.textContent = title.replace(/_/g, " ");

    span.onclick = () => {
      historyTrail = historyTrail.slice(0, index + 1);
      loadArticle(title, true);
    };

    nav.appendChild(span);

    if (index < historyTrail.length - 1) {
      nav.append(" ↓ ");
    }
  });
}

async function loadFullArticle(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(title)}`;
  const res = await fetch(url);
  const html = await res.text();

  const container = document.getElementById("full-article");
  container.innerHTML = html;

  postProcessArticle(container);
}

function postProcessArticle(container) {
  // Remove Wikipedia-specific UI elements that clutter the view
  container.querySelectorAll(
    ".mw-editsection, .mw-editsection-like, .reference, sup, .infobox, .ambox"
  ).forEach(el => el.remove());

  // Clean up images
  container.querySelectorAll("img").forEach(img => {
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    img.style.margin = "2rem 0";
    img.style.display = "block";
  });

  // Clean up typography
  container.querySelectorAll("p").forEach(p => {
    p.style.lineHeight = "1.75";
    p.style.margin = "1.5rem 0";
  });
}

// Global initialization
const params = new URLSearchParams(window.location.search);
const initialArticle = params.get("article") || "Battle_of_Stalingrad";
loadArticle(initialArticle);