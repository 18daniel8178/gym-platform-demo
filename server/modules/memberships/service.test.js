const { test } = require('node:test');
const assert = require('node:assert');
const { calcularFechas, periodoEnCurso, sumarDias } = require('./service');

const HOY = '2026-08-03';

test('sumarDias es aritmética de calendario correcta', () => {
  assert.equal(sumarDias('2026-08-03', 30), '2026-09-02');
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
});

test('sin membresía previa: arranca hoy', () => {
  const { fecha_inicio, fecha_fin } = calcularFechas(null, 'mensual', HOY);
  assert.equal(fecha_inicio, HOY);
  assert.equal(fecha_fin, '2026-09-02'); // hoy + 30
});

test('renovación anticipada conserva los días restantes', () => {
  // Vence en 5 días; renueva plan mensual → extiende desde la fecha_fin actual.
  const actual = { fecha_inicio: '2026-07-08', fecha_fin: '2026-08-08' };
  const { fecha_inicio, fecha_fin } = calcularFechas(actual, 'mensual', HOY);
  assert.equal(fecha_inicio, '2026-07-08'); // conserva el inicio original
  assert.equal(fecha_fin, '2026-09-07'); // 2026-08-08 + 30, NO 2026-09-02 (no pierde los 5 días)
});

test('renovación tras vencer: arranca hoy', () => {
  const actual = { fecha_inicio: '2026-06-01', fecha_fin: '2026-07-01' }; // vencida
  const { fecha_inicio, fecha_fin } = calcularFechas(actual, 'mensual', HOY);
  assert.equal(fecha_inicio, HOY);
  assert.equal(fecha_fin, '2026-09-02');
});

test('cambio de plan estando vigente extiende con los días del nuevo periodo', () => {
  const actual = { fecha_inicio: '2026-07-20', fecha_fin: '2026-08-20' };
  const { fecha_inicio, fecha_fin } = calcularFechas(actual, 'trimestral', HOY);
  assert.equal(fecha_inicio, '2026-07-20');
  assert.equal(fecha_fin, sumarDias('2026-08-20', 90)); // 2026-11-18
});

test('el día de vencimiento aún cuenta como vigente (borde)', () => {
  const actual = { fecha_inicio: '2026-07-04', fecha_fin: HOY }; // vence hoy
  const { fecha_inicio, fecha_fin } = calcularFechas(actual, 'diario', HOY);
  assert.equal(fecha_inicio, '2026-07-04'); // vigente hoy → conserva inicio
  assert.equal(fecha_fin, '2026-08-04'); // hoy + 1
});

// Periodo en curso: lo que ve el socio como "% del periodo transcurrido". Renovar
// a tiempo conserva la fecha_inicio original, así que medir desde ella daba más
// del 90 % a cualquier socio con meses de renovaciones encadenadas.
test('renovaciones encadenadas: el periodo es el último tramo, no toda la cadena', () => {
  const m = { fecha_inicio: '2026-02-17', fecha_fin: '2026-08-15' }; // 6 meses renovando a tiempo
  assert.deepEqual(periodoEnCurso(m, 'mensual', HOY), { inicio: '2026-07-16', fin: '2026-08-15' });
});

test('primer periodo sin renovar: coincide con la membresía', () => {
  const m = { fecha_inicio: '2026-07-20', fecha_fin: '2026-08-19' };
  assert.deepEqual(periodoEnCurso(m, 'mensual', HOY), { inicio: '2026-07-20', fin: '2026-08-19' });
});

test('pagado por adelantado: el periodo es el tramo que contiene a hoy', () => {
  const m = { fecha_inicio: '2026-06-01', fecha_fin: '2026-09-17' }; // 45 días por delante
  assert.deepEqual(periodoEnCurso(m, 'mensual', HOY), { inicio: '2026-07-19', fin: '2026-08-18' });
});

test('nunca empieza antes de fecha_inicio (ajuste manual más corto que un periodo)', () => {
  const m = { fecha_inicio: '2026-07-25', fecha_fin: '2026-08-14' };
  assert.deepEqual(periodoEnCurso(m, 'mensual', HOY), { inicio: '2026-07-25', fin: '2026-08-14' });
});

test('el día de vencimiento el periodo está completo (borde)', () => {
  const m = { fecha_inicio: '2026-05-05', fecha_fin: HOY };
  assert.deepEqual(periodoEnCurso(m, 'mensual', HOY), { inicio: '2026-07-04', fin: HOY });
});

test('el tramo mide lo que dura el periodo del plan', () => {
  const m = { fecha_inicio: '2026-01-01', fecha_fin: '2026-09-01' };
  assert.deepEqual(periodoEnCurso(m, 'trimestral', HOY), { inicio: '2026-06-03', fin: '2026-09-01' });
});

test('sin periodo conocido (plan ausente) se asume mensual, como al activar', () => {
  const m = { fecha_inicio: '2026-02-17', fecha_fin: '2026-08-15' };
  assert.deepEqual(periodoEnCurso(m, undefined, HOY), { inicio: '2026-07-16', fin: '2026-08-15' });
});
