# Skill: Orbin Parametric Engine

## Description
Aplica reglas técnicas de carpintería para generar despieces y listas de corte precisas (MVP: Closets).

## Hard Rules
- **Material Standard:** Grosor por defecto de 18mm para estructura y 6mm para fondos.
- **Edge Banding (Tapacantos):** Descontar siempre 0.45mm o 2mm según el tipo de acabado especificado por el usuario.
- **Hardware Clearance:** Dejar 13mm de holgura por lado para correderas telescópicas en cajones.
- **Output Format:** Siempre entregar un JSON estructurado listo para ser procesado por un script de optimización de corte (Nesting).
