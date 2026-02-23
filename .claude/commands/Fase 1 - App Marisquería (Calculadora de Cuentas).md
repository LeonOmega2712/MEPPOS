# Proyecto Técnico: App Marisquería - Fase 1

## Calculadora de Cuentas con Catálogo

**Versión:** 1.0 - Fase 1 (MVP Simplificado)  
**Desarrollador:** Individual  
**Objetivo:** Demo funcional - Calculadora rápida de cuentas con catálogo editable

---

## 1. Resumen Ejecutivo

Aplicación web para agilizar el cálculo de cuentas en una marisquería. Los usuarios pueden seleccionar productos de un catálogo, agregar cantidades, ver el total en tiempo real y reiniciar para la siguiente cuenta.

**NO incluye en Fase 1:**

- ❌ Guardado de historial de ventas
- ❌ Soporte offline
- ❌ Multi-terminal con sincronización
- ❌ Reportes o estadísticas
- ❌ Impresión de tickets
- ❌ Sistema complejo de autenticación

**SÍ incluye en Fase 1:**

- ✅ Catálogo de productos editable (CRUD)
- ✅ Productos con variantes de tamaño/precio
- ✅ Calculadora de cuenta: agregar, editar, quitar items
- ✅ Total automático
- ✅ Uso simultáneo por múltiples usuarios (cada uno con su propia sesión en memoria)
- ✅ Backend REST API simple
- ✅ Base de datos solo para catálogo de productos

---

## 2. Stack Tecnológico

### Frontend

- **Framework:** Angular ^21.0.0 con TypeScript ~5.9.2
- **Estilos:** Tailwind CSS ^4.1.12 + DaisyUI ^5.5.14
- **Estado:** Servicios de Angular (sin necesidad de NgRx para Fase 1)
- **HTTP:** HttpClient de Angular
- **Testing:** Vitest ^4.0.8

### Backend

- **Runtime:** Node.js 18+
- **Framework:** Express.js 5.2.1 con TypeScript 5.9.3
- **Validación:** Zod 4.3.6
- **ORM:** Prisma 7.3.0 (con @prisma/adapter-pg + pg 8.18.0)

### Base de Datos

- **PostgreSQL 15+**
- **Solo 2 tablas:** `categories` y `products`

### DevOps (mínimo)

- **Containerización:** Docker + docker-compose (opcional, para dev local)
- **Deploy:** Railway, Render o Fly.io (backend) + Netlify/Vercel (frontend)
- **Control de versiones:** Git + GitHub

---

## 3. Arquitectura de Fase 1

```
┌─────────────────┐
│  Angular App    │
│  (Frontend)     │
│                 │
│  - Catálogo     │
│  - Calculadora  │
│  - Admin CRUD   │
└────────┬────────┘
         │ HTTP REST
         ↓
┌─────────────────┐
│  Express API    │
│  (Backend)      │
│                 │
│  - GET /menu    │
│  - CRUD categ.  │
│  - CRUD prod.   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  PostgreSQL     │
│                 │
│  - categories   │
│  - products     │
└─────────────────┘
```

**Flujo básico:**

1. Usuario abre la app → carga catálogo desde API
2. Selecciona productos (con variante si aplica) → se agregan a cuenta local (en memoria del frontend)
3. Edita cantidades, quita items → todo en memoria local
4. Ve total calculado en tiempo real
5. Termina cuenta → limpia y empieza nueva (no se guarda nada)
6. Admin puede agregar/editar/eliminar productos → se actualiza en BD

---

## 4. Modelo de Datos

Referencia completa del diagrama ER en `.claude/commands/menu.mermaid.md`

### Tabla: `categories`

