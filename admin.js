const { SUPABASE_URL, SUPABASE_KEY, TZ } = window.APP_CONFIG;
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);
const fmtTime = new Intl.DateTimeFormat("es-UY", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

let shops = [];

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

function loginError(text) {
  $("loginMsg").textContent = text;
  $("loginMsg").classList.remove("hidden");
}

function currentShop() {
  return shops.find((s) => s.id === $("shopSelect").value) || shops[0];
}

async function showPanelIfAdmin() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return;

  const { data, error } = await db.from("shop_admins").select("shop_id, shops(id,name,slug,whatsapp,accent,address,description,instagram,logo_path)");
  shops = (data || []).map((r) => r.shops).filter(Boolean);
  if (error || !shops.length) {
    await db.auth.signOut();
    return loginError("Esta cuenta no tiene permiso para ver el panel.");
  }

  $("shopSelect").innerHTML = "";
  shops.forEach((s) => $("shopSelect").append(new Option(s.name, s.id)));
  $("shopPicker").classList.toggle("hidden", shops.length < 2);

  $("loginBox").classList.add("hidden");
  $("panel").classList.remove("hidden");
  $("day").value = today();
  refreshShop();
}

function refreshShop() {
  showShopLink();
  loadDay();
  loadServices();
  loadBarbers();
  loadHours();
  fillShopForm();
  showLogo();
  loadGallery();
}

function panelMsg(text, kind = "ok") {
  const el = $("panelMsg");
  el.textContent = text;
  el.className = "msg " + kind;
  clearTimeout(panelMsg.t);
  panelMsg.t = setTimeout(() => el.classList.add("hidden"), 4000);
}

function showShopLink() {
  const s = currentShop();
  const url = `${location.origin}/${s.slug}`;
  const p = $("shopLink");
  p.textContent = "Enlace para tus clientes: ";
  const a = document.createElement("a");
  a.href = url; a.textContent = url; a.target = "_blank"; a.rel = "noopener"; a.style.color = "inherit";
  p.append(a);
}

const fmtLong = new Intl.DateTimeFormat("es-UY", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });

// Celular uruguayo ("099 123 456", "+598 99 123 456") -> "59899123456" para wa.me
function waNumber(phone) {
  const d = phone.replace(/\D/g, "");
  return d.startsWith("598") ? d : "598" + d.replace(/^0/, "");
}

function reminderText(a, shop) {
  const when = fmtLong.format(new Date(a.starts_at)) + " a las " + fmtTime.format(new Date(a.starts_at));
  const first = a.customer_name.trim().split(/\s+/)[0];
  return `Hola ${first}! Te recordamos tu turno de ${a.services?.name ?? "barbería"} con ${a.barbers?.name ?? "nosotros"} el ${when} en ${shop.name}. ¿Nos confirmás que venís? ¡Gracias!`;
}

async function loadDay() {
  const shop = currentShop();
  const day = $("day").value;
  const from = new Date(`${day}T00:00:00-03:00`).toISOString();
  const to = new Date(`${day}T23:59:59-03:00`).toISOString();
  const { data, error } = await db
    .from("appointments")
    .select("id,starts_at,customer_name,customer_phone,status,reminded_at,barbers(name),services(name)")
    .eq("shop_id", shop.id)
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
    wa.href = "https://wa.me/" + waNumber(a.customer_phone);
    wa.textContent = a.customer_phone;
    wa.target = "_blank";
    wa.rel = "noopener";
    wa.style.color = "inherit";
    meta.append(wa);
    info.append(time, who, meta);
    row.append(info);

    if (a.status === "confirmed") {
      const actions = document.createElement("div");
      actions.className = "actions";

      // Recordatorio con un clic: abre WhatsApp con el mensaje ya escrito y marca el turno como avisado.
      const remind = document.createElement("a");
      remind.className = "btn small remind" + (a.reminded_at ? " done" : "");
      remind.href = "https://wa.me/" + waNumber(a.customer_phone) + "?text=" + encodeURIComponent(reminderText(a, shop));
      remind.target = "_blank";
      remind.rel = "noopener";
      remind.textContent = a.reminded_at ? "✓ Recordado" : "Recordar";
      remind.addEventListener("click", async () => {
        await db.from("appointments").update({ reminded_at: new Date().toISOString() }).eq("id", a.id);
        remind.classList.add("done");
        remind.textContent = "✓ Recordado";
      });

      const btn = document.createElement("button");
      btn.className = "btn small danger";
      btn.textContent = "Cancelar";
      btn.addEventListener("click", async () => {
        if (!confirm("¿Cancelar este turno?")) return;
        await db.from("appointments").update({ status: "cancelled" }).eq("id", a.id);
        loadDay();
      });
      actions.append(remind, btn);
      row.append(actions);
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

// ---------- Pestañas ----------
$("tabs").addEventListener("click", (ev) => {
  const btn = ev.target.closest(".tab");
  if (!btn) return;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === btn));
  document.querySelectorAll(".tabpane").forEach((p) => p.classList.toggle("hidden", p.id !== "tab-" + btn.dataset.tab));
});

