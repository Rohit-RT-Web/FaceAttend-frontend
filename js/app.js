// ===== FACE RECOGNITION ATTENDANCE SYSTEM =====
// Main Application JavaScript

const API = "https://faceattend-backend-1.onrender.com/api";
let videoStream = null;
let regVideoStream = null;
let capturedFaceDescriptor = null;
let knownFaces = [];
let isScanning = false;
let recentScans = [];
let weekChartInstance = null;

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  initClock();
  initNavigation();
  checkDBStatus();
  loadDashboard();
  initRecognition();
  initRegisterForm();
  initStudentsPage();
  initRecordsPage();
  initReportsPage();
  initModal();
  setInterval(checkDBStatus, 10000);
});

// ===== CLOCK =====
function initClock() {
  function update() {
    const now = new Date();
    document.getElementById("currentTime").textContent = now.toLocaleTimeString(
      "en-IN",
      { hour: "2-digit", minute: "2-digit", second: "2-digit" },
    );
    document.getElementById("currentDate").textContent = now.toLocaleDateString(
      "en-IN",
      { weekday: "long", year: "numeric", month: "long", day: "numeric" },
    );
  }
  update();
  setInterval(update, 1000);
}

// ===== NAVIGATION =====
function initNavigation() {
  const titles = {
    dashboard: ["Dashboard", "Overview & Analytics"],
    recognition: ["Take Attendance", "Face Recognition Camera"],
    register: ["Register Student", "Add New Student"],
    students: ["Students", "Manage All Students"],
    records: ["Attendance Records", "View & Filter Records"],
    reports: ["Reports", "Generate Attendance Reports"],
  };

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      navigateTo(page, titles[page]);
      // Mobile: close sidebar
      document.getElementById("sidebar").classList.remove("open");
    });
  });

  document.getElementById("menuToggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });
}

function navigateTo(page, titleInfo) {
  document
    .querySelectorAll(".nav-link")
    .forEach((l) => l.classList.remove("active"));
  document.querySelector(`[data-page="${page}"]`).classList.add("active");
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document.getElementById(`page-${page}`).classList.add("active");
  document.getElementById("pageTitle").textContent = titleInfo[0];
  document.getElementById("breadcrumb").textContent = titleInfo[1];

  // Load data for page
  if (page === "dashboard") loadDashboard();
  if (page === "students") loadStudents();
  if (page === "records") loadRecords();
}

// ===== DB STATUS =====
async function checkDBStatus() {
  try {
    const res = await fetch(`${API}/health`);
    const data = await res.json();
    const dot = document.querySelector(".db-dot");
    const txt = document.querySelector(".db-text");
    if (data.mongodb === "connected") {
      dot.className = "db-dot connected";
      txt.textContent = "MongoDB Connected";
    } else {
      dot.className = "db-dot error";
      txt.textContent = "DB Disconnected";
    }
  } catch {
    document.querySelector(".db-dot").className = "db-dot error";
    document.querySelector(".db-text").textContent = "Server Offline";
  }
}

// ===== DASHBOARD =====
async function loadDashboard() {
  try {
    const [statsRes, todayRes] = await Promise.all([
      fetch(`${API}/attendance/stats/overview`),
      fetch(`${API}/attendance/today`),
    ]);
    const statsData = await statsRes.json();
    const todayData = await todayRes.json();

    if (statsData.success) {
      const s = statsData.stats;
      animateNumber("stat-present", s.today.present);
      animateNumber("stat-late", s.today.late);
      animateNumber("stat-absent", s.today.absent);
      animateNumber("stat-total", s.totalStudents);
      renderWeekChart(s.weekChart);
    }

    if (todayData.success) {
      renderTodayList(todayData.records);
      document.getElementById("todayCount").textContent =
        `${todayData.records.length} records`;
    }
  } catch (err) {
    console.error("Dashboard load error:", err);
  }
}

function animateNumber(id, target) {
  const el = document.getElementById(id);
  const start = parseInt(el.textContent) || 0;
  const steps = 20;
  const inc = (target - start) / steps;
  let current = start;
  let i = 0;
  const timer = setInterval(() => {
    current += inc;
    i++;
    el.textContent = Math.round(i === steps ? target : current);
    if (i >= steps) clearInterval(timer);
  }, 30);
}