```sql
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  base_price DECIMAL(10,2),        -- precio base heredado por productos sin precio propio
  image VARCHAR(500),
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Tabla: `products`

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  price DECIMAL(10,2),             -- nullable: si es NULL, hereda category.base_price
  image VARCHAR(500),
  display_order INTEGER DEFAULT 0,
  customizable BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Relaciones:**

- `Category` 1:N `Product` (una categoría contiene muchos productos)
- ON DELETE CASCADE: al eliminar una categoría se eliminan sus productos

**Herencia de precios:**

- Si `product.price` es NOT NULL, se usa ese precio
- Si `product.price` es NULL, se hereda `category.base_price`
- In GET responses, `price` is always resolved (product price or inherited category base_price)

**Ejemplos:**

- **Producto con precio propio:** "Cóctel de Mariscos - Chico" → `price: 60.00` (categoría: Alimentos)
- **Producto que hereda precio:** "Coca-Cola Retornable" → `price: NULL`, hereda `base_price: 25.00` de categoría "Refrescos Retornables"

---

## 5. API REST (Endpoints Fase 1)

Todas las respuestas siguen el formato: `{ success: boolean, data: T, count?: number, message?: string }`. Excepción: `GET /api/products` incluye además `categories: Category[]` en la raíz de la respuesta.

### Menú completo (para calculadora)

#### `GET /api/menu`

Obtiene todas las categorías activas con sus productos activos y precios efectivos calculados. Endpoint optimizado para la pantalla de calculadora.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Alimentos",
      "description": "Platillos de mariscos",
      "basePrice": null,
      "image": null,
      "displayOrder": 1,
      "products": [
        {
          "id": 1,
          "name": "Cóctel de Mariscos - Chico",
          "description": "Cóctel chico de mariscos al gusto",
          "price": 60,
          "image": null,
          "displayOrder": 1,
          "customizable": true
        }
      ]
    },
    {
      "id": 2,
      "name": "Refrescos Retornables",
      "basePrice": 25,
      "products": [
        {
          "id": 10,
          "name": "Coca-Cola Retornable",
          "price": 25,
          "customizable": false
        }
      ]
    }
  ],
  "count": 7
}
```

### Categorías

#### `GET /api/categories`

Obtiene todas las categorías con conteo de productos. Soporta `?active=true`.

#### `GET /api/categories/:id`

Obtiene una categoría con todos sus productos incluidos.

#### `POST /api/categories`

Crea una nueva categoría.

**Request:**

```json
{
  "name": "Nueva Categoría",
  "description": "Descripción opcional",
  "basePrice": 25.00,
  "displayOrder": 8,
  "active": true
}
```

#### `PUT /api/categories/:id`

Actualiza una categoría existente.

#### `DELETE /api/categories/:id`

Desactiva (soft delete) la categoría y sus productos. Eliminación permanente con `?permanent=true`.

#### `PATCH /api/categories/reorder`

Reordena categorías en lote (transacción atómica). Body: `{ orders: [{ id, displayOrder }] }`

### Productos

#### `GET /api/products`

Obtiene todos los productos con `price` sin resolver (valor directo del producto, puede ser `null`) junto con un array `categories` para que el cliente resuelva precios heredados. Soporta `?active=true`.

#### `GET /api/products/:id`

Obtiene un producto por ID con datos completos de categoría.

#### `GET /api/products/:id/price`

Obtiene el precio efectivo de un producto (precio propio o heredado de categoría).

#### `GET /api/categories/:categoryId/products`

Obtiene productos filtrados por categoría. Soporta `?active=true`.

#### `POST /api/products`

Crea un nuevo producto.

**Request:**

```json
{
  "categoryId": 1,
  "name": "Aguachile",
  "description": "Aguachile de camarón",
  "price": 120.00,
  "displayOrder": 8,
  "customizable": true,
  "active": true
}
```

#### `PUT /api/products/:id`

Actualiza un producto existente (todos los campos opcionales).

#### `DELETE /api/products/:id`

Desactiva (soft delete) el producto. Eliminación permanente con `?permanent=true`.

#### `PATCH /api/products/reorder`

Reordena productos dentro de una categoría en lote (transacción atómica). Body: `{ orders: [{ id, displayOrder }] }`

---

## 6. Frontend: Pantallas Principales

### 6.1 Pantalla: Calculadora (Home)

**Propósito:** Crear cuentas rápidamente.

**Componentes:**

