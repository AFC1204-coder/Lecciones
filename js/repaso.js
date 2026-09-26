import { supabase } from "./supabaseClient.js";

export async function renderRepaso(root, { sesion, onDone }) {
  root.innerHTML = `<section class="screen"><p class="muted">Cargando repasos…</p></section>`;

  const { data: repasos, error } = await supabase
    .from("curso_repaso")
    .select("*, curso_items(*)")
    .lte("proximo_repaso", new Date().toISOString())
    .order("proximo_repaso", { ascending: true });

  if (error) {
    root.innerHTML = `<section class="screen"><p>Error cargando repasos: ${error.message}</p></section>`;
    return;
  }

  if (!repasos || !repasos.length) {
    root.innerHTML = `
      <section class="screen">
        <h1>Repaso</h1>
        <p class="muted">No hay nada pendiente de repasar ahora mismo. 🎉</p>
        <button type="button" id="repaso-volver">Continuar</button>
      </section>
    `;
    root.querySelector("#repaso-volver").addEventListener("click", onDone);
    return;
  }

  root.innerHTML = `
    <section class="screen">
      <h1>Repaso</h1>
      <p class="muted">${repasos.length} ítem(s) pendiente(s).</p>
      <ul class="repaso-lista" id="repaso-lista"></ul>
      <button type="button" id="repaso-terminar">He terminado por ahora</button>
    </section>
  `;

  const lista = root.querySelector("#repaso-lista");

  for (const repaso of repasos) {
    const item = repaso.curso_items;
    const li = document.createElement("li");
    li.className = "repaso-item";
    li.innerHTML = `
      <button type="button" class="repaso-abrir">
        <span class="repaso-tipo">${item.tipo} · ${item.modo}</span>
        <span>${item.enunciado}</span>
      </button>
      <div class="repaso-form" hidden></div>
    `;
    lista.appendChild(li);

    const abrirBtn = li.querySelector(".repaso-abrir");
    const formBox = li.querySelector(".repaso-form");

    abrirBtn.addEventListener("click", () => {
      if (!formBox.hidden) {
        formBox.hidden = true;
        return;
      }
      renderFormRepaso(formBox, { repaso, item, sesion, onGuardado: () => li.remove() });
      formBox.hidden = false;
    });
  }

  root.querySelector("#repaso-terminar").addEventListener("click", onDone);
}

function renderFormRepaso(container, { repaso, item, sesion, onGuardado }) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const esVoz = item.modo === "voz" && Recognition;

  container.innerHTML = `
    ${esVoz ? `<button type="button" class="rf-grabar">🎙️ Grabar</button><p class="rf-estado muted"></p>` : ""}
    <textarea class="rf-texto" rows="3" placeholder="Tu respuesta…"></textarea>
    <label>¿Cómo te ha salido? (1-5)</label>
    <select class="rf-auto">
      ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}">${n}</option>`).join("")}
    </select>
    <p class="rf-status muted" role="status"></p>
    <button type="button" class="rf-guardar">Guardar</button>
  `;

  if (esVoz) {
    const recognition = new Recognition();
    recognition.lang = "es-ES";
    recognition.continuous = true;
    recognition.interimResults = true;
    const grabarBtn = container.querySelector(".rf-grabar");
    const estado = container.querySelector(".rf-estado");
    const textarea = container.querySelector(".rf-texto");
    let grabando = false;

    recognition.addEventListener("result", (e) => {
      let texto = "";
      for (const res of e.results) texto += res[0].transcript + " ";
      textarea.value = texto.trim();
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

  const status = container.querySelector(".rf-status");
  container.querySelector(".rf-guardar").addEventListener("click", async () => {
    const texto = container.querySelector(".rf-texto").value.trim();
    if (!texto) {
      status.textContent = "Escribe o dicta tu respuesta antes de guardar.";
      return;
    }
    const autoevaluacion = Number(container.querySelector(".rf-auto").value);
    const guardarBtn = container.querySelector(".rf-guardar");
    guardarBtn.disabled = true;

    const payload =
      item.modo === "voz"
        ? { item_id: item.id, sesion_id: sesion.id, transcripcion: texto, autoevaluacion }
        : { item_id: item.id, sesion_id: sesion.id, texto, autoevaluacion };

    const { error: respError } = await supabase.from("curso_respuestas").insert(payload);
    if (respError) {
      status.textContent = `Error al guardar la respuesta: ${respError.message}`;
      guardarBtn.disabled = false;
      return;
    }

    // Placeholder de reprogramación: sin FSRS todavía. Empuja un día fijo y
    // marca "débil" con autoevaluación baja para que el repaso real lo priorice después.
    const proximoRepaso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error: repasoError } = await supabase
      .from("curso_repaso")
      .update({
        estado_fsrs: { ultima_autoevaluacion: autoevaluacion, ultima_revision: new Date().toISOString() },
        proximo_repaso: proximoRepaso,
        debil: autoevaluacion <= 2,
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", repaso.id);

    if (repasoError) {
      status.textContent = `Respuesta guardada, pero falló la reprogramación: ${repasoError.message}`;
      return;
    }

    onGuardado();
  });
}
