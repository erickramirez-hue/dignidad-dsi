/* ===========================================================
   Sesión: La dignidad humana frente a las realidades sociales
   =========================================================== */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CFG = window.CONFIG || {};
const FB = CFG.FIREBASE || {};
const CLOUD = !!(FB.apiKey && FB.projectId);
const LS = { user: "dh_user", ans: "dh_answers", local: "dh_local_db", step: "dh_step", follow: "dh_follow" };
const jget = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* ---------- Preguntas (clave → etiqueta para el CSV) ---------- */
const LABELS = {
  q1: "Inicio · ¿Qué tienen en común estas situaciones?",
  q2: "Inicio · ¿En qué momento dejamos de reconocer al otro como persona con el mismo valor?",
  q3: "Inicio · ¿La dignidad se respeta solo evitando hacer daño o también actuando ante injusticias?",
  r1: "Desarrollo · ¿Es suficiente tratar bien a las personas si somos indiferentes ante las injusticias?",
  a1: "Actividad · Situación 1 (espacio público) – principio(s)",
  a2: "Actividad · Situación 2 (inundación) – principio(s)",
  a3: "Actividad · Situación 3 (recursos educativos) – principio(s)",
  c1: "Caso · ¿Se respeta la dignidad de todos los estudiantes?",
  c2: "Caso · ¿Qué situación de desigualdad se presenta?",
  c3: "Caso · ¿Qué principio de la DSI debería orientar la solución?",
  c4: "Caso · ¿Qué responsabilidad tiene la institución?",
  f1: "Ficha · 1. Situación identificada",
  f2: "Ficha · 2. Análisis de la dignidad humana",
  f3: "Ficha · 3. Relación con la DSI",
  f4: "Ficha · 4. Propuesta de acción",
  z1: "Cierre · Reflexión final"
};
const KEYS = Object.keys(LABELS);
const PRINCIPIOS = ["Bien común", "Solidaridad", "Subsidiariedad", "Participación"];