- Grid de productos organizados por categoría (2–5 columnas según breakpoint)
- Al hacer clic en una card → agrega el producto con cantidad 1; clic adicional es ignorado si ya está en la cuenta
- Productos como DaisyUI collapse cards (checkbox-based, programmatically controlled):
  - Click abre el collapse y agrega producto; collapse solo cierra al remover el producto (qty → 0)
  - Controles de cantidad en collapse-content (DaisyUI join):
    - Botón izquierdo: ícono trash + color error cuando qty=1; ícono minus-circle + color warning cuando qty>1
    - Input numérico central (sin stepper nativo, sin valores negativos)
    - Botón derecho: ícono plus-circle + color success
  - Animación de apertura/cierre nativa de DaisyUI collapse (grid-template-rows transition)
- Card seleccionada resaltada con outline de color primary (sin afectar layout)
- Footer sticky con dos zonas:
  - **Panel expandible** (toggle): tabla de items con nombre, subtotal (qty × precio) y total por fila
  - **Barra de totales** (siempre visible): contador de items, botón de expand/collapse, total general

**Estado local (en memoria):**

```typescript
interface BillItem {
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
}

billItems: Map<number, BillItem>;  // keyed by productId
```

### 6.2 Pantalla: Admin CRUD

**Propósito:** Gestionar catálogo de categorías y productos.

**Funciones:**

- Listar todas las categorías con sus productos
- Crear/editar/eliminar categorías (con precio base opcional)
- Crear/editar/eliminar productos (con precio propio o heredado de categoría)
- Formularios con validaciones

---

## 7. Tareas Técnicas (Checklist)

### Setup Inicial

- [x] Crear repositorio Git (mono-repo frontend/backend)
- [x] Inicializar proyecto Angular
- [x] Inicializar proyecto Node.js + Express + TypeScript
- [x] Configurar PostgreSQL local (Docker con docker-compose)
- [x] Configurar Prisma (schema, migraciones, seed)

### Backend

- [x] Crear esquema de BD (`categories`, `products`)
- [x] Implementar migraciones con Prisma
- [x] Crear seed inicial con menú completo de la marisquería
- [x] Implementar endpoints REST:
  - [x] GET `/api/menu` (menú completo con precios efectivos)
  - [x] CRUD `/api/categories`
  - [x] CRUD `/api/products`
  - [x] GET `/api/products/:id/price` (precio efectivo)
  - [x] GET `/api/categories/:categoryId/products`
- [x] Validación de datos con Zod
- [x] Manejo básico de errores y respuestas consistentes
- [x] CORS configurado para frontend local
- [x] Script postinstall para Prisma generate automático

### Frontend

- [x] Crear servicio `MenuService` para llamadas HTTP
- [x] Crear servicios `CategoryService`, `ProductService`, `ThemeService`, `ToastService`, `ConfirmDialogService`
- [x] Crear modelos/interfaces TypeScript para categorías y productos
- [x] Pantalla: Calculadora (bill page)
  - [x] Grid de productos organizados por categoría
  - [x] DaisyUI collapse cards with quantity controls and native collapse animation
  - [x] Lógica de agregar/editar/quitar items
  - [x] Footer sticky expandible con detalle de items y total automático
- [x] Pantalla: Admin CRUD (Settings)
  - [x] Tab-based UI (Categories/Products)
  - [x] Listar categorías y productos
  - [x] Formulario crear/editar categoría y producto
  - [x] Confirmación de eliminación (con typed confirmation for destructive actions)
  - [x] Drag-and-drop reorder for categories and products
  - [x] Product reactivation with parent category auto-reactivation
- [x] Navegación básica entre pantallas (responsive navbar with app branding)
- [x] Estilos con Tailwind CSS + DaisyUI
- [x] Theme selector with DaisyUI themes (localStorage persistence)
- [x] Shared components: toast, confirm-dialog, icon

### Testing (opcional para Fase 1, pero recomendado)

- [ ] Tests unitarios básicos de servicios (frontend)
- [ ] Tests de endpoints REST (backend)

### Deploy

- [ ] Script de build para producción
- [ ] Deploy backend a Railway/Render
- [ ] Deploy frontend a Netlify/Vercel
- [ ] Configurar variables de entorno (DATABASE_URL, etc.)
- [ ] Documentar URL de producción

