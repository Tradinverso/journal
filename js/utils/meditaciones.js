// Lista de meditaciones — audios locales en assets/audio/.
// La app es estática (no puede "leer" una carpeta), así que la lista va escrita
// aquí (mismo patrón que FORMACION). Para añadir/quitar audios: deja el MP3 en
// assets/audio/ y edita esta lista con su nombre de archivo exacto.
//
// Campos: { titulo, autor, desc, src }  · `src` = ruta relativa al MP3.
//
// Cada edición (edition.js) tiene su lista: en la Nasdaq se ven las tres, pero
// solo la pre-operativa de David se puede escuchar (y es el único MP3 de su
// repo); el resto sale con candado hacia el programa completo, sin audio.

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

const NASDAQ_ABIERTAS = ['assets/audio/meditacion-pre-operativa.mp3'];
const NASDAQ = COMPLETO.map(m => NASDAQ_ABIERTAS.includes(m.src)
  ? m
  : { titulo: m.titulo, autor: m.autor, desc: m.desc, bloqueado: true });

export const MEDITACIONES = IS_NASDAQ ? NASDAQ : COMPLETO;
