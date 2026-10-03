const { SUPABASE_URL, SUPABASE_KEY, TZ } = window.APP_CONFIG;
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);
const fmtTime = new Intl.DateTimeFormat("es-UY", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

function loginError(text) {
  $("loginMsg").textContent = text;
  $("loginMsg").classList.remove("hidden");
}

async function showPanelIfAdmin() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return;
  const { data: adminRow } = await db.from("admins").select("user_id").maybeSingle();
  if (!adminRow) {
    await db.auth.signOut();
    return loginError("Esta cuenta no tiene permiso para ver el panel.");
  }
  $("loginBox").classList.add("hidden");
  $("panel").classList.remove("hidden");
  $("day").value = today();
  loadDay();
}

async function loadDay() {
  const day = $("day").value;
  const from = new Date(`${day}T00:00:00-03:00`).toISOString();
  const to = new Date(`${day}T23:59:59-03:00`).toISOString();
  const { data, error } = await db
    .from("appointments")
    .select("id,starts_at,customer_name,customer_phone,status,barbers(name),services(name)")
    .gte("starts_at", from).lte("starts_at", to)
    .order("starts_at");
  const list = $("list");
  list.innerHTML = "";
  if (error) { list.textContent = "No se pudo cargar la agenda."; return; }
  if (!data.length) { list.innerHTML = '<p class="empty">No hay turnos este día.</p>'; return; }

  data.forEach((a) => {
    const row = document.createElement("div");
    row.className = "appt" + (a.status === "cancelled" ? " cancelled" : "");

    const info = document.createElement("div");
    const time = document.createElement("div");
    time.className = "time";
    time.textContent = `${fmtTime.format(new Date(a.starts_at))} · ${a.barbers?.name ?? ""}`;
    const who = document.createElement("div");
    who.textContent = `${a.customer_name} — ${a.services?.name ?? ""}`;
    const meta = document.createElement("div");
    meta.className = "meta";
    const wa = document.createElement("a");
    wa.href = "https://wa.me/598" + a.customer_phone.replace(/\D/g, "").replace(/^0/, "");
    wa.textContent = a.customer_phone;
    wa.target = "_blank";
    wa.rel = "noopener";
    wa.style.color = "inherit";
    meta.append(wa);
    info.append(time, who, meta);
    row.append(info);

    if (a.status === "confirmed") {
      const btn = document.createElement("button");
      btn.className = "btn small danger";
      btn.textContent = "Cancelar";
      btn.addEventListener("click", async () => {
        if (!confirm("¿Cancelar este turno?")) return;
        await db.from("appointments").update({ status: "cancelled" }).eq("id", a.id);
        loadDay();
      });
      row.append(btn);
    }
    list.append(row);
  });
}

$("loginForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  $("loginMsg").classList.add("hidden");
  const { error } = await db.auth.signInWithPassword({ email: $("email").value, password: $("password").value });
  if (error) return loginError("Email o contraseña incorrectos.");
  $("password").value = "";
  showPanelIfAdmin();
});

$("day").addEventListener("change", loadDay);
$("logout").addEventListener("click", async () => {
  await db.auth.signOut();
  location.reload();
});

showPanelIfAdmin();
