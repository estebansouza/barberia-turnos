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
