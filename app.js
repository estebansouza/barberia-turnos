const { SUPABASE_URL, SUPABASE_KEY, TZ } = window.APP_CONFIG;
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const state = { shop: null, service: null, barber: null, day: null, slot: null };
const $ = (id) => document.getElementById(id);

const fmtTime = new Intl.DateTimeFormat("es-UY", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const fmtLong = new Intl.DateTimeFormat("es-UY", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });

function chip(text, sub, onClick, imgPath) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip";
  if (imgPath) {
    const img = document.createElement("img");
    img.className = "avatar";
    img.src = mediaUrl(imgPath);
    img.alt = "";
    b.append(img);
  }
  b.append(text);
  if (sub) {
    const s = document.createElement("small");
    s.textContent = sub;
    b.append(s);
  }
  b.addEventListener("click", () => {
    b.parentElement.querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
    b.classList.add("selected");
    onClick();
  });
  return b;
}

function enable(id, on = true) {
  $(id).classList.toggle("disabled", !on);
}

function showMsg(text, kind) {
  const el = $("result");
  el.textContent = text;
  el.className = "msg " + kind;
}

// Próximos n días en hora de Montevideo, como "YYYY-MM-DD"
function nextDays(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.now() + i * 86400000);
    out.push(new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d));
  }
  return out;
}

function notFound() {
  $("booking").classList.add("hidden");
  $("notFound").classList.remove("hidden");
  $("shopName").textContent = "Turnos online";
}

async function init() {
  const slug = window.getShopSlug();
  const { data: shop, error: eShop } = await db
    .from("shops").select("id,name,whatsapp,accent,logo_path").eq("slug", slug).maybeSingle();
  if (eShop || !shop) return notFound();
  state.shop = shop;

  document.title = `Reservá tu turno | ${shop.name}`;
  $("shopName").textContent = shop.name;
  document.documentElement.style.setProperty("--accent", shop.accent);
  $("infoLink").href = `/${slug}/info`;
  $("infoLink").classList.remove("hidden");
  if (shop.logo_path) {
    $("shopLogo").src = mediaUrl(shop.logo_path);
    $("shopLogo").classList.remove("hidden");
  }
  if (shop.whatsapp) {
    $("waLink").href = "https://wa.me/" + shop.whatsapp;
    $("waLink").classList.remove("hidden");
  }

  const [{ data: services, error: e1 }, { data: barbers, error: e2 }] = await Promise.all([
    db.from("services").select("id,name,duration_min,price_uyu").eq("shop_id", shop.id).order("price_uyu"),
    db.from("barbers").select("id,name,photo_path").eq("shop_id", shop.id).order("name")
  ]);
  if (e1 || e2) {
    $("services").textContent = "No se pudo cargar. Probá de nuevo en un momento.";
    return;
  }

  $("services").innerHTML = "";
  services.forEach((s) =>
    $("services").append(chip(s.name, `${s.duration_min} min · $${s.price_uyu}`, () => {
      state.service = s; state.barber = state.day = state.slot = null;
      resetFrom("barber");
      enable("stepBarber");
    }))
  );

  $("barbers").innerHTML = "";
  barbers.forEach((b) =>
    $("barbers").append(chip(b.name, "", () => {
      state.barber = b; state.day = state.slot = null;
      resetFrom("day");
      enable("stepDay");
    }, b.photo_path))
  );

  const fmtChip = new Intl.DateTimeFormat("es-UY", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
  $("days").innerHTML = "";
  nextDays(14).forEach((iso) => {
    const label = fmtChip.format(new Date(iso + "T12:00:00-03:00"));
    $("days").append(chip(label, "", () => {
      state.day = iso; state.slot = null;
      resetFrom("time");
      loadSlots();
    }));
  });
}

function resetFrom(step) {
  if (step === "barber") { $("barbers").querySelectorAll(".chip").forEach((c) => c.classList.remove("selected")); }
  if (["barber", "day"].includes(step)) {
    $("days").querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
    enable("stepDay", false);
  }
  $("times").innerHTML = "";
  enable("stepTime", false);
  enable("stepData", false);
  $("result").className = "msg hidden";
}

async function loadSlots() {
  enable("stepTime");
  $("times").innerHTML = '<span class="empty">Buscando horarios…</span>';
  const { data, error } = await db.rpc("get_available_slots", {
    p_barber: state.barber.id, p_service: state.service.id, p_day: state.day
  });
  $("times").innerHTML = "";
  if (error) { $("times").innerHTML = '<span class="empty">No se pudieron cargar los horarios.</span>'; return; }
  if (!data.length) { $("times").innerHTML = '<span class="empty">No hay horarios libres ese día. Probá con otro día u otro barbero.</span>'; return; }
  data.forEach((row) =>
    $("times").append(chip(fmtTime.format(new Date(row.slot_start)), "", () => {
      state.slot = row.slot_start;
      enable("stepData");
    }))
  );
}

$("form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const name = $("name").value.trim();
  const phone = $("phone").value.trim();
  if (name.length < 2) return showMsg("Escribí tu nombre.", "error");
  if (!/^[0-9+ ]{8,16}$/.test(phone)) return showMsg("Escribí un celular válido (solo números).", "error");

  $("submit").disabled = true;
  const { error } = await db.rpc("book_appointment", {
    p_barber: state.barber.id, p_service: state.service.id, p_starts: state.slot, p_name: name, p_phone: phone
  });
  $("submit").disabled = false;

  if (error) {
    showMsg(error.message.includes("disponible") ? "Ese horario se acaba de ocupar. Elegí otro." : "No se pudo reservar. Probá de nuevo.", "error");
    if (error.message.includes("disponible")) loadSlots();
    return;
  }
  const when = fmtLong.format(new Date(state.slot)) + " a las " + fmtTime.format(new Date(state.slot));
  showMsg(`¡Listo, ${name}! Tu turno de ${state.service.name} con ${state.barber.name} es el ${when}.`, "ok");
  $("form").reset();
  loadSlots();
});

init();