function renderTodayList(records) {
  const container = document.getElementById("todayList");
  if (!records.length) {
    container.innerHTML =
      '<div class="empty-state">No attendance marked today</div>';
    return;
  }
  const colors = ["#00d4ff", "#00e676", "#a855f7", "#ff9f43", "#ff4757"];
  container.innerHTML = records
    .slice(0, 15)
    .map(
      (r, i) => `
    <div class="att-item">
      <div class="att-avatar" style="background:${colors[i % colors.length]}20;color:${colors[i % colors.length]}">
        ${r.studentName.charAt(0).toUpperCase()}
      </div>
      <div class="att-info">
        <div class="att-name">${r.studentName}</div>
        <div class="att-dept">${r.department || ""} · ${r.studentId}</div>
      </div>
      <div>
        <span class="badge badge-${r.status.toLowerCase()}">${r.status}</span>
        <div class="att-time">${r.time}</div>
      </div>
    </div>
  `,
    )
    .join("");
}

function renderWeekChart(data) {
  // Polyfill for older browsers
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      this.beginPath();
      this.moveTo(x + r, y);
      this.lineTo(x + w - r, y);
      this.quadraticCurveTo(x + w, y, x + w, y + r);
      this.lineTo(x + w, y + h - r);
      this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      this.lineTo(x + r, y + h);
      this.quadraticCurveTo(x, y + h, x, y + h - r);
      this.lineTo(x, y + r);
      this.quadraticCurveTo(x, y, x + r, y);
      this.closePath();
    };
  }
  const canvas = document.getElementById("weekChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  if (weekChartInstance) weekChartInstance.destroy();

  // Simple custom bar chart
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  canvas.width = canvas.offsetWidth || 500;
  canvas.height = 240;
  const W = canvas.width,
    H = canvas.height;
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;
  const barW = (chartW / data.length) * 0.5;
  const gap = chartW / data.length;

  ctx.clearRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = "#1e2d47";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(W - padding.right, y);
    ctx.stroke();
    ctx.fillStyle = "#4a5a7a";
    ctx.font = "10px Space Mono, monospace";
    ctx.textAlign = "right";
    ctx.fillText(
      Math.round(maxVal - (maxVal / 4) * i),
      padding.left - 6,
      y + 4,
    );
  }

  // Bars
  data.forEach((d, i) => {
    const x = padding.left + gap * i + (gap - barW) / 2;
    const barH = (d.count / maxVal) * chartH;
    const y = padding.top + chartH - barH;

    // Gradient bar
    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, "#00d4ff");
    grad.addColorStop(1, "#0055aa");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
    ctx.fill();

    // Value label
    if (d.count > 0) {
      ctx.fillStyle = "#00d4ff";
      ctx.font = "bold 11px Space Mono, monospace";
      ctx.textAlign = "center";
      ctx.fillText(d.count, x + barW / 2, y - 6);
    }

    // Day label
    ctx.fillStyle = "#8a9bb8";
    ctx.font = "11px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(d.day, x + barW / 2, H - padding.bottom + 16);
  });
}

// ===== RECOGNITION =====
function initRecognition() {
  document.getElementById("startCam").addEventListener("click", startCamera);
  document.getElementById("stopCam").addEventListener("click", stopCamera);
  document
    .getElementById("captureBtn")
    .addEventListener("click", captureAndRecognize);
  document.getElementById("manualBtn").addEventListener("click", () => {
    document.getElementById("manualForm").classList.toggle("hidden");
  });
  document
    .getElementById("manualMarkBtn")
    .addEventListener("click", async () => {
      const id = document.getElementById("manualStudentId").value.trim();
      if (!id) return showToast("Student ID daalen", "warn");
      await markAttendance(id, 100, "Manual");
      document.getElementById("manualStudentId").value = "";
      document.getElementById("manualForm").classList.add("hidden");
    });
}

async function startCamera() {
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user",
      },
    });
    const video = document.getElementById("video");
    video.srcObject = videoStream;
    document.getElementById("cameraPlaceholder").classList.add("hidden");
    document.getElementById("startCam").classList.add("hidden");
    document.getElementById("stopCam").classList.remove("hidden");
    document.getElementById("captureBtn").disabled = false;
    document.getElementById("scanLine").classList.add("active");
    document.getElementById("recMode").textContent = "Live";
    showToast("Camera started", "info");

    // Load known faces from DB
    await loadKnownFaces();
  } catch (err) {
    showToast("Camera access denied: " + err.message, "error");
  }
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach((t) => t.stop());
    videoStream = null;
  }
  document.getElementById("video").srcObject = null;
  document.getElementById("cameraPlaceholder").classList.remove("hidden");
  document.getElementById("startCam").classList.remove("hidden");
  document.getElementById("stopCam").classList.add("hidden");
  document.getElementById("captureBtn").disabled = true;
  document.getElementById("scanLine").classList.remove("active");
  document.getElementById("recMode").textContent = "Idle";
  document.getElementById("recFace").textContent = "—";
  document.getElementById("recConf").textContent = "—";
}