function field(attrs) {
  const i = document.createElement("input");
  Object.assign(i, attrs);
  return i;
}

function actionButton(text, cls, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn small " + cls;
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}

// ---------- Imágenes (Supabase Storage) ----------
// Reduce la foto en el navegador (lado mayor = maxSide) y la sube como JPEG a la carpeta de la barbería.
async function uploadImage(file, maxSide) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
  if (!blob) throw new Error("No se pudo procesar la imagen");
  const path = `${currentShop().id}/${crypto.randomUUID()}.jpg`;
  const { error } = await db.storage.from("shop-media").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return path;
}

function removeFromStorage(path) {
  return db.storage.from("shop-media").remove([path]);
}

// ---------- Logo ----------
function showLogo() {
  const s = currentShop();
  $("logoPreview").classList.toggle("hidden", !s.logo_path);
  $("logoRemove").classList.toggle("hidden", !s.logo_path);
  if (s.logo_path) $("logoPreview").src = mediaUrl(s.logo_path);
}

$("logoFile").addEventListener("change", async (ev) => {
  const file = ev.target.files[0];
  ev.target.value = "";
  if (!file) return;
  const s = currentShop();
  try {
    const path = await uploadImage(file, 600);
    const { error } = await db.from("shops").update({ logo_path: path }).eq("id", s.id);
    if (error) throw error;
    if (s.logo_path) removeFromStorage(s.logo_path);
    s.logo_path = path;
    showLogo();
    panelMsg("Logo guardado.");
  } catch { panelMsg("No se pudo subir el logo. Probá con otra imagen.", "error"); }
});

$("logoRemove").addEventListener("click", async () => {
  const s = currentShop();
  const { error } = await db.from("shops").update({ logo_path: null }).eq("id", s.id);
  if (error) return panelMsg("No se pudo quitar el logo.", "error");
  removeFromStorage(s.logo_path);
  s.logo_path = null;
  showLogo();
});

// ---------- Galería ----------
async function loadGallery() {
  const { data, error } = await db.from("shop_photos")
    .select("id,path").eq("shop_id", currentShop().id).order("created_at");
  const box = $("galleryList");
  box.innerHTML = "";
  if (error) { box.textContent = "No se pudo cargar la galería."; return; }
  if (!data.length) { box.innerHTML = '<p class="empty">Todavía no hay fotos.</p>'; return; }
  data.forEach((p) => {
    const fig = document.createElement("figure");
    const img = document.createElement("img");
    img.src = mediaUrl(p.path);
    img.alt = "Foto de la galería";
    img.loading = "lazy";
    fig.append(img, actionButton("Quitar", "danger", async () => {
      if (!confirm("¿Quitar esta foto?")) return;
      const { error: e } = await db.from("shop_photos").delete().eq("id", p.id);
      if (e) return panelMsg("No se pudo quitar la foto.", "error");
      removeFromStorage(p.path);
      loadGallery();
    }));
    box.append(fig);
  });
}

$("galleryFile").addEventListener("change", async (ev) => {
  const files = [...ev.target.files];
  ev.target.value = "";
  if (!files.length) return;
  const shop_id = currentShop().id;
  let ok = 0;
  for (const f of files) {
    try {
      const path = await uploadImage(f, 1280);
      const { error } = await db.from("shop_photos").insert({ shop_id, path });
      if (error) { removeFromStorage(path); throw error; }
      ok++;
    } catch { /* se cuenta abajo */ }
  }
  if (ok === files.length) panelMsg(ok === 1 ? "Foto agregada." : `${ok} fotos agregadas.`);
  else panelMsg(`Se subieron ${ok} de ${files.length} fotos. Revisá que sean imágenes válidas.`, "error");
  loadGallery();
});

