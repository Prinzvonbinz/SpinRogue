"use strict";

const circle = document.getElementById("circle");
const goldDisplay = document.getElementById("gold");
const openChestBtn = document.getElementById("open-chest");
const resetBtn = document.getElementById("reset-game");
const chestModal = document.getElementById("chest-modal");
const cardsContainer = document.getElementById("cards-container");
const closeChestBtn = document.getElementById("close-chest");
const upgradesUl = document.getElementById("upgrades-ul");

let gold = 0;
let circleSpeed = 0.2; // Umdrehungen pro Sekunde
let rotation = 0; // Grad
let lastTimestamp = null;
let goldPerRotation = 3;
let animationFrameId = null;

let chestOpenedCount = 0;
const chestCostBase = 3;

let upgrades = {}; // key: cardId, value: level (Anzahl)


/**
 * Karten-Pool mit Seltenheiten & Werte
 * level multipliziert den Wert (für Mehrfachkarten)
 */
const cardsPool = [
  {
    id: "turbo",
    title: "Turbo",
    descBase: "+0.5 U/s Drehgeschwindigkeit",
    rarity: "gray",
    baseValue: 0.5,
    applyEffect: lvl => {
      circleSpeed += 0.5 * lvl;
    },
  },
  {
    id: "gewinn",
    title: "Gewinn",
    descBase: "+1 Gold pro Umdrehung",
    rarity: "blue",
    baseValue: 1,
    applyEffect: lvl => {
      goldPerRotation += 1 * lvl;
    },
  },
  {
    id: "aktion",
    title: "Aktion",
    descBase: "+10% mehr Gold",
    rarity: "blue",
    baseValue: 0.1,
    applyEffect: lvl => {
      goldPerRotation *= 1 + 0.1 * lvl;
    },
  },
  {
    id: "magnet",
    title: "Magnet",
    descBase: "+5% Chance auf Bonusgold",
    rarity: "purple",
    baseValue: 0.05,
    applyEffect: lvl => {
      // Wird in der Drehschleife berechnet
    },
  },
  {
    id: "power",
    title: "Power",
    descBase: "10% Chance, für 5 Sek. doppelte Drehung",
    rarity: "purple",
    baseValue: 0.1,
    applyEffect: lvl => {
      // Wird als temporärer Effekt umgesetzt
    },
  },
  {
    id: "zinsen",
    title: "Zinsen",
    descBase: "+2 Gold pro Minute passiv",
    rarity: "gold",
    baseValue: 2,
    applyEffect: lvl => {
      // Passiv wird separat getaktet
    },
  },
];

function getCardById(id) {
  return cardsPool.find((c) => c.id === id);
}

function getChestCost() {
  // exponentiell steigend: 3 + 3^chestOpenedCount
  return chestCostBase + (3 *chestOpenedCount);
  function increaseChestPrice() {
    if (chestPrice >= 100000) {
        chestPrice += 10000;
    } else if (chestPrice >= 10000) {
        chestPrice += 100;
    } else if (chestPrice >= 1002) {
        chestPrice += 50;
    } else if (chestPrice >= 602) {
        chestPrice += 25;
    } else if (chestPrice >= 302) {
        chestPrice += 10;
    } else if (chestPrice >= 102) {
        chestPrice += 5;
    } else {
        chestPrice += 3;
    }
  }
}

// Persistenz
function saveState() {
  const saveData = {
    gold,
    circleSpeed,
    upgrades,
    chestOpenedCount,
  };
  localStorage.setItem("spinrogue_save", JSON.stringify(saveData));
}

function loadState() {
  const data = localStorage.getItem("spinrogue_save");
  if (!data) return false;
  try {
    const obj = JSON.parse(data);
    gold = obj.gold || 0;
    circleSpeed = obj.circleSpeed || 0.2;
    upgrades = obj.upgrades || {};
    chestOpenedCount = obj.chestOpenedCount || 0;
    recalcEffects();
    updateOpenChestBtn();
    updateUpgradesList();
    return true;
  } catch {
    return false;
  }
}

function recalcEffects() {
  // Reset
  circleSpeed = 0.2;
  goldPerRotation = 3;

  // Reset Effekte, dann addiere alle Upgrades
  for (const [id, lvl] of Object.entries(upgrades)) {
    const card = getCardById(id);
    if (card) {
      card.applyEffect(lvl);
    }
  }
}

// Gold pro Sekunde passiv durch Zinseszins
function updatePassiveGold(dt) {
  if (!upgrades["zinseszins"]) return 0;
  const lvl = upgrades["zinseszins"];
  const goldPerMinute = 2 * lvl;
  return (goldPerMinute / 60) * dt;
}

// Visuelle Stufen für Kreisfarbe je nach Drehgeschwindigkeit
function updateCircleColor() {
  if (circleSpeed < 0.7) {
    circle.style.borderColor = getComputedStyle(document.documentElement).getPropertyValue("--circle-stage1");
  } else if (circleSpeed < 1.5) {
    circle.style.borderColor = getComputedStyle(document.documentElement).getPropertyValue("--circle-stage2");
  } else {
    circle.style.borderColor = getComputedStyle(document.documentElement).getPropertyValue("--circle-stage3");
  }
}

