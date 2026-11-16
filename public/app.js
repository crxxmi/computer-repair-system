const API_URL = "/api/repairs";

function getToken() {
  return sessionStorage.getItem("token");
}

function getCurrentUser() {
  try {
    const userText = sessionStorage.getItem("user");
    return userText ? JSON.parse(userText) : null;
  } catch {
    return null;
  }
}

function showMessage(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

function updateDashboard(repairs) {
  const total = document.getElementById("totalCount");
  const pending = document.getElementById("pendingCount");
  const progress = document.getElementById("progressCount");
  const completed = document.getElementById("completedCount");

  if (total) total.textContent = repairs.length;
  if (pending) {
    pending.textContent = repairs.filter(item => item.status === "pending").length;
  }
  if (progress) {
    progress.textContent = repairs.filter(item => item.status === "in_progress").length;
  }
  if (completed) {
    completed.textContent = repairs.filter(item => item.status === "completed").length;
  }
}

function updateAuthUI() {
  const token = getToken();
  const user = getCurrentUser();

  const authSection = document.getElementById("authSection");
  const userSection = document.getElementById("userSection");
  const userInfo = document.getElementById("userInfo");
  const repairForm = document.getElementById("repairForm");

  if (authSection) authSection.hidden = Boolean(token);
  if (userSection) userSection.hidden = !token;

  if (token && user) {
    if (userInfo) {
      userInfo.textContent = `เข้าสู่ระบบแล้ว: ${user.fullName} (${user.role})`;
    }

    if (repairForm) {
      repairForm.hidden = !["customer", "technician", "admin"].includes(user.role);
    }
  }
}

async function readResponse(response) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || data.message || "เกิดข้อผิดพลาด");
  }

  return data;
}

// LOGIN
const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage("authMessage", "กำลังเข้าสู่ระบบ...");

    const email =
      document.getElementById("loginEmail")?.value.trim() ||
      document.getElementById("email")?.value.trim();

    const password =
      document.getElementById("loginPassword")?.value ||
      document.getElementById("password")?.value;

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await readResponse(response);

      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("user", JSON.stringify(data.user));

      window.location.href = "dashboard.html";
    } catch (error) {
      showMessage("authMessage", error.message);
    }
  });
}

// REGISTER
const registerForm = document.getElementById("registerForm");

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage("authMessage", "กำลังสมัครสมาชิก...");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: document.getElementById("registerName").value.trim(),
          email: document.getElementById("registerEmail").value.trim(),
          password: document.getElementById("registerPassword").value
        })
      });

      await readResponse(response);

      alert("สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ");
      window.location.href = "login.html";
    } catch (error) {
      showMessage("authMessage", error.message);
    }
  });
}

// LOGOUT
const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    window.location.href = "login.html";
  });
}

// REPAIR APPROVAL
async function updateApproval(repairId, approvalStatus) {
  const token = getToken();

  if (!token) {
    alert("กรุณาเข้าสู่ระบบก่อน");
    return;
  }

  const confirmMessage = approvalStatus === "approved"
    ? "ยืนยันการอนุมัติราคาซ่อมหรือไม่?"
    : "ยืนยันการปฏิเสธราคาซ่อมหรือไม่?";

  if (!confirm(confirmMessage)) return;

  try {
    const response = await fetch(`${API_URL}/${repairId}/approval`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ approvalStatus })
    });

    await readResponse(response);
    alert("บันทึกการอนุมัติเรียบร้อยแล้ว");
    await loadRepairs();
  } catch (error) {
    alert(error.message);
  }
}

// SIMULATED PAYMENT
async function simulatePayment(repairId) {
  const token = getToken();

  if (!token) {
    alert("กรุณาเข้าสู่ระบบก่อน");
    return;
  }

  if (!confirm("ยืนยันการชำระเงินจำลองหรือไม่?")) return;

  try {
    const response = await fetch(`${API_URL}/${repairId}/payment`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ paymentMethod: "promptpay" })
    });

    await readResponse(response);
    alert("ชำระเงินจำลองสำเร็จ");
    await loadRepairs();
  } catch (error) {
    alert(error.message);
  }
}

