// ==================================================================
//  CONFIGURACIÓN  (edita solo este archivo)
// ============================================================
window.CONFIG = {
  // Contraseña del panel del facilitador (entra con  tu-sitio/#admin ).
  // Nota: es una barrera ligera del lado del navegador, no seguridad real.
  ADMIN_PASSWORD: "cambia-esta-clave",

  // Base de datos en la nube (Firebase Firestore, gratis) para que TODAS las
  // personas envíen respuestas desde su celular y tú las descargues.
  // Sigue el README.md (5 minutos) y pega aquí tus datos.
  // Si lo dejas vacío, el sitio funciona en "modo local" (solo para pruebas).
  FIREBASE: {
    apiKey: "",
    projectId: ""
  },

  // Cantidad de decanatos (solo se permiten números). Pon 0 para no limitar.
  MAX_DECANATO: 0
};
