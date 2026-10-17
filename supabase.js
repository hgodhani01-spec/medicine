const cfg = window.QL_CONFIG;
const configured = cfg && !cfg.SUPABASE_URL.startsWith("YOUR_");
window.db = configured ? supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

// Returns { data, error } where error is a friendly message string
window.fetchDoctors = async function () {
  if (!window.db) return { data: [], error: "The site isn't connected to the database yet. Add your Supabase keys in js/config.js." };
  const { data, error } = await window.db.from("doctors")
    .select("*").eq("is_active", true).order("name");
  if (error) return { data: [], error: "We couldn't load doctors. Please check your connection and try again." };
  return { data, error: null };
};

// ---- Step 2 helpers ----
window.esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

// Accepts 9876543210, +91 98765 43210, 09876543210 -> "9876543210" (or "" if invalid)
window.cleanPhone = function (v) {
  let d = String(v).replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : "";
};

// Calls a database function. Returns { data, error } with a friendly error message.
window.callDb = async function (fn, args) {
  if (!window.db) return { data: null, error: "The site isn't connected to the database yet. Add your Supabase keys in js/config.js." };
  try {
    const { data, error } = await window.db.rpc(fn, args);
    if (error) {
      // Our own friendly messages come from the database with code P0001
      return { data: null, error: error.code === "P0001" ? error.message : "Something went wrong. Please try again." };
    }
    return { data, error: null };
  } catch (e) {
    return { data: null, error: "Could not reach the server. Please check your internet connection." };
  }
};

window.fmtDate = d => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

window.apptHtml = a => `<div class="card detail">
  <p class="muted">Booking ID</p><p class="big">${esc(a.booking_id)}</p>
  <p><strong>${esc(a.doctor_name)}</strong><br><span class="muted">${esc(a.clinic_name)}</span></p>
  <p>${fmtDate(a.appointment_date)} at <strong>${esc(a.time_slot)}</strong></p>
  <p>Queue token: <strong>#${a.token_number}</strong> · Status: <span class="badge st-${esc(a.status.replace(/ /g, ""))}">${esc(a.status)}</span></p>
  <p class="muted">Patient: ${esc(a.patient_name)}</p></div>`;
