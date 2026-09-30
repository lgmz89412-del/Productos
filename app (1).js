import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, doc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// PEGA AQUÍ TU CONFIGURACIÓN (Firebase Console > Configuración del proyecto > Tus apps > Web)
// Puedes usar el mismo proyecto de Firebase que la agenda.
const firebaseConfig = {
  apiKey: "AIzaSyB57OSnPTXzMc3sO-wvw8Kr0jHMkdGs3zE",
  authDomain: "productos-9170a.firebaseapp.com",
  projectId: "productos-9170a",
  storageBucket: "productos-9170a.firebasestorage.app",
  messagingSenderId: "436705236014",
  appId: "1:436705236014:web:d6b28c038d6aff57aa7bbf",
  measurementId: "G-2EQY35GH6M"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (s) => document.querySelector(s);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

let products = [];
let productsRef = null;
let unsubscribe = null;
let editingId = null;

/* ---------- Autenticación ---------- */
const authMessages = {
  "auth/invalid-email": "El correo no es válido.",
  "auth/missing-password": "Escribe tu contraseña.",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
  "auth/email-already-in-use": "Ese correo ya tiene una cuenta. Inicia sesión.",
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/too-many-requests": "Demasiados intentos. Espera un momento."
};
const showAuthErr = (e) => {
  $("#authErr").textContent = authMessages[e.code] || "No se pudo completar la acción. Inténtalo de nuevo.";
};

$("#authForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  $("#authErr").textContent = "";
  try {
    await signInWithEmailAndPassword(auth, $("#email").value.trim(), $("#password").value);
  } catch (e) { showAuthErr(e); }
});

$("#signupBtn").addEventListener("click", async () => {
  $("#authErr").textContent = "";
  try {
    await createUserWithEmailAndPassword(auth, $("#email").value.trim(), $("#password").value);
  } catch (e) { showAuthErr(e); }
});

$("#logoutBtn").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  if (!user) {
    products = [];
    resetForm();
    $("#app").hidden = true;
    $("#auth").hidden = false;
    return;
  }
  $("#auth").hidden = true;
  $("#app").hidden = false;
  $("#hello").textContent = user.email;

  // Documento del usuario: users/{uid}
  setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    email: user.email,
    createdAt: user.metadata.creationTime,
    lastLogin: serverTimestamp()
  }, { merge: true }).catch(() => {});

  // Productos de este usuario: users/{uid}/products
  productsRef = collection(db, "users", user.uid, "products");
  unsubscribe = onSnapshot(productsRef, (snap) => {
    products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    render();
  }, showErr);
});

/* ---------- Productos ---------- */
function showErr() {
  $("#err").textContent = "No se pudo completar la acción. Revisa tu conexión e inténtalo de nuevo.";
}

function resetForm() {
  editingId = null;
  $("#f").reset();
  $("#formTitle").textContent = "Nuevo producto";
  $("#saveBtn").textContent = "Guardar producto";
  $("#cancelBtn").hidden = true;
  $("#err").textContent = "";
}

function startEdit(p) {
  editingId = p.id;
  $("#name").value = p.name;
  $("#category").value = p.category || "";
  $("#price").value = p.price;
  $("#stock").value = p.stock;
  $("#desc").value = p.desc || "";
  $("#formTitle").textContent = "Editar producto";
  $("#saveBtn").textContent = "Actualizar producto";
  $("#cancelBtn").hidden = false;
  $("#name").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function render() {
  const q = $("#q").value.trim().toLowerCase();
  const list = $("#list");
  list.textContent = "";

  // Resumen de inventario (de todos los productos, no solo los filtrados)
  const totalValue = products.reduce((s, p) => s + p.price * p.stock, 0);
  $("#stats").innerHTML = "";
  const s1 = el("div"); s1.append(el("strong", null, String(products.length)), "productos");
  const s2 = el("div"); s2.append(el("strong", null, money.format(totalValue)), "valor del inventario");
  $("#stats").append(s1, s2);

  const shown = products
    .filter((p) => !q || (p.name + " " + (p.category || "")).toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  if (!shown.length) {
    list.appendChild(el("p", "empty", products.length
      ? "Ningún producto coincide con la búsqueda."
      : "Aún no tienes productos. Agrega el primero desde el formulario."));
    return;
  }

  shown.forEach((p) => {
    const card = el("article", "p");
    card.appendChild(el("h3", null, p.name));
    if (p.category) card.appendChild(el("span", "chip", p.category));
    card.appendChild(el("div", "price", money.format(p.price)));
    card.appendChild(el("div", "stock" + (p.stock <= 5 ? " low" : ""),
      p.stock === 0 ? "Agotado" : p.stock + " en existencia" + (p.stock <= 5 ? " (pocas)" : "")));
    if (p.desc) card.appendChild(el("p", "d", p.desc));

    const acts = el("div", "acts");
    const edit = el("button", null, "Editar");
    edit.type = "button";
    edit.setAttribute("aria-label", "Editar: " + p.name);
    edit.addEventListener("click", () => startEdit(p));
    const del = el("button", "del", "Borrar");
    del.type = "button";
    del.setAttribute("aria-label", "Borrar: " + p.name);
    del.addEventListener("click", () => {
      if (!confirm("¿Borrar \"" + p.name + "\"?")) return;
      deleteDoc(doc(productsRef, p.id)).then(() => { if (editingId === p.id) resetForm(); }).catch(showErr);
    });
    acts.append(edit, del);
    card.appendChild(acts);
    list.appendChild(card);
  });
}

$("#q").addEventListener("input", render);
$("#cancelBtn").addEventListener("click", resetForm);

$("#f").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  $("#err").textContent = "";
  const name = $("#name").value.trim();
  const price = parseFloat($("#price").value);
  const stock = parseInt($("#stock").value, 10);
  if (!name || isNaN(price) || price < 0 || isNaN(stock) || stock < 0) {
    $("#err").textContent = "Escribe un nombre, un precio y unas existencias válidas.";
    return;
  }
  const data = {
    name, price, stock,
    category: $("#category").value.trim(),
    desc: $("#desc").value.trim()
  };
  try {
    if (editingId) {
      await updateDoc(doc(productsRef, editingId), data);
    } else {
      await addDoc(productsRef, { ...data, created: serverTimestamp() });
    }
    resetForm();
  } catch (e) { showErr(); }
});