---

## 8. Plan de Trabajo Sugerido (Orden Secuencial)

### Semana 1: Setup y Backend Base

1. Setup de repositorios y estructura
2. Configurar PostgreSQL + Prisma
3. Crear esquema de BD y migraciones
4. Implementar endpoints REST básicos
5. Probar endpoints con Postman/Thunder Client

### Semana 2: Frontend Base

6. Setup proyecto Angular
2. Crear servicios y modelos TypeScript
3. Implementar pantalla Admin CRUD (más simple)
4. Conectar frontend con backend
5. Probar flujo completo de CRUD

### Semana 3: Calculadora

11. Implementar pantalla calculadora
2. Lógica de agregar productos a cuenta
3. Modal de selección de variantes
4. Edición de cantidades y total automático
5. Limpieza de cuenta

### Semana 4: Pulido y Deploy

16. Estilos y UX básica
2. Validaciones y manejo de errores
3. Testing manual exhaustivo
4. Deploy a producción
5. Documentación básica (README)

**Total estimado:** 3-4 semanas para una persona (part-time)

---

## 9. Decisiones Técnicas Clave

### ¿Por qué NO guardar cuentas en Fase 1?

- Simplifica dramáticamente el proyecto
- No necesitas preocuparte por reportes, historial, auditoría
- Enfoque 100% en UX de calculadora rápida
- **Se agregará en Fase 2** cuando sea necesario

### ¿Por qué NO autenticación en Fase 1?

- La app es de uso interno y no guarda información sensible
- Múltiples personas pueden usarla simultáneamente sin conflictos
- **Se agregará en Fase 2** cuando se implemente guardado de ventas

### ¿Por qué Prisma?

- ORM muy simple y type-safe
- Generación automática de tipos TypeScript
- Migraciones fáciles
- Excelente DX (Developer Experience)

### ¿Por qué Express y no NestJS?

- Express es más ligero y directo para un proyecto pequeño
- Menos boilerplate y conceptos que aprender
- Perfectamente escalable para las necesidades actuales
- **Se puede migrar a NestJS** en fases posteriores si se requiere estructura más robusta

---

## 10. Observaciones Finales

### Lo que NO es necesario en Fase 1

- WebSockets o real-time
- Sistema de colas
- Manejo de transacciones complejas
- Backup y DR plans
- CI/CD automático (puede ser manual)
- Métricas y observabilidad avanzada
- Logs centralizados

### Lo que SÍ es importante

- Código limpio y organizado
- Separación de responsabilidades (services, controllers)
- Validación de datos
- Manejo básico de errores
- README con instrucciones de setup

### Señales de que Fase 1 está completa

- ✅ Puedes crear productos desde el admin
- ✅ Puedes hacer una cuenta completa en menos de 30 segundos
- ✅ El total se calcula correctamente
- ✅ 2 personas pueden usar la app al mismo tiempo sin problemas
- ✅ La app está deployada y accesible desde cualquier dispositivo

---

## 11. Próximos Pasos (Fases Futuras)

### Fase 2: Persistencia y Reportes Básicos

- Guardado de cuentas/ventas en BD
- Historial de ventas del día
- Reportes básicos (total del día, productos más vendidos)
- Autenticación simple con roles (mesero/admin)

### Fase 3: Multi-terminal y Mejoras UX

- Soporte para múltiples terminales
- Asignación de mesas
- Impresión de tickets
- Exports a Excel/PDF

### Fase 4: Integraciones y Escalado

- Integración con TPV/métodos de pago
- Dashboard avanzado con analytics
- API para pedidos en línea
- Backup automático

---

## Recursos Útiles

- **Prisma Docs:** <https://www.prisma.io/docs>
- **Angular Docs:** <https://angular.dev>
- **Express + TypeScript:** <https://github.com/microsoft/TypeScript-Node-Starter>
- **Railway Deploy:** <https://railway.app>
- **Render Deploy:** <https://render.com>

---

**Fin del documento Fase 1**

*Este documento debe actualizarse al comenzar cada nueva fase del proyecto.*
