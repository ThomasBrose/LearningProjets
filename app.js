const STORAGE_KEY = "inventory-app-v1";

const demoSeed = {
  items: [
    {
      id: crypto.randomUUID(),
      name: "Rose Stem Bundle",
      sku: "ROS-001",
      type: "Raw Material",
      zone: "Flowers",
      supplier: "Bloom Source",
      minStock: 60,
    },
    {
      id: crypto.randomUUID(),
      name: "Potting Soil 20L",
      sku: "SOI-010",
      type: "Consumable",
      zone: "Plants",
      supplier: "GreenBulk",
      minStock: 40,
    },
  ],
  movements: [],
};

const flowLabels = {
  purchasing: "Purchasing",
  receiving: "Receiving",
  storage: "Storage transfer",
  production: "Production",
  delivery: "Delivery",
  internal_use: "Internal use",
  selling: "Selling",
  disposal_waste: "Waste disposal",
  return_customer: "Return to customer",
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(demoSeed);
  try {
    return JSON.parse(saved);
  } catch {
    return structuredClone(demoSeed);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

const itemForm = document.getElementById("itemForm");
const transactionForm = document.getElementById("transactionForm");
const productSelect = document.getElementById("productSelect");
const flowSelect = document.getElementById("flowSelect");
const inventoryBody = document.getElementById("inventoryBody");
const transactionBody = document.getElementById("transactionBody");
const kpis = document.getElementById("kpis");
const kpiTemplate = document.getElementById("kpiTemplate");
const secondaryZoneWrap = document.getElementById("secondaryZoneWrap");
const productionModeWrap = document.getElementById("productionModeWrap");
const resetDataButton = document.getElementById("resetData");

transactionForm.elements.date.valueAsDate = new Date();

function getMovementsForItem(itemId) {
  return state.movements.filter((m) => m.productId === itemId);
}

function calculateOnHand(item) {
  const movements = getMovementsForItem(item.id);
  let qty = 0;

  for (const m of movements) {
    const q = Number(m.quantity);

    if (m.flow === "storage") {
      if (m.zone === item.zone) qty -= q;
      if (m.secondaryZone === item.zone) qty += q;
      continue;
    }

    if (m.flow === "production") {
      qty += m.productionMode === "produce" ? q : -q;
      continue;
    }

    if (["purchasing", "receiving"].includes(m.flow)) qty += q;
    if (["delivery", "internal_use", "selling", "disposal_waste", "return_customer"].includes(m.flow)) qty -= q;
  }

  return qty;
}

function statusBadge(onHand, minStock) {
  if (onHand <= minStock) return `<span class="badge low">Low</span>`;
  return `<span class="badge ok">Healthy</span>`;
}

function renderKpis() {
  const inventory = state.items.map((item) => ({ item, onHand: calculateOnHand(item) }));
  const totalStock = inventory.reduce((acc, x) => acc + x.onHand, 0);
  const lowItems = inventory.filter((x) => x.onHand <= Number(x.item.minStock)).length;
  const flowersStock = inventory.filter((x) => x.item.zone === "Flowers").reduce((a, b) => a + b.onHand, 0);
  const plantsStock = inventory.filter((x) => x.item.zone === "Plants").reduce((a, b) => a + b.onHand, 0);

  const cards = [
    ["Total items", String(state.items.length)],
    ["Units in stock", String(totalStock)],
    ["Low stock alerts", String(lowItems)],
    ["Flowers zone", String(flowersStock)],
    ["Plants zone", String(plantsStock)],
    ["Movements", String(state.movements.length)],
  ];

  kpis.innerHTML = "";
  cards.forEach(([label, value]) => {
    const node = kpiTemplate.content.cloneNode(true);
    node.querySelector("h3").textContent = value;
    node.querySelector("p").textContent = label;
    kpis.appendChild(node);
  });
}

function renderInventory() {
  inventoryBody.innerHTML = "";
  for (const item of state.items) {
    const onHand = calculateOnHand(item);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.sku}</td>
      <td>${item.name}</td>
      <td>${item.type}</td>
      <td>${item.zone}</td>
      <td>${onHand}</td>
      <td>${item.minStock}</td>
      <td>${statusBadge(onHand, Number(item.minStock))}</td>
    `;
    inventoryBody.appendChild(row);
  }
}

function renderTransactions() {
  transactionBody.innerHTML = "";
  const productsById = Object.fromEntries(state.items.map((item) => [item.id, item]));

  const latest = [...state.movements].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
  for (const m of latest) {
    const row = document.createElement("tr");
    const productName = productsById[m.productId]?.name || "Unknown";
    const zoneText = m.flow === "storage" ? `${m.zone} → ${m.secondaryZone}` : m.zone;
    row.innerHTML = `
      <td>${m.date}</td>
      <td>${flowLabels[m.flow] || m.flow}</td>
      <td>${productName}</td>
      <td>${m.quantity}</td>
      <td>${zoneText}</td>
      <td>${m.role}</td>
      <td>${m.notes || "-"}</td>
    `;
    transactionBody.appendChild(row);
  }
}

function refreshProductOptions() {
  productSelect.innerHTML = state.items
    .map((item) => `<option value="${item.id}">${item.name} (${item.sku})</option>`)
    .join("");
}

function render() {
  refreshProductOptions();
  renderKpis();
  renderInventory();
  renderTransactions();
  saveState();
}

function toggleFlowFields() {
  secondaryZoneWrap.classList.toggle("hidden", flowSelect.value !== "storage");
  productionModeWrap.classList.toggle("hidden", flowSelect.value !== "production");
}

itemForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(itemForm);
  const item = {
    id: crypto.randomUUID(),
    name: formData.get("name").toString().trim(),
    sku: formData.get("sku").toString().trim().toUpperCase(),
    type: formData.get("type"),
    zone: formData.get("zone"),
    supplier: formData.get("supplier").toString().trim(),
    minStock: Number(formData.get("minStock")),
  };

  state.items.push(item);
  itemForm.reset();
  itemForm.elements.minStock.value = "0";
  render();
});

transactionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!state.items.length) {
    alert("Create at least one product before recording movements.");
    return;
  }

  const formData = new FormData(transactionForm);
  const movement = {
    id: crypto.randomUUID(),
    date: formData.get("date"),
    productId: formData.get("productId"),
    flow: formData.get("flow"),
    quantity: Number(formData.get("quantity")),
    zone: formData.get("zone"),
    secondaryZone: formData.get("secondaryZone"),
    productionMode: formData.get("productionMode"),
    role: formData.get("role"),
    notes: formData.get("notes").toString().trim(),
  };

  if (movement.flow === "storage" && movement.zone === movement.secondaryZone) {
    alert("Source and destination zones must be different for a storage transfer.");
    return;
  }

  state.movements.push(movement);
  transactionForm.reset();
  transactionForm.elements.date.valueAsDate = new Date();
  render();
  toggleFlowFields();
});

flowSelect.addEventListener("change", toggleFlowFields);
resetDataButton.addEventListener("click", () => {
  state = structuredClone(demoSeed);
  render();
});

toggleFlowFields();
render();
