---
name: testing-bot-demo
description: Test the WhatsApp colmado order bot end-to-end in demo mode (no real WhatsApp/SQL/printer/AI credentials). Use when verifying the conversational purchase flow, NLU parsing, cart totals, order creation, or ESC/POS ticket generation.
---

# Testing the WhatsApp Colmado bot (demo mode)

The whole system runs without any external infrastructure thanks to swappable drivers
selected in `.env` (composition root: `src/config/container.js`). Demo defaults:
`DB_DRIVER=memory`, `WHATSAPP_PROVIDER=console`, `AI_PROVIDER=rules`, `PRINTER_DRIVER=file`.

## Run it
```
cp -n .env.example .env
npm install        # only first time
npm run bot:console
```
The app under test IS an interactive terminal program (it simulates WhatsApp), so test it
in a real terminal / GUI konsole and type one message at a time, waiting for each reply.

- The console provider auto-injects `hola` on start, so you immediately see the welcome menu.
- Default simulated client phone: `18090000001`.
- Generated tickets are written to `tickets/ticket-<id>.txt` (human readable) and
  `tickets/ticket-<id>.bin` (raw ESC/POS bytes). The order id sequence starts at 1001
  in memory mode (1000 IDENTITY in SQL).

## Golden-path conversation (proves the feature)
Type these sequentially (a NEW client must register before ordering):
```
quiero dos coca cola 2L y un arroz de 10 lb   # new client -> bot asks to register
Juan Perez                                     # nombre
Calle Duarte 25                                # direccion
no                                             # referencia
Los Mina                                       # sector  -> "registrado"
quiero dos coca cola 2L y un arroz de 10 lb   # re-issue order
1                                              # Si, agregar al carrito
1                                              # Confirmar
1                                              # Efectivo  -> Pedido #1001 + ticket
mi pedido                                      # status query
```

## High-signal assertions (would fail if broken)
- New client is FORCED to register before any purchase.
- NLU extracts 2 items with quantities from free text.
- **Offer pricing**: 2 Coca Cola 2L = RD$198 (2x99), NOT 2x120=240. Seed offer in
  `src/infrastructure/db/seedData.js` (precio 120, oferta 99).
- Cart total: Subtotal 748 + Envio 100 = TOTAL RD$848.
- After paying: "Pedido #1001 ... Estado: Recibido" and a "Ticket guardado" log line.
- `tickets/ticket-001001.bin` starts with ESC/POS bytes `1b 40` and contains `1b 61 01`
  (center) and `1b 45 01` (bold) -> confirms real ESC/POS encoding, not plain text.

## Gotchas
- Do NOT pipe all input lines at once into `console-bot.js`: readline fires all buffered
  `line` events before the async handlers finish, causing a state race ("Para registrarte"
  repeats). Send messages one at a time (interactive) — the integration test
  `tests/botFlow.test.js` and the HTTP `POST /api/bot/message` path are sequential and pass.
- Increasing konsole font: use `Ctrl++` (Ctrl+Shift+plus types literal `+`).
- Bot state is in-memory per process; restart `npm run bot:console` for a fresh client.

## Unit/lint regression
```
npx jest --runInBand   # 19 tests
npx eslint .           # exit 0
```

## Not testable here (need user credentials/hardware)
Real WhatsApp (Baileys QR / Cloud API token), OpenAI NLU (`AI_PROVIDER=openai`), network
thermal printer (`PRINTER_DRIVER=network`), real SQL Server (`DB_DRIVER=mssql` +
`npm run db:setup`).

## Devin Secrets Needed
None for demo-mode testing. For production-path testing the user must provide:
`OPENAI_API_KEY`, WhatsApp Cloud API token/verify token (or a Baileys session), SQL Server
connection vars, and the printer IP — none are required for the golden-path test above.
