# Proyecto Técnico: App Marisquería - Fase 2

## Registro de Ventas con Impresión de Tickets

**Versión:** 1.0 - Fase 2  
**Desarrollador:** Individual  
**Prerrequisito:** Fase 1 completada y desplegada  
**Objetivo:** Eliminar el ticket manual del flujo operativo, registrar ventas con persistencia y soporte para impresión física de tickets.

---

## 1. Resumen Ejecutivo

Extensión de la calculadora de Fase 1 hacia un sistema de cuentas persistentes. El mesero abre una cuenta ligada a una ubicación (mesa, barra o para llevar), agrega rondas de productos, y al finalizar cobra y genera un ticket consolidado. Toda la información queda registrada en base de datos para consulta histórica.

**NO incluye en Fase 2:**

- ❌ Control de estatus de órdenes (preparando, pendiente) → Fase 3
- ❌ Pedidos desde mesa / autoservicio → Fase 3
- ❌ Métodos de pago distintos al efectivo
- ❌ Propinas
- ❌ Facturación, inventario
- ❌ Reportes y analytics → Fase 4

**SÍ incluye en Fase 2:**

- ✅ Gestión de ubicaciones: mesas y barras (configurable por administrador)
- ✅ Cuentas persistentes con rondas múltiples
- ✅ Productos custom y lista de extras frecuentes
- ✅ Descuentos (monto fijo o porcentaje) al momento del cobro
- ✅ Ownership de cuentas con transferencia entre meseros
- ✅ Estados de cuenta: abierta / cobrada / cancelada
- ✅ Para llevar con consecutivo diario
- ✅ Impresión de tickets de cocina y ticket final
- ✅ Historial consultable con reimpresión marcada como copia
- ✅ Identificador numérico auto-asignado para órdenes de barra (consecutivo diario, reinicio a las 00:00)

---

## 2. Stack Tecnológico

Sin cambios respecto a Fase 1. Se extienden las capas existentes.

### Frontend

- **Framework:** Angular ^21.0.0 con TypeScript ~5.9.2
- **Estilos:** Tailwind CSS ^4.1.12 + DaisyUI ^5.5.14
- **Estado:** Servicios de Angular + RxJS (sin NgRx)
- **HTTP:** HttpClient de Angular
- **Impresión:** API de impresión del navegador (`window.print()`) con estilos CSS `@media print` — compatible con impresoras térmicas vía WebUSB o driver del sistema operativo

### Backend

- **Runtime:** Node.js 18+
- **Framework:** Express.js 5.x con TypeScript
- **Validación:** Zod 4.x
- **ORM:** Prisma 7.x

### Base de Datos

- **PostgreSQL 15+** (Supabase)
- Se extiende el schema existente con nuevas tablas

### DevOps

- Sin cambios: Koyeb (backend) + Vercel (frontend) + Supabase (BD)

---

## 3. Arquitectura de Fase 2

```
┌─────────────────────────────────┐
│          Angular App            │
│                                 │
│  - Calculadora (Fase 1)         │
│  - Vista de cuentas activas     │
│  - Detalle de cuenta / rondas   │
│  - Cobro con descuentos         │
│  - Historial                    │
│  - Admin: ubicaciones           │
│  - Admin: extras frecuentes     │
└────────────────┬────────────────┘
                 │ HTTP REST
                 ↓
┌─────────────────────────────────┐
│          Express API            │
│                                 │
│  /api/locations                 │
│  /api/orders                    │
│  /api/orders/:id/rounds         │
│  /api/orders/:id/charge         │
│  /api/orders/:id/cancel         │
│  /api/orders/:id/transfer       │
│  /api/extras                    │
│  /api/history                   │
└────────────────┬────────────────┘
                 │
                 ↓
┌─────────────────────────────────┐
│          PostgreSQL             │
│                                 │
│  categories, products (Fase 1)  │
│  locations                      │
│  orders                         │
│  order_rounds                   │
│  order_items                    │
│  custom_extras                  │
│  order_discounts                │
└─────────────────────────────────┘
```

