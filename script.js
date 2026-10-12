
let cards = [];
let currentCards = [];
let selectedColor = "all";

const colorNames = {
  red: "赤",
  green: "緑",
  purple: "紫",
  blue: "青",
  yellow: "黄"
};

/* ===================================
   タイトル別カードデータ読み込み
   =================================== */

const currentTitle = document.body.dataset.title;

const titleFiles = {
  "eternal-return": [
    "data/Eternal_Return.json"
  ],

  "blue_archive": [
    "data/blue_archive.json"
  ]
};

const cardFiles = titleFiles[currentTitle] || [];

Promise.all(
  cardFiles.map(async file => {
    const response = await fetch(file);

    if (!response.ok) {
      throw new Error(
        `読み込み失敗: ${file} (${response.status})`
      );
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
    flavor: card.flavor || "",
    image: card.image || ""
  }));

  currentCards = cards;
  createAffiliationOptions();
  searchCards();
  })
.catch(error => {
  console.error("カード読み込みエラー:", error);
});

/* ===================================
   検索イベント
   =================================== */

document.getElementById("nameSearchBox")
  .addEventListener("input", searchCards);

document.getElementById("textSearchBox")
  .addEventListener("input", searchCards);

document.getElementById("codeSearchBox")
  .addEventListener("input", searchCards);

document.getElementById("typeFilter")
  .addEventListener("change", searchCards);

document.getElementById("costFilter")
  .addEventListener("change", searchCards);

// 所属検索（ブルアカ専用）

/* 所属プルダウンの変更時に検索を実行 */
document.getElementById("affiliationFilter")
  ?.addEventListener("change", searchCards);


// 色フィルター
document.querySelectorAll(".color-btn").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".color-btn").forEach(btn => {
      btn.classList.remove("active");
    });

    button.classList.add("active");
    selectedColor = button.dataset.color;
    searchCards();
  });
});


/* ===================================
   所属プルダウン自動生成
   =================================== */

function createAffiliationOptions() {
  const select = document.getElementById("affiliationFilter");

  // 所属プルダウンがないページでは処理しない
  if (!select) return;

  // 選択肢を初期化
  select.replaceChildren(new Option("所属：すべて", ""));

  const affiliations = new Set();

  cards.forEach(card => {
    String(card.affiliation || "")
      .split("/")
      .map(item => item.trim())
      .filter(Boolean)
      .forEach(item => affiliations.add(item));
  });

  // 重複を除去して日本語順に並べる
  const sorted = [...affiliations].sort((a, b) =>
    a.localeCompare(b, "ja")
  );

  sorted.forEach(item => {
    select.add(new Option(item, item));
  });
}


/* ===================================
   カード検索処理
   =================================== */


function searchCards() {
  const nameKeyword = document.getElementById("nameSearchBox").value.trim().toLowerCase();
  const textKeyword = document.getElementById("textSearchBox").value.trim().toLowerCase();
  const codeKeyword = document.getElementById("codeSearchBox").value.trim().toLowerCase();

  const typeValue = document.getElementById("typeFilter").value;
  const expansionValue = document.getElementById("costFilter").value;

  const affiliationValue =
    document.getElementById("affiliationFilter")?.value.trim() || "";

  currentCards = cards.filter(card => {
    const nameMatch =
      !nameKeyword ||
      card.name.toLowerCase().includes(nameKeyword);

    const textMatch =
      !textKeyword ||
      card.text.toLowerCase().includes(textKeyword);

    const codeMatch =
      !codeKeyword ||
      card.code.toLowerCase().includes(codeKeyword);

    const colorMatch =
      selectedColor === "all" ||
      card.color === selectedColor;

    const typeMatch =
      !typeValue ||
      card.type.includes(typeValue);

    const expansionMatch =
      !expansionValue ||
      card.code.toUpperCase().startsWith(expansionValue.toUpperCase());

    // 所属を / で分割して完全一致判定
    const affiliations = String(card.affiliation || "")
      .split("/")
      .map(item => item.trim())
      .filter(Boolean);

    const affiliationMatch =
      !affiliationValue ||
      affiliations.includes(affiliationValue);

    return (
      nameMatch &&
      textMatch &&
      codeMatch &&
      colorMatch &&
      typeMatch &&
      expansionMatch &&
      affiliationMatch
    );
  });

  displayCards(currentCards);
}


