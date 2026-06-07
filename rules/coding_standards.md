# Orbin AI: Coding & Design Standards

## 1. Arquitectura y Stack
- **Frontend:** React con Tailwind CSS para una interfaz minimalista y profesional.
- **Backend:** Arquitectura orientada a servicios (Node.js/Python).
- **Base de Datos:** Supabase para persistencia y autenticación.
- **IA:** Integración de Gemini (Google AI Studio) para procesamiento de lenguaje natural y visión.

## 2. Principios de Programación (Clean Code)
- **Modularidad:** Dividir la lógica en componentes pequeños y reutilizables.
- **Nomenclatura:** Usar nombres descriptivos en inglés para variables y funciones (ej: `calculateCutList` en lugar de `calc`).
- **Documentación JSDoc:** Cada función compleja debe incluir un comentario breve explicando su propósito, inputs y outputs para facilitar la relectura de la IA.
- **Tipado:** Preferir TypeScript para evitar errores de tipo en la lógica paramétrica de muebles.

## 3. Optimización de Tokens (Directrices para la IA)
- **Modo Diff:** No reescribas archivos enteros si solo cambia una línea. Entrega solo el fragmento modificado.
- **Lógica Local:** Para cálculos de milímetros y descuentos de material, escribe funciones puras de JavaScript/Python que no requieran llamadas constantes a la API.

## 4. Estándares UX/UI (Enfoque Diseñador)
- **Diseño Responsivo:** Prioridad "Mobile-First" para que el carpintero pueda usar Orbin desde el taller.
- **Estética:** Seguir la skill de `diseñador_premium` para mantener interfaces sobrias, elegantes y con alto valor percibido.