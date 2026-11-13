# DBSHBOARD · Mis Finanzas

Dashboard personal de gastos (PWA) que se instala en el iPhone como app. Recibe tus movimientos de **Mercado Pago** automáticamente con un **Atajo de iOS**, importa estados de cuenta anteriores y te manda **notificaciones push** propias.

```
Notificación Mercado Pago ─▶ Automatización de Atajos ─▶ POST ─▶ Apps Script ─▶ Google Sheets
                                                                     │   └─▶ push ─▶ la app en tu iPhone
                     Dashboard (GitHub Pages, en tu pantalla de inicio) ◀── GET ┘
```

Todo es gratis: GitHub Pages (frontend) + Google Apps Script/Sheets (backend). No usa Netlify ni Firebase.

## Pestañas

- **Inicio**: libre en Mercado Pago, apartados, tus 4 tarjetas con saldo/deuda, resumen del mes y movimientos con buscador. Toca un movimiento para corregirlo o borrarlo.
- **Tarjetas**: Mercado Pago, BBVA Azul (crédito), Nu (crédito), BBVA Aqua (débito). **Editar** = pon el saldo que ves hoy en tu banco; a partir de ahí se suma/resta lo que entre.
- **Apartados**: tus apartados de Mercado Pago con saldo editable; se crean solos al importar el estado de cuenta.
- **Análisis**: presupuesto (hoy / 7 días / mes), categorías vs mes pasado, gasto diario, ingresos vs gastos 6 meses, regla 50/30/20.

Tipos de movimiento: **gasto**, **ingreso** y **entre cuentas** (transferencias tuyas, pagos de tarjeta, apartados; no cuentan como gasto).

## 1. Backend (Google Sheets + Apps Script)

1. En tu hoja: **Extensiones → Apps Script**.
2. Pega `backend/Code.gs` en `Code.gs`. Luego **Archivos → + → Secuencia de comandos**, llámalo `WebPush` y pega `backend/WebPush.gs` (es la librería de cifrado para las notificaciones).
3. Ejecuta **`configurar`** una vez (acepta todos los permisos). En el registro sale tu `TOKEN`.
4. **Implementar → Nueva implementación → Aplicación web** · Ejecutar como: **Yo** · Acceso: **Cualquier persona**. Copia la URL `/exec`.
   - Cuando actualices el código: **Administrar implementaciones → ✏️ → Versión: nueva**. La URL no cambia.
5. (Opcional) Propiedad del script `DASHBOARD_URL` = URL de tu dashboard (al tocar la notificación se abre).

## 2. Frontend en GitHub Pages

1. **Settings → Pages → Deploy from a branch → `main` / root**.
2. Abre la URL en **Safari** → Compartir → **Agregar a inicio**.
3. En la app: ⚙︎ → URL `/exec` + token → Guardar.
4. ⚙︎ → **Activar notificaciones** (solo funciona abriendo la app desde la pantalla de inicio).

## 3. Atajo de iOS

**Atajos → Automatización → + → Notificación → App: Mercado Pago → Ejecutar inmediatamente**

1. **Obtener contenido de URL** → tu URL `/exec` · Método **POST** · Cuerpo **JSON**:
   | Clave | Valor |
   |---|---|
   | `token` | tu token |
   | `texto` | la variable de la notificación |
   | `app` | `Mercado Pago` |

Con las notificaciones push activadas ya no necesitas "Mostrar notificación" en el atajo: el aviso llega de la app.

## 4. Importar estados de cuenta

Apartados → **Importar estados de cuenta** (o ⚙︎). Acepta varios archivos a la vez:
- **Mercado Pago**: Tu perfil → Estados de cuenta → descargar **Excel** (o CSV).
- **BBVA débito**: el **PDF** mensual.

Se leen en tu teléfono (el PDF con pdf.js). Antes de guardar ves un resumen. No se duplica nada: ni lo que ya llegó por notificación, ni la misma transferencia BBVA → Mercado Pago que aparece en los dos estados de cuenta. El saldo final del estado de cuenta actualiza el saldo de la tarjeta.

## API

| Petición | Cuerpo / query |
|---|---|
| `GET` | `?token=…` → `{ movimientos, config, vapid }` |
| `POST` notificación | `{token, texto \| titulo + cuerpo, app?, cuenta?}` |
| `POST` alta / edición / borrado | `{action:"add" \| "update" \| "delete", …}` |
| `POST` importar | `{action:"import", rows:[…]}` |
| `POST` configuración | `{action:"config", config:{cards, pots}}` |
| `POST` push | `{action:"subscribe", sub}` · `{action:"testpush"}` |

## Desarrollo

`backend/WebPush.gs` se genera con `npm install && npm run build:push` desde `tools/webpush-entry.js` (cifrado Web Push RFC 8291 + firma VAPID con las librerías @noble, empaquetado para Apps Script).

Las caras de tarjeta, los importadores y las secciones vienen de [Diapps-BS/finanzas](https://diegobasan.github.io/Diapps-BS/finanzas/).