async function loadKnownFaces() {
  try {
    const res = await fetch(`${API}/students/faces/all`);
    const data = await res.json();
    if (data.success) {
      knownFaces = data.students;
      showToast(`${knownFaces.length} student faces loaded`, "info");
    }
  } catch (err) {
    showToast("Face data load karne mein problem", "warn");
  }
}

async function captureAndRecognize() {
  if (!videoStream) return;

  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);

  // Simulate face recognition (since face-api.js requires CDN)
  // In production, replace with actual face-api.js recognition
  document.getElementById("recMode").textContent = "Scanning...";
  document.getElementById("recFace").textContent = "Processing";

  // Flash effect
  const overlay = document.getElementById("cameraOverlay");
  overlay.style.background = "rgba(0,212,255,0.1)";
  setTimeout(() => (overlay.style.background = ""), 200);

  await new Promise((r) => setTimeout(r, 1000));

  // Check if there are known faces
  if (knownFaces.length === 0) {
    showResultPanel(
      "fail",
      null,
      "Koi registered student nahi mila. Pehle students register karein.",
    );
    document.getElementById("recMode").textContent = "No Data";
    document.getElementById("recFace").textContent = "Not Found";
    return;
  }

  // Simulate matching (random from known for demo, replace with real face-api.js)
  // In production: use face-api.js to get descriptor and compare euclidean distance
  const randomMatch = knownFaces[Math.floor(Math.random() * knownFaces.length)];
  const confidence = Math.floor(Math.random() * 20 + 78); // 78-98%

  if (confidence >= 75) {
    document.getElementById("recFace").textContent = randomMatch.name;
    document.getElementById("recConf").textContent = confidence + "%";
    document.getElementById("recMode").textContent = "Matched";
    await markAttendance(randomMatch.studentId, confidence, "Face Recognition");
  } else {
    document.getElementById("recFace").textContent = "Unknown";
    document.getElementById("recConf").textContent = confidence + "%";
    document.getElementById("recMode").textContent = "No Match";
    showResultPanel(
      "fail",
      null,
      "Face recognize nahi ho saka. Dobara try karein.",
    );
  }
}

async function markAttendance(studentId, confidence, method) {
  try {
    const res = await fetch(`${API}/attendance/mark`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, confidence, method }),
    });
    const data = await res.json();

    if (data.success) {
      showResultPanel("success", data.student, data.attendance);
      addRecentScan(data.student, data.attendance.status);
      showToast(
        `✓ ${data.student.name} ki attendance mark ho gayi!`,
        "success",
      );
    } else if (res.status === 409) {
      showResultPanel("duplicate", null, data.message);
      showToast("Already marked today!", "warn");
    } else {
      showResultPanel("fail", null, data.message);
      showToast(data.message, "error");
    }
  } catch (err) {
    showResultPanel("fail", null, "Server se connect nahi ho saka");
    showToast("Network error: " + err.message, "error");
  }
}

function showResultPanel(type, student, info) {
  const panel = document.getElementById("resultDisplay");
  if (type === "success") {
    panel.innerHTML = `
      <div class="result-success" style="width:100%">
        <div style="font-size:40px;margin-bottom:12px">✓</div>
        <div class="result-name" style="color:var(--green)">${student.name}</div>
        <div class="result-detail">ID: ${student.studentId} | ${student.department}</div>
        <div class="result-detail" style="margin-top:8px">
          <span class="badge badge-${info.status.toLowerCase()}">${info.status}</span>
          &nbsp; ${info.time}
        </div>
      </div>`;
  } else if (type === "duplicate") {
    panel.innerHTML = `
      <div class="result-duplicate" style="width:100%;text-align:center">
        <div style="font-size:40px;margin-bottom:12px">⚠</div>
        <div class="result-name" style="color:var(--orange)">Already Marked</div>
        <div class="result-detail">${info}</div>
      </div>`;
  } else {
    panel.innerHTML = `
      <div class="result-fail" style="width:100%;text-align:center">
        <div style="font-size:40px;margin-bottom:12px">✗</div>
        <div class="result-name" style="color:var(--red)">Failed</div>
        <div class="result-detail">${info}</div>
      </div>`;
  }
}

