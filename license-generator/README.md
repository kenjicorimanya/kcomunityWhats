# Codificador y Generador de Licencias - Kcomunitywhats

Esta carpeta contiene la herramienta para generar las claves de activación del programa **Kcomunitywhats**.

---

## 🚀 Cómo usar el generador

### Método 1: Menú Interactivo (Recomendado)
Abre una terminal en esta carpeta y ejecuta:
```bash
node generator.js
```
El asistente te guiará paso a paso:
1. Pide el nombre o referencia del cliente (ej. *Carlos Pérez*).
2. Pregunta el tipo de vigencia:
   - **1)** Vitalicia (Permanente)
   - **2)** 1 Año (365 días)
   - **3)** 6 Meses (180 días)
   - **4)** 1 Mes (30 días)
   - **5)** Cantidad personalizada de días
3. Pregunta si deseas atarla al equipo del cliente:
   - Si presionas **ENTER**, la clave será **Universal** (sirve en cualquier equipo).
   - Si pegas el **ID de Equipo** del cliente (ej. `KHWID-A1B2-C3D4-E5F6`, el cual aparece en la pantalla de bloqueo o en Ajustes > Info del programa), la clave **solo funcionará en esa máquina**.

---

### Método 2: Por línea de comandos directa
```bash
# Licencia Vitalicia Universal:
node generator.js --type=LIFE --client="Cliente 1"

# Licencia de 1 Año atada a una PC:
node generator.js --type=1YEAR --hwid=KHWID-9A8B-7C6D-5E4F --client="Empresa ABC"

# Licencia de 30 días:
node generator.js --type=1MON --client="Usuario Prueba"
```

---

## 📝 Registro de Licencias
Cada vez que generas una clave, se guarda automáticamente con fecha y hora en el archivo `licencias_generadas.log` en esta misma carpeta, para que siempre tengas el historial de a quién le diste cada clave.
