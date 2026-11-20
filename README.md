# La dignidad humana frente a las realidades sociales
Sitio interactivo del Módulo 3 (DSI). Sitio estático: `index.html`, `style.css`, `app.js`, `config.js`.

## 1. Publicar en GitHub Pages
1. Crea un repositorio nuevo (ej. `dignidad-dsi`) y sube estos archivos a la raíz.
2. Settings → Pages → Source: *Deploy from a branch* → `main` / `/ (root)`.
3. Tu sitio queda en `https://TU-USUARIO.github.io/dignidad-dsi/`.

## 2. Recibir las respuestas de todos (Firebase, gratis, ~5 min)
GitHub Pages solo sirve archivos; para que muchas personas envíen respuestas desde su celular se necesita una base de datos.
1. https://console.firebase.google.com → *Agregar proyecto* (sin Analytics).
2. *Compilación → Firestore Database → Crear base de datos* (modo producción, cualquier región).
3. Pestaña **Reglas**, pega esto y *Publicar*:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /respuestas/{id} { allow read, write: if true; allow delete: if true; }
    match /sesion/{id}     { allow read, write: if true; }
  }
}
```
4. *Configuración del proyecto (engranaje) → Tus apps → Web (</>)* → registra la app y copia `apiKey` y `projectId`.
5. Pégalos en `config.js` junto con tu `ADMIN_PASSWORD`, guarda y sube el cambio.

> Las reglas son abiertas para que funcione sin inicio de sesión: quien tenga el enlace y conozca la API podría leer o borrar datos. Para una sesión puntual es razonable; al terminar, descarga el CSV y borra el proyecto o cambia las reglas a `allow read, write: if false;`.

## 3. Usar el día de la sesión
- **Participantes**: abren el enlace → nombre, decanato (solo número) y pastoral → responden en cada pantalla (se guarda solo).
- **Facilitador**: `…/#admin` + contraseña.
  - *Control en vivo*: marca la pantalla activa; quienes activen “Seguir al facilitador” avanzan contigo.
  - *Respuestas y descarga*: tabla en vivo (se actualiza cada 15 s), **Descargar CSV (Excel)** o JSON.
  - *Evaluación*: lista de cotejo y respuestas esperadas.
- Proyección: tecla **P** = letra grande; flechas ← → para navegar.

Sin configurar Firebase el sitio funciona en *modo local* (respuestas solo en ese navegador), útil para probar.
