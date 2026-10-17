const list = document.getElementById("doctor-list");
const msg = document.getElementById("msg");
const q = document.getElementById("q");
const spec = document.getElementById("spec");
let doctors = [];

function card(d) {
  return `<article class="card">
    <span class="badge">Demo listing</span>
    <h3>${d.name}</h3>
    <p class="muted">${d.specialization} · ${d.clinic_name}</p>
    <p><strong>₹${d.consultation_fee}</strong> consultation fee</p>
    <p class="muted">Days: ${d.available_days.join(", ")}</p>
    <a class="btn" href="book.html?doctor=${d.id}">Book Appointment</a>
  </article>`;
}

function render() {
  const text = q.value.trim().toLowerCase();
  const shown = doctors.filter(d =>
    (d.name + " " + d.clinic_name).toLowerCase().includes(text) &&
    (!spec.value || d.specialization === spec.value));
  list.innerHTML = shown.length ? shown.map(card).join("")
    : '<p class="muted">No doctors match your search. Try clearing the filters.</p>';
}

(async () => {
  const { data, error } = await fetchDoctors();
  if (error) { msg.textContent = error; msg.hidden = false; list.innerHTML = ""; return; }
  doctors = data;
  [...new Set(data.map(d => d.specialization))].sort()
    .forEach(s => spec.insertAdjacentHTML("beforeend", `<option>${s}</option>`));
  const p = new URLSearchParams(location.search);
  if (p.get("spec")) spec.value = p.get("spec");
  if (p.get("q")) q.value = p.get("q");
  render();
})();
q.addEventListener("input", render);
spec.addEventListener("change", render);
