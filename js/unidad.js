import { supabase } from "./supabaseClient.js";

const MERMAID_SRC = "https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js";
let mermaidReady = null;

function loadMermaid() {
  if (mermaidReady) return mermaidReady;
  mermaidReady = new Promise((resolve, reject) => {
    if (window.mermaid) return resolve(window.mermaid);
    const script = document.createElement("script");
    script.src = MERMAID_SRC;
    script.onload = () => {
      window.mermaid.initialize({ startOnLoad: false, theme: "neutral" });
      resolve(window.mermaid);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return mermaidReady;
}

async function fetchNextConceptoNuevo(seenConceptoIds) {
  const { data: modulos, error: modulosError } = await supabase
    .from("curso_modulos")
    .select("*")
    .order("orden", { ascending: true });
  if (modulosError) throw modulosError;

  for (const modulo of modulos || []) {
    const { data: conceptos, error: conceptosError } = await supabase
      .from("curso_conceptos")
      .select("*")
      .eq("modulo_id", modulo.id)
      .order("orden", { ascending: true });
    if (conceptosError) throw conceptosError;

    const siguiente = (conceptos || []).find((c) => !seenConceptoIds.has(c.id));
    if (siguiente) return { concepto: siguiente, modulo };
  }
  return null;
}

async function cargarUnidad() {
  const { data: anclas, error: anclasError } = await supabase
    .from("curso_anclas")
    .select("concepto_id");
  if (anclasError) throw anclasError;
  const seen = new Set((anclas || []).map((a) => a.concepto_id));

  const encontrado = await fetchNextConceptoNuevo(seen);
  if (!encontrado) return null;
  const { concepto, modulo } = encontrado;

  const { data: cadenas, error: cadenasError } = await supabase
    .from("curso_cadenas")
    .select("*")
    .eq("concepto_id", concepto.id)
    .order("creado_en", { ascending: true });
  if (cadenasError) throw cadenasError;
  const cadena = (cadenas || [])[0] || null;

  const { data: items, error: itemsError } = await supabase
    .from("curso_items")
    .select("*")
    .eq("concepto_id", concepto.id)
    .eq("activo", true);
  if (itemsError) throw itemsError;

  return { modulo, concepto, cadena, items: items || [] };
}

async function programarRepaso(items) {
  if (!items.length) return;
  const filas = items.map((item) => ({
    item_id: item.id,
    estado_fsrs: {},
    proximo_repaso: new Date().toISOString(),
    debil: false,
  }));
  await supabase.from("curso_repaso").upsert(filas, {
    onConflict: "user_id,item_id",
    ignoreDuplicates: true,
  });
}

export async function renderUnidad(root, { sesion, onFinish }) {
  root.innerHTML = `<section class="screen screen-unidad"><p class="muted">Cargando unidad…</p></section>`;

  let unidad;
  try {
    unidad = await cargarUnidad();
  } catch (err) {
    root.innerHTML = `<section class="screen"><p>Error cargando la unidad: ${err.message}</p></section>`;
    return;
  }

  if (!unidad) {
    root.innerHTML = `
      <section class="screen">
        <h1>No hay unidad nueva</h1>
        <p class="muted">Ya has anclado todos los conceptos disponibles. Vuelve al repaso.</p>
        <button type="button" id="volver">Volver</button>
      </section>
    `;
    root.querySelector("#volver").addEventListener("click", () => onFinish());
    return;
  }

  const { concepto, cadena, items } = unidad;
  const itemDetectaError = items.find((i) => i.tipo === "detecta_error") || null;
  const itemCadenaVoz = items.find((i) => i.tipo === "cadena" && i.modo === "voz") || null;

  const steps = ["pregunta_previa", "ancla", "experimento", "bloques", "cadena_pasos"];
  if (itemDetectaError) steps.push("detecta_error");
  if (itemCadenaVoz) steps.push("cadena_voz");
  steps.push("cierre");

  let stepIndex = 0;
  const respuestasLocales = {};

  function progreso() {
    return `<p class="progreso">Paso ${stepIndex + 1} / ${steps.length}</p>`;
  }

  function siguiente() {
    stepIndex += 1;
    if (stepIndex >= steps.length) {
      finalizar();
    } else {
      render();
    }
  }

  async function finalizar() {
    root.innerHTML = `<section class="screen"><p class="muted">Guardando…</p></section>`;
    await programarRepaso(items);
    onFinish();
  }

  function renderNavButton(container, label = "Siguiente →") {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("click", siguiente);
    container.appendChild(btn);
    return btn;
  }

  function render() {
    const step = steps[stepIndex];
    if (step === "pregunta_previa") return renderPreguntaPrevia();
    if (step === "ancla") return renderAncla();
    if (step === "experimento") return renderExperimento();
    if (step === "bloques") return renderBloques();
    if (step === "cadena_pasos") return renderCadenaPasos();
    if (step === "detecta_error") return renderDetectaError();
    if (step === "cadena_voz") return renderCadenaVoz();
    if (step === "cierre") return renderCierre();
  }

  function renderPreguntaPrevia() {
    root.innerHTML = `
      <section class="screen">
        ${progreso()}
        <h1>${concepto.titulo}</h1>
        <p class="muted">Antes de empezar: ¿qué crees que pasa aquí? No hay respuesta correcta ni incorrecta todavía.</p>
        <textarea id="pp-texto" rows="4" placeholder="Escribe lo que ya intuyes…"></textarea>
        <div class="nav"></div>
      </section>
    `;
    root.querySelector("#pp-texto").addEventListener("input", (e) => {
      respuestasLocales.pregunta_previa = e.target.value;
    });
    renderNavButton(root.querySelector(".nav"));
  }

  function renderAncla() {
    root.innerHTML = `
      <section class="screen">
        ${progreso()}
        <h1>Tu ancla</h1>
        <p class="muted">Anota algo que te ayude a recordar este concepto — una imagen, una analogía, una frase propia.</p>
        <textarea id="ancla-texto" rows="4" placeholder="Tu ancla…"></textarea>
        <p id="ancla-status" class="muted" role="status"></p>
        <div class="nav"></div>
      </section>
    `;
    const status = root.querySelector("#ancla-status");
    const btn = renderNavButton(root.querySelector(".nav"));
    btn.removeEventListener("click", siguiente);
    btn.addEventListener("click", async () => {
      const texto = root.querySelector("#ancla-texto").value.trim();
      if (!texto) {
        status.textContent = "Escribe algo antes de continuar.";
        return;
      }
      btn.disabled = true;
      const { error } = await supabase
        .from("curso_anclas")
        .insert({ concepto_id: concepto.id, texto });
      btn.disabled = false;
      if (error) {
        status.textContent = `Error: ${error.message}`;
        return;
      }
      siguiente();
    });
  }

  function renderExperimento() {
    root.innerHTML = `
      <section class="screen">
        ${progreso()}
        <h1>Experimento ancla</h1>
        <p>${concepto.experimento_ancla ? concepto.experimento_ancla : "(Sin experimento ancla para este concepto.)"}</p>
        <div class="nav"></div>
      </section>
    `;
    renderNavButton(root.querySelector(".nav"));
  }

  function renderBloques() {
    const bloques = concepto.bloques || [];
    let sub = 0;

    async function renderSub() {
      if (!bloques.length) {
        root.innerHTML = `
          <section class="screen">
            ${progreso()}
            <p class="muted">Este concepto no tiene bloques todavía.</p>
            <div class="nav"></div>
          </section>
        `;
        renderNavButton(root.querySelector(".nav"));
        return;
      }

      const bloque = bloques[sub];
      root.innerHTML = `
        <section class="screen">
          ${progreso()}
          <p class="muted">Bloque ${sub + 1} / ${bloques.length}</p>
          <p>${bloque.texto}</p>
          ${bloque.esquema_mermaid ? `<div class="mermaid">${bloque.esquema_mermaid}</div>` : ""}
          <div class="nav"></div>
        </section>
      `;

      if (bloque.esquema_mermaid) {
        try {
          const mermaid = await loadMermaid();
          await mermaid.run({ querySelector: ".mermaid" });
        } catch (err) {
          root.querySelector(".mermaid").textContent = "(No se pudo cargar el diagrama.)";
        }
      }

      const nav = root.querySelector(".nav");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = sub + 1 < bloques.length ? "Siguiente bloque →" : "Siguiente →";
      btn.addEventListener("click", () => {
        if (sub + 1 < bloques.length) {
          sub += 1;
          renderSub();
        } else {
          siguiente();
        }
      });
      nav.appendChild(btn);
    }

    renderSub();
  }

  function renderCadenaPasos() {
    if (!cadena) {
      root.innerHTML = `
        <section class="screen">
          ${progreso()}
          <p class="muted">Este concepto no tiene una cadena asociada todavía.</p>
          <div class="nav"></div>
        </section>
      `;
      renderNavButton(root.querySelector(".nav"));
      return;
    }

    const pasos = cadena.pasos || [];
    let sub = 0;

    function renderSub() {
      const paso = pasos[sub];
      root.innerHTML = `
        <section class="screen">
          ${progreso()}
          <p class="muted">Cadena · paso ${sub + 1} / ${pasos.length}</p>
          <p class="nivel">${paso.nivel}</p>
          <p>${paso.texto}</p>
          <div class="nav"></div>
        </section>
      `;
      const nav = root.querySelector(".nav");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = sub + 1 < pasos.length ? "Siguiente paso →" : "Siguiente →";
      btn.addEventListener("click", () => {
        if (sub + 1 < pasos.length) {
          sub += 1;
          renderSub();
        } else {
          siguiente();
        }
      });
      nav.appendChild(btn);
    }

    renderSub();
  }

  function renderDetectaError() {
    const item = itemDetectaError;
    root.innerHTML = `
      <section class="screen">
        ${progreso()}
        <h1>Detecta el error</h1>
        <p>${item.enunciado}</p>
        <textarea id="de-texto" rows="4" placeholder="¿Qué está mal y por qué?"></textarea>
        <p id="de-status" class="muted" role="status"></p>
        <div id="de-resultado" hidden>
          <p><strong>Respuesta modelo:</strong> ${item.respuesta_modelo || "(no definida)"}</p>
          <p class="muted">Errores plantados: ${item.num_errores ?? "?"}</p>
          <label for="de-auto">¿Cómo te ha salido? (1-5)</label>
          <select id="de-auto">
            ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}">${n}</option>`).join("")}
          </select>
          <div class="nav"></div>
        </div>
        <button type="button" id="de-comprobar">Comprobar</button>
      </section>
    `;

    const status = root.querySelector("#de-status");
    root.querySelector("#de-comprobar").addEventListener("click", () => {
      const texto = root.querySelector("#de-texto").value.trim();
      if (!texto) {
        status.textContent = "Escribe tu respuesta antes de comprobar.";
        return;
      }
      respuestasLocales.detecta_error = texto;
      status.textContent = "";
      root.querySelector("#de-comprobar").hidden = true;
      root.querySelector("#de-resultado").hidden = false;
      renderNavButton(root.querySelector("#de-resultado .nav"), "Guardar y continuar →");
      const btn = root.querySelector("#de-resultado .nav button");
      btn.removeEventListener("click", siguiente);
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        const autoevaluacion = Number(root.querySelector("#de-auto").value);
        const { error } = await supabase.from("curso_respuestas").insert({
          item_id: item.id,
          sesion_id: sesion.id,
          texto,
          autoevaluacion,
        });
        btn.disabled = false;
        if (error) {
          status.textContent = `Error al guardar: ${error.message}`;
          return;
        }
        siguiente();
      });
    });
  }

  function renderCadenaVoz() {
    const item = itemCadenaVoz;
    const pasos = cadena ? cadena.pasos || [] : [];
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    root.innerHTML = `
      <section class="screen">
        ${progreso()}
        <h1>Reproduce la cadena en voz alta</h1>
        <p>${item.enunciado}</p>
        ${
          Recognition
            ? `<button type="button" id="cv-grabar">🎙️ Grabar</button><p id="cv-estado" class="muted"></p>`
            : `<p class="muted">Tu navegador no soporta reconocimiento de voz — usa el texto.</p>`
        }
        <textarea id="cv-transcripcion" rows="4" placeholder="Transcripción de lo que has dicho…"></textarea>
        <fieldset>
          <legend>¿Qué pasos crees que has cubierto?</legend>
          ${pasos
            .map(
              (p) => `
            <label class="paso-check">
              <input type="checkbox" value="${p.n}" />
              ${p.n}. ${p.texto}
            </label>`
            )
            .join("")}
        </fieldset>
        <label for="cv-auto">¿Cómo te ha salido? (1-5)</label>
        <select id="cv-auto">
          ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}">${n}</option>`).join("")}
        </select>
        <p id="cv-status" class="muted" role="status"></p>
        <div class="nav"></div>
      </section>
    `;

    if (Recognition) {
      const recognition = new Recognition();
      recognition.lang = "es-ES";
      recognition.continuous = true;
      recognition.interimResults = true;
      const grabarBtn = root.querySelector("#cv-grabar");
      const estado = root.querySelector("#cv-estado");
      const textarea = root.querySelector("#cv-transcripcion");
      let grabando = false;

      recognition.addEventListener("result", (e) => {
        let texto = "";
        for (const res of e.results) texto += res[0].transcript + " ";
        textarea.value = texto.trim();
      });
      recognition.addEventListener("error", (e) => {
        estado.textContent = `Error de reconocimiento: ${e.error}`;
      });
      recognition.addEventListener("end", () => {
        grabando = false;
        grabarBtn.textContent = "🎙️ Grabar";
      });

      grabarBtn.addEventListener("click", () => {
        if (grabando) {
          recognition.stop();
          return;
        }
        grabando = true;
        grabarBtn.textContent = "⏹️ Detener";
        estado.textContent = "Escuchando…";
        recognition.start();
      });
    }

    const status = root.querySelector("#cv-status");
    const btn = renderNavButton(root.querySelector(".nav"), "Guardar y continuar →");
    btn.removeEventListener("click", siguiente);
    btn.addEventListener("click", async () => {
      const transcripcion = root.querySelector("#cv-transcripcion").value.trim();
      if (!transcripcion) {
        status.textContent = "Añade la transcripción (grabada o escrita) antes de continuar.";
        return;
      }
      const pasosMarcados = Array.from(
        root.querySelectorAll('.paso-check input[type="checkbox"]:checked')
      ).map((el) => Number(el.value));
      const autoevaluacion = Number(root.querySelector("#cv-auto").value);

      btn.disabled = true;
      const { error } = await supabase.from("curso_respuestas").insert({
        item_id: item.id,
        sesion_id: sesion.id,
        transcripcion,
        pasos_marcados: pasosMarcados,
        autoevaluacion,
      });
      btn.disabled = false;
      if (error) {
        status.textContent = `Error al guardar: ${error.message}`;
        return;
      }
      siguiente();
    });
  }

  function renderCierre() {
    root.innerHTML = `
      <section class="screen">
        ${progreso()}
        <h1>Cierre</h1>
        <p class="muted">Resume en una frase libre qué te llevas de esta unidad.</p>
        <textarea id="cierre-texto" rows="3" placeholder="En una frase…"></textarea>
        <p class="muted">Esta síntesis se guarda solo en este dispositivo por ahora (no hay un ítem de metacognición auditado todavía para este concepto).</p>
        <div class="nav"></div>
      </section>
    `;
    root.querySelector("#cierre-texto").addEventListener("input", (e) => {
      respuestasLocales.cierre = e.target.value;
      try {
        localStorage.setItem(`curso:cierre:${concepto.id}`, e.target.value);
      } catch (_) {}
    });
    renderNavButton(root.querySelector(".nav"), "Finalizar unidad ✓");
  }

  render();
}
