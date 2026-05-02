# Skill: Token Guard & Context Optimizer

## Description
Activa protocolos de ahorro de tokens y gestión de ventana de contexto. Se debe llamar antes de tareas extensas o cuando el uso del contexto supere el 60%.

## Guidelines
- **Summarization:** Antes de procesar, compacta el historial relevante usando el comando `/compact` invisiblemente.
- **Code Minimization:** No reescribas archivos completos; entrega solo los "diffs" o bloques modificados.
- **Local Routing:** Si la tarea es lógica simple (matemática de carpintería), genera un script de Python para que el usuario lo ejecute localmente en lugar de procesar cálculos en la nube.
- **No Verbosity:** Elimina introducciones, cortesías y explicaciones redundantes. Respuestas directas al código.