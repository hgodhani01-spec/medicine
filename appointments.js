const $ = id => document.getElementById(id);
const showErr = t => { $("msg").textContent = t; $("msg").hidden = !t; };
let current = null;
$("bid").value = new URLSearchParams(location.search).get("id") || "";

$("f").addEventListener("submit", async e => {
  e.preventDefault(); showErr(""); $("out").innerHTML = "";
  const bid = $("bid").value.trim().toUpperCase(), phone = cleanPhone($("phone").value);
  if (!/^QL-[0-9A-F]{8}$/.test(bid)) return showErr("That booking ID doesn't look right. It looks like QL-1A2B3C4D.");
  if (!phone) return showErr("Please enter a valid 10-digit Indian mobile number.");
  const { data, error } = await callDb("lookup_appointment", { p_booking_id: bid, p_phone: phone });
  if (error) return showErr(error);
  if (!data.length) return showErr("No appointment found. Check your booking ID and phone number.");
  current = { bid, phone }; draw(data[0]);
});

function draw(a) {
  const canCancel = a.status === "Booked" || a.status === "Waiting";
  $("out").innerHTML = apptHtml(a) + `<p>${canCancel ? '<button class="btn danger" id="cx">Cancel appointment</button> ' : ""}<a class="btn ghost" href="queue.html">Track queue</a></p>`;
  if (canCancel) $("cx").onclick = async () => {
    if (!confirm("Cancel this appointment? This cannot be undone.")) return;
    const r = await callDb("cancel_appointment", { p_booking_id: current.bid, p_phone: current.phone });
    if (r.error) return showErr(r.error);
    const again = await callDb("lookup_appointment", { p_booking_id: current.bid, p_phone: current.phone });
    if (again.data && again.data.length) draw(again.data[0]);
    $("out").insertAdjacentHTML("afterbegin", '<div class="success">Your appointment has been cancelled.</div>');
  };
}
