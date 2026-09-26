import { supabase } from "./supabaseClient.js";

export function renderLogin(root) {
  root.innerHTML = `
    <section class="screen screen-login">
      <h1>Curso</h1>
      <p class="muted">Inicia sesión con tu enlace mágico.</p>
      <form id="login-form">
        <label for="email">Email</label>
        <input id="email" type="email" required autocomplete="email" placeholder="tú@ejemplo.com" />
        <button type="submit">Enviar enlace</button>
      </form>
      <p id="login-status" class="muted" role="status"></p>
    </section>
  `;

  const form = root.querySelector("#login-form");
  const status = root.querySelector("#login-status");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = root.querySelector("#email").value.trim();
    if (!email) return;

    const submitBtn = form.querySelector("button");
    submitBtn.disabled = true;
    status.textContent = "Enviando…";

    // shouldCreateUser: false — instancia con registro cerrado (un único
    // usuario esperado); el usuario debe existir ya en Supabase Auth.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: window.location.href.split("#")[0],
      },
    });

    submitBtn.disabled = false;
    if (error) {
      status.textContent = /signups? not allowed/i.test(error.message)
        ? "Ese email no existe todavía como usuario en Supabase Auth. Créalo una vez desde el panel (Authentication → Users) y vuelve a intentarlo."
        : `Error: ${error.message}`;
      return;
    }
    status.textContent =
      "Revisa tu correo: te hemos enviado un enlace. Si es tu primer acceso, primero tendrás que confirmar la dirección antes de que el enlace te autentique.";
  });
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

export async function signOut() {
  await supabase.auth.signOut();
}
