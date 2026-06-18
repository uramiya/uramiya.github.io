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

fetch("cards.json")
  .then(response => response.json())
  .then(data => {
    cards = data.map(card => ({
      ...card,
      name: card.name || "",
      code: card.code || "",
      rarity: card.rarity || "",
      color: card.color || "",
      type: card.type || "",
      text: card.text || "",
      flavor: card.flavor || "",
      image: card.image || ""
    }));

    currentCards = cards;
    displayCards(currentCards);
  });

document.getElementById("nameSearchBox").addEventListener("input", searchCards);
document.getElementById("textSearchBox").addEventListener("input", searchCards);
document.getElementById("codeSearchBox").addEventListener("input", searchCards);
document.getElementById("typeFilter").addEventListener("change", searchCards);
document.getElementById("costFilter").addEventListener("change", searchCards);

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

function searchCards() {
  const nameKeyword = document.getElementById("nameSearchBox").value.trim().toLowerCase();
  const textKeyword = document.getElementById("textSearchBox").value.trim().toLowerCase();
  const codeKeyword = document.getElementById("codeSearchBox").value.trim().toLowerCase();
  const typeValue = document.getElementById("typeFilter").value;
  const expansionValue = document.getElementById("costFilter").value;

  currentCards = cards.filter(card => {
    const nameMatch = !nameKeyword || card.name.toLowerCase().includes(nameKeyword);
    const textMatch = !textKeyword || card.text.toLowerCase().includes(textKeyword);
    const codeMatch = !codeKeyword || card.code.toLowerCase().includes(codeKeyword);
    const colorMatch = selectedColor === "all" || card.color === selectedColor;
    const typeMatch = !typeValue || card.type.includes(typeValue);
    const expansionMatch = !expansionValue || card.code.toUpperCase().startsWith(expansionValue);

    return nameMatch && textMatch && codeMatch && colorMatch && typeMatch && expansionMatch;
  });

  displayCards(currentCards);
}

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

function openModal(index) {
  const card = currentCards[index];

  document.getElementById("modalImage").src = card.image;
  document.getElementById("modalName").textContent = card.name;
  document.getElementById("modalCode").textContent = `${card.rarity}・${card.code}`;
  document.getElementById("modalType").textContent = card.type;
  document.getElementById("modalColor").textContent = colorNames[card.color] || card.color || "-";
  document.getElementById("modalCost").textContent = card.cost ?? "-";
  document.getElementById("modalPower").textContent = card.power ?? "-";
  document.getElementById("modalHit").textContent = card.hit ?? "-";
  document.getElementById("modalText").innerHTML = decorateCardText(card.text);
  document.getElementById("modalFlavor").textContent = card.flavor || "";

  document.getElementById("cardModal").classList.add("show");
}

function closeModal() {
  document.getElementById("cardModal").classList.remove("show");
}

document.getElementById("cardModal").addEventListener("click", event => {
  if (event.target.id === "cardModal") {
    closeModal();
  }
});

function decorateCardText(text) {
  let safeText = escapeHtml(text || "");

  safeText = safeText.replace(/【([^】]+)】/g, (match, label) => {
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

    return `<span class="tag ${className}">${label}</span>`;
  });

  safeText = safeText.replace(/\[トリガー\]/g, '<span class="tag tag-trigger">トリガー</span>');

  return safeText;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}