---

## 4. Modelo de Datos

### Tabla: `locations`

Mesas y barras configurables. Una barra puede tener múltiples cuentas activas simultáneas; cada orden de barra recibe un identificador numérico auto-asignado por el sistema (ver `orders.bar_position`).

```sql
CREATE TABLE locations (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  type          VARCHAR(20) NOT NULL CHECK (type IN ('table', 'bar')),
  active        BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP
);
```

### Tabla: `orders`

Cuenta abierta por un mesero para una ubicación específica.

```sql
CREATE TABLE orders (
  id              SERIAL PRIMARY KEY,
  location_id     INTEGER REFERENCES locations(id),
  bar_position    INTEGER,            -- solo para barra (consecutivo diario auto-asignado)
  takeout_number  INTEGER,            -- solo para para llevar (consecutivo diario)
  order_type      VARCHAR(20) NOT NULL CHECK (order_type IN ('dine_in', 'bar', 'takeout')),
  status          VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'charged', 'cancelled')),
  owner_user_id   INTEGER NOT NULL REFERENCES users(id),
  opened_at       TIMESTAMP DEFAULT NOW(),
  closed_at       TIMESTAMP,
  notes           TEXT
);
```

> `bar_position` y `takeout_number` siguen el mismo patrón: el backend calcula el siguiente valor al crear la orden como `MAX(campo) + 1` filtrando por `opened_at >= inicio_del_día_local`, de modo que ambos contadores reinician a las 00:00 sin requerir cron.

### Tabla: `order_rounds`

Cada ronda de pedido dentro de una cuenta. Genera un ticket de cocina propio.

