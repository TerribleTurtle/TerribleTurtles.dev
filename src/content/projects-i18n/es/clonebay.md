---
title: "Clone Bay"
summary: "Panel solo de navegador para jugadores de EVE Online con varias cuentas."
disclaimer: "Proyecto no oficial de fans. No está afiliado con CCP Games ni respaldado por ellos."
screenshotAlt: "El panel de Clone Bay: una cuadrícula de seis tarjetas de personaje con retrato, ubicación, cartera, puntos de habilidad, clones, fatiga de salto y nave, y botones de estado para habilidades, correo y guerras. Los nombres de los personajes están difuminados y los retratos, suavizados."
source: "e244fe55a52ccf1126ed85c39f4b31e07a97f5ab2e9696af08b1f45e8b1f78ff"
---

Juego con varios personajes de EVE Online, y revisar cada uno implicaba iniciar sesión o cambiar de ventana solo para ver si una cola de habilidades se había vaciado o un extractor se había detenido. Clone Bay los reúne todos en una sola página de solo lectura.

Muestra:

- **Colas de habilidades**: progreso del entrenamiento, horas de finalización y avisos de cola vacía.
- **Interacción planetaria**: ciclos de extractores y avisos de caducidad.
- **Trabajos de industria**: temporizadores de fabricación, investigación e invención.
- **Resumen del personaje**: fatiga de salto, clones, ubicación, nave, cartera y correo.
- **Luces de estado**: indicadores verdes, amarillos y rojos para que los problemas destaquen en toda la lista de personajes.

No hay backend. Inicias sesión con EVE SSO (OAuth 2.0 con PKCE), los tokens se quedan en tu navegador y cada petición va directamente a los servidores de CCP. Un botón de borrado elimina todo lo guardado localmente.
