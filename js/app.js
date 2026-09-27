import { supabase } from "./supabaseClient.js";
import { renderLogin, onAuthChange, signOut } from "./auth.js";
import { renderEnergia } from "./energia.js";
import { renderUnidad } from "./unidad.js";
import { renderRepaso } from "./repaso.js";

const root = document.getElementById("app");

function renderHeader() {
  const header = document.createElement("header");
  header.className = "app-header";
  header.innerHTML = `<span>Curso</span><button type="button" id="logout">Salir</button>`;
  header.querySelector("#logout").addEventListener("click", async () => {
    await signOut();
  });
  return header;
}

async function cerrarSesion(sesionId) {
  await supabase
    .from("curso_sesiones")
    .update({ fin: new Date().toISOString() })
    .eq("id", sesionId);
}

function renderTerminado(sesion) {
  root.innerHTML = "";
  root.appendChild(renderHeader());
  const section = document.createElement("section");
  section.className = "screen";
  section.innerHTML = `
    <h1>Sesión terminada</h1>
    <p class="muted">Buen trabajo por hoy.</p>
    <button type="button" id="repetir">Empezar otra sesión</button>
  `;
  root.appendChild(section);
  section.querySelector("#repetir").addEventListener("click", () => iniciarFlujoAutenticado());
}

function iniciarFlujoAutenticado() {
  root.innerHTML = "";
  root.appendChild(renderHeader());
  const body = document.createElement("div");
  body.id = "app-body";
  root.appendChild(body);

  renderEnergia(body, {
    onStart: ({ sesion, tipo }) => {
      if (tipo === "repaso") {
        renderRepaso(body, {
          sesion,
          onDone: async () => {
            await cerrarSesion(sesion.id);
            renderTerminado(sesion);
          },
        });
      } else {
        renderRepaso(body, {
          sesion,
          onDone: () => {
            renderUnidad(body, {
              sesion,
              onFinish: async () => {
                await cerrarSesion(sesion.id);
                renderTerminado(sesion);
              },
            });
          },
        });
      }
    },
  });
}

function renderCargando() {
  root.innerHTML = `<section class="screen"><p class="muted">Cargando…</p></section>`;
}

function boot() {
  renderCargando();

  let autenticado = null; // null = aún sin determinar, evita re-render en refresh de token
  onAuthChange((sesionAuth) => {
    const haySesion = Boolean(sesionAuth);
    if (haySesion === autenticado) return;
    autenticado = haySesion;
    if (haySesion) {
      iniciarFlujoAutenticado();
    } else {
      renderLogin(root);
    }
  });
}

boot();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
