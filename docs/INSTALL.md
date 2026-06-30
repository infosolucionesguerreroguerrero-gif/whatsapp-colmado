# Manual de instalación

## Requisitos

- **Node.js >= 18** (probado en Node 22).
- **SQL Server 2019+** (o SQL Server Express) para producción. Para demo no se
  necesita (`DB_DRIVER=memory`).
- Para WhatsApp:
  - **Baileys**: un número de WhatsApp para escanear el QR.
  - **Cloud API**: cuenta de Meta for Developers + número y token.
- Para IA: **API key de OpenAI** (opcional; por defecto se usan reglas).
- Para impresión: impresora térmica **ESC/POS** (red TCP 9100) o usar salida a
  archivo.

## 1. Clonar e instalar

```bash
git clone <repo-url> whatsapp-colmado
cd whatsapp-colmado
npm install
cp .env.example .env
```

## 2. Configurar `.env`

Edita las variables según tu entorno (ver tabla en el README). Mínimo para demo:

```env
DB_DRIVER=memory
WHATSAPP_PROVIDER=console
AI_PROVIDER=rules
PRINTER_DRIVER=file
```

## 3. Base de datos (producción)

```bash
# Asegúrate de tener DB_DRIVER=mssql y credenciales correctas en .env
npm run db:setup     # crea la BD completa y carga datos iniciales
```

O ejecuta manualmente los scripts de `sql/` con SSMS / `sqlcmd` en orden
(01 → 06).

## 4. WhatsApp

### Opción A — Baileys (WhatsApp Web)

```env
WHATSAPP_PROVIDER=baileys
BAILEYS_AUTH_DIR=./auth_info_baileys
```

```bash
npm install @whiskeysockets/baileys qrcode-terminal   # dependencias opcionales
npm start
# Escanea el QR que aparece en la terminal con WhatsApp del negocio.
```

> La sesión se guarda en `BAILEYS_AUTH_DIR`; no tendrás que escanear de nuevo.

### Opción B — WhatsApp Cloud API (Meta)

```env
WHATSAPP_PROVIDER=cloud
WHATSAPP_CLOUD_TOKEN=EAAB...
WHATSAPP_CLOUD_PHONE_NUMBER_ID=123456789
WHATSAPP_CLOUD_VERIFY_TOKEN=mi_verify_token
```

Configura el webhook en Meta apuntando a `https://TU_DOMINIO/api/webhook` con el
mismo `verify_token`. El sistema responde la verificación (GET) y procesa los
mensajes (POST) automáticamente.

## 5. IA (opcional)

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
AI_ENABLE_VOICE=true   # transcripción de audios (Whisper)
AI_ENABLE_IMAGE=true   # reconocimiento de productos por foto
```

```bash
npm install openai
```

## 6. Impresora

```env
PRINTER_DRIVER=network
PRINTER_HOST=192.168.1.50
PRINTER_PORT=9100
PRINTER_WIDTH=42
```

Para pruebas sin hardware usa `PRINTER_DRIVER=file` (genera `tickets/*.txt` y
`*.bin`).

## 7. Ejecutar

```bash
npm start            # API + WebSocket + WhatsApp
npm run dev          # con recarga automática (nodemon)
npm run bot:console  # demo del bot en la terminal
```

## 8. Verificar

```bash
curl http://localhost:3000/api/health
npm test
```