// SAVE REPAIR ESTIMATE
async function saveEstimate(repairId, estimatedPrice, estimateNote) {
  const token = getToken();
  const price = Number(estimatedPrice);

  if (!token) {
    alert("กรุณาเข้าสู่ระบบก่อน");
    return;
  }

  if (estimatedPrice === "" || !Number.isFinite(price) || price < 0) {
    alert("กรุณากรอกราคาประเมินให้ถูกต้อง");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/${repairId}/estimate`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        estimatedPrice: price,
        estimateNote
      })
    });

    await readResponse(response);
    alert("บันทึกราคาประเมินเรียบร้อยแล้ว");
    await loadRepairs();
  } catch (error) {
    alert(error.message);
  }
}

// CHANGE REPAIR STATUS
async function changeRepairStatus(repairId, newStatus) {
  const token = getToken();

  if (!token) {
    alert("กรุณาเข้าสู่ระบบก่อน");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/${repairId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status: newStatus })
    });

    await readResponse(response);
    showMessage("message", "เปลี่ยนสถานะสำเร็จ");
    await loadRepairs();
  } catch (error) {
    showMessage("message", error.message);
  }
}

// LOAD REPAIR LIST
async function loadRepairs() {
  const repairList = document.getElementById("repairList");
  const token = getToken();

  if (!token) {
    showMessage("message", "กรุณาเข้าสู่ระบบก่อน");
    return;
  }

  try {
    const response = await fetch(API_URL, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await readResponse(response);

    updateDashboard(data);

    if (!repairList) return;

    repairList.replaceChildren();

    if (data.length === 0) {
      repairList.textContent = "ยังไม่มีรายการแจ้งซ่อม";
      return;
    }

    const currentUser = getCurrentUser();

    const statusNames = {
      pending: "รอดำเนินการ",
      in_progress: "กำลังซ่อม",
      completed: "ซ่อมเสร็จแล้ว"
    };

    const approvalNames = {
      waiting: "รออนุมัติ",
      approved: "อนุมัติแล้ว",
      rejected: "ไม่อนุมัติ"
    };

    const paymentNames = {
      unpaid: "ยังไม่ชำระเงิน",
      paid: "ชำระเงินแล้ว"
    };

    data.forEach((repair) => {
  const card = document.createElement("details");
  card.className = "repair";
  card.dataset.status = repair.status;

  const statusNames = {
    pending: "รอดำเนินการ",
    in_progress: "กำลังซ่อม",
    completed: "ซ่อมเสร็จแล้ว"
  };

  const approvalNames = {
    waiting: "รออนุมัติ",
    approved: "อนุมัติแล้ว",
    rejected: "ไม่อนุมัติ"
  };

  const paymentNames = {
    unpaid: "ยังไม่ชำระเงิน",
    paid: "ชำระเงินแล้ว"
  };

  const statusClass = {
    pending: "pending",
    in_progress: "in-progress",
    completed: "completed"
  };

  const createElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const header = createElement("summary", "repair-header");
  const title = createElement("h3", "repair-title", `รายการแจ้งซ่อม #${repair.id}`);
  const statusBadge = createElement(
    "span",
    `status-badge ${statusClass[repair.status] || "pending"}`,
    statusNames[repair.status] || repair.status
  );

  header.append(title, statusBadge);

  const infoGrid = createElement("div", "repair-info-grid");

  const addInfo = (label, value) => {
    const item = createElement("div", "repair-info-item");
    item.append(
      createElement("span", "info-label", label),
      createElement("strong", "info-value", value || "-")
    );
    infoGrid.appendChild(item);
  };

  addInfo("ผู้แจ้ง", repair.customerName);
  addInfo("อุปกรณ์", repair.device);
  addInfo("ปัญหาที่พบ", repair.problem);

  const estimateBox = createElement("div", "repair-estimate-box");
  const price = repair.estimatedPrice;

  estimateBox.append(
    createElement("span", "info-label", "ราคาประเมิน"),
    createElement(
      "strong",
      "estimate-price",
      price !== null && price !== undefined
        ? `${Number(price).toLocaleString("th-TH")} บาท`
        : "รอช่างประเมิน"
    ),
    createElement(
      "p",
      "estimate-note",
      repair.estimateNote || "ยังไม่มีรายละเอียดการประเมิน"
    )
  );

  const paymentInfo = createElement("div", "repair-payment-info");

  const approvalItem = createElement("div", "payment-item");
  approvalItem.append(
    createElement("span", "info-label", "การอนุมัติ"),
    createElement(
      "strong",
      "info-value",
      approvalNames[repair.approvalStatus] || "รออนุมัติ"
    )
  );

  const paymentItem = createElement("div", "payment-item");
  paymentItem.append(
    createElement("span", "info-label", "การชำระเงิน"),
    createElement(
      "strong",
      "info-value",
      paymentNames[repair.paymentStatus] || "ยังไม่ชำระเงิน"
    )
  );

  paymentInfo.append(approvalItem, paymentItem);

  const content = createElement("div", "repair-content");
  content.append(infoGrid, estimateBox, paymentInfo);
  card.append(header, content);

  const actionArea = createElement("div", "repair-actions");

  if (
    currentUser?.role === "customer" &&
    price !== null &&
    price !== undefined &&
    repair.approvalStatus === "waiting"
  ) {
    const approveButton = createElement("button", "action-button primary", "อนุมัติราคา");
    approveButton.onclick = () => updateApproval(repair.id, "approved");

    const rejectButton = createElement("button", "action-button danger", "ปฏิเสธราคา");
    rejectButton.onclick = () => updateApproval(repair.id, "rejected");

    actionArea.append(approveButton, rejectButton);
  }

  if (
    currentUser?.role === "customer" &&
    repair.approvalStatus === "approved" &&
    repair.paymentStatus !== "paid" &&
    price !== null &&
    price !== undefined
  ) {
    const paymentButton = createElement(
      "button",
      "action-button primary",
      "ชำระเงินจำลอง"
    );
    paymentButton.onclick = () => simulatePayment(repair.id);
    actionArea.appendChild(paymentButton);
  }

  if (["technician", "admin"].includes(currentUser?.role)) {
    const statusButton = createElement(
      "button",
      "action-button primary",
      "เปลี่ยนเป็นกำลังซ่อม"
    );
    statusButton.onclick = () =>
      changeRepairStatus(repair.id, "in_progress");

    const completeButton = createElement(
      "button",
      "action-button success",
      "เปลี่ยนเป็นซ่อมเสร็จแล้ว"
    );
    completeButton.onclick = () =>
      changeRepairStatus(repair.id, "completed");

    const priceInput = createElement("input", "estimate-input");
    priceInput.type = "number";
    priceInput.min = "0";
    priceInput.step = "0.01";
    priceInput.placeholder = "กรอกราคาประเมิน (บาท)";

    const noteInput = createElement("textarea", "estimate-textarea");
    noteInput.placeholder = "รายละเอียดการประเมินราคา";

    const estimateButton = createElement(
      "button",
      "action-button primary",
      "บันทึกราคาประเมิน"
    );
    estimateButton.onclick = () =>
      saveEstimate(repair.id, priceInput.value, noteInput.value);

    const estimateEditor = createElement("div", "estimate-editor");
    estimateEditor.append(
      createElement("h4", "", "จัดการราคาประเมิน"),
      priceInput,
      noteInput,
      estimateButton
    );

    actionArea.append(statusButton, completeButton);
    content.appendChild(estimateEditor);
  }

  if (actionArea.children.length > 0) {
  content.appendChild(actionArea);
  }

  repairList.appendChild(card);
});

  } catch (error) {
    showMessage("message", error.message);
  }
}

