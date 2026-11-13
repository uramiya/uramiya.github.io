/* =====================================================
カード検索サイト 改修版 script.js（2026-11-11）
- スマホ優先
- フリーワード検索（名前・テキスト・番号・所属などを横断）
- かな／全角の表記ゆれ吸収、スペース区切りでAND検索
- レアリティ／収録弾フィルタをJSONから自動生成
- コスト絞り込み、キーワード能力チップ（自動生成・複数選択）、表示切り替え（グリッド／リスト）、全件表示・ST→BT→SB順固定
- 検索条件をURLに残す（共有・戻る対策）、詳細は #番号 で直リンク
- モーダル：カード全体タップで開く、前後移動、スワイプ、Esc
===================================================== */

let cards = [];
let currentCards = [];
let selectedColors = new Set();
let selectedKeywords = new Set();
let selectedCost = "all";
let currentIndex = -1;

const colorNames = {
red: "赤",
green: "緑",
purple: "紫",
blue: "青",
yellow: "黄"
};

const $ = id => document.getElementById(id);

/* ===================================
テキスト正規化（表記ゆれ吸収）
- 全角→半角、ひらがな→カタカナ、小文字化
=================================== */
function normalizeText(value) {
const half = String(value || "").normalize("NFKC").toLowerCase();
return half.replace(/[ぁ-ん]/g, ch =>
String.fromCharCode(ch.charCodeAt(0) + 0x60)
);
}

function keywordBase(label) {
return String(label || "").normalize("NFKC").split(/[：:]/)[0].replace(/\d+$/, "").trim();
}

function extractKeywordBases(text) {
const bases = new Set();
const src = String(text || "");
for (const m of src.matchAll(/【([^\u3011]+)】/g)) bases.add(keywordBase(m[1]));
for (const m of src.matchAll(/\[([^\]]+)\]/g)) bases.add(keywordBase(m[1]));
for (const m of src.matchAll(/([一-龥ァ-ヶー・]+)［[^\uFF3D]+］/g)) bases.add(keywordBase(m[1]));
return [...bases].filter(Boolean);
}

function tokenize(value) {
return normalizeText(value).split(/\s+/).filter(Boolean);
}

function includesAll(haystack, tokens) {
const target = normalizeText(haystack);
return tokens.every(token => target.includes(token));
}

/* ===================================
タイトル別カードデータ読み込み
=================================== */

const currentTitle = document.body.dataset.title;

const titleFiles = {
"eternal-return": ["data/Eternal_Return.json"],
"blue_archive": ["data/blue_archive.json"]
};

const cardFiles = titleFiles[currentTitle] || [];

