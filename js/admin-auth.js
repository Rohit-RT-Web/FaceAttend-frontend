// ===== ADMIN AUTH — MONGODB LOGIN SYSTEM =====

const ADMIN_PAGES = ["dashboard", "register", "students", "records", "reports"];
const SESSION_KEY = "fa_admin_session";
const API_AUTH = "https://faceattend-backend-1.onrender.com/api/auth";

// ===== Login check =====
function isAdminLoggedIn() {
  const session = localStorage.getItem(SESSION_KEY);
  if (!session) return false;
  try {
    const data = JSON.parse(session);
    return data.loggedIn && Date.now() - data.time < 8 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

// ===== Logout =====
function adminLogout() {
  localStorage.removeItem(SESSION_KEY);
  updateUIForRole();
  navigateTo("recognition", ["Take Attendance", "Face Recognition Camera"]);
  if (typeof showToastNotification === "function") {
    showToastNotification("Logged out successfully", "info");
  }
}

// ===== UI update =====
function updateUIForRole() {
  const isAdmin = isAdminLoggedIn();

  document.querySelectorAll(".nav-link").forEach((link) => {
    const page = link.dataset.page;
    const li = link.parentElement;
    if (ADMIN_PAGES.includes(page)) {
      li.style.display = isAdmin ? "" : "none";
    }
  });

  const adminBtn = document.getElementById("adminAuthBtn");
  if (adminBtn) {
    if (isAdmin) {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY));
      adminBtn.innerHTML = `🔓 Admin — Logout`;
      adminBtn.classList.add("btn-danger");
      adminBtn.classList.remove("btn-outline");
    } else {
      adminBtn.innerHTML = "🔐 Admin Login";
      adminBtn.classList.remove("btn-danger");
      adminBtn.classList.add("btn-outline");
    }
  }

  if (!isAdmin) {
    const activePage = document.querySelector(".page.active");
    if (activePage) {
      const pageId = activePage.id.replace("page-", "");
      if (ADMIN_PAGES.includes(pageId)) {
        navigateTo("recognition", [
          "Take Attendance",
          "Face Recognition Camera",
        ]);
      }
    }
  }
}

// ===== Nav protection =====
function protectNavigation(page) {
  if (ADMIN_PAGES.includes(page) && !isAdminLoggedIn()) {
    openLoginModal();
    return false;
  }
  return true;
}

// ===== Login Modal =====
function openLoginModal() {
  document.getElementById("adminLoginModal").style.display = "flex";
  document.getElementById("loginEmail").focus();
  document.getElementById("loginError").textContent = "";
  document.getElementById("loginEmail").value = "";
  document.getElementById("loginPassword").value = "";
}

function closeLoginModal() {
  document.getElementById("adminLoginModal").style.display = "none";
}

// ===== Forgot Password Modal =====
function openForgotModal() {
  closeLoginModal();
  document.getElementById("forgotModal").style.display = "flex";
  document.getElementById("forgotEmail").value = "";
  document.getElementById("forgotError").textContent = "";
  document.getElementById("forgotSuccess").style.display = "none";
  document.getElementById("forgotFormArea").style.display = "block";
  // Email yaad rakho reset ke liye
  window._resetEmail = null;
}

function closeForgotModal() {
  document.getElementById("forgotModal").style.display = "none";
}

// ===== Reset Password Modal =====
function openResetModal() {
  closeForgotModal();
  document.getElementById("resetModal").style.display = "flex";
  document.getElementById("resetNewPass").value = "";
  document.getElementById("resetConfirmPass").value = "";
  document.getElementById("resetError").textContent = "";
}

function closeResetModal() {
  document.getElementById("resetModal").style.display = "none";
}

// ===== Button loading state =====
function setLoading(btnId, loading, text) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.textContent = loading ? "⏳ Please wait..." : text;
}