```sql
CREATE TABLE order_rounds (
  id         SERIAL PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  user_id    INTEGER NOT NULL REFERENCES users(id),  -- mesero que tomó la ronda
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Tabla: `order_items`

Items individuales dentro de una ronda. Soporta productos del catálogo y productos custom.

```sql
CREATE TABLE order_items (
  id             SERIAL PRIMARY KEY,
  round_id       INTEGER NOT NULL REFERENCES order_rounds(id) ON DELETE CASCADE,
  product_id     INTEGER REFERENCES products(id),  -- null si es custom
  custom_name    VARCHAR(255),                      -- solo para items custom
  unit_price     DECIMAL(10,2) NOT NULL,
  quantity       INTEGER NOT NULL DEFAULT 1,
  subtotal       DECIMAL(10,2) GENERATED ALWAYS AS (unit_price * quantity) STORED,
  notes          TEXT
);
```

### Tabla: `custom_extras`

Lista de extras frecuentes reutilizables, administrable por cualquier mesero.

```sql
CREATE TABLE custom_extras (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL UNIQUE,
  default_price DECIMAL(10,2) NOT NULL,
  active      BOOLEAN DEFAULT true,
  created_by  INTEGER REFERENCES users(id),
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP
);
```

### Tabla: `order_discounts`

Descuentos aplicados al cobro final. No afectan rondas ni tickets de cocina.

```sql
CREATE TABLE order_discounts (
  id           SERIAL PRIMARY KEY,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  description  VARCHAR(255) NOT NULL,
  type         VARCHAR(20) NOT NULL CHECK (type IN ('fixed', 'percentage')),
  value        DECIMAL(10,2) NOT NULL,    -- monto fijo o porcentaje (ej. 10 = 10%)
  amount       DECIMAL(10,2) NOT NULL,    -- monto calculado y guardado al cobrar
  created_at   TIMESTAMP DEFAULT NOW()
);
```

---

## 5. Flujos Operativos

### Abrir cuenta

1. Mesero selecciona tipo: mesa / barra / para llevar
2. Si es mesa: selecciona mesa disponible
3. Si es barra: sistema asigna automáticamente el siguiente número consecutivo del día (`bar_position`)
4. Si es para llevar: sistema asigna número consecutivo del día (`takeout_number`)
5. Se crea `order` con status `open` y `owner_user_id` del mesero activo

### Agregar ronda

1. Mesero abre cuenta existente
2. Selecciona productos del catálogo (reutiliza UI de Fase 1) o agrega extras custom
3. Confirma ronda → se crea `order_round` + `order_items`
4. Sistema genera e imprime ticket de cocina

### Ticket de cocina (por ronda)

Contenido:

- Ubicación (nombre de mesa / barra con `bar_position` / número para llevar)
- Mesero
- Número de ronda
- Lista de items con cantidad y nombre
- Hora

### Editar items de una ronda

- Permitido con confirmación de seguridad
- No genera ticket de cocina automáticamente
- Al finalizar la edición, se ofrece la opción de imprimir el ticket actualizado de esa ronda
- El ticket reimpreso de ronda lleva marca de "MODIFICADO" con hora de la modificación

### Transferir cuenta

- **Owner → otro mesero:** envío directo, notificación al receptor
- **No-owner → owner:** solicitud directa sin confirmación, notificación al owner anterior
- En ambos casos: `owner_user_id` se actualiza inmediatamente

### Cobrar cuenta

1. Mesero revisa resumen consolidado (todos los items por ronda)
2. Aplica descuentos opcionales (fijo o porcentaje con auto-cálculo)
3. Confirma cobro → status cambia a `charged`, se registra `closed_at`
4. Sistema genera e imprime ticket final al cliente

### Ticket final (al cliente)

Contenido:

- Encabezado: ubicación, mesero, fecha y hora de apertura y cierre
- Desglose por ronda: número de ronda, items con cantidad y precio unitario, subtotal de ronda
- Extras custom incluidos en sus respectivas rondas
- Subtotal general
- Descuentos aplicados (descripción y monto)
- **Total final**

### Cancelar cuenta

- Solo si la cuenta está `open`
- Requiere confirmación explícita
- Status cambia a `cancelled`, se conserva en historial como invalidada
- No genera ticket de cocina ni ticket final

### Reasignar ubicación

- Cuenta se puede mover a otra ubicación disponible (del mismo tipo o distinto)
- Queda registro del cambio en la cuenta

---

## 6. API REST (Endpoints Fase 2)

Todas las respuestas siguen el mismo formato de Fase 1: `{ success: boolean, data: T, message?: string }`.

### Ubicaciones

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/locations` | Lista todas las ubicaciones con estado (libre/ocupada) |
| POST | `/api/locations` | Crea una ubicación (admin) |
| PUT | `/api/locations/:id` | Edita una ubicación (admin) |
| DELETE | `/api/locations/:id` | Desactiva una ubicación (admin) |

### Cuentas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/orders` | Lista cuentas activas (con filtro `?mine=true`) |
| GET | `/api/orders/:id` | Detalle completo de una cuenta con rondas e items |
| POST | `/api/orders` | Abre una nueva cuenta |
| PATCH | `/api/orders/:id/location` | Reasigna a otra ubicación |
| POST | `/api/orders/:id/rounds` | Agrega una nueva ronda |
| PUT | `/api/orders/:id/rounds/:roundId/items/:itemId` | Edita un item de una ronda |
| DELETE | `/api/orders/:id/rounds/:roundId/items/:itemId` | Elimina un item de una ronda |
| POST | `/api/orders/:id/charge` | Cobra la cuenta (con descuentos opcionales) |
| POST | `/api/orders/:id/cancel` | Cancela la cuenta |
| POST | `/api/orders/:id/transfer` | Transfiere la cuenta a otro mesero |

### Extras frecuentes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/extras` | Lista extras frecuentes activos |
| POST | `/api/extras` | Crea un extra frecuente |
| PUT | `/api/extras/:id` | Edita un extra frecuente |
| DELETE | `/api/extras/:id` | Desactiva un extra frecuente |

