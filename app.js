// Interface: hash routes for contents, chapters, search, saved passages, and the Scripture index.
let BOOK = window.BOOK;
const $ = id => document.getElementById(id);
const view = $("view");
const STORE = "unseen-warfare-v1";
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]);

function loadState() {
  const fallback = {last: null, positions: {}, read: {}, saved: [], highlights: [], prefs: {size: 20, theme: "light", font: "serif", spacing: 1.75}, filter: ""};
  try {
    const stored = JSON.parse(localStorage.getItem(STORE) || "null");
    if (!stored || typeof stored !== "object") return fallback;
    const prefs = {...fallback.prefs, ...(stored.prefs || {})};
    if (!["light", "sepia", "dark", "night"].includes(prefs.theme)) prefs.theme = "light";
    return {...fallback, ...stored, prefs,
      positions: stored.positions && typeof stored.positions === "object" ? stored.positions : {},
      read: stored.read && typeof stored.read === "object" ? stored.read : {}, saved: Array.isArray(stored.saved) ? stored.saved : [],
      highlights: Array.isArray(stored.highlights) ? stored.highlights.filter(h => h && typeof h.chapter === "string" && Number.isInteger(h.paragraph) &&
        Number.isInteger(h.start) && Number.isInteger(h.end) && h.end > h.start) : []};
  } catch { return fallback; }
}
const state = loadState();
let saveTimer;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { toast("Your place could not be saved on this device."); } }, 150);
}
function persistNow() { clearTimeout(saveTimer); try { localStorage.setItem(STORE, JSON.stringify(state)); } catch {} }

function applyPrefs() {
  const root = document.documentElement, {size, theme, font, spacing} = state.prefs;
  root.style.setProperty("--reading-size", `${size}px`);
  root.style.setProperty("--reading-leading", spacing);
  root.dataset.font = font;
  if (theme === "light") delete root.dataset.theme; else root.dataset.theme = theme;
  const color = {night: "#0c0e13", dark: "#191c1b", sepia: "#f1e4ca"}[theme] || "#fcfcfa";
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.setAttribute("content", color));
}

let toastTimer;
function toast(message) {
  const element = $("toast");
  element.textContent = message; element.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { element.hidden = true; }, 2600);
}

// ----- Sheet (bottom drawer for Scripture, settings, notes) -----
let sheetReturn = null;
function openSheet(title, html, onReady) {
  sheetReturn = document.activeElement;
  $("sheetTitle").textContent = title; $("sheetBody").innerHTML = html;
  $("sheet").hidden = false; $("sheetBackdrop").hidden = false;
  document.body.classList.add("sheet-open");
  $("sheetBody").scrollTop = 0;
  onReady?.($("sheetBody"));
  requestAnimationFrame(() => $("sheet").classList.add("open"));
  $("sheetClose").focus({preventScroll: true});
}
function closeSheet() {
  if ($("sheet").hidden) return;
  $("sheet").classList.remove("open");
  $("sheet").hidden = true; $("sheetBackdrop").hidden = true;
  document.body.classList.remove("sheet-open");
  sheetReturn?.focus?.({preventScroll: true});
}

