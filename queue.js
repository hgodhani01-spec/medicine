const $ = id => document.getElementById(id);
const showErr = t => { $("msg").textContent = t; $("msg").hidden = !t; };
$("bid").value = new URLSearchParams(location.search).get("id") || "";

$("f").addEventListener("submit", async e => {
  e.preventDefault(); showErr(""); $("out").innerHTML = "";
  const bid = $("bid").value.trim().toUpperCase(), phone = cleanPhone($("phone").value);
  if (!/^QL-[0-9A-F]{8}$/.test(bid)) return showErr("That booking ID doesn't look right. It looks like QL-1A2B3C4D.");
  if (!phone) return showErr("Please enter a valid 10-digit Indian mobile number.");
  const { data, error } = await callDb("queue_status", { p_booking_id: bid, p_phone: phone });
  if (error) return showErr(error);
  const q = data[0], done = q.r_status === "Cancelled" || q.r_status === "Completed";
  $("out").innerHTML = `
    ${q.r_is_demo ? '<div class="demo"><strong>DEMO queue.</strong> The "current token" below is simulated for this prototype.</div>' : ""}
    <div class="card"><h3>${esc(q.r_doctor)}</h3><p class="muted">${fmtDate(q.r_date)} · ${esc(q.r_slot)}</p>
    <p>Status: <span class="badge st-${esc(q.r_status.replace(/ /g, ""))}">${esc(q.r_status)}</span></p>
    <div class="stat"><div><b>#${q.r_token}</b>Your token</div><div><b>#${q.r_current}</b>Now serving${q.r_is_demo ? " (demo)" : ""}</div>
    ${done ? "" : `<div><b>${q.r_ahead}</b>Patients ahead</div><div><b>~${q.r_wait} min</b>Estimated wait</div>`}</div>
    <p class="muted">${done ? "This appointment is no longer in the queue." : "Estimate assumes about 10 minutes per patient."}</p></div>`;
});