function addRecentScan(student, status) {
  recentScans.unshift({
    student,
    status,
    time: new Date().toLocaleTimeString(),
  });
  recentScans = recentScans.slice(0, 8);
  const container = document.getElementById("recentScans");
  container.innerHTML = recentScans
    .map(
      (s) => `
    <div class="scan-item">
      <div>
        <div class="scan-name">${s.student.name}</div>
        <div style="font-size:11px;color:var(--text3)">${s.student.studentId}</div>
      </div>
      <div style="text-align:right">
        <span class="badge badge-${s.status.toLowerCase()}">${s.status}</span>
        <div class="scan-time">${s.time}</div>
      </div>
    </div>
  `,
    )
    .join("");
}

// ===== REGISTER STUDENT =====
function initRegisterForm() {
  let faceDescriptorData = null;

  document.getElementById("openRegCam").addEventListener("click", async () => {
    try {
      regVideoStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      document.getElementById("regVideo").srcObject = regVideoStream;
      document.getElementById("regVideo").classList.remove("hidden");
      document.getElementById("facePrev").classList.add("hidden");
      document.getElementById("openRegCam").classList.add("hidden");
      document.getElementById("captureRegFace").classList.remove("hidden");
      document.getElementById("closeRegCam").classList.remove("hidden");
    } catch (err) {
      showToast("Camera open nahi ho saka", "error");
    }
  });

  document.getElementById("closeRegCam").addEventListener("click", closeRegCam);

  document.getElementById("captureRegFace").addEventListener("click", () => {
    const video = document.getElementById("regVideo");
    const canvas = document.getElementById("regCanvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    // Simulate face descriptor (128-dim array, replace with real face-api.js)
    faceDescriptorData = Array.from(
      { length: 128 },
      () => Math.random() * 2 - 1,
    );

    // Show preview
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const prev = document.getElementById("facePrev");
      prev.innerHTML = `<img src="${url}" alt="Face">`;
      prev.classList.remove("hidden");
    });

    document.getElementById("faceStatus").innerHTML =
      '<span class="face-dot green"></span> Face captured!';
    closeRegCam();
    showToast("Face captured!", "success");
  });

  document
    .getElementById("registerForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const formData = new FormData();
      formData.append(
        "studentId",
        document.getElementById("reg-studentId").value.trim(),
      );
      formData.append("name", document.getElementById("reg-name").value.trim());
      formData.append(
        "email",
        document.getElementById("reg-email").value.trim(),
      );
      formData.append(
        "department",
        document.getElementById("reg-department").value,
      );
      formData.append("class", document.getElementById("reg-class").value);

      if (faceDescriptorData) {
        formData.append("faceDescriptor", JSON.stringify(faceDescriptorData));
      }

      const photoFile = document.getElementById("reg-photo").files[0];
      if (photoFile) formData.append("profileImage", photoFile);

      const btn = e.target.querySelector('[type="submit"]');
      const origText = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Registering...";

      try {
        const res = await fetch(`${API}/students/register`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        const msg = document.getElementById("regMessage");
        msg.classList.remove("hidden");

        if (data.success) {
          msg.className = "form-message success";
          msg.textContent = `✓ ${data.student.name} successfully registered! (ID: ${data.student.studentId})`;
          e.target.reset();
          document.getElementById("faceStatus").innerHTML =
            '<span class="face-dot red"></span> No face data';
          document.getElementById("facePrev").innerHTML =
            "<span>◉</span><p>No face captured</p>";
          faceDescriptorData = null;
          showToast("Student registered!", "success");
        } else {
          msg.className = "form-message error";
          msg.textContent = "✗ " + data.message;
          showToast(data.message, "error");
        }
      } catch (err) {
        showToast("Network error: " + err.message, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = origText;
      }
    });

  function closeRegCam() {
    if (regVideoStream) {
      regVideoStream.getTracks().forEach((t) => t.stop());
      regVideoStream = null;
    }
    document.getElementById("regVideo").srcObject = null;
    document.getElementById("regVideo").classList.add("hidden");
    document.getElementById("openRegCam").classList.remove("hidden");
    document.getElementById("captureRegFace").classList.add("hidden");
    document.getElementById("closeRegCam").classList.add("hidden");
    document.getElementById("facePrev").classList.remove("hidden");
  }
}

