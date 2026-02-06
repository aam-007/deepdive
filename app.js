let historyTrail = [];
let fullLoaded = false;

async function loadArticle(title, fromHistory = false) {
  // Reset full article state on navigation
  document.getElementById("full-article").setAttribute("hidden", "");
  document.getElementById("full-article").innerHTML = "";
  document.getElementById("toggle-full").textContent = "Read full article";
  document.getElementById("paths").style.display = "block";
  document.getElementById("paths").style.opacity = "1";
  fullLoaded = false;

  if (!fromHistory) {
    historyTrail.push(title);
  }

  renderHistory();

  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url);
  const data = await res.json();

  document.getElementById("title").textContent = data.title;
  document.getElementById("summary").textContent = data.extract;

  const links = await loadLinks(title);
  renderPaths(links);
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

  // kill obvious noise
  if (t.match(/^\d+$/)) return false;
  if (t.includes("List of")) return false;
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

    div.innerHTML = `
      <h3>${link.title}</h3>
      <p>Explore how this connects to the current topic.</p>
    `;

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
  // Remove edit links, metadata, junk
  container.querySelectorAll(
    ".mw-editsection, .mw-editsection-like, .reference, sup"
  ).forEach(el => el.remove());

  // Fix image sizes
  container.querySelectorAll("img").forEach(img => {
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    img.style.margin = "2rem 0";
  });

  // Normalize typography
  container.querySelectorAll("p").forEach(p => {
    p.style.lineHeight = "1.75";
    p.style.margin = "1.5rem 0";
  });
}

const toggleBtn = document.getElementById("toggle-full");
const fullArticle = document.getElementById("full-article");

toggleBtn.onclick = async () => {
  if (!fullLoaded) {
    await loadFullArticle(
      document.getElementById("title").textContent.replace(/ /g, "_")
    );
    fullLoaded = true;
  }

  const isHidden = fullArticle.hasAttribute("hidden");

  if (isHidden) {
    fullArticle.removeAttribute("hidden");
    document.getElementById("paths").style.opacity = "0.35";
    toggleBtn.textContent = "Hide full article";
  } else {
    fullArticle.setAttribute("hidden", "");
    document.getElementById("paths").style.opacity = "1";
    toggleBtn.textContent = "Read full article";
  }
};

const params = new URLSearchParams(window.location.search);
const article = params.get("article") || "Battle_of_Stalingrad";
loadArticle(article);
