# Orbin AI — Códigos promocionales · Plan INDUSTRIAL (Enterprise)

> ⚠️ CONFIDENCIAL. No subir este archivo a un repo público. Cada código desbloquea
> el plan Industrial (export PDF/CSV/CNC/BOM) sin pago. Reparte de forma controlada.

Generados: 10 códigos aleatorios · uso de campaña/beta · plan `enterprise` (= Industrial).

| # | Código | Plan | Estado |
|---|--------|------|--------|
| 1 | ORBIN-TWX2-KGXU | Industrial | activo |
| 2 | ORBIN-GT3J-QURV | Industrial | activo |
| 3 | ORBIN-SYP9-TACN | Industrial | activo |
| 4 | ORBIN-TUTW-DN3D | Industrial | activo |
| 5 | ORBIN-NRDZ-BLDS | Industrial | activo |
| 6 | ORBIN-A49L-UPSZ | Industrial | activo |
| 7 | ORBIN-VH6W-6Y58 | Industrial | activo |
| 8 | ORBIN-J59N-3FGS | Industrial | activo |
| 9 | ORBIN-B9MR-36AX | Industrial | activo |
| 10 | ORBIN-ZJR5-GBRD | Industrial | activo |

## Cómo se canjean
En la pantalla de **Registro** (o en el panel de cuenta), campo "Código Promocional" →
escribir el código → "Aplicar". Activa el plan Industrial en `user_metadata.plan`.

## Cómo quedan cableados (para el dev/Antigravity)
Se agregan al objeto `PROMO_CODES` en `client/src/context/UserContext.jsx`, cada uno como:
`'ORBIN-XXXX-XXXX': { plan: 'enterprise', company_name: '', label: 'Industrial Desbloqueado' }`

## ⚠️ Nota de seguridad (founder)
El sistema de promos es **client-side**: estos códigos quedan visibles en el bundle JS,
así que un usuario técnico podría leerlos todos. Para una campaña real conviene validarlos
**server-side** (endpoint que verifica el código contra una tabla y setea el plan vía
service_role). Aceptable para beta/giveaway controlado; no para escala.
