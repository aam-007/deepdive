async function loadArticle(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

  const res = await fetch(url);
  const data = await res.json();

  document.getElementById("title").textContent = data.title;
  document.getElementById("summary").textContent = data.extract;
}

loadArticle("Battle_of_Stalingrad");