Promise.all(
cardFiles.map(async file => {
const response = await fetch(file);
if (!response.ok) {
throw new Error(`読み込み失敗: ${file} (${response.status})`);
}
return response.json();
})
)
.then(results => {
const allCards = results.flat();

cards = allCards.map(card => ({
...card,
name: card.name || "",
affiliation: card.affiliation || "",
code: card.code || "",
rarity: card.rarity || "",
color: card.color || "",
type: card.type || "",
text: card.text || "",
keywords: extractKeywordBases(card.text),
flavor: card.flavor || "",
image: card.image || ""
}));

createAffiliationOptions();
createRarityOptions();
createSetOptions();
createKeywordOptions();
restoreStateFromUrl();
applyView(localStorage.getItem(`cardView:${currentTitle}`) || "grid");
searchCards(false);

// #BT09-028 のような直リンクで詳細を開く
const hashCode = decodeURIComponent(location.hash.replace(/^#/, ""));
if (hashCode) {
const idx = currentCards.findIndex(
c => c.code.toUpperCase() === hashCode.toUpperCase()
);
if (idx >= 0) openModal(idx, false);
}
})
.catch(error => {
console.error("カード読み込みエラー:", error);
const box = $("loadError");
if (box) box.hidden = false;
const count = $("resultCount");
if (count) count.textContent = "読み込みに失敗しました";
});

/* ===================================
フィルタ選択肢の自動生成
=================================== */

function fillSelect(select, label, values) {
if (!select) return;
select.replaceChildren(new Option(label, ""));
values.forEach(v => select.add(new Option(v, v)));
}

function createAffiliationOptions() {
const select = $("affiliationFilter");
if (!select) return;

const set = new Set();
cards.forEach(card => {
String(card.affiliation || "")
.split("/")
.map(s => s.trim())
.filter(Boolean)
.forEach(s => set.add(s));
});

const wrap = $("affiliationWrap");
if (set.size === 0) {
// 所属データがないタイトルでは項目ごと隠す
if (wrap) wrap.hidden = true;
return;
}
if (wrap) wrap.hidden = false;
fillSelect(select, "所属：すべて", [...set].sort((a, b) => a.localeCompare(b, "ja")));
}

function createRarityOptions() {
const select = $("rarityFilter");
if (!select) return;
const set = new Set(cards.map(c => c.rarity).filter(Boolean));
const order = ["SPL", "SBL", "L", "UR", "SR", "SSR", "R", "C"];
const sorted = [...set].sort((a, b) => {
const ia = order.indexOf(a), ib = order.indexOf(b);
if (ia >= 0 && ib >= 0) return ia - ib;
if (ia >= 0) return -1;
if (ib >= 0) return 1;
return a.localeCompare(b);
});
fillSelect(select, "レアリティ：すべて", sorted);
}

function setCodeOf(card) {
const m = String(card.code || "").toUpperCase().match(/^([A-Z]+\d+)/);
return m? m[1]: "";
}

function createSetOptions() {
const select = $("setFilter");
if (!select) return;
const set = new Set(cards.map(setCodeOf).filter(Boolean));
fillSelect(select, "収録弾：すべて", [...set].sort());
}

/* ===================================
キーワード能力チップの自動生成
=================================== */

function createKeywordOptions() {
const wrap = $("keywordWrap");
const container = $("keywordChips");
if (!wrap ||!container) return;

const counts = new Map();
cards.forEach(card => {
(card.keywords || []).forEach(k => counts.set(k, (counts.get(k) || 0) + 1));
});

if (counts.size === 0) {
wrap.hidden = true;
return;
}
wrap.hidden = false;

const sorted = [...counts.entries()]
.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"));

container.replaceChildren();
sorted.forEach(([name, count]) => {
const chip = document.createElement("button");
chip.type = "button";
chip.className = "keyword-chip";
chip.dataset.keyword = name;
chip.setAttribute("aria-pressed", "false");
chip.innerHTML = `${escapeHtml(name)} <span class="keyword-count">${count}</span>`;
chip.addEventListener("click", () => {
if (selectedKeywords.has(name)) selectedKeywords.delete(name);
else selectedKeywords.add(name);
updateKeywordChips();
searchCards(true);
});
container.appendChild(chip);
});
}

function updateKeywordChips() {
document.querySelectorAll(".keyword-chip").forEach(chip => {
const active = selectedKeywords.has(chip.dataset.keyword);
chip.classList.toggle("active", active);
chip.setAttribute("aria-pressed", String(active));
});
}

/* ===================================
URLに検索条件を残す／復元する
=================================== */

function syncUrl() {
const params = new URLSearchParams();
const set = (key, id) => {
const el = $(id);
if (el && el.value.trim()) params.set(key, el.value.trim());
};
set("q", "keywordSearchBox");
set("name", "nameSearchBox");
set("text", "textSearchBox");
set("code", "codeSearchBox");
set("type", "typeFilter");
set("aff", "affiliationFilter");
set("rarity", "rarityFilter");
set("set", "setFilter");
if (selectedColors.size > 0) params.set("color", [...selectedColors].join(","));
if (selectedKeywords.size > 0) params.set("kw", [...selectedKeywords].join(","));
if (selectedCost!== "all") params.set("cost", selectedCost);

const qs = params.toString();
history.replaceState(null, "", qs? `?${qs}${location.hash}`: location.pathname + location.hash);
}

function restoreStateFromUrl() {
const p = new URLSearchParams(location.search);
const setVal = (id, key) => {
const el = $(id);
if (el && p.get(key)) el.value = p.get(key);
};
setVal("keywordSearchBox", "q");
setVal("nameSearchBox", "name");
setVal("textSearchBox", "text");
setVal("codeSearchBox", "code");
setVal("typeFilter", "type");
setVal("affiliationFilter", "aff");
setVal("rarityFilter", "rarity");
setVal("setFilter", "set");

if (p.get("kw")) {
p.get("kw").split(",").map(v => v.trim()).filter(Boolean)
.forEach(v => selectedKeywords.add(v));
updateKeywordChips();
}
if (p.get("color")) {
p.get("color").split(",").map(v => v.trim()).filter(Boolean)
.forEach(v => selectedColors.add(v));
updateColorButtons();
}
if (p.get("cost")) {
selectedCost = p.get("cost");
document.querySelectorAll(".cost-chip").forEach(b =>
b.classList.toggle("active", b.dataset.cost === selectedCost)
);
}
// 詳細フィルタが復元されたら、スマホでもパネルを開いておく
if (["name", "text", "code", "type", "aff", "rarity", "set", "cost", "kw"].some(k => p.get(k))) {
$("advancedFilters")?.classList.add("open");
$("filterToggle")?.setAttribute("aria-expanded", "true");
}
}

/* ===================================
検索イベント
=================================== */

["keywordSearchBox", "nameSearchBox", "textSearchBox", "codeSearchBox"]
.forEach(id => $(id)?.addEventListener("input", () => searchCards(true)));

["typeFilter", "affiliationFilter", "rarityFilter", "setFilter"]
.forEach(id => $(id)?.addEventListener("change", () => searchCards(true)));

function updateColorButtons() {
document.querySelectorAll(".color-btn").forEach(b => {
const active = b.dataset.color === "all"
? selectedColors.size === 0
: selectedColors.has(b.dataset.color);
b.classList.toggle("active", active);
b.setAttribute("aria-pressed", String(active));
});
}

document.querySelectorAll(".color-btn").forEach(button => {
button.addEventListener("click", () => {
if (button.dataset.color === "all") {
selectedColors.clear();
} else if (selectedColors.has(button.dataset.color)) {
selectedColors.delete(button.dataset.color);
} else {
selectedColors.add(button.dataset.color);
}
updateColorButtons();
searchCards(true);
});
});

document.querySelectorAll(".cost-chip").forEach(button => {
button.addEventListener("click", () => {
document.querySelectorAll(".cost-chip").forEach(b => b.classList.remove("active"));
button.classList.add("active");
selectedCost = button.dataset.cost;
searchCards(true);
});
});

// 絞り込みパネル開閉（スマホ）
$("filterToggle")?.addEventListener("click", () => {
const panel = $("advancedFilters");
const open = panel.classList.toggle("open");
$("filterToggle").setAttribute("aria-expanded", String(open));
});

// 表示切り替え
document.querySelectorAll(".view-btn").forEach(button => {
button.addEventListener("click", () => {
applyView(button.dataset.view);
localStorage.setItem(`cardView:${currentTitle}`, button.dataset.view);
renderCards();
});
});

function applyView(view) {
if (view!== "grid" && view!== "list") view = "grid";
const list = $("cardList");
if (list) list.dataset.view = view;
document.querySelectorAll(".view-btn").forEach(b =>
b.classList.toggle("active", b.dataset.view === view)
);
}

// リセット
function resetFilters() {
["keywordSearchBox", "nameSearchBox", "textSearchBox", "codeSearchBox"]
.forEach(id => { if ($(id)) $(id).value = "";});
["typeFilter", "affiliationFilter", "rarityFilter", "setFilter"]
.forEach(id => { if ($(id)) $(id).value = "";});
selectedColors.clear();
updateColorButtons();
selectedKeywords.clear();
updateKeywordChips();
selectedCost = "all";
document.querySelectorAll(".cost-chip").forEach(b =>
b.classList.toggle("active", b.dataset.cost === "all"));
searchCards(true);
}
$("resetFiltersBtn")?.addEventListener("click", resetFilters);
$("emptyResetBtn")?.addEventListener("click", resetFilters);

/* ===================================
カード検索処理
=================================== */

function activeFilterCount() {
let n = 0;
if (selectedColors.size > 0) n++;
if (selectedKeywords.size > 0) n++;
if (selectedCost!== "all") n++;
["nameSearchBox", "textSearchBox", "codeSearchBox", "typeFilter",
"affiliationFilter", "rarityFilter", "setFilter"]
.forEach(id => { if ($(id)?.value) n++;});
return n;
}

function costMatches(card) {
if (selectedCost === "all") return true;
const cost = Number(card.cost);
if (!Number.isFinite(cost)) return false;
if (selectedCost === "5plus") return cost >= 5;
return cost === Number(selectedCost);
}

function searchCards(updateUrl = true) {
const keywordTokens = tokenize($("keywordSearchBox")?.value || "");
const nameTokens = tokenize($("nameSearchBox")?.value || "");
const textTokens = tokenize($("textSearchBox")?.value || "");
const codeTokens = tokenize($("codeSearchBox")?.value || "");

const typeValue = $("typeFilter")?.value || "";
const rarityValue = $("rarityFilter")?.value || "";
const setValue = $("setFilter")?.value || "";
const affiliationValue = $("affiliationFilter")?.value.trim() || "";

currentCards = cards.filter(card => {
// フリーワード：名前・テキスト・番号・所属・フレーバー・タイプ・レアを横断
const keywordMatch =
keywordTokens.length === 0 ||
includesAll(
[card.name, card.text, card.code, card.affiliation,
card.flavor, card.type, card.rarity].join(" "),
keywordTokens
);

const nameMatch = nameTokens.length === 0 || includesAll(card.name, nameTokens);
const textMatch =
textTokens.length === 0 ||
includesAll(`${card.text} ${card.flavor}`, textTokens);
const codeMatch = codeTokens.length === 0 || includesAll(card.code, codeTokens);

const colorMatch = selectedColors.size === 0 || selectedColors.has(card.color);
const typeMatch =!typeValue || card.type.includes(typeValue);
const rarityMatch =!rarityValue || card.rarity === rarityValue;
const setMatch =!setValue || setCodeOf(card) === setValue;

const affiliations = String(card.affiliation || "")
.split("/").map(s => s.trim()).filter(Boolean);
const affiliationMatch =!affiliationValue || affiliations.includes(affiliationValue);

const keywordAbilityMatch =
selectedKeywords.size === 0 ||
[...selectedKeywords].every(k => (card.keywords || []).includes(k));

return keywordMatch && nameMatch && textMatch && codeMatch &&
colorMatch && typeMatch && rarityMatch && setMatch &&
affiliationMatch && keywordAbilityMatch && costMatches(card);
});

// 並びは ST → BT → SB の弾順に固定（同じ弾の中は番号順）
const prefixRanks = { ST: 0, BT: 1, SB: 2 };
const prefixOf = code => (String(code).match(/^([A-Z]+)/) || [])[1] || "";
const prefixRank = code => prefixRanks[prefixOf(code)] ?? 3;
currentCards.sort((a, b) =>
prefixRank(a.code) - prefixRank(b.code) ||
prefixOf(a.code).localeCompare(prefixOf(b.code)) ||
a.code.localeCompare(b.code, "en", { numeric: true}));

renderCards();
updateFilterBadge();
if (updateUrl) syncUrl();
}

function updateFilterBadge() {
const badge = $("filterBadge");
if (!badge) return;
const n = activeFilterCount();
badge.textContent = n > 0? String(n): "";
badge.hidden = n === 0;
}

/* ===================================
カード一覧表示
=================================== */

function renderCards() {
const cardList = $("cardList");
const resultCount = $("resultCount");
if (!cardList ||!resultCount) return;

const total = currentCards.length;
resultCount.textContent = `${total}件`;

const empty = $("emptyState");
if (empty) empty.hidden = total!== 0;

const visible = currentCards;
const fragment = document.createDocumentFragment();

visible.forEach((card, index) => {
const item = document.createElement("button");
item.type = "button";
item.className = "card";
item.setAttribute("aria-label", `${card.name} ${card.code} の詳細を開く`);

const stats = [];
if (card.cost!== null && card.cost!== undefined && card.cost!== "") stats.push(`コスト ${card.cost}`);
if (card.power!== null && card.power!== undefined && card.power!== "") stats.push(`パワー ${card.power}`);

item.innerHTML = `
<span class="card-thumb">
<img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.name)}" loading="lazy">
<span class="card-fallback" hidden>${escapeHtml(card.code)}<br>画像なし</span>
</span>
<span class="card-info">
<span class="card-name">${escapeHtml(card.name)}</span>
<span class="card-meta">${escapeHtml(card.rarity)}・${escapeHtml(card.code)}${stats.length? `／${escapeHtml(stats.join("・"))}`: ""}</span>
<span class="card-text">${decorateCardText(card.text)}</span>
</span>
`;

const img = item.querySelector("img");
img.addEventListener("error", () => {
img.hidden = true;
item.querySelector(".card-fallback").hidden = false;
});

item.addEventListener("click", () => openModal(index));
fragment.appendChild(item);
});

cardList.replaceChildren(fragment);
}

/* ===================================
カード詳細モーダル
=================================== */

function openModal(index, updateHash = true) {
currentIndex = index;
const card = currentCards[index];
if (!card) return;

$("modalImage").src = card.image;
$("modalImage").alt = card.name;
$("modalName").textContent = card.name;

const affiliationElement = $("modalAffiliation");
if (affiliationElement) {
affiliationElement.replaceChildren();
const affiliations = String(card.affiliation || "")
.split("/").map(s => s.trim()).filter(Boolean);
affiliations.forEach(item => {
const tag = document.createElement("span");
tag.className = "affiliation-tag";
tag.textContent = item;
affiliationElement.appendChild(tag);
});
affiliationElement.style.display = affiliations.length > 0? "flex": "none";
}

$("modalCode").textContent = `${card.rarity}・${card.code}`;
$("modalType").textContent = card.type || "-";
$("modalColor").textContent = colorNames[card.color] || card.color || "-";
$("modalCost").textContent = card.cost?? "-";
$("modalPower").textContent = card.power?? "-";
$("modalHit").textContent = card.hit?? "-";
$("modalText").innerHTML = decorateCardText(card.text);
$("modalFlavor").textContent = card.flavor || "";

const counter = $("modalCounter");
if (counter) counter.textContent = `${index + 1} / ${currentCards.length}`;
const prev = $("prevCardBtn"), next = $("nextCardBtn");
if (prev) prev.disabled = index <= 0;
if (next) next.disabled = index >= currentCards.length - 1;

$("cardModal").classList.add("show");
document.body.classList.add("modal-open");
if (updateHash) {
history.replaceState(null, "", `${location.pathname}${location.search}#${encodeURIComponent(card.code)}`);
}
}

function closeModal() {
$("cardModal")?.classList.remove("show");
document.body.classList.remove("modal-open");
currentIndex = -1;
history.replaceState(null, "", `${location.pathname}${location.search}`);
}
// 旧HTML互換のため残す
window.closeModal = closeModal;

function stepModal(delta) {
if (currentIndex < 0) return;
const next = currentIndex + delta;
if (next < 0 || next >= currentCards.length) return;
openModal(next);
}

$("prevCardBtn")?.addEventListener("click", () => stepModal(-1));
$("nextCardBtn")?.addEventListener("click", () => stepModal(1));
document.querySelector(".close-btn")?.addEventListener("click", closeModal);

$("cardModal")?.addEventListener("click", event => {
if (event.target.id === "cardModal") closeModal();
});

// ダブルクリックで閉じる（前へ／次へボタンを連打したときは閉じない）
$("cardModal")?.addEventListener("dblclick", event => {
if (event.target.closest("button")) return;
closeModal();
});

document.addEventListener("keydown", event => {
if (currentIndex < 0) return;
if (event.key === "Escape") closeModal();
if (event.key === "ArrowLeft") stepModal(-1);
if (event.key === "ArrowRight") stepModal(1);
});

// スワイプで前後移動
let touchStartX = null;
$("cardModal")?.addEventListener("touchstart", e => {
touchStartX = e.changedTouches[0].clientX;
}, { passive: true});
$("cardModal")?.addEventListener("touchend", e => {
if (touchStartX === null) return;
const dx = e.changedTouches[0].clientX - touchStartX;
if (Math.abs(dx) > 60) stepModal(dx < 0? 1: -1);
touchStartX = null;
}, { passive: true});

/* ===================================
カード効果テキスト装飾
=================================== */

function decorateCardText(text) {
let safeText = escapeHtml(text || "");

safeText = safeText.replace(/【([^\u3011]+)】/g, (match, label) => {
let className = "tag-default";
if (label === "アタッカー") className = "tag-attacker";
else if (label === "トリガー") className = "tag-trigger";
else if (label === "ミックス") className = "tag-mix";
else if (label.startsWith("クレジット")) className = "tag-leveling";
else if (label === "エントリー") className = "tag-entry";
else if (label === "アームド") className = "tag-armed";
else if (label === "ディフェンダー") className = "tag-blocker";
else if (label === "パッシブ") className = "tag-passive";
else if (label.startsWith("アクティブ")) className = "tag-active";
else if (label === "エグジット") className = "tag-exit";
else if (label === "エスケープ") className = "tag-escape";
else if (label.startsWith("EX")) className = "tag-extra";
else if (label === "契約") className = "tag-contract";
else if (label.startsWith("覚醒")) className = "tag-awaken";
return `<span class="tag ${className}">${label}</span>`;
});

safeText = safeText.replace(/\[トリガー\]/g, '<span class="tag tag-trigger">トリガー</span>');
return safeText;
}

/* ===================================
HTMLエスケープ
=================================== */

function escapeHtml(text) {
return String(text?? "")
.replaceAll("&", "&amp;")
.replaceAll("<", "&lt;")
.replaceAll(">", "&gt;")
.replaceAll('"', "&quot;")
.replaceAll("'", "&#039;");
}
