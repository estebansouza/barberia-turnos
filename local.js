const { SUPABASE_URL, SUPABASE_KEY } = window.APP_CONFIG;
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);

const hhmm = (t) => t.slice(0, 5);

function line(left, right) {
  const row = document.createElement("div");
  row.className = "line";
  const a = document.createElement("span");
  a.textContent = left;
  const b = document.createElement("strong");
  b.textContent = right;
  row.append(a, b);
  return row;
}

async function init() {
  const slug = window.getShopSlug();
  const { data: shop } = await db.from("shops")
    .select("id,name,whatsapp,accent,address,description,instagram,logo_path")
    .eq("slug", slug).maybeSingle();
  if (!shop) {
    $("notFound").classList.remove("hidden");
    return;
  }

  document.title = `${shop.name} | Servicios, horarios y ubicación`;
  document.documentElement.style.setProperty("--accent", shop.accent);
  $("shopName").textContent = shop.name;
  $("description").textContent = shop.description || "";
  if (shop.logo_path) {
    $("logo").src = mediaUrl(shop.logo_path);
    $("logo").classList.remove("hidden");
  }
  $("bookTop").href = $("bookBottom").href = `/${slug}`;

  if (shop.address) {
    $("address").textContent = shop.address;
    $("address").classList.remove("hidden");
    $("mapLink").href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(`${shop.address} ${shop.name}`);
    $("mapLink").classList.remove("hidden");
  }
  if (shop.whatsapp) {
    $("waLink").href = "https://wa.me/" + shop.whatsapp;
    $("waLink").classList.remove("hidden");
  }
  if (shop.instagram) {
    $("instaLink").href = "https://instagram.com/" + shop.instagram;
    $("instaLink").classList.remove("hidden");
  }

  const [services, barbers, hours, photos] = await Promise.all([
    db.from("services").select("name,duration_min,price_uyu").eq("shop_id", shop.id).order("price_uyu"),
    db.from("barbers").select("name,photo_path").eq("shop_id", shop.id).order("name"),
    db.from("business_hours").select("weekday,open_time,close_time").eq("shop_id", shop.id),
    db.from("shop_photos").select("path").eq("shop_id", shop.id).order("created_at")
  ]);

  (services.data || []).forEach((s) => $("services").append(line(`${s.name} · ${s.duration_min} min`, `$${s.price_uyu}`)));
  if (!(services.data || []).length) $("services").innerHTML = '<p class="empty">Consultanos por WhatsApp.</p>';

  const team = barbers.data || [];
  team.forEach((b) => {
    const m = document.createElement("div");
    m.className = "member";
    if (b.photo_path) {
      const img = document.createElement("img");
      img.src = mediaUrl(b.photo_path);
      img.alt = b.name;
      img.loading = "lazy";
      m.append(img);
    }
    m.append(b.name);
    $("barbers").append(m);
  });
  $("barbersBox").classList.toggle("hidden", !team.length);

  const byDay = new Map((hours.data || []).map((h) => [h.weekday, h]));
  [1, 2, 3, 4, 5, 6, 0].forEach((wd) => {
    const h = byDay.get(wd);
    $("hours").append(line(window.WEEKDAYS[wd], h ? `${hhmm(h.open_time)} – ${hhmm(h.close_time)}` : "Cerrado"));
  });

  const pics = photos.data || [];
  pics.forEach((p) => {
    const img = document.createElement("img");
    img.src = mediaUrl(p.path);
    img.alt = `Foto de ${shop.name}`;
    img.loading = "lazy";
    $("gallery").append(img);
  });
  $("galleryBox").classList.toggle("hidden", !pics.length);

  $("page").classList.remove("hidden");
}

init();
