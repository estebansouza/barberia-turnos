# Gestor de turnos para barberías

Una sola web y una sola base de datos (Supabase) para varias barberías. Cada una tiene su dirección: `https://<dominio>/<slug>`.

## Dar de alta una barbería nueva

1. Crear el usuario del dueño en Supabase: Authentication → Users → Add user (con "Auto Confirm User").
2. Ejecutar en el SQL Editor (cambiá los valores):

```sql
with s as (
  insert into public.shops (slug, name, whatsapp, accent)
  values ('donpepe', 'Barbería Don Pepe', '598XXXXXXXX', '#c9a24b')
  returning id
), b as (
  insert into public.barbers (shop_id, name) select id, n from s, unnest(array['Pepe','Juan']) n
), v as (
  insert into public.services (shop_id, name, duration_min, price_uyu)
  select s.id, x.name, x.dur, x.price from s,
    (values ('Corte', 30, 400), ('Barba', 30, 300), ('Corte y barba', 60, 650)) as x(name, dur, price)
), h as (
  insert into public.business_hours (shop_id, weekday, open_time, close_time)
  select s.id, d, '10:00', '20:00' from s, generate_series(1, 6) d
)
insert into public.shop_admins (shop_id, user_id)
select s.id, u.id from s, auth.users u where u.email = 'email-del-dueno@ejemplo.com';
```

3. Compartir `https://<dominio>/donpepe` con los clientes y `https://<dominio>/admin.html` con el dueño.

Horarios: `weekday` 0 = domingo ... 6 = sábado. Los turnos se ofrecen cada 30 minutos, hora de Montevideo.

## Qué puede hacer el dueño desde el panel (`/admin.html`)

- **Agenda:** ver y cancelar turnos del día, y mandar un recordatorio por WhatsApp con un clic (el mensaje sale armado y el turno queda marcado como "Recordado").
- **Servicios y Barberos:** editar, agregar y quitar. Quitar los desactiva; los turnos ya reservados se conservan.
- **Horarios:** abrir o cerrar cada día y fijar apertura y cierre.
- **Fotos:** logo, foto de cada barbero y galería. Las imágenes se reducen en el navegador y se guardan en Supabase Storage (bucket `shop-media`, una carpeta por barbería).
- **Mi local:** nombre, WhatsApp, dirección, Instagram, descripción y color.

## Páginas públicas

- `https://<dominio>/<slug>`: reserva de turnos.
- `https://<dominio>/<slug>/info`: página del local (servicios, equipo, galería, horarios, mapa y contacto).
