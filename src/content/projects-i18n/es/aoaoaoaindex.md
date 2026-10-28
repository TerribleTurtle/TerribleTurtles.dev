---
title: "AOAOAOA Index"
summary: "Buscador de citas, personajes y sketches para Artists on Artists on Artists on Artists."
disclaimer: "Proyecto no oficial de fans. No está afiliado con los creadores de Artists on Artists on Artists on Artists ni respaldado por ellos."
screenshotAlt: "Página de inicio de AOAOAOA Index: una barra lateral con filtros de reparto e invitados y tipos de gag junto a una cuadrícula de tarjetas de episodios con miniaturas, listas de reparto y enlaces al desglose de cada episodio."
source: "1064d32bfd67cbe418419daa1e2fc0b5e4964987ecff8d943834682aed1e9863"
---

*Artists on Artists on Artists on Artists* es un pódcast de comedia de improvisación en el que cuatro presentadores y una persona invitada interpretan cada semana a distintos expertos de un sector. Con cientos de episodios y personajes, encontrar un sketch o una cita concreta implicaba revisar horas de vídeo. Construí AOAOAOA Index para que se pudiera buscar en todo el catálogo.

Incluye:

- **Búsqueda en transcripciones**: búsqueda de texto completo en líneas habladas, resúmenes de sketches y nombres de personajes, con enlaces con marca de tiempo que abren YouTube dos segundos antes de la frase.
- **Desglose de episodios**: líneas temporales cronológicas de sketches, listas de reparto y premisas de cada episodio.
- **Directorios de personajes e intérpretes**: perfiles que registran cada aparición, personaje recurrente y sketch destacado del programa.
- **Filtros laterales**: filtra episodios por reparto e invitados (incluir o excluir), tipos de gag, recopilatorios y fechas de emisión, o elige un sketch al azar.
- **Canalización de datos sin conexión**: un proceso en Python que combina subtítulos de YouTube y datos de la wiki comunitaria en una instantánea SQLite de solo lectura servida en memoria.
