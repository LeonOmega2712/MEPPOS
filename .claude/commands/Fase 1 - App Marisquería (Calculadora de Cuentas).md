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

- **Framework:** Angular 17+ con TypeScript
- **Estilos:** Tailwind CSS o Angular Material (según preferencia)
- **Estado:** Servicios de Angular (sin necesidad de NgRx para Fase 1)
- **HTTP:** HttpClient de Angular

### Backend

- **Runtime:** Node.js 18+
- **Framework:** Express.js con TypeScript
- **Validación:** Zod o express-validator
- **ORM:** Prisma (recomendado por simplicidad) o TypeORM

### Base de Datos

- **PostgreSQL 15+**
- **Solo 2 tablas:** `products` y `product_variants`

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
│  - GET products │
│  - CRUD         │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  PostgreSQL     │
│                 │
│  - products     │
│  - variants     │
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

### Tabla: `products`

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  has_variants BOOLEAN DEFAULT false,
  base_price DECIMAL(10,2), -- precio si no tiene variantes
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Tabla: `product_variants`

```sql
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  size_name VARCHAR(100) NOT NULL, -- "Chico", "Mediano", "Grande", "1kg", etc.
  price DECIMAL(10,2) NOT NULL,
  sort_order INT DEFAULT 0, -- para ordenar variantes
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Ejemplos:**

- **Producto simple:** "Refresco" → `has_variants: false`, `base_price: 25.00`
- **Producto con variantes:** "Cóctel de Camarón" → `has_variants: true`, variantes: [{size: "Chico", price: 100}, {size: "Grande", price: 150}]

---

## 5. API REST (Endpoints Fase 1)

### Productos

#### `GET /api/products`

Obtiene todos los productos con sus variantes.

**Response:**

```json
[
  {
    "id": "uuid",
    "name": "Cóctel de Camarón",
    "category": "Cócteles",
    "hasVariants": true,
    "variants": [
      {"id": "uuid", "sizeName": "Chico", "price": 100},
      {"id": "uuid", "sizeName": "Grande", "price": 150}
    ]
  },
  {
    "id": "uuid",
    "name": "Refresco",
    "category": "Bebidas",
    "hasVariants": false,
    "basePrice": 25
  }
]
```

#### `POST /api/products`

Crea un nuevo producto.

**Request:**

```json
{
  "name": "Aguachile",
  "category": "Platillos",
  "hasVariants": true,
  "variants": [
    {"sizeName": "Mediano", "price": 120},
    {"sizeName": "Grande", "price": 180}
  ]
}
```

#### `PUT /api/products/:id`

Actualiza un producto existente.

#### `DELETE /api/products/:id`

Elimina un producto (y sus variantes por CASCADE).

---

## 6. Frontend: Pantallas Principales

### 6.1 Pantalla: Calculadora (Home)

**Propósito:** Crear cuentas rápidamente.

**Componentes:**

- Lista/grid de productos (con búsqueda rápida)
- Al hacer click en producto:
  - Si NO tiene variantes → agrega directo a cuenta
  - Si tiene variantes → muestra modal para seleccionar tamaño
- Cuenta actual (sidebar o sección):
  - Lista de items agregados con cantidad
  - Botones +/- para ajustar cantidad
  - Botón X para quitar item
  - **Total:** calculado automáticamente
- Botones:
  - "Limpiar Cuenta" (resetea todo)
  - "Admin" (ir a pantalla de administración)

**Estado local (en memoria):**

```typescript
interface OrderItem {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  price: number;
  quantity: number;
}

currentOrder: OrderItem[] = [];
total: number = 0;
```

### 6.2 Pantalla: Admin CRUD

**Propósito:** Gestionar catálogo de productos.

**Funciones:**

- Listar todos los productos
- Crear nuevo producto (con o sin variantes)
- Editar producto existente
- Eliminar producto
- Formulario simple con validaciones

---

## 7. Tareas Técnicas (Checklist)

### Setup Inicial

- [ ] Crear repositorio Git (mono-repo o repos separados frontend/backend)
- [ ] Inicializar proyecto Angular (`ng new marisqueria-app`)
- [ ] Inicializar proyecto Node.js + Express + TypeScript
- [ ] Configurar PostgreSQL local (Docker o instalación nativa)
- [ ] Configurar Prisma (schema, migraciones)

### Backend

- [ ] Crear esquema de BD (`products`, `product_variants`)
- [ ] Implementar migraciones con Prisma
- [ ] Crear seed inicial con productos de ejemplo
- [ ] Implementar endpoints REST:
  - [ ] GET `/api/products`
  - [ ] POST `/api/products`
  - [ ] PUT `/api/products/:id`
  - [ ] DELETE `/api/products/:id`
- [ ] Validación de datos (Zod o express-validator)
- [ ] Manejo básico de errores y respuestas consistentes
- [ ] CORS configurado para frontend local

### Frontend

- [ ] Crear servicio `ProductsService` para llamadas HTTP
- [ ] Crear modelo/interface TypeScript para productos y variantes
- [ ] Pantalla: Calculadora
  - [ ] Componente lista de productos
  - [ ] Componente cuenta actual (sidebar)
  - [ ] Lógica de agregar/editar/quitar items
  - [ ] Cálculo automático de total
  - [ ] Modal para selección de variantes
- [ ] Pantalla: Admin CRUD
  - [ ] Listar productos
  - [ ] Formulario crear/editar producto
  - [ ] Confirmación de eliminación
- [ ] Navegación básica entre pantallas
- [ ] Estilos básicos (Tailwind o Angular Material)

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
