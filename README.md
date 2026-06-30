# 🛒 WhatsApp Colmado — Sistema inteligente de pedidos

Sistema completo de recepción, procesamiento y gestión de pedidos para un
**colmado / minimarket**, donde **toda la interacción del cliente ocurre por
WhatsApp** (sin apps móviles ni web para el cliente).

- **Node.js + Express** — API REST y orquestación.
- **SQL Server** — persistencia (esquema, SPs, triggers, vistas).
- **WhatsApp** — Baileys (WhatsApp Web) o WhatsApp Cloud API (Meta).
- **IA / NLU** — interpretación de lenguaje natural (reglas offline u OpenAI).
- **ESC/POS** — impresión térmica automática del ticket.
- **WebSocket** — seguimiento de pedidos en tiempo real (panel de caja).
- **Clean Architecture + SOLID** — Repository / Service / DTO / Dependency Injection.

```
CLIENTE → WHATSAPP → BOT INTELIGENTE → MOTOR DE PEDIDOS → SQL SERVER → IMPRESORA TÉRMICA
```

---

## 🚀 Inicio rápido (modo demo, sin SQL Server ni WhatsApp)

El proyecto arranca "out of the box" usando un **driver de base de datos en
memoria**, **NLU por reglas** e **impresión a archivo**. Ideal para probar todo
el flujo sin infraestructura.

```bash
npm install
cp .env.example .env        # ya viene en modo demo (DB_DRIVER=memory, etc.)
npm run bot:console         # conversa con el bot desde la terminal
```

Escribe en la terminal: `hola` → `1` → `quiero dos coca cola 2L y un arroz de 10 lb` → `1` → `1` → `1`.

O levanta el servidor completo (API + WebSocket):

```bash
npm start
# API en http://localhost:3000/api  ·  WS en ws://localhost:3001
```

Prueba el bot por HTTP:

```bash
curl -X POST http://localhost:3000/api/bot/message \
  -H 'Content-Type: application/json' \
  -d '{"from":"18095551234","text":"quiero dos coca cola 2L y un arroz de 10 lb"}'
```

---

## 🧩 Funcionalidades

- **Bienvenida con menú** (Hacer pedido, Ofertas, Consultar, Repetir, Operador).
- **Identificación automática** del cliente por número de WhatsApp; registro
  guiado de clientes nuevos (nombre, dirección, referencia, sector).
- **Creación de pedidos en lenguaje natural**: *"quiero dos coca cola de dos litros y un arroz de diez libras"*.
- **Carrito** temporal con subtotal, envío, ITBIS y total.
- **Modificación**: *"quita una coca"*, *"agrega dos panes"*, *"elimina todo"*.
- **Catálogo** por categorías y **ofertas** vigentes.
- **Repetir pedido** anterior.
- **Pedidos por voz e imagen** (requiere IA configurada — ver `AI_ENABLE_VOICE`/`AI_ENABLE_IMAGE`).
- **Confirmación** con resumen, **formas de pago** (efectivo, transferencia, tarjeta, contra entrega).
- **Estados del pedido** (Recibido → Confirmado → Preparando → Enviado → Entregado / Cancelado).
- **Impresión automática** del ticket ESC/POS al confirmar.
- **API REST** + **JWT**, rate limiting, validación, manejo de errores y auditoría.
- **WebSocket** para notificaciones en vivo.

---

## ⚙️ Configuración (`.env`)

Ver `.env.example`. Variables clave:

| Variable | Valores | Descripción |
|---|---|---|
| `DB_DRIVER` | `memory` \| `mssql` | Backend de datos. `memory` para demo, `mssql` para producción. |
| `WHATSAPP_PROVIDER` | `console` \| `baileys` \| `cloud` | Canal de WhatsApp. |
| `AI_PROVIDER` | `rules` \| `openai` | Motor NLU. |
| `PRINTER_DRIVER` | `file` \| `network` \| `noop` | Salida de impresión. |

Documentación detallada: [`docs/INSTALL.md`](docs/INSTALL.md) y [`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## 🗄️ Base de datos

Scripts en [`sql/`](sql/) (ejecutar en orden) o automáticamente:

```bash
# Con DB_DRIVER=mssql y credenciales en .env
npm run db:setup     # crea BD, tablas, índices, vistas, SPs, triggers y seed
```

Esquema y diagrama: [`docs/DATABASE.md`](docs/DATABASE.md).

---

## 🏛️ Arquitectura

Clean Architecture en 4 capas (dominio → aplicación → infraestructura → interfaces).
Detalle y diagramas en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) y el flujo
conversacional en [`docs/FLOW.md`](docs/FLOW.md).

```
src/
├── domain/          # Entidades, value-objects, errores, interfaces de repos
├── application/     # Servicios (casos de uso) + DTOs
├── infrastructure/  # SQL Server, WhatsApp, IA/NLU, impresión, logger
├── interfaces/      # HTTP (API REST), WebSocket, Bot conversacional
└── config/          # env + contenedor de inyección de dependencias
```

---

## 🧪 Calidad

```bash
npm run lint     # ESLint
npm test         # Jest (dominio, NLU, ticket ESC/POS, flujo del bot)
```

---

## 📡 API REST (resumen)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/auth/login` | — | Token JWT (admin) |
| GET | `/api/productos` | — | Catálogo |
| GET | `/api/productos/buscar?q=` | — | Búsqueda |
| GET | `/api/categorias` | — | Categorías |
| GET | `/api/ofertas` | — | Ofertas vigentes |
| POST | `/api/cliente` | — | Crear/actualizar cliente |
| GET | `/api/cliente/:telefono` | JWT | Obtener cliente |
| GET | `/api/pedido` | JWT | Listar pedidos |
| GET | `/api/pedido/:id` | — | Detalle |
| GET | `/api/pedido/:id/estado` | — | Estado |
| POST | `/api/pedido` | — | Crear pedido (imprime ticket) |
| PUT | `/api/pedido/:id` | JWT | Cambiar estado |
| DELETE | `/api/pedido/:id` | JWT | Cancelar |
| POST | `/api/imprimir` | JWT | Reimprimir ticket |
| POST | `/api/bot/message` | — | Inyectar mensaje al bot |
| GET/POST | `/api/webhook` | — | Webhook WhatsApp Cloud API |

---

## 📄 Licencia

MIT.
