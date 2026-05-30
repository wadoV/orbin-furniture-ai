# Orbin-Brain-Trainer — Guia de Configuracion en GCC Agent Platform

## Estado actual
- **Servidor Orbin IA:** Corriendo en puerto 3003
- **Tunnel activo:** `https://slimy-eyes-search.loca.lt`
- **Pagina GCC:** Ya abierta en Chrome (console.cloud.google.com/agent-platform)

---

## PASO 1 — Cerrar el modal "Autentica"
Haz click en la **X** (esquina superior derecha del modal).

---

## PASO 2 — Ir a la seccion Agentes
En el menu lateral izquierdo, haz click en **"Agentes"**.

---

## PASO 3 — Crear nuevo agente
Haz click en **"Crear agente"** o **"+ Nuevo agente"**.

Configura:
- **Nombre:** `Orbin-Brain-Trainer`
- **Modelo:** `gemini-2.0-flash` (o el mas reciente disponible)
- **Region:** `us-central1`

---

## PASO 4 — Configurar el Playbook (System Prompt)
En la seccion "Playbook" o "Instrucciones del sistema", pega el contenido completo del archivo:
```
AGENT_SETUP/orbin-brain-trainer-playbook.txt
```

---

## PASO 5 — Agregar herramienta OpenAPI
1. Ve a la seccion **"Tools"** o **"Herramientas"**
2. Haz click en **"+ Agregar herramienta"** → selecciona **"OpenAPI"**
3. En "URL del esquema" o "Especificacion OpenAPI", sube o pega el archivo:
   ```
   AGENT_SETUP/orbin-brain-trainer-openapi.json
   ```
4. Verifica que el endpoint muestre:
   - URL base: `https://slimy-eyes-search.loca.lt`
   - Operacion: `runStressTest` (POST /api/v1/stress-test)

---

## PASO 6 — Guardar y probar
1. Haz click en **"Guardar"** o **"Publicar"**
2. Abre el panel **"Test Agent"** o **"Probar agente"**
3. Envia este mensaje inicial:

```
Prueba un modulo extremo de 100mm de ancho con altura de 2400mm y 18mm de espesor.
Verifica si el motor crashea o retorna un resultado estructuralmente valido.
```

---

## Resultado esperado
El agente debe:
1. Llamar automaticamente a `runStressTest` con `width=100, height=2400, thickness=18`
2. Recibir `qaResult: "STRUCTURAL_FAIL"` o `"ENGINE_CRASH"` (100mm es insuficiente para 2 laterales de 18mm)
3. Reportar el hallazgo y proponer el siguiente caso de prueba

Si el servidor esta corriendo correctamente, veras en la ventana CMD del tunnel que llega una peticion POST.

---

## Verificacion del tunnel (CMD abierto)
En la ventana "Orbin IA — Server + Tunnel", debes ver aparecer:
```
[Orbin] POST /api/v1/stress-test - 200 - Xms
```

Si no aparece, el servidor puede haber caido. Re-ejecuta `orbin-tunnel-start.bat`.

---

## Archivos de este paquete
| Archivo | Uso |
|---|---|
| `orbin-brain-trainer-openapi.json` | Spec OpenAPI para subir a GCC Agent Tools |
| `orbin-brain-trainer-playbook.txt` | System prompt a pegar en el Playbook del agente |
| `GCC_SETUP_STEPS.md` | Este archivo — guia de configuracion |
