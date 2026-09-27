import { supabase } from "./supabaseClient.js";

export function renderEnergia(root, { onStart }) {
  root.innerHTML = `
    <section class="screen screen-energia">
      <h1>¿Cómo está tu energía hoy?</h1>
      <p class="muted">1 = agotado · 10 = a tope. Por debajo de 6 solo verás repaso.</p>
      <div class="energia-scale" id="energia-scale">
        ${Array.from({ length: 10 }, (_, i) => i + 1)
          .map((n) => `<button type="button" class="energia-btn" data-value="${n}">${n}</button>`)
          .join("")}
      </div>
      <p id="energia-status" class="muted" role="status"></p>
    </section>
  `;

  const scale = root.querySelector("#energia-scale");
  const status = root.querySelector("#energia-status");

  scale.addEventListener("click", async (e) => {
    const btn = e.target.closest(".energia-btn");
    if (!btn) return;

    scale.querySelectorAll(".energia-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");

    const energia = Number(btn.dataset.value);
    const tipo = energia < 6 ? "repaso" : "repaso_y_nuevo";

    status.textContent = "Abriendo sesión…";

    const { data, error } = await supabase
      .from("curso_sesiones")
      .insert({ energia, tipo, inicio: new Date().toISOString() })
      .select()
      .single();

    if (error) {
      status.textContent = `Error al abrir la sesión: ${error.message}`;
      return;
    }

    status.textContent = "";
    onStart({ sesion: data, tipo });
  });
}
