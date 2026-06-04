// ===== ADMIN AUTH — NETLIFY IDENTITY =====
// Netlify Identity se real email/password login

const ADMIN_PAGES = ["dashboard", "register", "students", "records", "reports"];

// ===== Netlify Identity user check =====
function isAdminLoggedIn() {
  const user = netlifyIdentity.currentUser();
  return user !== null;
}

// ===== Admin logout =====
function adminLogout() {
  netlifyIdentity.logout();
}

// ===== UI update karo role ke hisaab se =====
function updateUIForRole() {
  const isAdmin = isAdminLoggedIn();

  // Sidebar nav items show/hide
  document.querySelectorAll(".nav-link").forEach((link) => {
    const page = link.dataset.page;
    const li = link.parentElement;
    if (ADMIN_PAGES.includes(page)) {
      li.style.display = isAdmin ? "" : "none";
    }
  });

  // Admin button update
  const adminBtn = document.getElementById("adminAuthBtn");
  if (adminBtn) {
    if (isAdmin) {
      const user = netlifyIdentity.currentUser();
      const name = user?.user_metadata?.full_name || user?.email || "Admin";
      adminBtn.innerHTML = `🔓 ${name} — Logout`;
      adminBtn.classList.add("btn-danger");
      adminBtn.classList.remove("btn-outline");
    } else {
      adminBtn.innerHTML = "🔐 Admin Login";
      adminBtn.classList.remove("btn-danger");
      adminBtn.classList.add("btn-outline");
    }
  }

  // Agar student mode aur admin page pe hai — recognition pe bhejo
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
    netlifyIdentity.open("login");
    return false;
  }
  return true;
}

// ===== Init Admin Auth =====
function initAdminAuth() {
  // Netlify Identity initialize karo
  netlifyIdentity.init();

  // Admin button click handler
  const adminBtn = document.getElementById("adminAuthBtn");
  if (adminBtn) {
    adminBtn.addEventListener("click", () => {
      if (isAdminLoggedIn()) {
        if (confirm("Admin se logout karna chahte hain?")) {
          adminLogout();
        }
      } else {
        netlifyIdentity.open("login");
      }
    });
  }

  // Login success event
  netlifyIdentity.on("login", (user) => {
    netlifyIdentity.close();
    updateUIForRole();
    if (typeof showToastNotification === "function") {
      const name = user?.user_metadata?.full_name || user?.email;
      showToastNotification(`✅ Welcome, ${name}!`, "success");
    }
    navigateTo("dashboard", ["Dashboard", "Overview & Analytics"]);
    if (typeof loadDashboard === "function") loadDashboard();
  });

  // Logout event
  netlifyIdentity.on("logout", () => {
    updateUIForRole();
    navigateTo("recognition", ["Take Attendance", "Face Recognition Camera"]);
    if (typeof showToastNotification === "function") {
      showToastNotification("Logged out successfully", "info");
    }
  });

  // Init event — page load pe state check
  netlifyIdentity.on("init", () => {
    updateUIForRole();
  });

  // Page load pe default view set karo
  updateUIForRole();
}
