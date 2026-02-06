async function loadArticle(title) {
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

loadArticle("Battle_of_Stalingrad");