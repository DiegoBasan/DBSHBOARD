import webpush from "web-push"

/**
 * Envía una notificación push a los dispositivos suscritos.
 * La llama el backend de Apps Script cuando entra un movimiento:
 *   POST /api/push  { secret, subs: [PushSubscription], title, body, url? }
 * Responde { ok, enviados, expirados: [endpoint] } para que el backend limpie los que ya no existen.
 *
 * Variables de entorno (Netlify → Project configuration → Environment variables):
 *   PUSH_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…)
 */
export default async (req: Request) => {
  if (req.method !== "POST") return Response.json({ ok: false, error: "usa POST" }, { status: 405 })

  let data: any
  try {
    data = await req.json()
  } catch {
    return Response.json({ ok: false, error: "JSON inválido" }, { status: 400 })
  }

  const secret = Netlify.env.get("PUSH_SECRET")
  if (!secret || data.secret !== secret) return Response.json({ ok: false, error: "no autorizado" }, { status: 401 })

  const subs = Array.isArray(data.subs) ? data.subs.slice(0, 20) : []
  if (!subs.length) return Response.json({ ok: false, error: "sin dispositivos" }, { status: 400 })

  webpush.setVapidDetails(
    Netlify.env.get("VAPID_SUBJECT") || "mailto:dbshboard@example.com",
    Netlify.env.get("VAPID_PUBLIC_KEY")!,
    Netlify.env.get("VAPID_PRIVATE_KEY")!,
  )

  const payload = JSON.stringify({
    title: String(data.title || "DBSHBOARD").slice(0, 120),
    body: String(data.body || "").slice(0, 300),
    url: String(data.url || "").slice(0, 300),
  })

  const expirados: string[] = []
  const errores: string[] = []
  let enviados = 0
  await Promise.all(
    subs.map(async (sub: any) => {
      try {
        await webpush.sendNotification(sub, payload, { TTL: 86400, urgency: "high" })
        enviados++
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) expirados.push(sub.endpoint)
        else errores.push(String(err?.statusCode || err?.message || err))
      }
    }),
  )

  return Response.json({ ok: enviados > 0, enviados, expirados, errores })
}

export const config = { path: "/api/push" }
