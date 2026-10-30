// Cliente HTTP del checkout: el pago y la activación de la membresía ocurren
// en el server (puerto PaymentGateway), nunca escribiendo en Supabase desde el cliente.
export async function checkout({ planId, metodo, token }) {
  try {
    const res = await fetch('/api/payments/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ plan_id: planId, metodo }),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, error: body?.error || 'No se pudo procesar el pago' }
    return { ok: true, reference: body?.reference }
  } catch {
    return { ok: false, error: 'No se pudo conectar con el servidor' }
  }
}
