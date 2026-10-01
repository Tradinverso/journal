// Lista de meditaciones — audios locales en assets/audio/.
// La app es estática (no puede "leer" una carpeta), así que la lista va escrita
// aquí (mismo patrón que FORMACION). Para añadir/quitar audios: deja el MP3 en
// assets/audio/ y edita esta lista con su nombre de archivo exacto.
//
// Campos: { titulo, autor, desc, src }  · `src` = ruta relativa al MP3.
//
// Cada edición (edition.js) tiene su lista: la Nasdaq solo lleva la
// pre-operativa de David (y su repo solo tiene ese MP3).

import { IS_NASDAQ } from '../edition.js';

const COMPLETO = [
  {
    titulo: 'Meditación pre-operativa',
    autor: 'Tradinverso',
    desc: 'Para centrarte y entrar al mercado con calma antes de operar.',
    src: 'assets/audio/meditacion-pre-operativa.mp3',
  },
  {
    titulo: 'Estar presente',
    autor: 'Mario Alonso Puig',
    desc: 'Atención plena para operar desde el presente, sin ruido mental.',
    src: 'assets/audio/mario-alonso-puig-estar-presente.mp3',
  },
  {
    titulo: 'Del corazón',
    autor: 'Mario Alonso Puig',
    desc: 'Conexión y serenidad para gestionar la parte emocional.',
    src: 'assets/audio/mario-alonso-puig-del-corazon.mp3',
  },
];

const NASDAQ = COMPLETO.filter(m => m.src === 'assets/audio/meditacion-pre-operativa.mp3');

export const MEDITACIONES = IS_NASDAQ ? NASDAQ : COMPLETO;
