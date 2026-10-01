// Protocolos FIJOS de Tradinverso — iguales para todos los alumnos.
// Escritos en código (la app es estática). Para añadir/editar: pega aquí el
// enlace de cada protocolo (Google Drive/Docs compartido como "Cualquiera con el
// enlace"). Se muestran arriba en la pestaña Protocolos, en solo lectura.
//
// Campos: { titulo, desc, url }
//
// Cada edición (edition.js) tiene su lista: la Nasdaq solo lleva los que
// correspondan a su programa.

import { IS_NASDAQ } from '../edition.js';

const COMPLETO = [
  { titulo: 'Protocolo Operativa', desc: 'La operativa completa de Tradinverso.', url: 'https://drive.google.com/file/d/1Guw8Vxrn_hO9Vxl6dhHoqqfwG3gn-5Nv/view' },
  { titulo: 'Diario del Trader', desc: 'Plantilla para registrar tu operativa.', url: 'https://drive.google.com/file/d/1e38Cq33osDU8On_4O2WRHJ4iv1TdIJmX/view' },
  { titulo: 'Diario Inverso', desc: 'El diario en su versión inversa.', url: 'https://drive.google.com/file/d/1b41w-uvPitJcthb7Vtk0umSkRcsr_C-_/view' },
  { titulo: 'Reset del Trader', desc: 'Protocolo para resetear tu mente tras una racha.', url: 'https://drive.google.com/file/d/1RFGUa_w4BZu4z5q14NsTmkHPu4tcHW-L/view' },
];

// Edición Nasdaq: solo la Operativa y el Reset del Trader (decisión de David).
const NASDAQ_TITULOS = ['Protocolo Operativa', 'Reset del Trader'];
const NASDAQ = COMPLETO.filter(p => NASDAQ_TITULOS.includes(p.titulo));

export const PROTOCOLOS_FIJOS = IS_NASDAQ ? NASDAQ : COMPLETO;