// ===== STUDENTS PAGE =====
function initStudentsPage() {
  let searchTimeout;
  document.getElementById("studentSearch").addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(
      () =>
        loadStudents(
          e.target.value,
          document.getElementById("deptFilter").value,
        ),
      400,
    );
  });
  document.getElementById("deptFilter").addEventListener("change", (e) => {
    loadStudents(
      document.getElementById("studentSearch").value,
      e.target.value,
    );
  });
}

async function loadStudents(search = "", department = "") {
  const tbody = document.getElementById("studentsBody");
  tbody.innerHTML =
    '<tr><td colspan="9" class="loading-cell">Loading students...</td></tr>';

  try {
    const params = new URLSearchParams({ limit: 100 });
    if (search) params.append("search", search);
    if (department) params.append("department", department);

    const res = await fetch(`${API}/students?${params}`);
    const data = await res.json();

    if (!data.success || !data.students.length) {
      tbody.innerHTML =
        '<tr><td colspan="9" class="empty-cell">No students found</td></tr>';
      return;
    }

    tbody.innerHTML = data.students
      .map(
        (s, i) => `
      <tr>
        <td style="color:var(--text3);font-family:'Space Mono',monospace">${i + 1}</td>
        <td><span style="font-family:'Space Mono',monospace;color:var(--accent)">${s.studentId}</span></td>
        <td style="font-weight:600">${s.name}</td>
        <td style="color:var(--text3)">${s.email}</td>
        <td>${s.department}</td>
        <td>${s.class}</td>
        <td>
          <span class="badge ${s.faceDescriptor && s.faceDescriptor.length ? "badge-present" : "badge-absent"}">
            ${s.faceDescriptor && s.faceDescriptor.length ? "✓ Yes" : "✗ No"}
          </span>
        </td>
        <td style="color:var(--text3);font-size:12px">${new Date(s.registeredAt || s.createdAt).toLocaleDateString("en-IN")}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="viewStudent('${s.studentId}')">View</button>
          <button class="btn btn-sm btn-danger" style="margin-left:4px" onclick="deleteStudent('${s.studentId}', '${s.name}')">Del</button>
        </td>
      </tr>
    `,
      )
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-cell">Error loading: ${err.message}</td></tr>`;
  }
}

async function viewStudent(id) {
  try {
    const res = await fetch(`${API}/students/${id}`);
    const data = await res.json();
    if (!data.success) return showToast("Student not found", "error");
    const s = data.student;
    showModal(
      "Student Details",
      `
      <div style="display:grid;gap:12px">
        <div style="display:flex;gap:16px;align-items:center;padding-bottom:16px;border-bottom:1px solid var(--border)">
          <div style="width:60px;height:60px;border-radius:50%;background:var(--bg3);border:2px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:var(--accent)">
            ${s.name.charAt(0)}
          </div>
          <div>
            <div style="font-size:18px;font-weight:700">${s.name}</div>
            <div style="color:var(--text3);font-size:13px">${s.studentId}</div>
          </div>
        </div>
        ${[
          ["Email", s.email],
          ["Department", s.department],
          ["Class", s.class],
          [
            "Face Data",
            s.faceDescriptor?.length
              ? `✓ Registered (${s.faceDescriptor.length} points)`
              : "✗ Not registered",
          ],
          ["Status", s.isActive ? "Active" : "Inactive"],
          ["Registered", new Date(s.createdAt).toLocaleString("en-IN")],
        ]
          .map(
            ([k, v]) => `
          <div style="display:flex;justify-content:space-between;font-size:14px">
            <span style="color:var(--text3)">${k}</span>
            <span style="font-weight:500">${v}</span>
          </div>
        `,
          )
          .join("")}
      </div>
    `,
    );
  } catch (err) {
    showToast("Error: " + err.message, "error");
  }
}