// CREATE REPAIR REQUEST
const repairForm = document.getElementById("repairForm");

if (repairForm) {
  repairForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const token = getToken();
    const submitButton = document.getElementById("submitButton");

    if (!token) {
      showMessage("message", "กรุณาเข้าสู่ระบบก่อน");
      return;
    }

    if (submitButton) submitButton.disabled = true;
    showMessage("message", "กำลังส่งรายการ...");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
        customerName: document.getElementById("customerName").value.trim(),
        device: document.getElementById("device").value.trim(),
        problem: document.getElementById("problem").value.trim()
        })
      });

      const data = await readResponse(response);

      showMessage("message", `แจ้งซ่อมสำเร็จ! หมายเลขรายการ ${data.id}`);
      repairForm.reset();
      await loadRepairs();
    } catch (error) {
      showMessage("message", error.message);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

// RELOAD BUTTON
const loadButton = document.getElementById("loadButton");

if (loadButton) {
  loadButton.addEventListener("click", loadRepairs);
}

// SEARCH REPAIR
const searchRepair = document.getElementById("searchRepair");

if (searchRepair) {
  const statusKeywords = {
    "รอดำเนินการ": "pending",
    "กำลังซ่อม": "in_progress",
    "ซ่อมเสร็จแล้ว": "completed"
  };

  searchRepair.addEventListener("input", () => {
    const keyword = searchRepair.value.trim().toLowerCase();
    const searchStatus = statusKeywords[keyword] || keyword;

    document.querySelectorAll("#repairList .repair").forEach((card) => {
      const status = (card.dataset.status || "").toLowerCase();
      const text = card.textContent.toLowerCase();

      const matchesText = text.includes(keyword);
      const matchesStatus = status === searchStatus;

      card.hidden = keyword !== "" && !(matchesText || matchesStatus);
    });
  });
}

// INITIALIZE
updateAuthUI();

if (getToken()) {
  loadRepairs();
}