// ---------- Servicios ----------
async function loadServices() {
  const shop = currentShop();
  const { data, error } = await db.from("services")
    .select("id,name,duration_min,price_uyu").eq("shop_id", shop.id).eq("active", true).order("price_uyu");
  const list = $("servicesList");
  list.innerHTML = "";
  if (error) { list.textContent = "No se pudieron cargar los servicios."; return; }
  if (!data.length) { list.innerHTML = '<p class="empty">Todavía no hay servicios.</p>'; return; }

  data.forEach((s) => {
    const row = document.createElement("div");
    row.className = "item";
    const name = field({ value: s.name, maxLength: 60, className: "grow" });
    const dur = field({ type: "number", value: s.duration_min, min: 10, max: 240, step: 5, title: "Minutos" });
    const price = field({ type: "number", value: s.price_uyu, min: 0, step: 10, title: "Precio $" });
    row.append(
      name, dur, price,
      actionButton("Guardar", "", async () => {
        const patch = { name: name.value.trim(), duration_min: Number(dur.value), price_uyu: Number(price.value) };
        const { error: e } = await db.from("services").update(patch).eq("id", s.id);
        if (e) return panelMsg("No se pudo guardar. Revisá nombre (hasta 60), minutos (10–240) y precio.", "error");
        panelMsg("Servicio guardado.");
        loadServices();
      }),
      actionButton("Quitar", "danger", async () => {
        if (!confirm(`¿Quitar "${s.name}"? Los turnos ya reservados se conservan.`)) return;
        const { error: e } = await db.from("services").update({ active: false }).eq("id", s.id);
        if (e) return panelMsg("No se pudo quitar el servicio.", "error");
        loadServices();
      })
    );
    list.append(row);
  });
}

$("serviceForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const row = {
    shop_id: currentShop().id,
    name: $("svName").value.trim(),
    duration_min: Number($("svDur").value),
    price_uyu: Number($("svPrice").value)
  };
  const { error } = await db.from("services").insert(row);
  if (error) return panelMsg("No se pudo agregar. Minutos entre 10 y 240, precio 0 o más.", "error");
  ev.target.reset();
  panelMsg("Servicio agregado.");
  loadServices();
});

// ---------- Barberos ----------
async function loadBarbers() {
  const shop = currentShop();
  const { data, error } = await db.from("barbers")
    .select("id,name,photo_path").eq("shop_id", shop.id).eq("active", true).order("name");
  const list = $("barbersList");
  list.innerHTML = "";
  if (error) { list.textContent = "No se pudieron cargar los barberos."; return; }
  if (!data.length) { list.innerHTML = '<p class="empty">Todavía no hay barberos.</p>'; return; }

  data.forEach((b) => {
    const row = document.createElement("div");
    row.className = "item";
    const name = field({ value: b.name, maxLength: 60, className: "grow" });
    const photo = document.createElement("img");
    photo.className = "thumb" + (b.photo_path ? "" : " hidden");
    photo.alt = "Foto de " + b.name;
    if (b.photo_path) photo.src = mediaUrl(b.photo_path);
    const pick = document.createElement("label");
    pick.className = "btn small filebtn";
    pick.textContent = b.photo_path ? "Cambiar foto" : "Subir foto";
    const file = field({ type: "file", accept: "image/*", hidden: true });
    pick.append(file);
    file.addEventListener("change", async () => {
      if (!file.files[0]) return;
      try {
        const path = await uploadImage(file.files[0], 600);
        const { error: e } = await db.from("barbers").update({ photo_path: path }).eq("id", b.id);
        if (e) throw e;
        if (b.photo_path) removeFromStorage(b.photo_path);
        panelMsg("Foto guardada.");
        loadBarbers();
      } catch { panelMsg("No se pudo subir la foto. Probá con otra imagen.", "error"); }
    });
    row.append(
      photo, name, pick,
      actionButton("Guardar", "", async () => {
        const { error: e } = await db.from("barbers").update({ name: name.value.trim() }).eq("id", b.id);
        if (e) return panelMsg("No se pudo guardar el nombre.", "error");
        panelMsg("Barbero guardado.");
        loadBarbers();
      }),
      actionButton("Quitar", "danger", async () => {
        if (!confirm(`¿Quitar a "${b.name}"? Los turnos ya reservados se conservan.`)) return;
        const { error: e } = await db.from("barbers").update({ active: false }).eq("id", b.id);
        if (e) return panelMsg("No se pudo quitar al barbero.", "error");
        loadBarbers();
      })
    );
    list.append(row);
  });
}