// ===== Init Admin Auth =====
function initAdminAuth() {
  // Admin button click
  const adminBtn = document.getElementById("adminAuthBtn");
  if (adminBtn) {
    adminBtn.addEventListener("click", () => {
      if (isAdminLoggedIn()) {
        if (confirm("Admin se logout karna chahte hain?")) {
          adminLogout();
        }
      } else {
        openLoginModal();
      }
    });
  }

  // ── Login submit ──────────────────────────────────────────
  document
    .getElementById("loginSubmitBtn")
    .addEventListener("click", async () => {
      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;
      const errorEl = document.getElementById("loginError");

      if (!email || !password) {
        errorEl.textContent = "⚠️ Email aur password dono bharein.";
        return;
      }

      setLoading("loginSubmitBtn", true, "Login");
      try {
        const res = await fetch(`${API_AUTH}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();

        if (data.success) {
          localStorage.setItem(
            SESSION_KEY,
            JSON.stringify({
              loggedIn: true,
              email: data.email,
              time: Date.now(),
            }),
          );
          closeLoginModal();
          updateUIForRole();
          if (typeof showToastNotification === "function") {
            showToastNotification(`✅ Welcome, ${data.email}!`, "success");
          }
          navigateTo("dashboard", ["Dashboard", "Overview & Analytics"]);
          if (typeof loadDashboard === "function") loadDashboard();
        } else {
          errorEl.textContent = "❌ " + data.message;
        }
      } catch (err) {
        errorEl.textContent =
          "❌ Server se connect nahi ho paya. Dobara try karein.";
      }
      setLoading("loginSubmitBtn", false, "Login");
    });

  // Enter key support
  ["loginEmail", "loginPassword"].forEach((id) => {
    document.getElementById(id).addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("loginSubmitBtn").click();
    });
  });

  // ── Forgot password submit ────────────────────────────────
  document
    .getElementById("forgotSubmitBtn")
    .addEventListener("click", async () => {
      const email = document.getElementById("forgotEmail").value.trim();
      const errorEl = document.getElementById("forgotError");
      const successEl = document.getElementById("forgotSuccess");

      if (!email) {
        errorEl.textContent = "⚠️ Email address daalein.";
        return;
      }

      setLoading("forgotSubmitBtn", true, "Verify Email");
      try {
        const res = await fetch(`${API_AUTH}/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();

        if (data.success) {
          window._resetEmail = email; // email yaad rakho
          document.getElementById("forgotFormArea").style.display = "none";
          successEl.style.display = "block";
          setTimeout(() => {
            closeForgotModal();
            openResetModal();
          }, 1500);
        } else {
          errorEl.textContent = "❌ " + data.message;
        }
      } catch (err) {
        errorEl.textContent = "❌ Server se connect nahi ho paya.";
      }
      setLoading("forgotSubmitBtn", false, "Verify Email");
    });

  // ── Reset password submit ─────────────────────────────────
  document
    .getElementById("resetSubmitBtn")
    .addEventListener("click", async () => {
      const newPass = document.getElementById("resetNewPass").value;
      const confirmPass = document.getElementById("resetConfirmPass").value;
      const errorEl = document.getElementById("resetError");

      if (!newPass || !confirmPass) {
        errorEl.textContent = "⚠️ Dono fields bharein.";
        return;
      }
      if (newPass.length < 6) {
        errorEl.textContent =
          "⚠️ Password kam se kam 6 characters ka hona chahiye.";
        return;
      }
      if (newPass !== confirmPass) {
        errorEl.textContent = "❌ Dono passwords match nahi karte.";
        return;
      }

      setLoading("resetSubmitBtn", true, "Update Password");
      try {
        const res = await fetch(`${API_AUTH}/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: window._resetEmail,
            newPassword: newPass,
          }),
        });
        const data = await res.json();

        if (data.success) {
          if (typeof showToastNotification === "function") {
            showToastNotification(
              "✅ Password successfully update ho gaya!",
              "success",
            );
          }
          closeResetModal();
          openLoginModal();
        } else {
          errorEl.textContent = "❌ " + data.message;
        }
      } catch (err) {
        errorEl.textContent = "❌ Server se connect nahi ho paya.";
      }
      setLoading("resetSubmitBtn", false, "Update Password");
    });

  // Modal close on backdrop click
  ["adminLoginModal", "forgotModal", "resetModal"].forEach((id) => {
    document.getElementById(id).addEventListener("click", (e) => {
      if (e.target.id === id) {
        document.getElementById(id).style.display = "none";
      }
    });
  });

  updateUIForRole();
}
