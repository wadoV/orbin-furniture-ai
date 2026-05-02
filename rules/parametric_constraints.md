# Orbin AI: Parametric & Manufacturing Constraints

## 1. Dimensiones de Materia Prima (Estándar Brasil/Latam)
- **Placa de MDF/MDP:** Dimensiones máximas de 2750mm x 1840mm. Ninguna pieza individual puede exceder estas medidas.
- **Sentido de la Veta:** Por defecto, la medida más larga de la pieza sigue el sentido de la veta del diseño (textura vertical en laterales, horizontal en repisas).

## 2. Holguras y Tolerancias Técnicas
- **Correderas (Gavetas):** Aplicar descuento de 13mm por lado (26mm total en el ancho del cajón) para herrajes telescópicos.
- **Tapacantos (Bordos):** - PVC Delgado: 0.45mm (no requiere descuento en el corte si la tolerancia es <1mm).
    - PVC Grueso/ABS: 2.00mm (descontar del corte final de la pieza).
- **Fondos:** Ranura de 6mm de profundidad situada a 20mm del borde posterior.

## 3. Límites Estructurales (MDF 18mm)
- **Vanos Libres:** Máximo 900mm para estantes sin apoyo central para evitar pandeo.
- **Zócalos:** Altura mínima de 60mm y máxima de 150mm. Retranqueo (recuo) sugerido de 30mm a 50mm respecto al frente.
- **Módulos:** Altura máxima recomendada de 2600mm para facilitar el montaje en obra.

## 4. Validaciones de Corte
- **Optimización (Nesting):** Dejar un margen de 10mm en el perímetro de la placa para refilado.
- **Espesor de Sierra:** Considerar una pérdida de 4mm por cada pasada de disco de corte.