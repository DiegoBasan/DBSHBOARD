# DBSHBOARD · Estado de gastos

Dashboard personal (PWA) que se instala en el iPhone como app y recibe tus movimientos de **Mercado Pago** automáticamente vía un **Atajo de iOS**.

```
Notificación Mercado Pago ─▶ Automatización de Atajos ─▶ POST ─▶ Apps Script ─▶ Google Sheets
                                                                                    │
                     Dashboard (GitHub Pages, en tu pantalla de inicio) ◀── GET ────┘
```

| Pieza | Dónde vive | Costo |
|---|---|---|
| Frontend (`index.html`, `app.js`, `styles.css`) | GitHub Pages | Gratis |
| Backend (`backend/Code.gs`) | Google Apps Script | Gratis |
| Base de datos | Una hoja de Google Sheets | Gratis |

## 1. Backend (Google Sheets + Apps Script) — 5 min

1. Crea una hoja nueva en [sheets.new](https://sheets.new) y llámala "DBSHBOARD".
2. Menú **Extensiones → Apps Script**. Borra lo que haya y pega el contenido de `backend/Code.gs`. Guarda.
3. En el selector de funciones elige **`configurar`** → **Ejecutar**. Acepta permisos. Abre **Registro de ejecución** y copia el `TOKEN: ...`.
4. **Implementar → Nueva implementación → Tipo: Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona** (el token es lo que protege tus datos)
5. Copia la URL que termina en `/exec`.

> Si cambias el código después: **Implementar → Administrar implementaciones → ✏️ → Versión: Nueva**. Así la URL no cambia.

Prueba rápida desde una terminal:

```bash
curl -L -X POST "TU_URL_EXEC" -H "Content-Type: text/plain" -d '{"token":"TU_TOKEN","texto":"Pagaste $249.00 a OXXO"}'
```

## 2. Frontend en GitHub Pages

1. En GitHub: **Settings → Pages → Source: Deploy from a branch**, elige la rama y carpeta `/ (root)`.
2. Abre la URL de Pages en **Safari** del iPhone → botón Compartir → **Agregar a inicio**.
3. Abre la app → ⚙︎ → pega la **URL /exec** y el **token**. (Se guardan solo en tu teléfono, no en el repo.)

Sin configurar, la app muestra datos de demo.

## 3. Atajo de iOS (automatización por notificación)

**Atajos → Automatización → + → Notificación**
- App: **Mercado Pago**
- Marca **Ejecutar inmediatamente** (y desactiva "Notificar al ejecutar" si quieres que sea silencioso).

Acciones (burbujas), en orden:

1. **Texto** → escribe tu token (así no lo repites).
2. **Obtener contenido de URL**
   - URL: tu URL `/exec`
   - Método: **POST**
   - Cuerpo de la solicitud: **JSON**, con estos campos:
     | Clave | Tipo | Valor |
     |---|---|---|
     | `token` | Texto | variable *Texto* del paso 1 |
     | `titulo` | Texto | *Entrada del atajo* → toca la variable → **Título** |
     | `cuerpo` | Texto | *Entrada del atajo* → toca la variable → **Cuerpo / Mensaje** |
     | `app` | Texto | `Mercado Pago` |
3. *(Opcional)* **Obtener valor del diccionario** `movimiento.monto` del resultado → **Mostrar notificación** "Registrado $…" para confirmar.

> Si al tocar *Entrada del atajo* no ves Título/Cuerpo, manda la variable completa en un solo campo `texto`; el backend acepta `titulo`, `cuerpo` y/o `texto` y los une.

El backend se encarga de todo lo demás: extrae monto, detecta gasto vs ingreso, saca el comercio, asigna categoría y descarta duplicados (misma notificación en 5 min).

## Formato de la API

| Petición | Cuerpo / query | Respuesta |
|---|---|---|
| `POST` notificación | `{token, titulo?, cuerpo?, texto?, app?}` | `{ok, movimiento}` |
| `POST` alta manual | `{token, action:"add", tipo, monto, concepto, categoria, fecha?}` | `{ok, movimiento}` |
| `POST` borrar | `{token, action:"delete", id}` | `{ok}` |
| `GET` listar | `?token=…` | `{ok, movimientos:[…]}` |

Categorías y palabras clave: edítalas en `CATEGORIAS` dentro de `backend/Code.gs`. Si una notificación se parsea mal, la columna `texto` de la hoja guarda el original para corregirla a mano.
