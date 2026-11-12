// Pure book logic: chapters, Scripture references, and search. No DOM access.
const CANON = ["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings",
  "1 Chronicles","2 Chronicles","Ezra","Nehemiah","Tobit","Judith","Esther","1 Maccabees","2 Maccabees","Job","Psalms","Proverbs","Ecclesiastes",
  "Song of Solomon","Wisdom of Solomon","Sirach","Isaiah","Jeremiah","Lamentations","Baruch","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah",
  "Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi","Matthew","Mark","Luke","John","Acts","Romans",
  "1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy",
  "2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation"];
const PART_NAMES = ["One", "Two", "Three", "Four"];

function stripTags(html) {
  return String(html).replace(/<[^>]*>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&");
}
// Case, curly quotes, and dashes do not matter when searching.
function normalizeText(text) {
  return String(text).toLocaleLowerCase().replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-").replace(/\s+/g, " ");
}
function bookChapters(book) { return book.parts.flatMap(part => part.chapters); }
function chapterById(book, id) { return bookChapters(book).find(chapter => chapter.id === id) || null; }
function chapterNeighbours(book, id) {
  const list = bookChapters(book), index = list.findIndex(chapter => chapter.id === id);
  return {previous: index > 0 ? list[index - 1] : null, next: index >= 0 && index < list.length - 1 ? list[index + 1] : null, index, total: list.length};
}
function partLabel(book, chapter) { return `Part ${PART_NAMES[chapter.part - 1] || chapter.part}`; }
function chapterWords(chapter) {
  return chapter.words ??= chapter.paragraphs.reduce((sum, p) => sum + stripTags(p).split(/\s+/).filter(Boolean).length, 0);
}
function readingMinutes(chapter) { return Math.max(1, Math.round(chapterWords(chapter) / 230)); }

// "Matt 5:48", "Ps. 33:9-11", "1 Cor 13:4,7" -> chapter and verse list. Without a colon the whole chapter is meant.
function parseReference(label) {
  const match = String(label).trim().match(/(\d+)\s*[:.]\s*([\d\s,–-]+[a-c]?)\s*$/);
  if (!match) return {chapter: Number(String(label).match(/(\d+)\s*$/)?.[1]) || null, verses: []};
  const verses = [];
  for (const piece of match[2].split(",")) {
    const [start, end] = piece.split(/[–-]/).map(value => parseInt(value, 10));
    if (!Number.isInteger(start)) continue;
    const last = Number.isInteger(end) && end >= start && end - start < 200 ? end : start;
    for (let verse = start; verse <= last; verse++) if (!verses.includes(verse)) verses.push(verse);
  }
  return {chapter: Number(match[1]), verses};
}
function citedVerses(scripture, label) {
  const ref = parseReference(label);
  const found = scripture.verses.filter(([number]) => ref.verses.includes(parseInt(number, 10)));
  return {ref, verses: found, missing: ref.verses.length > 0 && found.length === 0};
}
function scriptureBook(title) { return String(title).replace(/\s+\d+$/, "").trim(); }

// Every reference in reading order, grouped by Bible book in canonical order.
function scriptureIndex(book) {
  const groups = new Map();
  for (const chapter of bookChapters(book)) chapter.paragraphs.forEach((paragraph, index) => {
    for (const match of paragraph.matchAll(/data-ref="([^"]+)" data-label="([^"]*)"/g)) {
      const scripture = book.scripture[match[1]];
      if (!scripture) continue;
      const name = scriptureBook(scripture.title);
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push({target: match[1], label: stripTags(match[2]), title: scripture.title, chapter: chapter.id, paragraph: index,
        sort: parseReference(match[2])});
    }
  });
  const rank = name => { const index = CANON.indexOf(name); return index < 0 ? CANON.length : index; };
  return [...groups].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0])).map(([name, refs]) => ({name,
    refs: refs.sort((a, b) => (a.sort.chapter || 0) - (b.sort.chapter || 0) || (a.sort.verses[0] || 0) - (b.sort.verses[0] || 0))}));
}

// Whole-book search: literal phrase, case-insensitive. Returns chapters with paragraph hits and snippets.
function searchBook(book, query, limit = 300) {
  const needle = normalizeText(query).trim();
  if (needle.length < 2) return {needle, chapters: [], total: 0, truncated: false};
  const chapters = [];
  let total = 0, truncated = false;
  for (const chapter of bookChapters(book)) {
    const hits = [];
    const titleHit = normalizeText(chapter.title).includes(needle);
    chapter.paragraphs.forEach((paragraph, index) => {
      const text = stripTags(paragraph).replace(/\s+/g, " "), normalized = normalizeText(text);
      let at = normalized.indexOf(needle), count = 0;
      while (at >= 0) { count++; if (count === 1) hits.push({paragraph: index, snippet: snippetAt(text, at, needle.length)}); at = normalized.indexOf(needle, at + needle.length); }
      if (count) hits.at(-1).count = count;
      total += count;
    });
    if (hits.length || titleHit) chapters.push({chapter, hits, titleHit});
    if (total >= limit) { truncated = true; break; }
  }
  return {needle, chapters, total, truncated};
}
function snippetAt(text, at, length, before = 70, after = 110) {
  const start = Math.max(0, text.lastIndexOf(" ", Math.max(0, at - before)) + 1 || 0), end = Math.min(text.length, at + length + after);
  const cut = text.indexOf(" ", end);
  const stop = cut < 0 ? text.length : cut;
  return {before: (start > 0 ? "…" : "") + text.slice(start, at), match: text.slice(at, at + length), after: text.slice(at + length, stop) + (stop < text.length ? "…" : "")};
}

// Text-node runs -> every literal match, as run/offset pairs, for highlighting rendered chapters.
function findMatches(runs, query) {
  const needle = normalizeText(query).trim();
  if (!needle) return [];
  let text = "";
  const offsets = [];
  runs.forEach((run, index) => {
    let offset = 0;
    for (const character of run) {
      const normalized = /\s/.test(character) ? " " : normalizeText(character);
      if (normalized !== " " || !text.endsWith(" ")) for (let n = 0; n < normalized.length; n++) { text += normalized[n]; offsets.push({index, offset, end: offset + character.length}); }
      offset += character.length;
    }
  });
  const matches = [];
  for (let at = text.indexOf(needle); at >= 0 && matches.length < 500; at = text.indexOf(needle, at + needle.length))
    matches.push({start: offsets[at], end: offsets[at + needle.length - 1]});
  return matches;
}

if (typeof module !== "undefined") module.exports = {CANON, stripTags, normalizeText, bookChapters, chapterById, chapterNeighbours, partLabel,
  chapterWords, readingMinutes, parseReference, citedVerses, scriptureBook, scriptureIndex, searchBook, snippetAt, findMatches};