$("barberForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const { error } = await db.from("barbers").insert({ shop_id: currentShop().id, name: $("bbName").value.trim() });
  if (error) return panelMsg("No se pudo agregar al barbero.", "error");
  ev.target.reset();
  panelMsg("Barbero agregado.");
  loadBarbers();
});

// ---------- Horarios ----------
const WEEK = [[1, "Lunes"], [2, "Martes"], [3, "Miércoles"], [4, "Jueves"], [5, "Viernes"], [6, "Sábado"], [0, "Domingo"]];

async function loadHours() {
  const shop = currentShop();
  const { data, error } = await db.from("business_hours").select("weekday,open_time,close_time").eq("shop_id", shop.id);
  const list = $("hoursList");
  list.innerHTML = "";
  if (error) { list.textContent = "No se pudieron cargar los horarios."; return; }
  const byDay = new Map(data.map((h) => [h.weekday, h]));

  WEEK.forEach(([wd, label]) => {
    const h = byDay.get(wd);
    const row = document.createElement("div");
    row.className = "hours-row" + (h ? "" : " closed");
    row.dataset.weekday = wd;
    const lab = document.createElement("label");
    lab.className = "day";
    const check = field({ type: "checkbox", checked: !!h });
    lab.append(check, label);
    const open = field({ type: "time", value: h ? h.open_time.slice(0, 5) : "10:00" });
    const close = field({ type: "time", value: h ? h.close_time.slice(0, 5) : "20:00" });
    check.addEventListener("change", () => row.classList.toggle("closed", !check.checked));
    row.append(lab, open, close);
    list.append(row);
  });
}

$("saveHours").addEventListener("click", async () => {
  const shop_id = currentShop().id;
  const upserts = [];
  const closedDays = [];
  for (const row of $("hoursList").children) {
    const wd = Number(row.dataset.weekday);
    const [check, open, close] = row.querySelectorAll("input");
    if (!check.checked) { closedDays.push(wd); continue; }
    if (!open.value || !close.value || open.value >= close.value) {
      return panelMsg("En cada día abierto, la hora de cierre tiene que ser posterior a la de apertura.", "error");
    }
    upserts.push({ shop_id, weekday: wd, open_time: open.value, close_time: close.value });
  }
  if (upserts.length) {
    const { error } = await db.from("business_hours").upsert(upserts, { onConflict: "shop_id,weekday" });
    if (error) return panelMsg("No se pudieron guardar los horarios.", "error");
  }
  if (closedDays.length) {
    const { error } = await db.from("business_hours").delete().eq("shop_id", shop_id).in("weekday", closedDays);
    if (error) return panelMsg("No se pudieron guardar los días cerrados.", "error");
  }
  panelMsg("Horarios guardados.");
  loadHours();
});

// ---------- Mi local ----------
function fillShopForm() {
  const s = currentShop();
  $("shName").value = s.name;
  $("shWa").value = s.whatsapp || "";
  $("shAccent").value = s.accent || "#c9a24b";
  $("shAddress").value = s.address || "";
  $("shInsta").value = s.instagram || "";
  $("shDesc").value = s.description || "";
}

$("shopForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const s = currentShop();
  const whatsapp = $("shWa").value.replace(/\D/g, "");
  if (whatsapp && (whatsapp.length < 8 || whatsapp.length > 15)) {
    return panelMsg("El WhatsApp debe tener entre 8 y 15 números, con código de país (ej: 59899123456).", "error");
  }
  const instagram = $("shInsta").value.trim().replace(/^@/, "");
  if (instagram && !/^[A-Za-z0-9._]{1,30}$/.test(instagram)) {
    return panelMsg("El usuario de Instagram solo puede tener letras, números, puntos y guiones bajos.", "error");
  }
  const patch = {
    name: $("shName").value.trim(), whatsapp: whatsapp || null, accent: $("shAccent").value,
    address: $("shAddress").value.trim() || null, instagram: instagram || null,
    description: $("shDesc").value.trim() || null
  };
  const { error } = await db.from("shops").update(patch).eq("id", s.id);
  if (error) return panelMsg("No se pudieron guardar los cambios.", "error");
  Object.assign(s, patch);
  $("shopSelect").selectedOptions[0].textContent = patch.name;
  panelMsg("Datos del local guardados.");
});

$("day").addEventListener("change", loadDay);
$("shopSelect").addEventListener("change", refreshShop);
$("logout").addEventListener("click", async () => {
  await db.auth.signOut();
  location.reload();
});

showPanelIfAdmin();
