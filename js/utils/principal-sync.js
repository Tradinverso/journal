// Traer los trades de Nasdaq del PANEL PRINCIPAL (app.tradinverso.com) a la
// app Nasdaq. Solo para el admin: así David no registra cada trade dos veces
// para enseñar la app.
//
// Son dos proyectos de Firebase distintos, con sus propios usuarios, así que
// esto abre una SEGUNDA conexión al proyecto principal ('principal'), con su
// propio inicio de sesión. Firebase la recuerda en este navegador: la
// contraseña solo se pide la primera vez.
//
// Del principal SOLO SE LEE (trades de Nasdaq, cuentas de futuros y las
// gestiones personalizadas). La escritura en la app Nasdaq la hace
// state.syncFromPrincipal.

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, getDocs, doc, getDoc, query, where,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { PRINCIPAL_CONFIG } from '../firebase.js';

const APP_NAME = 'principal';

function principalApp() {
  return getApps().find(a => a.name === APP_NAME) || initializeApp(PRINCIPAL_CONFIG, APP_NAME);
}

// Usuario conectado al principal (o null). Espera a que Firebase recupere la
// sesión guardada antes de contestar.
export function principalUser() {
  const pAuth = getAuth(principalApp());
  return new Promise(resolve => {
    const off = onAuthStateChanged(pAuth, u => { off(); resolve(u); });
  });
}

export async function principalSignIn(email, password) {
  const cred = await signInWithEmailAndPassword(getAuth(principalApp()), email, password);
  return cred.user;
}

export async function principalSignOut() {
  await signOut(getAuth(principalApp()));
}

// Lee del principal lo que hay que copiar. Cuentas: solo las de futuros (la
// app Nasdaq no tiene CFD). Gestiones: solo las personalizadas que usan esas
// cuentas, para que su riesgo se calcule igual.
export async function loadPrincipalData() {
  const user = await principalUser();
  if (!user) throw new Error('No has entrado en el panel principal');
  const db = getFirestore(principalApp());
  const uid = user.uid;
  const [tradesSnap, cuentasSnap, configSnap] = await Promise.all([
    getDocs(query(collection(db, 'users', uid, 'trades'), where('sheet', '==', 'NASDAQ'))),
    getDocs(collection(db, 'users', uid, 'cuentas')),
    getDoc(doc(db, 'users', uid, 'config', 'data')),
  ]);
  const trades = tradesSnap.docs.map(d => ({ ...d.data(), id: d.data().id || d.id }));
  const cuentas = cuentasSnap.docs
    .map(d => ({ ...d.data(), id: d.data().id || d.id }))
    .filter(c => c.tipo === 'Futuros');
  const usadas = new Set(cuentas.map(c => c.futGestion).filter(Boolean));
  const custom = configSnap.exists() ? (configSnap.data().futGestionesCustom || []) : [];
  const gestionesCustom = custom.filter(g => g && usadas.has(g.id));
  return { email: user.email, trades, cuentas, gestionesCustom };
}
