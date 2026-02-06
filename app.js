let historyTrail = [];
async function loadArticle(title, fromHistory = false) {
  const fullArticleContainer = document.getElementById("full-article");
  const rightRailLinks = document.getElementById("path-list");
  const titleDisplay = document.getElementById("title");
  const summaryDisplay = document.getElementById("summary");
  
  const cleanTitle = title.replace(/_/g, " ");

  // 1. Reset UI State
  fullArticleContainer.removeAttribute("hidden");
  fullArticleContainer.innerHTML = "<p class='loading'>Fetching content...</p>";
  rightRailLinks.innerHTML = "<p>Finding paths...</p>";
  
  if (!fromHistory) {
    historyTrail.push(cleanTitle);
  }
  renderHistory();

  // 2. Prepare Parallel Requests
  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const relatedUrl = `https://en.wikipedia.org/api/rest_v1/page/related/${encodeURIComponent(title)}`;
  const contentUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json&origin=*`;

  // Start fetches
  const summaryPromise = fetch(summaryUrl).then(res => res.json());
  const relatedPromise = fetch(relatedUrl).then(res => res.ok ? res.json() : { pages: [] });
  const contentPromise = fetch(contentUrl).then(res => res.json());

  try {
    // 3. Render Summary (Fastest)
    summaryPromise.then(data => {
      titleDisplay.textContent = data.title || cleanTitle;
      summaryDisplay.textContent = data.extract || "";
    });

    // 4. Render Body Content ASAP
    contentPromise.then(data => {
      if (data.parse && data.parse.text) {
        fullArticleContainer.innerHTML = data.parse.text["*"];
        requestAnimationFrame(() => postProcessArticle(fullArticleContainer));
      } else {
        throw new Error("Content not found");
      }
    }).catch(err => {
      fullArticleContainer.innerHTML = "<p>Error loading article body.</p>";
    });

    // 5. Sidebar "Where to go next" (Waterfall Logic)
    relatedPromise
      .then(async (data) => {
        let pages = data.pages ? data.pages.slice(0, 5) : [];
        // If Related API is empty, use Search API
        if (pages.length === 0) {
          pages = await fetchSearchFallback(cleanTitle);
        }
        renderPaths(pages);
      })
      .catch(async () => {
        const fallbackPages = await fetchSearchFallback(cleanTitle);
        renderPaths(fallbackPages);
      });

  } catch (error) {
    console.error("Critical Load Error:", error);
    fullArticleContainer.innerHTML = "<p>Something went wrong.</p>";
  }
}

/**
 * Robust search fallback if Related API fails
 */
async function fetchSearchFallback(query) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=6`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.query || !data.query.search) return [];

    return data.query.search
      .filter(item => item.title.toLowerCase() !== query.toLowerCase())
      .map(item => ({
        title: item.title,
        displaytitle: item.title,
        // Strip HTML tags from the search snippet for a clean description
        description: item.snippet.replace(/<\/?[^>]+(>|$)/g, "") + "..."
      }));
  } catch (e) {
    return [];
  }
}

/**
 * Renders the "Paths" in the sidebar
 */
function renderPaths(pages) {
  const container = document.getElementById("path-list");
  container.innerHTML = "";

  if (!pages || pages.length === 0) {
    container.innerHTML = "<p>No paths found. Try searching for a new topic.</p>";
    return;
  }

  pages.forEach(page => {
    const div = document.createElement("div");
    div.className = "path";
    div.style.cursor = "pointer";
    div.innerHTML = `
      <h3>${page.displaytitle || page.title}</h3>
      <p>${page.description || 'Continue your dive...'}</p>
    `;
    div.onclick = () => {
      window.scrollTo(0, 0);
      loadArticle(page.title);
    };
    container.appendChild(div);
  });
}

/**
 * Cleanup Wikipedia clutter
 */
function postProcessArticle(container) {
  const unwanted = [
    ".mw-editsection", ".reflist", ".reference", "sup", ".infobox", 
    ".ambox", ".navbox", ".hatnote", ".metadata", ".side-box", ".noprint"
  ];
  container.querySelectorAll(unwanted.join(",")).forEach(el => el.remove());

  container.querySelectorAll("img").forEach(img => {
    img.setAttribute("loading", "lazy");
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    img.style.display = "block";
    img.style.margin = "2rem auto";

    if (img.src.startsWith("file://") || !img.src.includes("http")) {
      const src = img.getAttribute("src");
      img.src = src.startsWith("//") ? `https:${src}` : `https://en.wikipedia.org${src}`;
    }
  });
}

/**
 * Breadcrumb Navigation
 */
function renderHistory() {
  const nav = document.getElementById("history");
  if (!nav) return;
  nav.innerHTML = "";
  historyTrail.forEach((title, index) => {
    const span = document.createElement("span");
    span.textContent = title;
    span.className = "history-item";
    span.onclick = () => {
      historyTrail = historyTrail.slice(0, index + 1);
      loadArticle(title, true);
    };
    nav.appendChild(span);
    if (index < historyTrail.length - 1) nav.append(" ↓ ");
  });
}

// Initial Load
const params = new URLSearchParams(window.location.search);
loadArticle(params.get("article") || "India");