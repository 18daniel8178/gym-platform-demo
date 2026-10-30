-- FORJA GYM (demo) - Datos de ejemplo
-- Ejecutar DESPUÉS de schema.sql en el SQL Editor de Supabase.
-- Todo es ficticio: el gimnasio, sus horarios, sus productos y sus precios.

insert into gym_info (id, nombre, descripcion, frase, horarios) values (
  1,
  'FORJA GYM',
  'Gimnasio de demostración: sala de pesas, clases grupales y un coffee corner para antes o después de entrenar.',
  'Constancia que se nota',
  '[
    {"dia": "Lunes",     "abre": "06:00", "cierra": "22:00"},
    {"dia": "Martes",    "abre": "06:00", "cierra": "22:00"},
    {"dia": "Miércoles", "abre": "06:00", "cierra": "22:00"},
    {"dia": "Jueves",    "abre": "06:00", "cierra": "22:00"},
    {"dia": "Viernes",   "abre": "06:00", "cierra": "21:00"},
    {"dia": "Sábado",    "abre": "08:00", "cierra": "17:00"},
    {"dia": "Domingo",   "abre": "09:00", "cierra": "13:00"}
  ]'::jsonb
)
on conflict (id) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  frase = excluded.frase,
  horarios = excluded.horarios;

-- Aforo: 27 de 60 personas = 45%
insert into occupancy (id, current_count, max_capacity) values (1, 27, 60)
on conflict (id) do update set
  current_count = excluded.current_count,
  max_capacity = excluded.max_capacity,
  updated_at = now();

insert into products (nombre, categoria, descripcion, precio, imagen_url) values
  ('Proteína Whey 2lb',       'suplemento', 'Proteína de suero de leche, 24g por porción. Sabor chocolate o vainilla.',    42.00, '/img/prod-whey.webp'),
  ('Creatina Monohidrato',    'suplemento', 'Creatina micronizada, 300g. Apoya la fuerza y el rendimiento.',               26.00, '/img/prod-creatina.webp'),
  ('Pre-entreno',             'suplemento', 'Energía y enfoque para tus entrenamientos más intensos.',                     31.00, '/img/prod-preworkout.webp'),
  ('BCAA 2:1:1',              'suplemento', 'Aminoácidos esenciales para la recuperación muscular.',                       21.00, '/img/prod-bcaa.webp'),
  ('Bowl de pollo',           'comida',     'Arroz integral, pollo a la plancha y vegetales asados. Alto en proteína.',      8.00, '/img/menu1.webp'),
  ('Wrap de pavo',            'comida',     'Tortilla integral, pavo, vegetales frescos y aderezo ligero.',                 6.00, '/img/prod-wrap.webp'),
  ('Batido post-entreno',     'comida',     'Batido de banana, avena y proteína.',                                          4.50, '/img/coffe3.webp'),
  ('Barra energética',        'comida',     'Barra de avena, miel y maní. Ideal antes de entrenar.',                        2.75, '/img/prod-barra.webp'),
  ('Café americano',          'comida',     'Café de la casa del coffee corner, para llevar o tomar en el gym.',            2.50, '/img/coffe1.webp'),
  ('Té verde frío',           'comida',     'Té verde frío sin azúcar añadida.',                                            3.00, '/img/coffe4.webp'),
  ('Desayuno de avena',       'comida',     'Avena con frutas, huevos revueltos y café.',                                   7.50, '/img/menu2.webp'),
  ('Tostadas con huevo',      'comida',     'Pan integral, huevo, aguacate y jugo natural.',                                7.00, '/img/menu3.webp');

insert into membership_plans (nombre, precio, periodo, beneficios, destacado) values
  ('Diario',     6.00, 'diario',     '["Acceso completo por un día", "Sin inscripción"]'::jsonb, false),
  ('1 Mes',     45.00, 'mensual',    '["Acceso ilimitado todo el mes", "Clases grupales incluidas", "Sin inscripción"]'::jsonb, false),
  ('3 Meses',  120.00, 'trimestral', '["Acceso ilimitado", "Ahorra $15 vs pago mensual", "Clases grupales incluidas"]'::jsonb, false),
  ('6 Meses',  225.00, 'semestral',  '["Acceso ilimitado", "Ahorra $45 vs pago mensual", "Clases grupales incluidas"]'::jsonb, false),
  ('1 Año',    420.00, 'anual',      '["Acceso ilimitado", "Ahorra $120 vs pago mensual", "Clases grupales e invitado mensual"]'::jsonb, true);

-- Para asignar una membresía a un usuario registrado (reemplaza el email):
-- insert into memberships (user_id, plan_id, fecha_inicio, fecha_fin)
-- select id, 2, current_date, current_date + interval '30 days'
-- from auth.users where email = 'cliente@example.com';