### Historial

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/history` | Lista cuentas cerradas/canceladas (paginado, con filtros de fecha) |
| GET | `/api/history/:id` | Detalle completo de cuenta histórica |
| GET | `/api/history/:id/ticket` | Genera datos del ticket para reimpresión |

---

## 7. Pantallas Frontend

### Cuentas activas (vista principal Fase 2)

- Lista de cuentas abiertas
- Filtro: mis cuentas / todas
- Indicador de mesero owner por cuenta
- Estado de ubicación: libre / ocupada
- Botón para abrir nueva cuenta
- Acceso rápido a cada cuenta

### Detalle de cuenta

- Resumen de ubicación, mesero, hora de apertura
- Listado de rondas con sus items
- Botón: agregar ronda (reutiliza UI calculadora de Fase 1)
- Botón: cobrar (con descuentos)
- Botón: cancelar (con confirmación)
- Botón: transferir
- Botón: reasignar ubicación
- Advertencia visible si no eres el owner

### Cobro

- Resumen consolidado de todos los items
- Sección de descuentos: agregar, tipo fijo/porcentaje, auto-cálculo
- Total final calculado
- Confirmación de cobro → dispara impresión

### Historial

- Lista paginada de cuentas cobradas e invalidadas
- Filtros: fecha, mesero, tipo de ubicación
- Indicador visual en cuentas canceladas
- Detalle de cada cuenta
- Botón de reimpresión con marca de copia

### Admin: Gestión de ubicaciones

- Lista de mesas y barras con estado
- Agregar / editar / desactivar mesas
- Agregar / editar / desactivar barras
- Los identificadores de las órdenes de barra se asignan automáticamente y no requieren administración

---

## 8. Lógica de Impresión

La impresión se gestiona desde el navegador mediante `window.print()` con una hoja de estilos `@media print` dedicada. Esto permite compatibilidad con cualquier impresora térmica conectada al sistema operativo del dispositivo (iOS AirPrint, Android Print, o driver USB/Bluetooth en desktop).

**Componente de ticket:** se renderiza en un componente Angular oculto en pantalla, visible solo al imprimir. El contenido se parametriza para ticket de cocina o ticket final según el contexto.

**Reimpresión:** mismo componente, con un banner destacado de "COPIA" y la fecha/hora de la reimpresión.

> ⚠️ La compatibilidad exacta con modelos específicos de impresoras térmicas se validará durante el desarrollo. Si se requiere integración directa con protocolo ESC/POS, se evaluará una librería como `escpos` en el backend en ese momento.

---

## 9. Consideraciones de Seguridad y UX

- **Intervención en cuenta ajena:** modal de advertencia con nombre del owner antes de cualquier acción (agregar ronda, editar, cobrar, cancelar)
- **Edición de items:** confirmación explícita con descripción del cambio
- **Cancelación de cuenta:** confirmación en dos pasos para evitar errores
- **Transferencia:** inmediata pero con notificación push/toast al owner anterior
- **Consecutivos diarios** (`bar_position` y `takeout_number`): se reinician a las 00:00 en el timezone local del negocio. El reinicio es implícito: el cálculo del siguiente valor filtra por `opened_at >= inicio_del_día_local`, por lo que no requiere tarea programada

---

## 10. Modelo de Notificaciones

Para la notificación de transferencia de cuenta no se requiere WebSocket en Fase 2. Se implementa con **polling ligero** cada **30 segundos**, más un botón de refresco manual visible en la vista de cuentas activas para forzar la consulta en cualquier momento. Si el listado detecta que una cuenta fue asignada al mesero actual desde otra sesión, muestra un toast de aviso.

> WebSockets se evaluarán en Fase 3 cuando el sistema de órdenes requiera actualizaciones en tiempo real.

---

## 11. Tareas Técnicas (Checklist)

### Base de Datos

- [ ] Diseñar y crear migración Prisma: `locations`, `orders`, `order_rounds`, `order_items`, `custom_extras`, `order_discounts`
- [ ] Seed de ubicaciones iniciales (7 mesas + 1 barra)

### Backend

- [ ] CRUD `/api/locations` (con validación de tipo y estado)
- [ ] `POST /api/orders` (abrir cuenta con validación de ubicación disponible; auto-asignación de `bar_position` para barra y `takeout_number` para para llevar como consecutivos diarios)
- [ ] `GET /api/orders` (con filtro mine/all)
- [ ] `GET /api/orders/:id` (detalle con rondas e items)
- [ ] `POST /api/orders/:id/rounds` (nueva ronda con items)
- [ ] `PUT/DELETE /api/orders/:id/rounds/:roundId/items/:itemId` (edición con log)
- [ ] `PATCH /api/orders/:id/location` (reasignación)
- [ ] `POST /api/orders/:id/transfer` (con notificación)
- [ ] `POST /api/orders/:id/charge` (con descuentos y cierre)
- [ ] `POST /api/orders/:id/cancel` (con registro)
- [ ] CRUD `/api/extras`
- [ ] `GET /api/history` (paginado con filtros)
- [ ] `GET /api/history/:id/ticket` (datos para reimpresión)
- [ ] Lógica de consecutivos diarios para `bar_position` y `takeout_number` (cálculo al crear orden, sin cron)
- [ ] Validaciones Zod para todos los endpoints nuevos

### Frontend

- [ ] Vista: Cuentas activas con filtro mine/all
- [ ] Vista: Detalle de cuenta con rondas
- [ ] Integrar UI calculadora de Fase 1 como componente de selección de ronda
- [ ] Vista: Cobro con descuentos y auto-cálculo
- [ ] Vista: Transferir cuenta
- [ ] Vista: Reasignar ubicación
- [ ] Vista: Historial paginado con filtros
- [ ] Vista: Detalle histórico con reimpresión
- [ ] Componente de ticket de cocina (print-ready)
- [ ] Componente de ticket de ronda modificada (print-ready con marca "MODIFICADO")
- [ ] Componente de ticket final (print-ready)
- [ ] Componente de ticket copia (print-ready con marca)
- [ ] Estilos `@media print` para tickets
- [ ] Advertencias de intervención en cuenta ajena
- [ ] Polling de cuentas activas para notificación de transferencias
- [ ] Admin: Gestión de ubicaciones (mesas y barras)
- [ ] Admin: Extras frecuentes

### Deploy

- [ ] Ejecutar migraciones en Supabase (producción)
- [ ] Verificar variables de entorno en Koyeb
- [ ] Prueba de impresión en dispositivo iOS real
- [ ] Prueba de múltiples cuentas simultáneas

---

## 12. Decisiones Técnicas Clave

### ¿Por qué `window.print()` y no una librería ESC/POS directa?

- Máxima compatibilidad multiplataforma (iOS, Android, desktop) sin dependencias nativas
- AirPrint en iOS ya soporta impresoras térmicas compatibles
- Evita costos y complejidad de drivers adicionales
- Si se requiere ESC/POS directo en el futuro, se puede agregar como capa backend sin cambiar el frontend

### ¿Por qué polling y no WebSockets para notificaciones?

- El volumen de eventos en tiempo real es mínimo (máximo 2 meseros)
- Polling cada 30 segundos es invisible para el usuario y sin costo de infraestructura
- WebSockets agregan complejidad de conexión y reconexión que no se justifica en Fase 2

### ¿Por qué `subtotal` como columna generada en `order_items`?

- Garantiza consistencia entre `unit_price`, `quantity` y `subtotal` a nivel de BD
- Elimina riesgo de inconsistencia si se actualiza precio o cantidad por separado

### ¿Por qué guardar `amount` calculado en `order_discounts`?

- El precio de un producto podría cambiar después del cobro
- El historial debe reflejar exactamente lo que se cobró en ese momento, no recalcular

### ¿Por qué no snapshotear nombres de producto, ubicación, categoría o usuario en las tablas históricas?

Fase 2 entrega **reimpresión de tickets**, no reportes históricos de largo plazo. La integridad histórica completa se difiere a Fase 4 (reportes y analytics), donde el requerimiento se vuelve fuerte.

**Estado actual por entidad:**

| Entidad         | Referencia histórica                                  | Precio capturado              | Nombre capturado | Riesgo                       |
| --------------- | ----------------------------------------------------- | ----------------------------- | ---------------- | ---------------------------- |
| `products`      | `order_items.product_id`                              | ✅ `unit_price`               | ❌ JOIN          | Ticket muestra nombre actual |
| `locations`     | `orders.location_id`                                  | n/a                           | ❌ JOIN          | Ticket muestra nombre actual |
| `categories`    | `products.category_id` (indirecta)                    | ✅ vía `unit_price` resuelto  | ❌ JOIN          | Solo reportes por categoría  |
| `users`         | `orders.owner_user_id`, `order_rounds.user_id`        | n/a                           | ❌ JOIN          | Solo reportes por mesero     |
| `custom_extras` | **no es FK** — se copia a `order_items.custom_name`   | ✅ `unit_price`               | ✅ snapshot      | Ninguno                      |

**Mitigaciones vigentes en Fase 2:**

- Borrado lógico (`active=false`) es el default: la fila sobrevive, el FK resuelve, el ticket se renderiza igual.
- Borrado físico (`?permanent=true`) está gated detrás de confirmación + type-to-confirm; uso excepcional.
- Todos los precios se capturan en inserción (`order_items.unit_price`, `order_discounts.amount`).

**Trade-off consciente**: si un producto / ubicación / categoría / usuario se renombra entre la transacción y una consulta posterior, se muestra el nombre actual vía JOIN. Aceptable para reimpresión de tickets del día, no para reportes históricos.

**A evaluar en Fase 4** cuando se diseñe el módulo de reportes:

- Snapshot de `product_name` / `location_name` en `order_items` / `orders` al momento de la inserción.
- `ON DELETE RESTRICT` (o check a nivel de aplicación) para impedir hard-delete de filas de catálogo referenciadas desde órdenes históricas.
- Política explícita de archivo/anonimización de usuarios con historial de ventas.

---

## 13. Señales de que Fase 2 está completa

- ✅ Un mesero puede abrir, gestionar y cobrar una cuenta completa sin papel
- ✅ La cocina recibe un ticket impreso por cada ronda de pedido
- ✅ El cliente recibe un ticket final consolidado con todo lo consumido
- ✅ Se puede consultar el historial de cuentas del día desde cualquier dispositivo
- ✅ Dos meseros pueden operar simultáneamente sin conflictos
- ✅ Una cuenta puede transferirse entre meseros correctamente
- ✅ Las cuentas canceladas quedan registradas como invalidadas en el historial

---

## 14. Próximos Pasos

### Fase 3 — Operación y flujos avanzados

- Control de órdenes con estatus (preparando / pendiente / cobrado)
- Pedidos centralizados desde punto fijo (no mesero a mesa)
- Cobro integrado al momento del pedido
- Posible incorporación de terminal en caja registradora
- Evaluación de WebSockets para notificaciones en tiempo real si el volumen lo justifica

### Fase 4 — Reportes, analytics e integridad histórica

- Reportes y analytics (ventas por período, por categoría, por mesero, productos más vendidos)
- Snapshots de nombre de producto / ubicación en `order_items` / `orders` al momento de la inserción (ver sección 12)
- `ON DELETE RESTRICT` o check a nivel de aplicación que impida hard-delete de filas de catálogo referenciadas por órdenes históricas
- Política explícita de archivo / anonimización de usuarios con historial de ventas
- Integraciones (TPV, métodos de pago, API de pedidos en línea)
- Backup automático y exports (Excel / PDF)

---

**Fin del documento Fase 2**

*Este documento debe actualizarse al comenzar la Fase 3.*
