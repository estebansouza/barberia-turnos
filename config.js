// La clave "publishable" es pública por diseño: la seguridad real está en las reglas (RLS) de la base de datos.
window.APP_CONFIG = {
  SUPABASE_URL: "https://xxkiupgdknnheosewalr.supabase.co",
  SUPABASE_KEY: "sb_publishable_v88bsZ53C3aHmCQF1S-czQ_EtRtFQ3F",
  TZ: "America/Montevideo",
  DEFAULT_SLUG: "demo"
};

// Barbería a mostrar: /donpepe (producción) o ?b=donpepe (pruebas locales). Sin nada, usa la demo.
window.getShopSlug = function () {
  const fromQuery = new URLSearchParams(location.search).get("b");
  if (fromQuery) return fromQuery.toLowerCase();
  const seg = location.pathname.split("/").filter(Boolean)[0];
  if (seg && !seg.includes(".")) return seg.toLowerCase();
  return window.APP_CONFIG.DEFAULT_SLUG;
};

// URL pública de una foto guardada en Supabase Storage (bucket shop-media).
window.mediaUrl = function (path) {
  return path ? `${window.APP_CONFIG.SUPABASE_URL}/storage/v1/object/public/shop-media/${path}` : "";
};

// Día de semana en español, de 0 (domingo) a 6 (sábado).
window.WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