// ----- Routing -----
function route() {
  const hash = location.hash.slice(1) || "/";
  const [path, query = ""] = hash.split("?");
  const params = new URLSearchParams(query);
  closeSheet();
  saveChapterPosition();
  hideSelectionBar();
  currentChapter = null;
  const chapterMatch = path.match(/^\/c\/(\d+-\d+)$/);
  if (chapterMatch && chapterById(BOOK, chapterMatch[1])) return renderChapter(chapterMatch[1], params);
  if (path === "/search") return renderSearch(params.get("q") || "");
  if (path === "/saved") return renderSaved();
  if (path === "/scripture") return renderScripture();
  if (path === "/about") return renderAbout();
  renderContents();
}
function setChrome(section, title) {
  delete view.dataset.list;
  document.querySelectorAll("[data-nav]").forEach(link => { if (link.dataset.nav === section) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current"); });
  const reading = section === "chapter";
  $("backButton").hidden = !reading; $("brand").hidden = reading;
  $("topTitle").hidden = !reading; $("topTitle").textContent = title || "";
  document.body.dataset.section = section;
  $("progressBar").style.transform = "scaleX(0)";
  document.title = title ? `${title} · Unseen Warfare` : "Unseen Warfare";
}

// ----- Contents -----
function chapterRow(chapter) {
  const read = state.read[chapter.id], here = state.last?.id === chapter.id;
  return `<a class="chapter-row${read ? " is-read" : ""}" href="#/c/${chapter.id}" data-title="${esc(normalizeText(chapter.title))}">
    <span class="chapter-number" aria-hidden="true">${read ? '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : chapter.number}</span>
    <span class="chapter-text"><strong>${esc(chapter.title)}</strong><small>Chapter ${chapter.number} · ${readingMinutes(chapter)} min${here ? " · <em>You are here</em>" : ""}${read ? " · Read" : ""}</small></span></a>`;
}
function renderContents() {
  setChrome("contents");
  const all = bookChapters(BOOK), readCount = all.filter(c => state.read[c.id]).length;
  const last = state.last && chapterById(BOOK, state.last.id);
  view.innerHTML = `<div class="page">
    <section class="hero">
      <h1>Unseen Warfare</h1>
      <p class="subtitle">The Spiritual Combat and Path to Paradise</p>
      <div class="book-progress" role="img" aria-label="${readCount} of ${all.length} chapters read"><span style="width:${(readCount / all.length * 100).toFixed(1)}%"></span></div>
      <p class="helper">${readCount} of ${all.length} chapters read</p>
    </section>
    ${last ? `<a class="continue" href="#/c/${last.id}"><small>Continue reading · ${partLabel(BOOK, last)}, chapter ${last.number}</small><strong>${esc(last.title)}</strong><span>${Math.round((state.positions[last.id] || 0) * 100)}% through ›</span></a>` : `<a class="continue" href="#/c/${all[0].id}"><small>Begin</small><strong>${esc(all[0].title)}</strong><span>Part One, chapter 1 ›</span></a>`}
    <label class="filter"><span class="visually-hidden">Find a chapter by title</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>
      <input id="chapterFilter" type="search" placeholder="Find a chapter" autocomplete="off" value="${esc(state.filter)}"></label>
    ${BOOK.parts.map((part, i) => {
      const done = part.chapters.filter(c => state.read[c.id]).length;
      return `<section class="part" id="part-${i + 1}"><h2><span>${esc(part.title.split(":")[0])}</span>${esc(part.title.split(":").slice(1).join(":").trim())}</h2>
        <div class="chapter-list">${part.chapters.map(chapterRow).join("")}</div><p class="helper empty" hidden>No chapter titles match.</p></section>`;
    }).join("")}
  </div>`;
  const filter = $("chapterFilter");
  const apply = () => {
    const needle = normalizeText(filter.value).trim();
    state.filter = filter.value; persist();
    view.querySelectorAll(".part").forEach(section => {
      let shown = 0;
      section.querySelectorAll(".chapter-row").forEach(row => { const match = !needle || row.dataset.title.includes(needle); row.hidden = !match; shown += match; });
      section.querySelector(".empty").hidden = shown > 0;
    });
  };
  filter.oninput = apply; apply();
  restoreListScroll("contents");
}
const listScroll = {};
function restoreListScroll(name) {
  window.scrollTo(0, listScroll[name] || 0);
  view.dataset.list = name;
}

// ----- Chapter -----
let currentChapter = null;
function renderChapter(id, params) {
  const chapter = chapterById(BOOK, id), {previous, next, index, total} = chapterNeighbours(BOOK, id);
  const part = BOOK.parts[chapter.part - 1];
  currentChapter = chapter;
  setChrome("chapter", `${partLabel(BOOK, chapter)} · ${chapter.number} of ${part.chapters.length}`);
  const savedHere = new Set(state.saved.filter(item => item.chapter === id).map(item => item.paragraph));
  view.innerHTML = `<article class="page chapter" lang="en">
    <p class="eyebrow">${esc(part.title)}</p>
    <h1><span class="chapter-label">Chapter ${chapter.number}</span>${esc(chapter.title)}</h1>
    <p class="helper chapter-meta">${readingMinutes(chapter)} min</p>
    <div class="reading" id="reading">${chapter.paragraphs.map((paragraph, i) => `<p data-index="${i}"${savedHere.has(i) ? ' class="is-saved"' : ""}>${paragraph}</p>`).join("")}</div>
    <div class="chapter-end">
      <button class="secondary mark-read" id="markRead" aria-pressed="${!!state.read[id]}">${state.read[id] ? "✓ Read" : "Mark as read"}</button>
      <nav class="pager" aria-label="Chapters">
        ${previous ? `<a class="pager-link" href="#/c/${previous.id}" rel="prev"><small>‹ Previous · ${partLabel(BOOK, previous)}, ${previous.number}</small><span>${esc(previous.title)}</span></a>` : "<span></span>"}
        ${next ? `<a class="pager-link next" href="#/c/${next.id}" rel="next"><small>Next · ${partLabel(BOOK, next)}, ${next.number} ›</small><span>${esc(next.title)}</span></a>` : `<a class="pager-link next" href="#/"><small>The end</small><span>Back to contents</span></a>`}
      </nav>
    </div>
  </article>`;
  $("markRead").onclick = () => {
    state.read[id] = !state.read[id]; if (!state.read[id]) delete state.read[id]; persist();
    $("markRead").setAttribute("aria-pressed", String(!!state.read[id])); $("markRead").textContent = state.read[id] ? "✓ Read" : "Mark as read";
    if (state.read[id]) toast("Marked as read");
  };
  state.last = {id, at: Date.now()}; persist();
  const query = params.get("q"), paragraph = params.get("p");
  applyHighlights(chapter);
  if (query) highlight($("reading"), query);
  requestAnimationFrame(() => {
    const target = paragraph !== null ? view.querySelector(`[data-index="${Number(paragraph)}"]`) : null;
    const hit = target?.querySelector("mark") || (query && !target ? view.querySelector("mark") : null);
    if (hit || target) {
      (hit || target).scrollIntoView({block: "center"});
      if (target && params.get("flash")) { target.classList.add("flash"); setTimeout(() => target.classList.remove("flash"), 1800); }
    } else window.scrollTo(0, (state.positions[id] || 0) * maxScroll());
    updateProgress();
  });
}
function maxScroll() { return Math.max(1, document.documentElement.scrollHeight - innerHeight); }
function scrollFraction() { return Math.max(0, Math.min(1, scrollY / maxScroll())); }
function saveChapterPosition() {
  if (!currentChapter) return;
  const fraction = scrollFraction();
  state.positions[currentChapter.id] = Math.round(fraction * 1000) / 1000;
  // Reaching the end marks a chapter read; it can still be unmarked.
  if (fraction > .985 && document.documentElement.scrollHeight > innerHeight * 1.2 && !state.read[currentChapter.id]) {
    state.read[currentChapter.id] = true;
    const button = $("markRead"); if (button) { button.setAttribute("aria-pressed", "true"); button.textContent = "✓ Read"; }
  }
  persist();
}
function updateProgress() {
  if (!currentChapter) return;
  $("progressBar").style.transform = `scaleX(${scrollFraction()})`;
}

function highlight(container, query) {
  for (const paragraph of container.querySelectorAll("p")) {
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT), nodes = [];
    for (let node; (node = walker.nextNode());) nodes.push(node);
    const matches = findMatches(nodes.map(node => node.textContent), query);
    for (const match of matches.slice().reverse()) {
      for (let index = match.end.index; index >= match.start.index; index--) {
        const node = nodes[index], start = index === match.start.index ? match.start.offset : 0;
        const end = index === match.end.index ? match.end.end : node.textContent.length;
        if (end <= start) continue;
        const hit = node.splitText(start); hit.splitText(end - start);
        const mark = document.createElement("mark"); hit.replaceWith(mark); mark.append(hit);
      }
    }
  }
}

// ----- Highlights: character ranges within a paragraph, stored with their text -----
const HIGHLIGHT_COLORS = [["yellow", "Yellow"], ["green", "Green"], ["blue", "Blue"], ["rose", "Rose"]];
function textNodes(element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT), nodes = [];
  for (let node; (node = walker.nextNode());) nodes.push(node);
  return nodes;
}
// Wraps characters start..end of an element's text in marks made by makeMark().
function wrapRange(element, start, end, makeMark) {
  let position = 0;
  for (const node of textNodes(element)) {
    const length = node.textContent.length, from = Math.max(start, position), to = Math.min(end, position + length);
    if (from < to) {
      const hit = node.splitText(from - position); hit.splitText(to - from);
      const mark = makeMark(); hit.replaceWith(mark); mark.append(hit);
    }
    position += length;
    if (position >= end) break;
  }
}
// If the book text shifts after a rebuild, a highlight relocates by its saved text.
function locateHighlight(paragraph, item) {
  const text = paragraph.textContent;
  if (!item.text || text.slice(item.start, item.end) === item.text) return item.end <= text.length ? [item.start, item.end] : null;
  const at = text.indexOf(item.text);
  return at >= 0 ? [at, at + item.text.length] : null;
}
function applyHighlights(chapter, only) {
  const list = state.highlights.filter(item => item.chapter === chapter.id && (only === undefined || item.paragraph === only));
  for (const item of list.sort((a, b) => a.start - b.start)) {
    const paragraph = view.querySelector(`.reading p[data-index="${item.paragraph}"]`);
    const range = paragraph && locateHighlight(paragraph, item);
    if (!range) continue;
    wrapRange(paragraph, range[0], range[1], () => {
      const mark = document.createElement("mark");
      mark.className = `hl hl-${item.color}${item.note ? " has-note" : ""}`; mark.dataset.hl = item.id; return mark;
    });
  }
}
function redrawParagraph(chapter, index) {
  const paragraph = view.querySelector(`.reading p[data-index="${index}"]`);
  if (!paragraph) return;
  paragraph.innerHTML = chapter.paragraphs[index];
  applyHighlights(chapter, index);
}
function offsetIn(paragraph, container, offset) {
  const range = document.createRange();
  range.setStart(paragraph, 0); range.setEnd(container, offset);
  return range.toString().length;
}
// A selection may span paragraphs; each paragraph gets its own piece.
function selectionPieces() {
  const selection = getSelection?.();
  if (!selection || selection.isCollapsed || !selection.rangeCount || !currentChapter) return [];
  const range = selection.getRangeAt(0), reading = $("reading");
  if (!reading || !reading.contains(range.commonAncestorContainer)) return [];
  const pieces = [];
  for (const paragraph of reading.querySelectorAll("p[data-index]")) {
    if (!range.intersectsNode(paragraph)) continue;
    let start = paragraph.contains(range.startContainer) ? offsetIn(paragraph, range.startContainer, range.startOffset) : 0;
    let end = paragraph.contains(range.endContainer) ? offsetIn(paragraph, range.endContainer, range.endOffset) : paragraph.textContent.length;
    const full = paragraph.textContent, word = /[\p{L}\p{N}'’]/u;
    // Snap to whole words so a sloppy touch selection still highlights complete words.
    let from = start, to = end;
    while (from > 0 && word.test(full[from - 1]) && word.test(full[from])) from--;
    while (to < full.length && to > 0 && word.test(full[to - 1]) && word.test(full[to])) to++;
    start = from; end = to;
    const text = full.slice(start, end);
    if (text.trim()) {
      const lead = text.length - text.trimStart().length, trail = text.length - text.trimEnd().length;
      pieces.push({paragraph: Number(paragraph.dataset.index), start: start + lead, end: end - trail, text: text.trim()});
    }
  }
  return pieces;
}
function addHighlights(pieces, color, note = "") {
  const chapter = currentChapter, group = crypto.randomUUID?.() || String(Date.now());
  for (const piece of pieces) {
    // A new highlight replaces any it overlaps.
    state.highlights = state.highlights.filter(item => !(item.chapter === chapter.id && item.paragraph === piece.paragraph && item.start < piece.end && piece.start < item.end));
    state.highlights.push({id: `${group}-${piece.paragraph}`, group, chapter: chapter.id, ...piece, color, note, createdAt: Date.now()});
  }
  persistNow();
  getSelection?.().removeAllRanges();
  for (const index of new Set(pieces.map(piece => piece.paragraph))) redrawParagraph(chapter, index);
  hideSelectionBar();
}
function showSelectionBar() {
  const bar = $("selectionBar");
  bar.innerHTML = `${HIGHLIGHT_COLORS.map(([color, name]) => `<button class="swatch hl-${color}" data-color="${color}" aria-label="Highlight ${name}"></button>`).join("")}
    <button class="bar-button" data-bar="note">Note</button><button class="bar-button" data-bar="copy">Copy</button>`;
  bar.hidden = false;
}
function hideSelectionBar() { const bar = $("selectionBar"); if (bar) bar.hidden = true; }
function showHighlight(id) {
  const item = state.highlights.find(entry => entry.id === id), chapter = item && chapterById(BOOK, item.chapter);
  if (!item || !chapter) return;
  const group = state.highlights.filter(entry => entry.group && entry.group === item.group);
  const text = (group.length > 1 ? group.sort((a, b) => a.paragraph - b.paragraph) : [item]).map(entry => entry.text).join(" … ");
  openSheet("Highlight", `<blockquote class="quote hl-quote hl-border-${item.color}">${esc(text.length > 500 ? text.slice(0, 500) + "…" : text)}</blockquote>
    <div class="chips color-chips">${HIGHLIGHT_COLORS.map(([color, name]) => `<button class="chip" data-recolor="${color}" aria-pressed="${color === item.color}"><span class="dot hl-${color}"></span>${name}</button>`).join("")}</div>
    <label class="field-label" for="noteText">Your note (optional)</label>
    <textarea id="noteText" rows="4" maxlength="5000" placeholder="Note">${esc(item.note || "")}</textarea>
    <div class="actions"><button class="primary" id="saveHighlight">Save</button><button class="secondary" id="copyHighlight">Copy</button><button class="text-button danger" id="removeHighlight">Remove highlight</button></div>`, body => {
    const members = group.length ? group : [item];
    let color = item.color;
    body.querySelectorAll("[data-recolor]").forEach(button => button.onclick = () => {
      color = button.dataset.recolor;
      body.querySelectorAll("[data-recolor]").forEach(other => other.setAttribute("aria-pressed", String(other === button)));
    });
    const redraw = () => { if (currentChapter?.id === chapter.id) for (const index of new Set(members.map(m => m.paragraph))) redrawParagraph(chapter, index); };
    $("saveHighlight").onclick = () => {
      const note = $("noteText").value.trim();
      for (const member of members) { member.color = color; member.note = note; }
      persistNow(); redraw(); closeSheet(); toast("Highlight saved");
    };
    $("copyHighlight").onclick = async () => { try { await navigator.clipboard.writeText(`${text}\n${citation(chapter)}`); toast("Copied"); } catch { toast("Copying is not available here."); } };
    $("removeHighlight").onclick = () => {
      state.highlights = state.highlights.filter(entry => !members.includes(entry)); persistNow(); redraw(); closeSheet(); toast("Highlight removed");
    };
  });
}

// ----- Scripture -----
function showScripture(target, label, origin) {
  const scripture = BOOK.scripture[target];
  if (!scripture) { toast("This passage is not included in the book."); return; }
  const {ref, verses, missing} = citedVerses(scripture, label);
  const cited = new Set(verses.map(([n]) => n));
  const verseHtml = list => list.map(([n, text]) => `<p class="verse${cited.has(n) ? " cited" : ""}"><sup>${esc(n)}</sup>${esc(text).replace(/\n/g, "<br>")}</p>`).join("");
  const whole = !verses.length;
  openSheet(label, `<p class="eyebrow">${esc(scripture.title)}${ref.verses.length ? ` · verse${ref.verses.length > 1 ? "s" : ""} ${esc(label.split(":").pop())}` : ""}</p>
    ${missing ? `<p class="helper note">Verse ${esc(label.split(":").pop())} is not in ${esc(scripture.title)} in this edition; showing the whole chapter.</p>` : ""}
    <div class="scripture" id="scriptureText">${verseHtml(whole ? scripture.verses : verses)}</div>
    ${whole ? "" : `<button class="text-button" id="wholeChapter">Show all of ${esc(scripture.title)}</button>`}
    ${origin ? `<p><a class="text-button" href="#/c/${origin.chapter}?p=${origin.paragraph}&flash=1">Read where it is cited ›</a></p>` : ""}`, body => {
    const button = body.querySelector("#wholeChapter");
    if (button) button.onclick = () => {
      $("scriptureText").innerHTML = verseHtml(scripture.verses); button.remove();
      body.querySelector(".cited")?.scrollIntoView({block: "center"});
    };
  });
}

// ----- Paragraph actions: save, note, copy -----
function paragraphText(chapter, index) { return stripTags(chapter.paragraphs[index]).replace(/\s+/g, " ").trim(); }
function citation(chapter) { return `Unseen Warfare, ${partLabel(BOOK, chapter)}, ch. ${chapter.number}`; }
function showParagraphActions(chapter, index) {
  const existing = state.saved.find(item => item.chapter === chapter.id && item.paragraph === index);
  const text = paragraphText(chapter, index);
  openSheet(existing ? "Saved passage" : "This passage", `<blockquote class="quote">${esc(text.length > 420 ? text.slice(0, 420) + "…" : text)}</blockquote>
    <label class="field-label" for="noteText">Your note (optional)</label>
    <textarea id="noteText" rows="4" maxlength="5000" placeholder="Note">${esc(existing?.note || "")}</textarea>
    <div class="actions"><button class="primary" id="savePassage">${existing ? "Save note" : "Save passage"}</button>
    <button class="secondary" id="copyPassage">Copy</button>${existing ? '<button class="text-button danger" id="removePassage">Remove</button>' : ""}</div>
    <p class="field-label">Highlight the whole passage</p><div class="chips color-chips">${HIGHLIGHT_COLORS.map(([color, name]) => `<button class="chip" data-whole="${color}"><span class="dot hl-${color}"></span>${name}</button>`).join("")}</div>`, body => {
    body.querySelectorAll("[data-whole]").forEach(button => button.onclick = () => {
      const paragraph = view.querySelector(`.reading p[data-index="${index}"]`), full = paragraph.textContent;
      const start = full.length - full.trimStart().length, end = full.trimEnd().length;
      addHighlights([{paragraph: index, start, end, text: full.slice(start, end)}], button.dataset.whole, $("noteText").value.trim());
      closeSheet(); toast("Highlighted");
    });
    $("savePassage").onclick = () => {
      const note = $("noteText").value.trim();
      if (existing) existing.note = note;
      else state.saved.push({id: crypto.randomUUID?.() || String(Date.now()), chapter: chapter.id, paragraph: index, note, createdAt: Date.now()});
      persistNow(); markSaved(index, true); closeSheet(); toast(existing ? "Note saved" : "Passage saved");
    };
    $("copyPassage").onclick = async () => {
      try { await navigator.clipboard.writeText(`${text}\n${citation(chapter)}`); toast("Copied"); } catch { toast("Copying is not available here."); }
    };
    if (existing) $("removePassage").onclick = () => {
      state.saved = state.saved.filter(item => item !== existing); persistNow(); markSaved(index, false); closeSheet(); toast("Passage removed");
    };
  });
}
function markSaved(index, saved) { view.querySelector(`.reading [data-index="${index}"]`)?.classList.toggle("is-saved", saved); }

// ----- Search -----
function renderSearch(query) {
  setChrome("search");
  view.innerHTML = `<div class="page"><h1>Search</h1>
    <form id="searchForm" class="search-form" role="search"><label class="visually-hidden" for="searchInput">Word or phrase</label>
    <input id="searchInput" type="search" placeholder="Search the book" value="${esc(query)}" autocomplete="off" enterkeyhint="search">
    <button class="primary" type="submit">Search</button></form>
    <p class="helper" id="searchStatus" role="status" aria-live="polite"></p><div id="searchResults"></div></div>`;
  $("searchForm").onsubmit = event => {
    event.preventDefault();
    const value = $("searchInput").value.trim();
    history.replaceState(null, "", `#/search${value ? `?q=${encodeURIComponent(value)}` : ""}`); showResults(value);
  };
  showResults(query);
  if (!query) $("searchInput").focus({preventScroll: true});
  else restoreListScroll(`search:${query}`);
}
function showResults(query) {
  const status = $("searchStatus"), results = $("searchResults");
  if (!query) { status.textContent = ""; results.innerHTML = ""; return; }
  const found = searchBook(BOOK, query);
  if (found.needle.length < 2) { status.textContent = "Enter at least two characters."; results.innerHTML = ""; return; }
  status.textContent = found.total || found.chapters.length
    ? `${found.truncated ? "More than " : ""}${found.total} ${found.total === 1 ? "match" : "matches"} in ${found.chapters.length} ${found.chapters.length === 1 ? "chapter" : "chapters"}`
    : "No matches. Try a shorter phrase or another word.";
  const q = encodeURIComponent(query);
  results.innerHTML = found.chapters.map(({chapter, hits, titleHit}) => `<section class="result-group">
    <a class="result-head" href="#/c/${chapter.id}?q=${q}"><small>${partLabel(BOOK, chapter)}, chapter ${chapter.number}${hits.length ? ` · ${(n => `${n} ${n === 1 ? "match" : "matches"}`)(hits.reduce((n, h) => n + h.count, 0))}` : ""}</small><strong>${titleHit ? markSnippet(chapter.title, query) : esc(chapter.title)}</strong></a>
    ${hits.slice(0, 4).map(hit => `<a class="result-hit" href="#/c/${chapter.id}?q=${q}&p=${hit.paragraph}">${esc(hit.snippet.before)}<mark>${esc(hit.snippet.match)}</mark>${esc(hit.snippet.after)}</a>`).join("")}
    ${hits.length > 4 ? `<a class="result-more" href="#/c/${chapter.id}?q=${q}">${hits.length - 4} more ${hits.length - 4 === 1 ? "passage" : "passages"} in this chapter ›</a>` : ""}
  </section>`).join("");
}
function markSnippet(text, query) {
  const at = normalizeText(text).indexOf(normalizeText(query).trim());
  if (at < 0) return esc(text);
  const length = normalizeText(query).trim().length;
  return `${esc(text.slice(0, at))}<mark>${esc(text.slice(at, at + length))}</mark>${esc(text.slice(at + length))}`;
}

// ----- Saved -----
let savedFilter = "all";
function renderSaved() {
  setChrome("saved");
  const groups = new Map();
  for (const item of state.highlights) {
    const key = item.group || item.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const highlightItems = [...groups.values()].map(members => {
    members.sort((a, b) => a.paragraph - b.paragraph);
    return {kind: "highlight", id: members[0].id, chapter: members[0].chapter, paragraph: members[0].paragraph, start: members[0].start,
      color: members[0].color, note: members[0].note, quote: members.map(m => m.text).join(" … ")};
  });
  const filter = savedFilter;
  const items = [...state.saved.map(item => ({...item, kind: "passage"})), ...highlightItems]
    .map(item => ({...item, chapterData: chapterById(BOOK, item.chapter)}))
    .filter(item => item.chapterData && item.chapterData.paragraphs[item.paragraph] !== undefined)
    .filter(item => filter === "all" || (filter === "notes" ? !!item.note : item.kind === "highlight" && (filter === "highlights" || item.color === filter)));
  const order = bookChapters(BOOK).map(c => c.id);
  items.sort((a, b) => order.indexOf(a.chapter) - order.indexOf(b.chapter) || a.paragraph - b.paragraph || (a.start || 0) - (b.start || 0));
  const counts = {highlights: highlightItems.length, notes: [...state.saved, ...highlightItems].filter(item => item.note).length};
  view.innerHTML = `<div class="page"><h1>Saved</h1>
    <div class="chips saved-filter">${[["all", "All"], ["highlights", `Highlights · ${counts.highlights}`], ["notes", `Notes · ${counts.notes}`]].map(([value, label]) =>
      `<button class="chip" data-saved-filter="${value}" aria-pressed="${filter === value}">${HIGHLIGHT_COLORS.some(([c]) => c === value) ? `<span class="dot hl-${value}"></span>` : ""}${label}</button>`).join("")}</div>
    ${items.length ? `<div class="saved-tools"><button class="text-button" id="exportSaved">Export</button></div>` : ""}
    <div class="saved-list">${items.map(item => {
      const text = item.kind === "highlight" ? item.quote : paragraphText(item.chapterData, item.paragraph);
      return `<article class="saved-item${item.kind === "highlight" ? ` hl-border-${item.color}` : ""}"><a href="#/c/${item.chapter}?p=${item.paragraph}&flash=1"><small>${item.kind === "highlight" ? "Highlight" : "Passage"} · ${partLabel(BOOK, item.chapterData)}, chapter ${item.chapterData.number} · ${esc(item.chapterData.title)}</small>
        <blockquote>${esc(text.length > 300 ? text.slice(0, 300) + "…" : text)}</blockquote></a>${item.note ? `<p class="note-text">${esc(item.note)}</p>` : ""}</article>`;
    }).join("") || `<p class="empty-state">${filter === "all" ? "Nothing saved yet." : "Nothing here yet."}</p>`}</div>
    ${Object.keys(state.read).length ? `<h2 class="section-label">Reading record</h2><p class="helper">${Object.keys(state.read).length} chapters marked read.</p><button class="text-button danger" id="resetRead">Clear reading record</button>` : ""}
  </div>`;
  if ($("exportSaved")) $("exportSaved").onclick = () => {
    const text = items.map(item => `${citation(item.chapterData)}: ${item.chapterData.title}${item.kind === "highlight" ? ` (${item.color} highlight)` : ""}\n\n${item.kind === "highlight" ? item.quote : paragraphText(item.chapterData, item.paragraph)}${item.note ? `\n\nNote: ${item.note}` : ""}`).join("\n\n\n");
    const url = URL.createObjectURL(new Blob([text], {type: "text/plain"})), link = document.createElement("a");
    link.href = url; link.download = `unseen-warfare-notes-${new Date().toISOString().slice(0, 10)}.txt`; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
  view.querySelectorAll("[data-saved-filter]").forEach(button => button.onclick = () => { savedFilter = button.dataset.savedFilter; renderSaved(); });
  if ($("resetRead")) $("resetRead").onclick = () => {
    if (!confirm("Clear which chapters are marked read? Saved passages are kept.")) return;
    state.read = {}; persistNow(); renderSaved(); toast("Reading record cleared");
  };
  restoreListScroll("saved");
}

// ----- Scripture index -----
let scriptureCache;
function renderScripture() {
  setChrome("scripture");
  scriptureCache ||= scriptureIndex(BOOK);
  const count = scriptureCache.reduce((n, group) => n + group.refs.length, 0);
  view.innerHTML = `<div class="page"><h1>Scripture</h1>
    <p class="subtitle">${count} passages · ${scriptureCache.length} books</p>
    <div class="book-index">${scriptureCache.map(group => `<a href="#sb-${esc(group.name.replace(/\s+/g, "-"))}">${esc(group.name)}</a>`).join("")}</div>
    ${scriptureCache.map(group => `<section class="scripture-group" id="sb-${esc(group.name.replace(/\s+/g, "-"))}"><h2>${esc(group.name)} <small>${group.refs.length}</small></h2>
      <div class="ref-list">${group.refs.map(ref => { const chapter = chapterById(BOOK, ref.chapter); return `<button class="ref-row" data-target="${esc(ref.target)}" data-label="${esc(ref.label)}" data-chapter="${ref.chapter}" data-paragraph="${ref.paragraph}"><strong>${esc(ref.label)}</strong><small>${partLabel(BOOK, chapter)}, ch. ${chapter.number} · ${esc(chapter.title)}</small></button>`; }).join("")}</div></section>`).join("")}
  </div>`;
  view.querySelectorAll(".book-index a").forEach(link => link.onclick = event => { event.preventDefault(); document.querySelector(link.getAttribute("href")).scrollIntoView({behavior: "smooth"}); });
  restoreListScroll("scripture");
}

function renderAbout() {
  setChrome("about");
  view.innerHTML = `<div class="page"><h1>About this copy</h1>
    <p><strong>${esc(BOOK.title)}</strong></p><p>${esc(BOOK.authors)}</p><p class="helper">${esc(BOOK.copyright)}</p>
    
    ${window.BOOK_LOCKED ? '<p><button class="secondary" id="lockBook">Lock this device</button></p>' : ""}
    <p><a class="text-button" href="#/">‹ Contents</a></p></div>`;
  if ($("lockBook")) $("lockBook").onclick = () => { forgetBookKey(); location.reload(); };
}

// ----- Settings -----
function showSettings() {
  const p = state.prefs;
  const choice = (name, value, label) => `<button class="chip" data-pref="${name}" data-value="${value}" aria-pressed="${String(p[name]) === String(value)}">${label}</button>`;
  openSheet("Reading settings", `<div class="setting"><span>Text size</span><div class="stepper"><button class="secondary" data-size="-1" aria-label="Smaller text">A−</button><output id="sizeValue">${p.size}</output><button class="secondary" data-size="1" aria-label="Larger text">A+</button></div></div>
    <div class="setting"><span>Theme</span><div class="chips">${choice("theme", "light", "Light")}${choice("theme", "sepia", "Sepia")}${choice("theme", "dark", "Gray")}${choice("theme", "night", "Dark")}</div></div>
    <div class="setting"><span>Font</span><div class="chips">${choice("font", "serif", "Serif")}${choice("font", "sans", "Sans")}</div></div>
    <div class="setting"><span>Line spacing</span><div class="chips">${choice("spacing", 1.55, "Compact")}${choice("spacing", 1.75, "Normal")}${choice("spacing", 2, "Airy")}</div></div>
    <p class="settings-foot"><a href="#/about">About this copy</a></p>`, body => {
    body.querySelectorAll("[data-size]").forEach(button => button.onclick = () => {
      const fraction = scrollFraction();
      p.size = Math.max(15, Math.min(30, p.size + Number(button.dataset.size))); $("sizeValue").textContent = p.size;
      applyPrefs(); persist(); if (currentChapter) window.scrollTo(0, fraction * maxScroll());
    });
    body.querySelectorAll("[data-pref]").forEach(button => button.onclick = () => {
      const value = button.dataset.pref === "spacing" ? Number(button.dataset.value) : button.dataset.value;
      p[button.dataset.pref] = value; applyPrefs(); persist();
      body.querySelectorAll(`[data-pref="${button.dataset.pref}"]`).forEach(other => other.setAttribute("aria-pressed", String(other === button)));
    });
  });
}

// ----- Events -----
function setup() {
  applyPrefs();
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyPrefs);
  $("settingsButton").onclick = showSettings;
  $("sheetClose").onclick = closeSheet; $("sheetBackdrop").onclick = closeSheet;
  $("backButton").onclick = () => { location.hash = "#/"; };
  view.addEventListener("click", event => {
    const ref = event.target.closest("a.ref, .ref-row");
    if (ref) {
      event.preventDefault();
      const paragraph = ref.closest("[data-index]");
      showScripture(ref.dataset.ref || ref.dataset.target, ref.dataset.label,
        ref.dataset.chapter ? {chapter: ref.dataset.chapter, paragraph: ref.dataset.paragraph} : null);
      return;
    }
    if (hadSelection || String(getSelection?.() || "").trim()) return;
    const mark = event.target.closest("mark.hl");
    if (mark && currentChapter) { showHighlight(mark.dataset.hl); return; }
    const paragraph = event.target.closest(".reading p[data-index]");
    // Tapping a paragraph opens its actions; a tap that only clears a selection does not.
    if (paragraph && currentChapter) showParagraphActions(currentChapter, Number(paragraph.dataset.index));
  });
  let hadSelection = false, selectionTimer;
  view.addEventListener("pointerdown", () => { hadSelection = !!String(getSelection?.() || "").trim(); }, true);
  document.addEventListener("selectionchange", () => {
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(() => { if (selectionPieces().length) showSelectionBar(); else hideSelectionBar(); }, 180);
  });
  const bar = document.createElement("div");
  bar.id = "selectionBar"; bar.className = "selection-bar"; bar.hidden = true; bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-label", "Highlight selection");
  document.body.append(bar);
  // Keep the selection alive while tapping the bar.
  bar.addEventListener("pointerdown", event => event.preventDefault());
  bar.addEventListener("mousedown", event => event.preventDefault());
  bar.addEventListener("click", async event => {
    const button = event.target.closest("button"); if (!button) return;
    const pieces = selectionPieces();
    if (!pieces.length) { hideSelectionBar(); return; }
    if (button.dataset.color) { addHighlights(pieces, button.dataset.color); toast("Highlighted"); }
    else if (button.dataset.bar === "note") { addHighlights(pieces, "yellow"); showHighlight(state.highlights.at(-1).id); }
    else if (button.dataset.bar === "copy") {
      try { await navigator.clipboard.writeText(`${pieces.map(p => p.text).join(" ")}\n${citation(currentChapter)}`); toast("Copied"); } catch { toast("Copying is not available here."); }
    }
  });
  addEventListener("scroll", () => {
    if (view.dataset.list && !currentChapter) listScroll[view.dataset.list] = scrollY;
    if (!currentChapter) return;
    updateProgress();
    clearTimeout(scrollSave); scrollSave = setTimeout(saveChapterPosition, 300);
  }, {passive: true});
  addEventListener("keydown", event => {
    if (event.key === "Escape") { closeSheet(); return; }
    if (event.target.closest?.("input, textarea, select, [contenteditable]") || event.metaKey || event.ctrlKey || event.altKey || !$("sheet").hidden) return;
    if (currentChapter && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
      const {previous, next} = chapterNeighbours(BOOK, currentChapter.id), target = event.key === "ArrowRight" ? next : previous;
      if (target) { event.preventDefault(); location.hash = `#/c/${target.id}`; }
    } else if (event.key === "/") { event.preventDefault(); location.hash = "#/search"; }
  });
  addEventListener("pagehide", () => { saveChapterPosition(); persistNow(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { saveChapterPosition(); persistNow(); } });
  addEventListener("hashchange", route);
  route();
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
}
let scrollSave;

// ----- Encrypted copy (public hosting): AES-GCM with a passphrase-derived key -----
const KEY_STORE = "unseen-warfare-key";
const fromBase64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
function forgetBookKey() { try { localStorage.removeItem(KEY_STORE); } catch {} }
async function decryptBook(envelope, rawKey) {
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
  const zipped = await crypto.subtle.decrypt({name: "AES-GCM", iv: fromBase64(envelope.iv)}, key, fromBase64(envelope.data));
  const text = await new Response(new Blob([zipped]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  return JSON.parse(text);
}
async function deriveBookKey(envelope, passphrase) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({name: "PBKDF2", hash: "SHA-256", salt: fromBase64(envelope.salt), iterations: envelope.iterations},
    base, {name: "AES-GCM", length: 256}, true, ["decrypt"]);
  return new Uint8Array(await crypto.subtle.exportKey("raw", key));
}
async function unlockBook() {
  window.BOOK_LOCKED = true;
  let envelope;
  try { envelope = await (await fetch("book-data.enc.json")).json(); }
  catch { view.innerHTML = '<div class="page"><h1>Book unavailable</h1><p>Connect to the internet once to download the book.</p></div>'; return; }
  // A private unlock link carries the key after "#", which is never sent to the server.
  const linked = location.hash.match(/^#unlock=([A-Za-z0-9_-]{43})$/);
  if (linked) {
    // The link stays in the address bar on Contents so "Add to Home Screen" saves it; the installed app then
    // unlocks itself on every launch, even though it does not share Safari's storage.
    const key = linked[1].replace(/-/g, "+").replace(/_/g, "/") + "=";
    try { localStorage.setItem(KEY_STORE, JSON.stringify({salt: envelope.salt, key})); } catch {}
  }
  const stored = (() => { try { return JSON.parse(localStorage.getItem(KEY_STORE) || "null"); } catch { return null; } })();
  if (stored?.salt === envelope.salt) {
    try { BOOK = await decryptBook(envelope, fromBase64(stored.key)); return setup(); } catch { forgetBookKey(); }
  }
  document.body.dataset.section = "locked";
  // The private link is the way in; the passphrase stays tucked away as a fallback.
  view.innerHTML = `<div class="page lock"><img src="icon.svg" alt="" width="64" height="64"><h1>Unseen Warfare</h1>
    <p class="subtitle">Open your private link to read.</p>
    <details class="lock-fallback"><summary>Use passphrase</summary>
    <form id="unlockForm"><label class="visually-hidden" for="passphrase">Passphrase</label>
    <input id="passphrase" type="password" autocomplete="current-password" placeholder="Passphrase" required>
    <button class="primary" type="submit">Open</button></form><p class="helper" id="unlockStatus" role="status"></p></details></div>`;
  $("unlockForm").onsubmit = async event => {
    event.preventDefault();
    const button = event.target.querySelector("button"), status = $("unlockStatus");
    button.disabled = true; status.textContent = "Opening…";
    try {
      const rawKey = await deriveBookKey(envelope, $("passphrase").value);
      BOOK = await decryptBook(envelope, rawKey);
      try { localStorage.setItem(KEY_STORE, JSON.stringify({salt: envelope.salt, key: btoa(String.fromCharCode(...rawKey))})); } catch {}
      setup();
    } catch { status.textContent = "That passphrase did not open the book."; button.disabled = false; $("passphrase").select(); }
  };
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
}
if (BOOK) setup();
else unlockBook();
