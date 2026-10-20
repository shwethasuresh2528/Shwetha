const STORAGE_KEY = "foodshare_donations_v2";
let donations = loadDonations();
let toastTimer;

const $ = (id) => document.getElementById(id);
const form = $("donationForm");
const foodList = $("foodList");

function loadDonations() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    return [];
  }
}
function saveDonations() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(donations));
}
function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}
function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[char]);
}
function currentStatus(donation) {
  if (donation.status !== "Completed" && new Date(donation.deadline).getTime() < Date.now()) return "Expired";
  return donation.status;
}
function statusClass(status) {
  return ({Available:"status-available", Requested:"status-requested", Completed:"status-completed", Expired:"status-expired"})[status] || "status-available";
}
function updateDashboard() {
  $("totalDonations").textContent = donations.length;
  $("availableCount").textContent = donations.filter(d => currentStatus(d) === "Available").length;
  $("completedCount").textContent = donations.filter(d => d.status === "Completed").length;
  $("totalServings").textContent = donations.reduce((sum, d) => sum + Number(d.quantity || 0), 0).toLocaleString();
  $("completedServings").textContent = donations.filter(d => d.status === "Completed").reduce((sum, d) => sum + Number(d.quantity || 0), 0).toLocaleString();
}
function updateLocationFilter() {
  const select = $("locationFilter");
  const oldValue = select.value;
  const locations = [...new Set(donations.map(d => d.location.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  select.innerHTML = '<option value="">All locations</option>' + locations.map(loc => `<option value="${escapeText(loc)}">${escapeText(loc)}</option>`).join("");
  if (locations.includes(oldValue)) select.value = oldValue;
}
function filteredDonations() {
  const query = $("searchInput").value.trim().toLowerCase();
  const category = $("categoryFilter").value;
  const status = $("statusFilter").value;
  const location = $("locationFilter").value;
  return donations.filter(d => {
    const matchesQuery = [d.foodName, d.donorName, d.location, d.notes, d.category].some(value => String(value || "").toLowerCase().includes(query));
    const actualStatus = currentStatus(d);
    return matchesQuery && (!category || d.category === category) && (!status || actualStatus === status) && (!location || d.location === location);
  }).sort((a,b) => new Date(a.deadline) - new Date(b.deadline));
}
function renderDonations() {
  updateDashboard();
  updateLocationFilter();
  const items = filteredDonations();
  $("resultsCount").textContent = `${items.length} donation${items.length === 1 ? "" : "s"}`;
  foodList.innerHTML = "";
  $("emptyState").classList.toggle("hidden", items.length !== 0);
  foodList.classList.toggle("hidden", items.length === 0);

  items.forEach(d => {
    const status = currentStatus(d);
    const emoji = ({"Cooked Food":"🍲","Fruits & Vegetables":"🥦","Bakery Products":"🥖","Packaged Food":"🥫","Other":"🍱"})[d.category] || "🍱";
    const card = document.createElement("article");
    card.className = "donation-card";
    card.innerHTML = `
      <div class="card-top"><div class="food-symbol">${emoji}</div><span class="status-pill ${statusClass(status)}">${escapeText(status)}</span></div>
      <h3>${escapeText(d.foodName)}</h3><div class="category-text">${escapeText(d.category)}</div>
      <div class="donation-meta">
        <p>🍽️ <b>${Number(d.quantity).toLocaleString()} servings</b></p>
        <p>🏪 Donor: <b>${escapeText(d.donorName)}</b></p>
        <p>📍 ${escapeText(d.location)}</p>
        <p>⏰ Deadline: <b>${escapeText(new Date(d.deadline).toLocaleString())}</b></p>
      </div>
      ${d.notes ? `<p class="donation-notes">Note: ${escapeText(d.notes)}</p>` : ""}
      <div class="card-actions">
        ${status === "Available" ? `<button class="mini-btn primary" data-action="request" data-id="${d.id}">Mark requested</button>` : ""}
        ${status === "Requested" ? `<button class="mini-btn primary" data-action="complete" data-id="${d.id}">Mark collected</button>` : ""}
        <button class="mini-btn" data-action="edit" data-id="${d.id}">✎ Edit</button>
        <button class="mini-btn danger" data-action="delete" data-id="${d.id}">Delete</button>
      </div>`;
    foodList.appendChild(card);
  });
}
function resetForm() {
  form.reset();
  $("editId").value = "";
  $("formHeading").textContent = "Add a food donation";
  $("submitBtn").textContent = "Publish donation →";
  $("cancelEditBtn").classList.add("hidden");
}
function setMinimumDeadline() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  $("deadline").min = now.toISOString().slice(0,16);
}
form.addEventListener("submit", event => {
  event.preventDefault();
  const id = $("editId").value;
  const deadline = $("deadline").value;
  if (new Date(deadline).getTime() <= Date.now()) {
    showToast("Please select a future collection deadline.");
    $("deadline").focus();
    return;
  }
  const donation = {
    id: id ? Number(id) : Date.now(),
    foodName: $("foodName").value.trim(),
    category: $("category").value,
    quantity: Number($("quantity").value),
    donorName: $("donorName").value.trim(),
    location: $("location").value.trim(),
    deadline,
    notes: $("notes").value.trim(),
    status: "Available",
    createdAt: id ? (donations.find(d => d.id === Number(id))?.createdAt || new Date().toISOString()) : new Date().toISOString()
  };
  if (!donation.foodName || !donation.donorName || !donation.location || donation.quantity < 1) {
    showToast("Please complete all required fields.");
    return;
  }
  if (id) {
    const index = donations.findIndex(d => d.id === Number(id));
    if (index >= 0) {
      donation.status = donations[index].status;
      donations[index] = donation;
      showToast("Donation updated successfully.");
    }
  } else {
    donations.unshift(donation);
    showToast("Donation published successfully.");
  }
  saveDonations();
  resetForm();
  renderDonations();
  $("available").scrollIntoView({behavior:"smooth"});
});
$("cancelEditBtn").addEventListener("click", resetForm);
foodList.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = Number(button.dataset.id);
  const donation = donations.find(d => d.id === id);
  if (!donation) return;
  switch(button.dataset.action) {
    case "request":
      if (currentStatus(donation) !== "Available") return showToast("This donation is no longer available.");
      donation.status = "Requested";
      showToast("Donation marked as requested.");
      break;
    case "complete":
      if (currentStatus(donation) !== "Requested") return showToast("Only requested donations can be marked collected.");
      donation.status = "Completed";
      showToast("Donation marked as collected.");
      break;
    case "edit":
      $("editId").value = donation.id;
      $("foodName").value = donation.foodName;
      $("category").value = donation.category;
      $("quantity").value = donation.quantity;
      $("donorName").value = donation.donorName;
      $("location").value = donation.location;
      $("deadline").value = donation.deadline;
      $("notes").value = donation.notes || "";
      $("formHeading").textContent = "Edit food donation";
      $("submitBtn").textContent = "Save changes →";
      $("cancelEditBtn").classList.remove("hidden");
      $("donate").scrollIntoView({behavior:"smooth"});
      return;
    case "delete":
      if (!confirm(`Delete the donation "${donation.foodName}"?`)) return;
      donations = donations.filter(d => d.id !== id);
      showToast("Donation deleted.");
      break;
  }
  saveDonations();
  renderDonations();
});
["searchInput","categoryFilter","statusFilter","locationFilter"].forEach(id => $(id).addEventListener(id === "searchInput" ? "input" : "change", renderDonations));
$("clearFiltersBtn").addEventListener("click", () => {
  $("searchInput").value = "";
  $("categoryFilter").value = "";
  $("statusFilter").value = "";
  $("locationFilter").value = "";
  renderDonations();
});
$("exportBtn").addEventListener("click", () => {
  if (!donations.length) return showToast("There are no donations to export yet.");
  const columns = ["Food Name","Category","Quantity (servings)","Donor","Location","Deadline","Status","Notes"];
  const rows = donations.map(d => [d.foodName,d.category,d.quantity,d.donorName,d.location,new Date(d.deadline).toLocaleString(),currentStatus(d),d.notes || ""]);
  const csvCell = value => `"${String(value ?? "").replace(/"/g,'""')}"`;
  const csv = [columns, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "foodshare-donations.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Donation report downloaded as CSV.");
});
$("themeToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const dark = document.body.classList.contains("dark");
  $("themeToggle").innerHTML = dark ? "☀ <span>Light mode</span>" : "☾ <span>Dark mode</span>";
  localStorage.setItem("foodshare_theme", dark ? "dark" : "light");
});
if (localStorage.getItem("foodshare_theme") === "dark") {
  document.body.classList.add("dark");
  $("themeToggle").innerHTML = "☀ <span>Light mode</span>";
}
$("menuToggle").addEventListener("click", () => $("mainNav").classList.toggle("open"));
document.querySelectorAll(".nav-link").forEach(link => link.addEventListener("click", () => $("mainNav").classList.remove("open")));
window.addEventListener("scroll", () => $("backTop").classList.toggle("show", window.scrollY > 450));
$("backTop").addEventListener("click", () => window.scrollTo({top:0,behavior:"smooth"}));
setMinimumDeadline();
renderDonations();
