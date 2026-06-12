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
      searchText: [
        card.name,
        card.text,
        card.type,
        card.code,
        card.rarity,
        card.color
      ].join(" ").toLowerCase()
    }));

    currentCards = cards;
    displayCards(currentCards);
  });

document.getElementById("nameSearchBox").addEventListener("input", searchCards);
document.getElementById("textSearchBox").addEventListener("input", searchCards);
document.getElementById("codeSearchBox").addEventListener("input", searchCards);
document.getElementById("typeFilter").addEventListener("change", searchCards);

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

  currentCards = cards.filter(card => {
    const nameMatch = !nameKeyword || card.name.toLowerCase().includes(nameKeyword);
    const textMatch = !textKeyword || card.text.toLowerCase().includes(textKeyword);
    const codeMatch = !codeKeyword || card.code.toLowerCase().includes(codeKeyword);
    const colorMatch = selectedColor === "all" || card.color === selectedColor;
    const typeMatch = !typeValue || card.type.includes(typeValue);

    return nameMatch && textMatch && codeMatch && colorMatch && typeMatch;
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
      <img src="${card.image}" alt="${card.name}" loading="lazy">
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
  document.getElementById("modalColor").textContent = colorNames[card.color] || card.color;
  document.getElementById("modalCost").textContent = card.cost ?? "-";
  document.getElementById("modalPower").textContent = card.power ?? "-";
  document.getElementById("modalHit").textContent = card.hit ?? "-";
  document.getElementById("modalText").textContent = card.text || "";
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