let historyTrail = [];

async function loadArticle(title, fromHistory = false) {
  const fullArticleContainer = document.getElementById("full-article");
  const rightRailLinks = document.getElementById("path-list");
  
  // Clean title for API calls (replace underscores with spaces)
  const cleanTitle = title.replace(/_/g, " ");

  fullArticleContainer.removeAttribute("hidden");
  fullArticleContainer.innerHTML = "<p class='loading'>Loading article...</p>";
  rightRailLinks.innerHTML = "<p>Finding paths...</p>";
  
  if (!fromHistory) {
    historyTrail.push(cleanTitle);
  }

  renderHistory();

  try {
    // 1. Summary
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetch(summaryUrl);
    const data = await res.json();

    document.getElementById("title").textContent = data.title;
    document.getElementById("summary").textContent = data.extract;

    // 2. High-Relevance Related Pages with Fallback
    let relatedLinks = await fetchRelatedPages(title);
    
    // Fallback: If Related API fails or is empty, use Search API
    if (!relatedLinks || relatedLinks.length === 0) {
      relatedLinks = await fetchSearchFallback(cleanTitle);
    }
    
    renderPaths(relatedLinks);

    // 3. Full Article
    await loadFullArticle(data.title.replace(/ /g, "_"));
  } catch (error) {
    console.error("Failed to load article:", error);
    fullArticleContainer.innerHTML = "<p>Error loading content.</p>";
  }
}

// Method A: Related API (Best for context)
async function fetchRelatedPages(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/related/${encodeURIComponent(title)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.pages ? data.pages.slice(0, 5) : [];
  } catch (e) {
    return [];
  }
}

// Method B: Search Fallback (Best if page is obscure)
async function fetchSearchFallback(query) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    // Transform search results to match the 'related' object structure
    return data.query.search.slice(1, 6).map(item => ({
      title: item.title,
      displaytitle: item.title,
      description: "Related search result"
    }));
  } catch (e) {
    return [];
  }
}

function renderPaths(pages) {
  const container = document.getElementById("path-list");
  container.innerHTML = "";

  if (!pages || pages.length === 0) {
    container.innerHTML = "<p>No paths found. Try a different topic.</p>";
    return;
  }

  pages.forEach(page => {
    const div = document.createElement("div");
    div.className = "path";
    div.innerHTML = `
      <h3>${page.displaytitle || page.title}</h3>
      <p>${page.description || 'Continue your dive...'}</p>
    `;

    div.onclick = () => loadArticle(page.title);
    container.appendChild(div);
  });
}

function renderHistory() {
  const nav = document.getElementById("history");
  nav.innerHTML = "";
  historyTrail.forEach((title, index) => {
    const span = document.createElement("span");
    span.textContent = title;
    span.onclick = () => {
      historyTrail = historyTrail.slice(0, index + 1);
      loadArticle(title, true);
    };
    nav.appendChild(span);
    if (index < historyTrail.length - 1) nav.append(" ↓ ");
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
  container.querySelectorAll(".mw-editsection, .mw-editsection-like, .reference, sup, .infobox, .ambox, .navbox").forEach(el => el.remove());
  container.querySelectorAll("img").forEach(img => {
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    img.style.margin = "2rem 0";
    img.style.display = "block";
  });
}

const params = new URLSearchParams(window.location.search);
const initialArticle = params.get("article") || "India";
loadArticle(initialArticle);