/* ===================================
   カード一覧表示
   =================================== */

function displayCards(list) {
  const cardList = document.getElementById("cardList");
  const resultCount = document.getElementById("resultCount");

  cardList.innerHTML = "";
  resultCount.textContent = `${list.length}件`;

  const fragment = document.createDocumentFragment();

  list.forEach((card, index) => {
    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <img src="${card.image}" alt="${escapeHtml(card.name)}" loading="lazy">
      <button class="zoom-btn" type="button">🔍</button>
    `;

    div.querySelector(".zoom-btn").addEventListener("click", () => {
      openModal(index);
    });

    fragment.appendChild(div);
  });

  cardList.appendChild(fragment);
}

/* ===================================
   カード詳細モーダル
   =================================== */

function openModal(index) {
  const card = currentCards[index];

  document.getElementById("modalImage").src = card.image;
  document.getElementById("modalName").textContent = card.name;

  // 所属をタグ形式で表示
  const affiliationElement =
    document.getElementById("modalAffiliation");

  if (affiliationElement) {
    affiliationElement.replaceChildren();

    const affiliations = String(card.affiliation || "")
      .split("/")
      .map(item => item.trim())
      .filter(Boolean);

    affiliations.forEach(item => {
      const tag = document.createElement("span");
      tag.className = "affiliation-tag";
      tag.textContent = item;

      affiliationElement.appendChild(tag);
    });

    affiliationElement.style.display =
      affiliations.length > 0 ? "flex" : "none";
  }

  document.getElementById("modalCode").textContent =
    `${card.rarity}・${card.code}`;

  document.getElementById("modalType").textContent =
    card.type;

  document.getElementById("modalColor").textContent =
    colorNames[card.color] || card.color || "-";

  document.getElementById("modalCost").textContent =
    card.cost ?? "-";

  document.getElementById("modalPower").textContent =
    card.power ?? "-";

  document.getElementById("modalHit").textContent =
    card.hit ?? "-";

  document.getElementById("modalText").innerHTML =
    decorateCardText(card.text);

  document.getElementById("modalFlavor").textContent =
    card.flavor || "";

  document.getElementById("cardModal").classList.add("show");
}

function closeModal() {
  document.getElementById("cardModal").classList.remove("show");
}

// モーダル背景クリックで閉じる
document.getElementById("cardModal")
  .addEventListener("click", event => {
    if (event.target.id === "cardModal") {
      closeModal();
    }
  });

// ダブルクリックで閉じる
document.getElementById("cardModal")
  .addEventListener("dblclick", () => {
    closeModal();
  });

/* ===================================
   カード効果テキスト装飾
   =================================== */

function decorateCardText(text) {
  let safeText = escapeHtml(text || "");

  safeText = safeText.replace(
    /【([^】]+)】/g,
    (match, label) => {
      let className = "tag-default";

      if (label === "アタッカー")
        className = "tag-attacker";

      else if (label === "トリガー")
        className = "tag-trigger";

      else if (label === "ミックス")
        className = "tag-mix";

      else if (label.startsWith("クレジット"))
        className = "tag-leveling";

      else if (label === "エントリー")
        className = "tag-entry";

      else if (label === "アームド")
        className = "tag-armed";

      else if (label === "ディフェンダー")
        className = "tag-blocker";

      else if (label === "パッシブ")
        className = "tag-passive";

      else if (label.startsWith("アクティブ"))
        className = "tag-active";

      else if (label === "エグジット")
        className = "tag-exit";

      else if (label === "エスケープ")
        className = "tag-escape";

      else if (label.startsWith("EX"))
        className = "tag-extra";

      return `<span class="tag ${className}">${label}</span>`;
    }
  );

  safeText = safeText.replace(
    /\[トリガー\]/g,
    '<span class="tag tag-trigger">トリガー</span>'
  );

  return safeText;
}

/* ===================================
   HTMLエスケープ
   =================================== */

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