async function deleteStudent(id, name) {
  if (!confirm(`"${name}" ko delete karna chahte hain?`)) return;
  try {
    const res = await fetch(`${API}/students/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      showToast(`${name} deleted`, "success");
      loadStudents();
    } else {
      showToast(data.message, "error");
    }
  } catch (err) {
    showToast("Delete failed: " + err.message, "error");
  }
}

// ===== RECORDS PAGE =====
function initRecordsPage() {
  // Set today's date as default
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("recDate").value = today;

  document
    .getElementById("filterRecords")
    .addEventListener("click", loadRecords);
  document.getElementById("exportCSV").addEventListener("click", exportCSV);

  loadRecords();
}

async function loadRecords() {
  const tbody = document.getElementById("recordsBody");
  tbody.innerHTML =
    '<tr><td colspan="9" class="loading-cell">Loading records...</td></tr>';

  const date = document.getElementById("recDate").value;
  const status = document.getElementById("recStatus").value;

  try {
    const params = new URLSearchParams({ limit: 200 });
    if (date) params.append("date", date);
    if (status) params.append("status", status);

    const res = await fetch(`${API}/attendance?${params}`);
    const data = await res.json();

    if (!data.success || !data.records.length) {
      tbody.innerHTML =
        '<tr><td colspan="9" class="empty-cell">No records found</td></tr>';
      return;
    }

    tbody.innerHTML = data.records
      .map(
        (r, i) => `
      <tr>
        <td style="color:var(--text3);font-family:'Space Mono',monospace">${i + 1}</td>
        <td><span style="font-family:'Space Mono',monospace;color:var(--accent)">${r.studentId}</span></td>
        <td style="font-weight:600">${r.studentName}</td>
        <td style="color:var(--text3)">${r.department || "—"}</td>
        <td style="font-family:'Space Mono',monospace;font-size:12px">${r.date}</td>
        <td style="font-family:'Space Mono',monospace;font-size:12px">${r.time}</td>
        <td><span class="badge badge-${r.status.toLowerCase()}">${r.status}</span></td>
        <td style="color:var(--text3);font-size:12px">${r.method}</td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="deleteRecord('${r._id}')">Del</button>
        </td>
      </tr>
    `,
      )
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-cell">Error: ${err.message}</td></tr>`;
  }
}

async function deleteRecord(id) {
  if (!confirm("Is record ko delete karna chahte hain?")) return;
  try {
    const res = await fetch(`${API}/attendance/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      showToast("Record deleted", "success");
      loadRecords();
    }
  } catch (err) {
    showToast("Delete failed", "error");
  }
}

function exportCSV() {
  const rows = [];
  const headers = [
    "#",
    "Student ID",
    "Name",
    "Department",
    "Date",
    "Time",
    "Status",
    "Method",
  ];
  rows.push(headers.join(","));

  document.querySelectorAll("#recordsBody tr").forEach((tr, i) => {
    const cells = tr.querySelectorAll("td");
    if (cells.length > 3) {
      const row = [
        i + 1,
        cells[1]?.textContent.trim(),
        cells[2]?.textContent.trim(),
        cells[3]?.textContent.trim(),
        cells[4]?.textContent.trim(),
        cells[5]?.textContent.trim(),
        cells[6]?.textContent.trim(),
        cells[7]?.textContent.trim(),
      ];
      rows.push(row.map((v) => `"${v}"`).join(","));
    }
  });

  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("CSV exported!", "success");
}

// ===== REPORTS PAGE =====
function initReportsPage() {
  const today = new Date().toISOString().split("T")[0];
  const monthStart = new Date(new Date().setDate(1))
    .toISOString()
    .split("T")[0];
  document.getElementById("rep-start").value = monthStart;
  document.getElementById("rep-end").value = today;

  document
    .getElementById("generateReport")
    .addEventListener("click", generateReport);
}

async function generateReport() {
  const studentId = document.getElementById("rep-studentId").value.trim();
  const startDate = document.getElementById("rep-start").value;
  const endDate = document.getElementById("rep-end").value;

  if (!studentId) return showToast("Student ID daalen", "warn");

  const output = document.getElementById("reportOutput");
  output.innerHTML =
    '<div style="text-align:center;padding:30px;color:var(--text3)">Generating report...</div>';

  try {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);

    const res = await fetch(`${API}/attendance/report/${studentId}?${params}`);
    const data = await res.json();

    if (!data.success) {
      output.innerHTML = `<div style="color:var(--red);padding:20px">✗ ${data.message}</div>`;
      return;
    }

    const { student, records, summary } = data;
    const pct =
      records.length > 0
        ? Math.round((summary.present / records.length) * 100)
        : 0;

    output.innerHTML = `
      <div style="display:grid;gap:20px">
        <!-- Student Info -->
        <div style="display:flex;gap:20px;align-items:center;padding:20px;background:var(--bg3);border-radius:10px;border:1px solid var(--border)">
          <div style="width:56px;height:56px;border-radius:50%;background:rgba(0,212,255,0.1);border:2px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:var(--accent)">
            ${student.name.charAt(0)}
          </div>
          <div>
            <div style="font-size:20px;font-weight:700">${student.name}</div>
            <div style="color:var(--text3);font-size:13px">${student.studentId} · ${student.department} · ${student.class}</div>
          </div>
        </div>
        
        <!-- Summary Stats -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
          ${[
            ["Total Days", records.length, "var(--accent)"],
            ["Present", summary.present, "var(--green)"],
            ["Late", summary.late, "var(--orange)"],
            [
              "Attendance %",
              pct + "%",
              pct >= 75 ? "var(--green)" : "var(--red)",
            ],
          ]
            .map(
              ([label, val, color]) => `
            <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:16px;text-align:center">
              <div style="font-size:28px;font-weight:800;color:${color};font-family:'Space Mono',monospace">${val}</div>
              <div style="font-size:12px;color:var(--text3);margin-top:4px">${label}</div>
            </div>
          `,
            )
            .join("")}
        </div>

        <!-- Progress Bar -->
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:16px">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px">
            <span>Attendance Rate</span>
            <span style="color:${pct >= 75 ? "var(--green)" : "var(--red)"};font-weight:700">${pct}%</span>
          </div>
          <div style="background:var(--border);border-radius:4px;height:8px">
            <div style="background:${pct >= 75 ? "var(--green)" : "var(--red)"};height:8px;border-radius:4px;width:${pct}%;transition:width 0.5s ease"></div>
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:6px">${pct >= 75 ? "✓ Attendance satisfactory" : "⚠ Attendance below 75% threshold"}</div>
        </div>

        <!-- Records Table -->
        ${
          records.length
            ? `
        <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;overflow:hidden">
          <div style="padding:14px 16px;border-bottom:1px solid var(--border);font-weight:600;font-size:14px">Attendance History (${records.length} records)</div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead style="background:var(--bg3)">
                <tr>
                  <th style="padding:10px 14px;text-align:left;color:var(--text3);font-size:11px;font-family:'Space Mono',monospace">DATE</th>
                  <th style="padding:10px 14px;text-align:left;color:var(--text3);font-size:11px;font-family:'Space Mono',monospace">TIME</th>
                  <th style="padding:10px 14px;text-align:left;color:var(--text3);font-size:11px;font-family:'Space Mono',monospace">STATUS</th>
                  <th style="padding:10px 14px;text-align:left;color:var(--text3);font-size:11px;font-family:'Space Mono',monospace">METHOD</th>
                </tr>
              </thead>
              <tbody>
                ${records
                  .map(
                    (r) => `
                  <tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:10px 14px;font-family:'Space Mono',monospace">${r.date}</td>
                    <td style="padding:10px 14px;font-family:'Space Mono',monospace">${r.time}</td>
                    <td style="padding:10px 14px"><span class="badge badge-${r.status.toLowerCase()}">${r.status}</span></td>
                    <td style="padding:10px 14px;color:var(--text3)">${r.method}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>`
            : '<div class="empty-state">Is period mein koi record nahi mila</div>'
        }
      </div>
    `;
  } catch (err) {
    output.innerHTML = `<div style="color:var(--red);padding:20px">✗ Error: ${err.message}</div>`;
  }
}

// ===== MODAL =====
function initModal() {
  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modalOverlay")) closeModal();
  });
}

function showModal(title, bodyHTML) {
  document.getElementById("modalHeader").textContent = title;
  document.getElementById("modalBody").innerHTML = bodyHTML;
  document.getElementById("modalOverlay").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modalOverlay").classList.add("hidden");
}

// ===== TOAST =====
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icons = { success: "✓", error: "✗", warn: "⚠", info: "ℹ" };
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = "slideIn 0.3s ease reverse";
    setTimeout(() => toast.remove(), 280);
  }, 3500);
}

// ===== GLOBAL expose for inline onclick =====
window.viewStudent = viewStudent;
window.deleteStudent = deleteStudent;
window.deleteRecord = deleteRecord;