// Kreis Rotation & Gold-Berechnung
let doubleSpinActive = false;
let doubleSpinTimer = 0;
function gameLoop(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const dt = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  // Update Drehung (Grad)
  let speedNow = circleSpeed;
  if (doubleSpinActive) speedNow *= 2;

  rotation += speedNow * 360 * dt;
  if (rotation >= 360) {
    rotation -= 360;
    // Pro Umdrehung Gold verdienen
    let goldGain = goldPerRotation;

    // Magnet Bonus (5% pro Level)
    if (upgrades["magnet"]) {
      for (let i = 0; i < upgrades["magnet"]; i++) {
        if (Math.random() < 0.05) {
          goldGain += 1; // Bonusgold +1
        }
      }
    }

    gold += goldGain;
    gold = Math.floor(gold);
    goldDisplay.textContent = gold;
    updateOpenChestBtn();
  }

  if (doubleSpinActive) {
    doubleSpinTimer -= dt;
    if (doubleSpinTimer <= 0) {
      doubleSpinActive = false;
    }
  }

  // Passive Gold (zinseszins)
  gold += updatePassiveGold(dt);
  gold = Math.floor(gold);
  goldDisplay.textContent = gold;
  updateOpenChestBtn();

  circle.style.transform = `rotate(${rotation}deg)`;
  updateCircleColor();

  animationFrameId = requestAnimationFrame(gameLoop);
}

// Truhe öffnen Button aktivieren
function updateOpenChestBtn() {
  const cost = getChestCost();
  openChestBtn.disabled = gold < cost;
  openChestBtn.textContent = `Truhe öffnen (${cost} Gold)`;
}

// Karten ziehen mit Seltenheit (Gewichtung)
// grau: 60%, blau 25%, lila 12%, gold 3%
function weightedRandomCard() {
  const r = Math.random() * 100;
  let rarity;
  if (r < 60) rarity = "gray";
  else if (r < 85) rarity = "blue";
  else if (r < 97) rarity = "purple";
  else rarity = "gold";

  const pool = cardsPool.filter((c) => c.rarity === rarity);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Truhe öffnen: 3 Karten anzeigen mit Animation
function openChest() {
  const cost = getChestCost();
  if (gold < cost) return;
  gold -= cost;
goldDisplay.textContent = gold;
increaseChestPrice(); // Dynamische Preissteigerung
updateOpenChestBtn();

  chestModal.classList.remove("hidden");
  cardsContainer.innerHTML = "";

  // 3 Karten ziehen
  const drawnCards = [];
  const drawnIds = new Set();

  while (drawnCards.length < 3) {
    const card = weightedRandomCard();
    if (!card) break;
    // Nicht dieselbe Karte doppelt in einer Truhe
    if (drawnIds.has(card.id)) continue;
    drawnCards.push(card);
    drawnIds.add(card.id);
  }

  drawnCards.forEach((card, i) => {
    const div = document.createElement("div");
    div.className = `card ${card.rarity}`;
    // Level der Karte (wenn schon vorhanden)
    const lvl = upgrades[card.id] || 0;
    const descVal = (card.baseValue * (lvl + 1)).toFixed(2);
    div.innerHTML = `<div class="card-title">${card.title}</div>
                     <div class="card-desc">${card.descBase.replace(/\+\d+(\.\d+)?/, `+${descVal}`)}</div>
                     <div class="card-level">Lvl ${lvl + 1}</div>`;
    cardsContainer.appendChild(div);

    // Animation: leichtes Glühen mit Verzögerung
    setTimeout(() => {
      div.style.boxShadow = `0 0 15px var(--card-${card.rarity})`;
    }, 150 * i);

    div.addEventListener("click", () => {
      selectCard(card.id);
    });
  });
}

function selectCard(id) {
  // Upgrade zählen
  if (!upgrades[id]) upgrades[id] = 0;
  upgrades[id]++;

  recalcEffects();
  saveState();
  updateUpgradesList();
  closeChest();
}

function closeChest() {
  chestModal.classList.add("hidden");
}

function updateUpgradesList() {
  upgradesUl.innerHTML = "";
  if (Object.keys(upgrades).length === 0) {
    upgradesUl.innerHTML = "<li>Keine Upgrades ausgewählt.</li>";
    return;
  }
  for (const [id, lvl] of Object.entries(upgrades)) {
    const card = getCardById(id);
    if (!card) continue;
    const val = (card.baseValue * lvl).toFixed(2);
    const li = document.createElement("li");
    li.textContent = `${card.title} (Lvl ${lvl}): +${val} ${card.descBase.replace(/^\+[\d\.]+/, "")}`;
    upgradesUl.appendChild(li);
  }
}

// Reset Game komplett (LocalStorage löschen und neu starten)
function resetGame() {
  if (confirm("Willst du den Spielstand wirklich komplett zurücksetzen?")) {
    localStorage.removeItem("spinrogue_save");
    gold = 0;
    upgrades = {};
    chestOpenedCount = 0;
    circleSpeed = 0.2;
    goldPerRotation = 3;
    rotation = 0;
    goldDisplay.textContent = gold;
    updateOpenChestBtn();
    updateUpgradesList();
    closeChest();
  }
}

// Event Listener
openChestBtn.addEventListener("click", openChest);
closeChestBtn.addEventListener("click", closeChest);
resetBtn.addEventListener("click", resetGame);

// Initialisieren und Spiel starten
function startGame() {
  if (!loadState()) {
    gold = 0;
    upgrades = {};
    chestOpenedCount = 0;
    circleSpeed = 0.2;
    goldPerRotation = 3;
  }
  updateOpenChestBtn();
  updateUpgradesList();
  lastTimestamp = null;
  animationFrameId = requestAnimationFrame(gameLoop);
}

startGame();
