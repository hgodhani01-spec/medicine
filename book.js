const $ = id => document.getElementById(id);
const doctorId = new URLSearchParams(location.search).get("doctor");
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
let doctor = null;
const showErr = t => { $("msg").textContent = t; $("msg").hidden = !t; };
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

(async () => {
  if (!window.db) return showErr("The site isn't connected to the database yet. Add your Supabase keys in js/config.js.");
  const ok = /^[0-9a-f-]{36}$/i.test(doctorId || "");
  const res = ok ? await window.db.from("doctors").select("*").eq("id", doctorId).eq("is_active", true).maybeSingle() : {};
  if (!res.data) { $("doc").hidden = true; return showErr("We couldn't find that doctor. Please choose one from the Find a doctor page."); }
  doctor = res.data;
  $("doc").innerHTML = `<span class="badge">Demo listing</span><h3>${esc(doctor.name)}</h3>
    <p class="muted">${esc(doctor.specialization)} · ${esc(doctor.clinic_name)}</p>
    <p><strong>₹${doctor.consultation_fee}</strong> · Days: ${doctor.available_days.map(esc).join(", ")}</p>`;
  const today = new Date(), max = new Date(); max.setDate(max.getDate() + 14);
  $("date").min = iso(today); $("date").max = iso(max);
  $("f").hidden = false;
})();

$("date").addEventListener("change", async () => {
  showErr(""); const v = $("date").value; if (!v) return;
  const day = DAYS[new Date(v + "T00:00:00").getDay()];
  if (!doctor.available_days.includes(day)) { $("slots").innerHTML = `<p class="muted">${esc(doctor.name)} is not available on ${day}. Please pick another date.</p>`; return; }
  $("slots").innerHTML = '<p class="muted">Loading slots…</p>';
  const { data, error } = await callDb("get_slots", { p_doctor_id: doctor.id, p_date: v });
  if (error) { $("slots").innerHTML = ""; return showErr(error); }
  $("slots").innerHTML = data.map(s => `<label><input type="radio" name="slot" value="${esc(s.time_slot)}" ${s.available ? "" : "disabled"}><span>${esc(s.time_slot)}</span></label>`).join("");
});

$("f").addEventListener("submit", async e => {
  e.preventDefault(); showErr("");
  const date = $("date").value, name = $("name").value.trim(), phone = cleanPhone($("phone").value);
  const slot = document.querySelector('input[name="slot"]:checked');
  if (!date) return showErr("Please choose a date.");
  if (!slot) return showErr("Please choose an available time slot.");
  if (name.length < 2) return showErr("Please enter your name.");
  if (!phone) return showErr("Please enter a valid 10-digit Indian mobile number.");
  $("go").disabled = true;
  const { data, error } = await callDb("book_appointment", { p_doctor_id: doctor.id, p_name: name, p_phone: phone, p_date: date, p_slot: slot.value });
  $("go").disabled = false;
  if (error) { showErr(error); $("date").dispatchEvent(new Event("change")); return; }
  sessionStorage.setItem("ql_phone", phone);
  location.href = "confirmation.html?id=" + encodeURIComponent(data[0].r_booking_id);
});