/* ---------- Capa de datos ---------- */
const DB = {
  base() { return `https://firestore.googleapis.com/v1/projects/${FB.projectId}/databases/(default)/documents`; },
  async put(user, key, value) {
    const rec = { pid: user.pid, nombre: user.nombre, decanato: String(user.decanato), pastoral: user.pastoral, key, value, ts: new Date().toISOString() };
    if (!CLOUD) {
      const all = jget(LS.local, {}); all[user.pid + "_" + key] = rec; jset(LS.local, all); return;
    }
    const fields = {}; for (const k in rec) fields[k] = { stringValue: String(rec[k]) };
    const r = await fetch(`${this.base()}/respuestas/${encodeURIComponent(user.pid + "_" + key)}?key=${FB.apiKey}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields })
    });
    if (!r.ok) throw new Error("save " + r.status);
  },
  async all() {
    if (!CLOUD) return Object.values(jget(LS.local, {}));
    let out = [], tok = "";
    do {
      const r = await fetch(`${this.base()}/respuestas?pageSize=300&key=${FB.apiKey}${tok ? "&pageToken=" + tok : ""}`);
      if (!r.ok) throw new Error("list " + r.status);
      const j = await r.json();
      (j.documents || []).forEach(d => { const o = {}; for (const k in d.fields) o[k] = d.fields[k].stringValue; out.push(o); });
      tok = j.nextPageToken || "";
    } while (tok);
    return out;
  },
  async getState() {
    if (!CLOUD) { const s = jget("dh_local_state", {}); return { paso: s.paso ?? null, contenido: s.contenido || "" }; }
    const r = await fetch(`${this.base()}/sesion/estado?key=${FB.apiKey}`);
    if (!r.ok) return { paso: null, contenido: "" };
    const f = (await r.json()).fields || {};
    return { paso: f.paso?.integerValue === undefined ? null : +f.paso.integerValue, contenido: f.contenido?.stringValue || "" };
  },
  async getStep() { return (await this.getState()).paso; },
  async patchState(field, value) {
    if (!CLOUD) { jset("dh_local_state", { ...jget("dh_local_state", {}), [field]: field === "paso" ? +value : value }); return; }
    const body = { fields: { [field]: field === "paso" ? { integerValue: String(value) } : { stringValue: String(value) } } };
    const r = await fetch(`${this.base()}/sesion/estado?updateMask.fieldPaths=${field}&key=${FB.apiKey}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error("state " + r.status);
  },
  setStep(n) { return this.patchState("paso", n); },
  setContent(str) { return this.patchState("contenido", str); },
  async clear() {
    if (!CLOUD) { localStorage.removeItem(LS.local); return; }
    const rows = await this.all();
    await Promise.all(rows.map(o => fetch(`${this.base()}/respuestas/${encodeURIComponent(o.pid + "_" + o.key)}?key=${FB.apiKey}`, { method: "DELETE" })));
  }
};

/* ---------- Contenido de la sesión ---------- */
const ask = (key, label, hint = "") => `
  <div class="ask"><label for="${key}">${label} ${hint ? `<span class="hint">${hint}</span>` : ""}</label>
  <textarea id="${key}" data-key="${key}" placeholder="Escribe tu respuesta…"></textarea><div class="saved" data-saved="${key}">✔ Guardado</div></div>`;

const STEPS = [
  { id: "portada", title: "Inicio", html: () => `
    <div class="kicker">Módulo 3 · La dignidad de la persona humana desde la Doctrina Social de la Iglesia</div>
    <h1>La dignidad humana frente a las realidades sociales</h1>
    <p class="lead">Sesión única · Modalidad virtual · 60 minutos</p>
    <div class="grid" style="margin-top:1.5rem">
      <div class="card"><h3>Propósito</h3><p>Analizar situaciones que vulneran la dignidad humana y relacionarlas con los principios de la Doctrina Social de la Iglesia (DSI), reconociendo la responsabilidad personal y social en su defensa.</p></div>
      <div class="card"><h3>Aprendizaje esperado</h3><p>Relaciona situaciones de la vida cotidiana con los principios de la DSI y propone acciones concretas para defender la dignidad humana.</p></div>
      <div class="card"><h3>Ruta de la sesión</h3>
        <p style="margin:0">① Inicio · 10 min<br>② Dignidad como fundamento · 15 min<br>③ Principios de la DSI · 15 min<br>④ Del reconocimiento al compromiso · 20 min</p></div>
    </div>
    <div class="notice" style="margin-top:1.2rem">Responde en los recuadros que aparecen en cada pantalla: tus respuestas se guardan solas y el facilitador podrá verlas.</div>` },

  { id: "inicio", title: "¿Qué tan digna es nuestra sociedad?", html: () => `
    <div class="kicker">1 · Inicio <span class="time">10 min</span></div>
    <h2>¿Qué tan digna es nuestra sociedad?</h2>
    <p class="lead">Recuperamos conocimientos previos y reflexionamos sobre las contradicciones entre reconocer la dignidad humana y las condiciones sociales actuales.</p>
    <div class="grid">
      <div class="card case"><div class="tag">Caso 1 · Exclusión social</div><p>Una persona en situación de calle es ignorada y rechazada cuando solicita ayuda.</p></div>
      <div class="card case"><div class="tag">Caso 2 · Discriminación laboral</div><p>Una persona es descartada de un empleo debido a su edad, aunque cumple con los requisitos.</p></div>
      <div class="card case"><div class="tag">Caso 3 · Exclusión educativa</div><p>Un estudiante es objeto de burlas y aislamiento por sus condiciones económicas.</p></div>
    </div>
    ${ask("q1", "¿Qué tienen en común estas situaciones?")}
    ${ask("q2", "¿En qué momento dejamos de reconocer al otro como una persona con el mismo valor que nosotros?")}
    ${ask("q3", "¿La dignidad humana se respeta únicamente evitando hacer daño o también implica actuar ante las injusticias?")}
    <div class="box"><h3>Cierre del momento</h3><p>La DSI invita a pasar del reconocimiento de la dignidad humana a un compromiso concreto con las personas y con la transformación de las condiciones sociales injustas.</p></div>` },

  { id: "fundamento", title: "Fundamento bíblico", html: () => `
    <div class="kicker">2 · Desarrollo <span class="time">15 min</span></div>
    <h2>La dignidad humana, fundamento de la DSI</h2>
    <p class="lead">Comprender por qué la dignidad humana es el fundamento de los principios y las orientaciones sociales de la Iglesia.</p>
    <h3>Fundamento bíblico</h3>
    <div class="quote">«Dios creó al hombre a su imagen; a imagen de Dios lo creó; hombre y mujer los creó».<small>Génesis 1, 26-27</small></div>
    <div class="grid">
      <div class="card"><h3>Una dignidad que no se gana</h3><p>Desde la perspectiva cristiana, todas las personas poseen una dignidad que no depende de su posición económica, capacidades, nacionalidad, edad o reconocimiento social. Su fundamento es haber sido creadas a imagen y semejanza de Dios.</p></div>
      <div class="card"><h3>Nadie es descartable</h3><p>Ninguna persona puede ser considerada inferior, descartable o utilizada únicamente para beneficio de otros.</p></div>
      <div class="card"><h3>Mateo 25, 35-40</h3><p>Jesús enseña a reconocerlo en quienes tienen hambre, sed, están enfermos o necesitan ayuda.</p></div>
    </div>` },

  { id: "social", title: "La dignidad en la vida social", html: () => `
    <div class="kicker">2 · Desarrollo</div>
    <h2>La dignidad humana en la vida social</h2>
    <p class="lead">La DSI no limita la dignidad a una cuestión individual o espiritual: también establece criterios para organizar la convivencia y orientar las decisiones sociales, económicas y políticas.</p>
    <ul class="not-enough">
      <li><b>No basta</b> con reconocer que todas las personas tienen los mismos derechos si existen condiciones que impiden ejercerlos.</li>
      <li><b>No basta</b> con rechazar la discriminación si se mantienen prácticas que excluyen a determinados grupos.</li>
      <li><b>No basta</b> con ayudar ocasionalmente a quien lo necesita si no se cuestionan las condiciones que generan pobreza y desigualdad.</li>
    </ul>
    ${ask("r1", "¿Es suficiente tratar bien a las personas en nuestra vida cotidiana si permanecemos indiferentes ante las injusticias que afectan a nuestra sociedad?")}` },

  { id: "principios", title: "Principios de la DSI", html: () => `
    <div class="kicker">3 · Desarrollo <span class="time">15 min</span></div>
    <h2>Principios de la DSI relacionados con la dignidad humana</h2>
    <p class="lead">Identificamos cómo estos principios orientan la defensa de la dignidad en diferentes situaciones sociales.</p>
    <div class="grid">
      <div class="card"><span class="pill">Bien común</span><p>Las condiciones sociales deben favorecer el desarrollo de todas las personas.</p><div class="ex"><b>Ejemplo:</b> garantizar el acceso a servicios educativos y de salud.</div></div>
      <div class="card"><span class="pill">Solidaridad</span><p>Reconocer que somos responsables unos de otros y que las necesidades ajenas también nos conciernen.</p><div class="ex"><b>Ejemplo:</b> apoyar a personas o comunidades en situación de vulnerabilidad.</div></div>
      <div class="card"><span class="pill">Subsidiariedad</span><p>Respetar la capacidad de las personas y comunidades para participar y resolver sus propios asuntos, con el apoyo necesario.</p><div class="ex"><b>Ejemplo:</b> permitir que una comunidad participe en las decisiones que afectan su entorno.</div></div>
      <div class="card"><span class="pill">Participación</span><p>Todas las personas deben tener oportunidades de intervenir en la construcción de la vida social.</p><div class="ex"><b>Ejemplo:</b> escuchar a los estudiantes en decisiones que afectan su convivencia escolar.</div></div>
    </div>
    <div class="box"><h3>Se complementan</h3><p>La solidaridad impulsa a reconocer las necesidades de los demás; el bien común orienta las decisiones hacia el beneficio colectivo; la subsidiariedad promueve la autonomía y la participación fortalece la intervención de las personas en su comunidad.</p></div>` },

  { id: "actividad", title: "Identifica el principio", html: () => {
    const sits = [
      ["a1", "Una comunidad participa en las decisiones sobre la construcción de un espacio público.", "Participación y subsidiariedad"],
      ["a2", "Un grupo de personas organiza apoyo para familias afectadas por una inundación.", "Solidaridad"],
      ["a3", "Una institución implementa medidas para garantizar que todos sus estudiantes tengan acceso a los recursos educativos.", "Bien común"]];
    return `
    <div class="kicker">3 · Actividad breve</div>
    <h2>Identifica el principio</h2>
    <p class="lead">Elige el principio de la DSI que se relaciona principalmente con cada situación. Puedes marcar más de uno.</p>
    <div class="ask">${sits.map(([k, t, ans], i) => `
      <div class="sit"><div class="q"><b>${i + 1}.</b> ${t}</div>
        <div class="chips" data-multi="${k}">${PRINCIPIOS.map(p => `<label class="chip"><input type="checkbox" value="${p}"><span>${p}</span></label>`).join("")}</div>
        <div class="saved" data-saved="${k}">✔ Guardado</div>
        <div class="answer-key hidden" data-admin-only>Respuesta esperada: <b>${ans}</b></div></div>`).join("")}</div>
    <div class="box"><h3>Cierre del momento</h3><p>Los principios de la DSI no son conceptos aislados, sino orientaciones para tomar decisiones y actuar ante las necesidades de otras personas.</p></div>`; } },

  { id: "caso", title: "Una oportunidad desigual", html: () => `
    <div class="kicker">4 · Cierre <span class="time">20 min</span> · Análisis individual</div>
    <h2>Caso: una oportunidad desigual</h2>
    <div class="card case"><p style="margin:0">En una institución educativa se anuncia un programa de apoyo académico gratuito. Sin embargo, la información únicamente se comparte por medios digitales y en horarios en los que algunos estudiantes no tienen acceso a internet o no pueden conectarse debido a sus responsabilidades laborales.</p><p style="margin:.6rem 0 0">Como consecuencia, algunos estudiantes quedan fuera del programa, aunque también necesitan ese apoyo.</p></div>
    ${ask("c1", "¿Se está respetando la dignidad de todos los estudiantes?")}
    ${ask("c2", "¿Qué situación de desigualdad se presenta?")}
    ${ask("c3", "¿Qué principio de la DSI debería orientar la solución?")}
    ${ask("c4", "¿Qué responsabilidad tiene la institución ante esta situación?")}` },

  { id: "ficha", title: "Ficha: La dignidad humana en mi entorno", html: () => `
    <div class="kicker">4 · Producto final</div>
    <h2>La dignidad humana en mi entorno</h2>
    <p class="lead">Elige una situación de tu entorno (familia, escuela, trabajo o comunidad) donde se respete o vulnere la dignidad humana y completa esta ficha. <b>Individual · 250 a 350 palabras en total.</b></p>
    <div class="ask ficha">
      <div class="field"><label for="f1"><span class="n">1</span>Situación identificada</label><div class="desc">Describe brevemente qué sucede y dónde ocurre.</div><textarea id="f1" data-key="f1" data-ficha></textarea><div class="saved" data-saved="f1">✔ Guardado</div></div>
      <div class="field"><label for="f2"><span class="n">2</span>Análisis de la dignidad humana</label><div class="desc">Explica de qué manera se respeta o vulnera la dignidad de las personas involucradas.</div><textarea id="f2" data-key="f2" data-ficha></textarea><div class="saved" data-saved="f2">✔ Guardado</div></div>
      <div class="field"><label for="f3"><span class="n">3</span>Relación con la DSI</label><div class="desc">Identifica un principio de la DSI que permita analizar la situación y explica por qué.</div><textarea id="f3" data-key="f3" data-ficha></textarea><div class="saved" data-saved="f3">✔ Guardado</div></div>
      <div class="field"><label for="f4"><span class="n">4</span>Propuesta de acción</label><div class="desc">Plantea una acción concreta y viable para defender la dignidad humana.</div><textarea id="f4" data-key="f4" data-ficha></textarea><div class="saved" data-saved="f4">✔ Guardado</div></div>
      <div class="wc" id="wc">0 palabras · meta: 250–350</div>
      <ul class="check" id="check">
        <li data-c="1">Describe claramente una situación de su entorno.</li>
        <li data-c="2">Identifica cómo se respeta o vulnera la dignidad humana.</li>
        <li data-c="3">Relaciona la situación con un principio de la DSI.</li>
        <li data-c="4">Propone una acción concreta y viable.</li>
      </ul>
    </div>
    <p class="notice">No hay nada que subir ni enviar: tu ficha se guarda automáticamente en esta página.</p>` },

  { id: "cierre", title: "Reflexión final", html: () => `
    <div class="kicker">4 · Reflexión final</div>
    <h2>Del reconocimiento al compromiso</h2>
    ${ask("z1", "¿De qué sirve reconocer que todas las personas tienen dignidad si nuestras decisiones y nuestra indiferencia permiten que otras vivan en condiciones injustas?")}
    <div class="box"><h3>Para llevar</h3><p>La DSI invita a transformar el reconocimiento de la dignidad humana en acciones personales y sociales orientadas a la justicia, la solidaridad y el bien común.</p></div>
    <div class="card"><h3>Bibliografía base</h3>
      <p style="margin:0">• Pontificio Consejo Justicia y Paz. <i>Compendio de la Doctrina Social de la Iglesia</i>, capítulo III.<br>
      • Dicasterio para la Doctrina de la Fe. <i>Dignitas Infinita</i> (2024).<br>
      • Biblia: Génesis 1, 26-27 y Mateo 25, 35-40.</p></div>
    <p style="text-align:center;margin-top:1.5rem;font-family:var(--serif);font-size:1.4rem;color:var(--navy)">¡Gracias por tu participación!</p>` }
];

/* ---------- Estado ---------- */
let user = jget(LS.user, null);
let answers = jget(LS.ans, {});
let cur = Math.min(jget(LS.step, 0), STEPS.length - 1);
let visited = new Set([0]);
let follow = jget(LS.follow, true);
let isAdmin = false;
let editMode = false, dirty = false, saveT = null;
let CONTENT = {}, ORIG = [], lastContentStr = null;
const ADMIN_USER = { pid: "admin", nombre: "Facilitador", decanato: "-", pastoral: "Vista del facilitador" };
const timers = {};

/* ---------- Registro ---------- */
function showGate() {
  ["top", "main", "nav", "admin", "rail", "editbar"].forEach(i => $("#" + i).classList.add("hidden"));
  $("#gate").classList.remove("hidden");
  $("#localNotice").classList.toggle("hidden", CLOUD);
}
$("#regForm").addEventListener("submit", e => {
  e.preventDefault();
  const nombre = $("#nombre").value.trim().replace(/\s+/g, " ");
  const dec = $("#decanato").value.trim();
  const past = ($("input[name=pastoral]:checked") || {}).value;
  const err = m => { $("#regErr").textContent = m; };
  if (nombre.length < 3) return err("Escribe tu nombre.");
  if (!/^\d+$/.test(dec) || +dec < 1) return err("El decanato debe ser un número entero (ej. 12).");
  if (CFG.MAX_DECANATO && +dec > CFG.MAX_DECANATO) return err("Ese número de decanato no es válido.");
  if (!past) return err("Elige tu pastoral.");
  user = { pid: "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), nombre, decanato: +dec, pastoral: past };
  jset(LS.user, user);
  DB.put(user, "registro", "ok").catch(() => {});
  startSessionOnce();
});

/* ---------- Sesión ---------- */
function showSession() {
  $("#gate").classList.add("hidden"); $("#admin").classList.add("hidden");
  ["top", "main", "nav", "rail"].forEach(i => $("#" + i).classList.remove("hidden"));
  $("#editbar").classList.toggle("hidden", !isAdmin);
  $("#syncBtn").classList.toggle("hidden", isAdmin);
  document.body.classList.add("has-rail");
  $("#who").innerHTML = isAdmin ? `<b>Facilitador</b><br>Vista con edición` : `<b>${esc(user.nombre)}</b><br>Decanato ${user.decanato} · ${esc(user.pastoral)}`;
}
function startSession() {
  showSession();
  $("#dots").innerHTML = STEPS.map((s, i) => `<button title="${esc(s.title)}" data-i="${i}" aria-label="${esc(s.title)}"></button>`).join("");
  renderSync(); go(cur, false);
  loadContent(); setInterval(poll, 8000);
}
function go(i, remember = true) {
  if (editMode && dirty) saveContent();
  cur = Math.max(0, Math.min(STEPS.length - 1, i)); visited.add(cur); jset(LS.step, cur);
  const s = STEPS[cur];
  $("#main").innerHTML = `<article class="step">${s.html()}</article>`;
  ORIG = editables().map(e => e.innerHTML);
  applyContent();
  if (editMode) setEdit(true);
  if (isAdmin) DB.setStep(cur).catch(() => {});
  renderRail();
  window.scrollTo(0, 0);
  document.title = s.title + " · Dignidad humana";
  $("#bar").style.width = ((cur + 1) / STEPS.length * 100) + "%";
  $("#prev").disabled = cur === 0; $("#next").disabled = cur === STEPS.length - 1;
  document.querySelectorAll(".dots button").forEach((b, k) => { b.classList.toggle("cur", k === cur); b.classList.toggle("vis", visited.has(k) && k !== cur); });
  hydrate();
}
function hydrate() {
  document.querySelectorAll("textarea[data-key]").forEach(t => { t.value = answers[t.dataset.key] || ""; });
  document.querySelectorAll("[data-multi]").forEach(g => {
    const sel = (answers[g.dataset.multi] || "").split(" + ").filter(Boolean);
    g.querySelectorAll("input").forEach(c => { c.checked = sel.includes(c.value); });
  });
  document.querySelectorAll("[data-admin-only]").forEach(e => e.classList.toggle("hidden", !isAdmin));
  updateFicha();
}
function setAnswer(key, value) {
  if (isAdmin) return;
  answers[key] = value; jset(LS.ans, answers);
  clearTimeout(timers[key]);
  timers[key] = setTimeout(async () => {
    try { await DB.put(user, key, value); flash(key, "✔ Guardado"); }
    catch { flash(key, "⚠ Sin conexión: se reintentará al seguir escribiendo"); }
  }, 600);
}
function flash(key, msg) {
  const el = document.querySelector(`[data-saved="${key}"]`); if (!el) return;
  el.textContent = msg; el.classList.add("show"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 2200);
}
const words = s => (s.trim().match(/\S+/g) || []).length;
function updateFicha() {
  const wc = $("#wc"); if (!wc) return;
  const n = ["f1", "f2", "f3", "f4"].reduce((a, k) => a + words(answers[k] || ""), 0);
  wc.textContent = `${n} palabras · meta: 250–350`;
  wc.className = "wc " + (n >= 250 && n <= 350 ? "ok" : n > 350 ? "bad" : "");
  const f = k => words(answers[k] || "");
  const norm = x => (x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const st = { 1: f("f1") >= 15, 2: f("f2") >= 25, 3: f("f3") >= 20 && PRINCIPIOS.some(p => norm(answers.f3).includes(norm(p))), 4: f("f4") >= 20 };
  document.querySelectorAll("#check li").forEach(li => li.classList.toggle("done", !!st[li.dataset.c]));
}
document.addEventListener("input", e => {
  const t = e.target;
  if (editMode && t.classList && t.classList.contains("editing")) { dirty = true; queueSave(); return; }
  if (t.matches("textarea[data-key]")) { setAnswer(t.dataset.key, t.value); if (t.hasAttribute("data-ficha")) updateFicha(); }
});
document.addEventListener("change", e => {
  const g = e.target.closest("[data-multi]"); if (!g) return;
  setAnswer(g.dataset.multi, [...g.querySelectorAll("input:checked")].map(c => c.value).join(" + "));
});
$("#prev").onclick = () => go(cur - 1);
$("#next").onclick = () => go(cur + 1);
$("#dots").onclick = e => { const b = e.target.closest("button"); if (b) go(+b.dataset.i); };
document.addEventListener("keydown", e => {
  if (editMode && e.key === "Enter" && e.target.classList && e.target.classList.contains("editing")) { e.preventDefault(); document.execCommand("insertLineBreak"); return; }
  if (e.target.matches("textarea,input,select") || e.target.isContentEditable) return;
  if (!$("#main").classList.contains("hidden")) {
    if (e.key === "ArrowRight" || e.key === "PageDown") go(cur + 1);
    if (e.key === "ArrowLeft" || e.key === "PageUp") go(cur - 1);
    if (e.key.toLowerCase() === "p") document.body.classList.toggle("proj");
  }
});
function renderSync() { const b = $("#syncBtn"); b.textContent = "Seguir al facilitador: " + (follow ? "sí" : "no"); b.classList.toggle("on", follow); }
$("#syncBtn").onclick = () => { follow = !follow; jset(LS.follow, follow); renderSync(); if (follow) poll(); };
async function poll() {
  if (document.hidden || isAdmin || $("#main").classList.contains("hidden")) return;
  try {
    const st = await DB.getState();
    if (follow && st.paso !== null && st.paso !== cur && st.paso >= 0 && st.paso < STEPS.length) go(st.paso);
    if (st.contenido !== lastContentStr) setContent(st.contenido);
  } catch {}
}
async function loadContent() { try { setContent((await DB.getState()).contenido); } catch {} }
function setContent(str) {
  lastContentStr = str;
  try { CONTENT = str ? JSON.parse(str) : {}; } catch { CONTENT = {}; }
  applyContent();
}

// ---------- Riel lateral: en qué diapositiva estamos ----------
function renderRail() {
  $("#rail").innerHTML = STEPS.map((s, i) => `<button data-i="${i}" class="${i === cur ? "cur" : visited.has(i) ? "vis" : ""}" title="${esc(s.title)}" aria-label="Diapositiva ${i + 1}: ${esc(s.title)}"><b>${i + 1}</b><span>${esc(s.title)}</span></button>`).join("") + `<div class="rail-n">${cur + 1} / ${STEPS.length}</div>`;
}
$("#rail").onclick = e => { const b = e.target.closest("button"); if (b) go(+b.dataset.i); };

// ---------- Modo edición del facilitador (los cambios llegan a todos) ----------
const EDIT_SEL = "h1,h2,h3,p,li,.kicker,.tag,.quote,.ex,.pill,.desc,.q,.notice,.ask>label";
function editables() { const a = $("#main article"); return a ? [...a.querySelectorAll(EDIT_SEL)] : []; }
function sanitize(html) {
  const t = document.createElement("template"); t.innerHTML = html;
  const ok = ["B", "I", "U", "EM", "STRONG", "BR", "SMALL", "SPAN"];
  (function walk(n) {
    [...n.childNodes].forEach(c => {
      if (c.nodeType === 3) return;
      if (c.nodeType !== 1) { c.remove(); return; }
      if (!ok.includes(c.tagName)) { c.replaceWith(document.createTextNode(c.textContent)); return; }
      [...c.attributes].forEach(a => { if (!(c.tagName === "SPAN" && a.name === "class" && /^(time|hint)$/.test(a.value))) c.removeAttribute(a.name); });
      walk(c);
    });
  })(t.content);
  return t.innerHTML;
}
function applyContent() {
  const ov = CONTENT[STEPS[cur].id]; if (!ov) return;
  const els = editables();
  for (const [i, h] of Object.entries(ov)) { const el = els[+i]; if (el && !el.classList.contains("editing")) el.innerHTML = sanitize(h); }
}
function setEdit(on) {
  editMode = on;
  editables().forEach(el => { if (on) { el.setAttribute("contenteditable", "true"); el.classList.add("editing"); } else { el.removeAttribute("contenteditable"); el.classList.remove("editing"); } });
  document.body.classList.toggle("editmode", on);
  $("#eBtn").textContent = on ? "✔ Terminar edición" : "✎ Modo edición";
  $("#eReset").classList.toggle("hidden", !on);
  $("#eInfo").textContent = on ? "Haz clic en cualquier texto para editarlo" : "";
}
function queueSave() { clearTimeout(saveT); $("#eInfo").textContent = "Guardando…"; saveT = setTimeout(saveContent, 800); }
async function saveContent() {
  clearTimeout(saveT); dirty = false;
  const id = STEPS[cur].id, ov = {};
  editables().forEach((el, i) => { const h = sanitize(el.innerHTML); if (h !== sanitize(ORIG[i] || "")) ov[i] = h; });
  if (Object.keys(ov).length) CONTENT[id] = ov; else delete CONTENT[id];
  const str = JSON.stringify(CONTENT);
  try { await DB.setContent(str); lastContentStr = str; $("#eInfo").textContent = "✔ Guardado para todos"; }
  catch { $("#eInfo").textContent = "⚠ No se pudo guardar"; }
}
$("#eBtn").onclick = () => { if (editMode && dirty) saveContent(); setEdit(!editMode); };
$("#eReset").onclick = async () => {
  delete CONTENT[STEPS[cur].id]; dirty = false;
  const str = JSON.stringify(CONTENT);
  try { await DB.setContent(str); lastContentStr = str; } catch {}
  go(cur);
};
document.addEventListener("paste", e => {
  if (!(editMode && e.target.classList && e.target.classList.contains("editing"))) return;
  e.preventDefault(); document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain"));
});

/* ---------- Panel del facilitador ---------- */
function buildRows(recs) {
  const people = {};
  recs.forEach(r => {
    const p = people[r.pid] ||= { pid: r.pid, nombre: r.nombre, decanato: r.decanato, pastoral: r.pastoral, ts: r.ts, a: {} };
    if (r.key !== "registro") p.a[r.key] = r.value;
    if (r.ts > p.ts) p.ts = r.ts;
  });
  return Object.values(people).sort((x, y) => (+x.decanato - +y.decanato) || x.nombre.localeCompare(y.nombre, "es"));
}
const csvCell = v => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ⏎ ")}"`;
function download(name, text, mime) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

function showAdmin() {
  ["gate", "main", "nav", "top", "rail", "editbar"].forEach(i => $("#" + i).classList.add("hidden"));
  const A = $("#admin"); A.classList.remove("hidden");
  if (!isAdmin) {
    A.innerHTML = `<div class="gate" style="margin-top:4vh"><div class="card"><h2>Panel del facilitador</h2>
      <label for="pw" style="font-weight:600">Contraseña</label><input type="password" id="pw" autofocus>
      <div class="err" id="pwErr"></div><button class="btn" id="pwGo" style="width:100%">Entrar</button>
      <p style="text-align:center;margin:1rem 0 0"><a href="#" style="font-size:.85rem">← Volver a la sesión</a></p></div></div>`;
    const tryLogin = () => { if ($("#pw").value === CFG.ADMIN_PASSWORD) { isAdmin = true; showAdmin(); } else $("#pwErr").textContent = "Contraseña incorrecta."; };
    $("#pwGo").onclick = tryLogin; $("#pw").onkeydown = e => { if (e.key === "Enter") tryLogin(); };
    return;
  }
  A.innerHTML = `
    <div class="kicker">Facilitador</div><h2>Panel de la sesión</h2>
    ${CLOUD ? "" : `<p class="notice">Modo local: solo verás respuestas enviadas desde este mismo navegador. Configura Firebase en <code>config.js</code> para recibir las de todos (ver README).</p>`}
    <div class="tabs"><button data-t="ctl" class="on">Control en vivo</button><button data-t="res">Respuestas y descarga</button><button data-t="eva">Evaluación</button></div>
    <div id="tab"></div>
    <p style="margin-top:2rem"><a href="#">← Ver sesión como participante</a></p>`;
  A.querySelector(".tabs").onclick = e => { const b = e.target.closest("button"); if (!b) return; A.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("on", x === b)); tab(b.dataset.t); };
  tab("ctl");
}
let autoTimer;
async function tab(t) {
  clearInterval(autoTimer);
  const T = $("#tab");
  if (t === "ctl") {
    let at = (await DB.getStep().catch(() => null)) ?? 0;
    const draw = () => {
      T.innerHTML = `<p class="lead">Marca la pantalla activa. Los participantes que activen “Seguir al facilitador” avanzarán contigo.</p>
        <div class="grid">${STEPS.map((s, i) => `<button class="card" data-i="${i}" style="text-align:left;cursor:pointer;font:inherit;${i === at ? "border:2px solid var(--gold);background:var(--gold2)" : ""}"><b>${i + 1}. ${esc(s.title)}</b>${i === at ? "<br><small>● pantalla activa</small>" : ""}</button>`).join("")}</div>
        <div class="row"><button class="btn" id="open">Abrir sesión en modo proyección</button><span style="font-size:.85rem;color:var(--ink2)">Tecla <b>P</b> alterna letra grande · flechas ← → navegan</span></div>`;
      T.querySelectorAll("[data-i]").forEach(b => b.onclick = async () => { at = +b.dataset.i; await DB.setStep(at).catch(() => {}); draw(); });
      $("#open").onclick = () => { document.body.classList.add("proj"); if (location.hash) location.hash = ""; else route(); };
    };
    draw();
  }
  if (t === "res") {
    T.innerHTML = `<p>Cargando…</p>`;
    let rows;
    const load = async () => {
      const recs = await DB.all(); rows = buildRows(recs);
      const by = k => rows.reduce((o, r) => (o[r[k]] = (o[r[k]] || 0) + 1, o), {});
      const bp = by("pastoral");
      const q = ($("#srch") || {}).value?.toLowerCase() || "";
      const shown = rows.filter(r => !q || (r.nombre + " " + r.decanato + " " + r.pastoral + " " + Object.values(r.a).join(" ")).toLowerCase().includes(q));
      T.innerHTML = `
        <div class="stats"><div class="stat"><b>${rows.length}</b>participantes</div>
          ${Object.entries(bp).map(([k, v]) => `<div class="stat"><b>${v}</b>${esc(k)}</div>`).join("")}
          <div class="stat"><b>${rows.filter(r => r.a.f1 && r.a.f2 && r.a.f3 && r.a.f4).length}</b>fichas completas</div></div>
        <div class="row"><button class="btn gold" id="dlcsv">⬇ Descargar CSV (Excel)</button><button class="btn" id="dljson">⬇ Descargar JSON</button>
          <button class="btn ghost" id="refresh">↻ Actualizar</button><input type="text" id="srch" placeholder="Buscar…" value="${esc(q)}"></div>
        <div class="tablewrap"><table><thead><tr><th>Nombre</th><th>Dec.</th><th>Pastoral</th>${KEYS.map(k => `<th title="${esc(LABELS[k])}">${esc(LABELS[k])}</th>`).join("")}</tr></thead>
        <tbody>${shown.map(r => `<tr><td><b>${esc(r.nombre)}</b></td><td>${esc(r.decanato)}</td><td>${esc(r.pastoral)}</td>${KEYS.map(k => `<td class="long">${esc(r.a[k] || "")}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${KEYS.length + 3}">Aún no hay respuestas.</td></tr>`}</tbody></table></div>
        <div class="row" style="margin-top:1.2rem"><button class="btn ghost" id="clear" style="color:var(--rose);border-color:var(--rose)">Borrar todas las respuestas</button></div>`;
      $("#refresh").onclick = load;
      $("#srch").oninput = () => { clearTimeout(load._t); load._t = setTimeout(load, 250); };
      $("#srch").focus(); const v = $("#srch").value; $("#srch").setSelectionRange(v.length, v.length);
      $("#dlcsv").onclick = () => {
        const head = ["Nombre", "Decanato", "Pastoral", ...KEYS.map(k => LABELS[k]), "Última actualización"];
        const lines = [head.map(csvCell).join(",")].concat(rows.map(r => [r.nombre, r.decanato, r.pastoral, ...KEYS.map(k => r.a[k] || ""), r.ts].map(csvCell).join(",")));
        download(`respuestas-dignidad-${stamp()}.csv`, "\ufeff" + lines.join("\r\n"), "text/csv;charset=utf-8");
      };
      $("#dljson").onclick = () => download(`respuestas-dignidad-${stamp()}.json`, JSON.stringify(rows.map(r => ({ nombre: r.nombre, decanato: +r.decanato, pastoral: r.pastoral, actualizado: r.ts, respuestas: Object.fromEntries(KEYS.map(k => [LABELS[k], r.a[k] || ""])) })), null, 2), "application/json");
      $("#clear").onclick = async () => { if (confirm("¿Borrar TODAS las respuestas? Descarga antes una copia.") && confirm("Esta acción no se puede deshacer. ¿Continuar?")) { await DB.clear(); load(); } };
    };
    try { await load(); } catch (e) { T.innerHTML = `<p class="notice">No se pudo leer la base de datos (${esc(e.message)}). Revisa la configuración de Firebase y las reglas en el README.</p>`; }
    autoTimer = setInterval(() => { if (!document.activeElement || document.activeElement.id !== "srch") load().catch(() => {}); }, 15000);
  }
  if (t === "eva") {
    T.innerHTML = `<div class="card"><h3>Evidencias</h3><table><thead><tr><th>Evidencia</th><th>Instrumento</th><th>Valor</th></tr></thead><tbody>
      <tr><td>Participación en las preguntas y actividad</td><td>Registro de participación (pestaña Respuestas)</td><td>Formativa</td></tr>
      <tr><td>Ficha de análisis individual</td><td>Lista de cotejo</td><td>100%</td></tr></tbody></table></div>
      <div class="card" style="margin-top:1rem"><h3>Lista de cotejo de la ficha</h3><p style="margin:0">☐ Describe claramente una situación de su entorno.<br>☐ Identifica cómo se respeta o vulnera la dignidad humana.<br>☐ Relaciona la situación con un principio de la DSI.<br>☐ Propone una acción concreta y viable.</p></div>
      <div class="card" style="margin-top:1rem"><h3>Respuestas esperadas · actividad “Identifica el principio”</h3><p style="margin:0">Situación 1: Participación y subsidiariedad · Situación 2: Solidaridad · Situación 3: Bien común.</p></div>`;
  }
}

/* ---------- Arranque ---------- */
function route() {
  if (location.hash === "#admin") return showAdmin();
  if (isAdmin) { $("#admin").classList.add("hidden"); if (!user) user = ADMIN_USER; }
  user ? startSessionOnce() : showGate();
}
let started = false;
function startSessionOnce() { if (started) { showSession(); go(cur, false); return; } started = true; startSession(); }
addEventListener("hashchange", route);
route();
