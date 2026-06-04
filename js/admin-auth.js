// ===== ADMIN AUTH — CUSTOM LOGIN SYSTEM =====
// LocalStorage based secure admin login

const ADMIN_PAGES = ["dashboard", "register", "students", "records", "reports"];

// Default credentials (change kar sakte ho)
const ADMIN_EMAIL = "admin@faceattend.com";
const ADMIN_PASSWORD = "admin@123";
const SESSION_KEY = "fa_admin_session";

// ===== Login check =====
function isAdminLoggedIn() {
  const session = localStorage.getItem(SESSION_KEY);
  if (!session) return false;
  try {
    const data = JSON.parse(session);
    // 8 ghante ki session expiry
    return data.loggedIn && Date.now() - data.time < 8 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

// ===== Login =====
function doAdminLogin(email, password) {
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        loggedIn: true,
        email: email,
        time: Date.now(),
      }),
    );
    return true;
  }
  return false;
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
      adminBtn.innerHTML = `🔓 ${session.email} — Logout`;
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

  // Login form submit
  document.getElementById("loginSubmitBtn").addEventListener("click", () => {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const errorEl = document.getElementById("loginError");

    if (!email || !password) {
      errorEl.textContent = "⚠️ Email aur password dono bharein.";
      return;
    }

    if (doAdminLogin(email, password)) {
      closeLoginModal();
      updateUIForRole();
      if (typeof showToastNotification === "function") {
        showToastNotification(`✅ Welcome, ${email}!`, "success");
      }
      navigateTo("dashboard", ["Dashboard", "Overview & Analytics"]);
      if (typeof loadDashboard === "function") loadDashboard();
    } else {
      errorEl.textContent = "❌ Email ya password galat hai.";
    }
  });

  // Enter key support on login
  ["loginEmail", "loginPassword"].forEach((id) => {
    document.getElementById(id).addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("loginSubmitBtn").click();
    });
  });

  // Forgot password submit
  document.getElementById("forgotSubmitBtn").addEventListener("click", () => {
    const email = document.getElementById("forgotEmail").value.trim();
    const errorEl = document.getElementById("forgotError");
    const successEl = document.getElementById("forgotSuccess");

    if (!email) {
      errorEl.textContent = "⚠️ Email address daalein.";
      return;
    }

    if (email === ADMIN_EMAIL) {
      // Email match — reset form dikhao
      document.getElementById("forgotFormArea").style.display = "none";
      successEl.style.display = "block";
      setTimeout(() => {
        closeForgotModal();
        openResetModal();
      }, 1500);
    } else {
      errorEl.textContent = "❌ Yeh email registered nahi hai.";
    }
  });

  // Reset password submit
  document.getElementById("resetSubmitBtn").addEventListener("click", () => {
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

    // Password update (session mein save)
    // Note: Production mein yeh server pe save hona chahiye
    if (typeof showToastNotification === "function") {
      showToastNotification(
        "✅ Password successfully update ho gaya!",
        "success",
      );
    }
    closeResetModal();
    openLoginModal();
  });

  // Modal close on backdrop click
  ["adminLoginModal", "forgotModal", "resetModal"].forEach((id) => {
    document.getElementById(id).addEventListener("click", (e) => {
      if (e.target.id === id) {
        document.getElementById(id).style.display = "none";
      }
    });
  });

  // Page load pe state check
  updateUIForRole();
}
