const $ = id => document.getElementById(id);
const id = (new URLSearchParams(location.search).get("id") || "").trim();
const showErr = t => { $("msg").textContent = t; $("msg").hidden = !t; };

async function show(phone) {
  showErr("");
  const { data, error } = await callDb("lookup_appointment", { p_booking_id: id, p_phone: phone });
  if (error) return showErr(error);
  if (!data.length) { $("f").hidden = false; return showErr("No booking found. Check the phone number you used when booking."); }
  sessionStorage.setItem("ql_phone", phone);
  $("f").hidden = true;
  $("out").innerHTML = `<div class="success">Your appointment is booked. Save your booking ID.</div>${apptHtml(data[0])}
    <p><a class="btn" href="queue.html">Track my queue</a> <a class="btn ghost" href="appointments.html">Manage appointment</a></p>`;
}
if (!id) showErr("No booking ID in this link. Use My appointments to find your booking.");
else { const p = sessionStorage.getItem("ql_phone"); if (p) show(p); else $("f").hidden = false; }
$("f").addEventListener("submit", e => {
  e.preventDefault(); const p = cleanPhone($("phone").value);
  p ? show(p) : showErr("Please enter a valid 10-digit Indian mobile number.");
});
