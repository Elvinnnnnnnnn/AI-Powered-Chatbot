/* ================= TIME HELPER ================= */
function formatPHTime(dateString) {
  if (!dateString) return "";

  return new Date(dateString).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
}

let editingKbId = null;
let kbData = [];
let activeCategory = "All";
let searchText = "";
let activeConversationUserId = null;
let activeConversationChatId = null;
let activeStatusFilter = "all";
let activeUserRole = "all";

function goTo(page) {
  window.location.href = page;
}

function logout() {
  // Clear admin session
  localStorage.removeItem("admin");

  // Force redirect (prevents back button issues)
  window.location.replace("admin-login.html");
}

/* AUTO-HIGHLIGHT ACTIVE MENU */
document.addEventListener("DOMContentLoaded", () => {
  const currentPage = window.location.pathname.split("/").pop();

  document.querySelectorAll(".menu li").forEach(item => {
    const page = item.getAttribute("data-page");

    if (
      (page === "dashboard" && currentPage === "admin-dashboard.html") ||
      (page === "logs" && currentPage === "admin-conversation-logs.html") ||
      (page === "kb" && currentPage === "admin-knowledge-base.html")
    ) {
      item.classList.add("active");
    }
  });
});

function loadConversations() {
  fetch("http://localhost:5000/api/admin/conversations")
    .then(res => res.json())
    .then(data => {
      const list = document.getElementById("conversationList");
      if (!list) return;
      list.innerHTML = "";

      data
        .filter(chat => {
          if (activeStatusFilter === "all") return true;
          return chat.status === activeStatusFilter;
        })
          .forEach(chat => {
            const div = document.createElement("div");
              div.className = "conversation-item";
              div.onclick = () => loadConversationThread(chat.user_id);

            div.innerHTML = `
              <div class="item-header">
                  <strong>${chat.first_name} ${chat.last_name}</strong>

                  <span class="status-pill ${chat.status}">
                    ${
                      chat.status === "resolved"
                        ? "✔ Resolved"
                        : chat.status === "escalated"
                        ? "⚠ Escalated"
                        : chat.status === "incorrect"
                        ? "✖ Incorrect"
                        : chat.status
                    }
                  </span>
                </div>

              <p class="last-message">
                ${chat.user_message || "(no message)"}
              </p>

              <div class="item-footer">
                <span class="time">
                  ${formatPHTime(chat.created_at)}
                </span>
              </div>
            `;
;

        list.appendChild(div);
      });
    });
}

function loadConversationThread(userId) {
  fetch(`http://localhost:5000/api/admin/conversations/${userId}`)
    .then(res => res.json())
    .then(data => {
      if (data.length === 0) return;

      const latestChat = data[data.length - 1];
      activeConversationChatId = latestChat.id;

      const chatPanel = document.querySelector(".chat-panel");
      chatPanel.innerHTML = "";

      const user = data[0];
      activeConversationUserId = userId;

      // Header
      chatPanel.innerHTML = `
        <div class="chat-header">
          <div>
            <strong>${user.first_name} ${user.last_name}</strong>
            <p>${user.program} · ${user.year_level}</p>
          </div>
          <span class="badge ${user.status}">
            ${user.status.toUpperCase()}
          </span>
        </div>

        <div class="chat-body" id="chatBody"></div>

        ${
          user.status === "escalated"
            ? `
              <!-- ADMIN REPLY BOX -->
              <div class="chat-actions admin-reply-box">
                <textarea
                  id="adminReply"
                  placeholder="Type admin reply here..."
                  rows="3"></textarea>

                <button class="btn-success" onclick="sendAdminReply()">
                  📩 Send Reply
                </button>
              </div>
            `
            : ""
  }

  <div class="chat-actions">

    <!-- CONVERSATION STATUS -->
    <div class="status-actions">
      <button class="btn-success" onclick="updateChatStatus('resolved')">
        ✔ Mark as Resolved
      </button>

      <button class="btn-warning" onclick="updateChatStatus('escalated')">
        ⚠ Mark as Escalated
      </button>

      <button class="btn-danger" onclick="updateChatStatus('incorrect')">
        ✖ Mark as Incorrect
      </button>
    </div>


  </div>
`;
;

      const body = document.getElementById("chatBody");

      data.forEach(row => {
        // STUDENT MESSAGE
        if (row.user_message) {
          const userMsg = document.createElement("div");
          userMsg.className = "chat student";
          userMsg.innerHTML = `
            <div>${row.user_message}</div>
            <small class="msg-time">${formatPHTime(row.created_at)}</small>
          `;
          body.appendChild(userMsg);
        }

        // BOT / ADMIN MESSAGE
        if (row.bot_reply) {
          const botMsg = document.createElement("div");

          // 👇 THIS IS WHERE YOUR CODE GOES
          if (row.bot_reply.startsWith("[ADMIN]")) {
            botMsg.className = "chat bot admin-reply";
            botMsg.textContent =
              "Admin: " + row.bot_reply.replace("[ADMIN]", "").trim();
          } else {
            botMsg.className = "chat bot";
            botMsg.innerHTML = `
              <div>${row.bot_reply}</div>
              <small class="msg-time">${formatPHTime(row.created_at)}</small>
            `;
          }

          body.appendChild(botMsg);
        }
      });

      body.scrollTop = body.scrollHeight;
    });
}

function sendAdminReply() {
  const replyEl = document.getElementById("adminReply");

  if (!replyEl) {
    showToast("Reply box not found", "error");
    return;
  }

  const reply = replyEl.value.trim();

  if (!activeConversationChatId) {
    showToast("Select a conversation first", "warn");
    return;
  }

  if (!reply) {
    showToast("Reply cannot be empty", "warn");
    return;
  }

  fetch("http://localhost:5000/api/admin/conversations/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: activeConversationUserId,
      reply: reply
    })
  })
  .then(res => res.json())
  .then(data => {
    console.log("SERVER RESPONSE:", data);

    if (!data.success) {
      showToast(data.message || "Reply failed", "error");
      return;
    }

    const body = document.getElementById("chatBody");
    const adminMsg = document.createElement("div");
    adminMsg.className = "chat bot";
    adminMsg.textContent = reply;

    body.appendChild(adminMsg);
    body.scrollTop = body.scrollHeight;

    replyEl.value = "";
    showToast("Reply sent", "success");
    loadConversations();
  })
  .catch(err => {
    console.error("SEND ERROR:", err);
    showToast("Network error. Please try again.", "error");
  });
}

function loadKnowledgeBase() {
  fetch("http://localhost:5000/api/admin/knowledge-base")
    .then(res => res.json())
    .then(data => {
      kbData = data;
      renderCategoryButtons();
      renderKnowledgeBase();
      updateKbStats();   // 👈 ADD THIS
    });
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("kbList")) {
    loadKnowledgeBase();
  }
});

function openModal() {
  document.getElementById("kbModal").classList.add("show");
}

function closeModal() {
  document.getElementById("kbModal").classList.remove("show");
}

function saveKnowledgeBase(event) {
  event.preventDefault();

  const category = kbCategory.value;
  const status = document.querySelector("input[name='kbStatus']:checked").value;

  const categoryAnswer = document.getElementById("kbCategoryAnswer").value.trim();

  const qaBlocks = document.querySelectorAll(".qa-block");

  const requests = [];

  // ⭐ SAVE CATEGORY ANSWER
  if (categoryAnswer) {
    requests.push(
      fetch("http://localhost:5000/api/admin/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: category,
          question: "__CATEGORY__",
          answer: categoryAnswer,
          status: status
        })
      })
    );
  }

  // ⭐ SAVE QUESTIONS
  qaBlocks.forEach(block => {
    const question = block.querySelector(".kb-question").value.trim();
    const answer = block.querySelector(".kb-answer").value.trim();

    if (!question || !answer) return;

    requests.push(
      fetch("http://localhost:5000/api/admin/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: category,
          question: question,
          answer: answer,
          status: status
        })
      })
    );
  });

  Promise.all(requests).then(() => {
    closeModal();
    loadKnowledgeBase();
    resetModal();
  });
}

function editKnowledgeBase(id, category, question, answer, status) {
  editingKbId = id;

  document.getElementById("kbCategory").value = category;
  document.getElementById("kbCategoryAnswer").value =
    question === "__CATEGORY__" ? answer : "";

  const qaContainer = document.getElementById("qaContainer");
  qaContainer.innerHTML = "";

  if (question !== "__CATEGORY__") {
    qaContainer.innerHTML = `
      <div class="qa-block">
        <input type="text" class="kb-question" value="${question}" readonly>
        <textarea class="kb-answer">${answer}</textarea>
      </div>
    `;
  }

  // ❌ DISABLE ADD QUESTION BUTTON
  const addBtn = document.getElementById("addQuestionBtn");
  if (addBtn) addBtn.style.display = "none";

  document.querySelector(
    `input[name="kbStatus"][value="${status}"]`
  ).checked = true;

  document.querySelector("#kbModal h2").textContent = "Edit Entry";
  document.querySelector(".modal-footer .btn-primary").textContent =
    "Save Changes";

  openModal();
}

function resetModal() {
  editingKbId = null;

  document.getElementById("kbCategory").value = "Enrollment";
  document.getElementById("kbCategoryAnswer").value = "";

  document.getElementById("qaContainer").innerHTML = `
    <div class="qa-block">
      <input type="text" class="kb-question" placeholder="Enter question">
      <textarea class="kb-answer" placeholder="Enter answer"></textarea>
    </div>
  `;

  const addBtn = document.getElementById("addQuestionBtn");
  if (addBtn) addBtn.style.display = "inline-flex";

  document.querySelector("input[name='kbStatus'][value='active']").checked = true;

  document.querySelector("#kbModal h2").textContent = "Add New Entry";
  document.querySelector(".modal-footer .btn-primary").textContent =
    "Add Entry";
}

function deleteKnowledgeBase(id) {
  if (!confirm("Are you sure you want to delete this entry?")) return;

  fetch(`http://localhost:5000/api/admin/knowledge-base/${id}`, {
    method: "DELETE"
  })
  .then(res => res.json())
  .then(() => {
    loadKnowledgeBase();
  })
  .catch(err => {
  console.error(err);
  showToast("Network error. Please refresh the page.", "error");
});

}

function renderKnowledgeBase() {
  const container = document.getElementById("kbList");
  container.innerHTML = "";

  const filtered = kbData.filter(item => {
    const matchesCategory =
      activeCategory === "All" ||
      item.category.toLowerCase() === activeCategory.toLowerCase();

    const matchesSearch =
      item.question.toLowerCase().includes(searchText) ||
      item.answer.toLowerCase().includes(searchText);

    return matchesCategory && matchesSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = "<p>No results found.</p>";
    return;
  }

  filtered.forEach(item => {
    const div = document.createElement("div");
    div.className = "kb-entry";

    div.innerHTML = `
      <span class="tag ${item.category.toLowerCase()}">${item.category}</span>
      <strong>${item.question}</strong>
      <p>${item.answer}</p>
      <div class="entry-actions">
        <span onclick="editKnowledgeBase(${item.id}, '${item.category}', \`${item.question}\`, \`${item.answer}\`, '${item.status}')">✏️</span>
        <span onclick="deleteKnowledgeBase(${item.id})">🗑️</span>
      </div>
    `;

    container.appendChild(div);
  });
}

function handleSearch(value) {
  searchText = value.toLowerCase();
  renderKnowledgeBase();
}

function filterCategory(category, btn) {
  activeCategory = category;

  document.querySelectorAll(".kb-categories .cat")
    .forEach(b => b.classList.remove("active"));

  btn.classList.add("active");
  renderKnowledgeBase();
}

function updateChatStatus(status) {
  if (!activeConversationUserId) return;

  fetch(`http://localhost:5000/api/admin/conversations/${activeConversationUserId}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  })
  .then(res => res.json())
  .then(() => {
    loadConversations(); // refresh left list
    loadConversationThread(activeConversationUserId); // refresh right panel
  })
  .catch(err => {
  console.error(err);
  showToast("Network error. Please refresh the page.", "error");
});

}

function renderCategoryButtons() {
  const container = document.getElementById("kbCategories");
  container.innerHTML = "";

  // Always add "All Categories"
  const allBtn = document.createElement("button");
  allBtn.className = "cat active";
  allBtn.textContent = "All Categories";
  allBtn.onclick = () => filterCategory("All", allBtn);
  container.appendChild(allBtn);

  // Get unique categories from KB data
  const categories = [...new Set(kbData.map(item => item.category))];

  categories.forEach(category => {
    const btn = document.createElement("button");
    btn.className = "cat";
    btn.textContent = category;
    btn.onclick = () => filterCategory(category, btn);
    container.appendChild(btn);
  });
}

function updateKbStats() {
  // Total entries
  document.getElementById("statTotal").textContent = kbData.length;

  // Active entries
  const activeCount = kbData.filter(item => item.status === "active").length;
  document.getElementById("statActive").textContent = activeCount;

  // Unique categories
  const uniqueCategories = new Set(kbData.map(item => item.category));
  document.getElementById("statCategories").textContent = uniqueCategories.size;

  // Last updated
  if (kbData.length === 0) {
    document.getElementById("statUpdated").textContent = "—";
    return;
  }

  const latest = kbData
    .map(item => item.updated_at)
    .sort((a, b) => new Date(b) - new Date(a))[0];

  document.getElementById("statUpdated").textContent =
    formatPHTime(latest);
}

function addQuestionBlock() {
  const container = document.getElementById("qaContainer");

  const block = document.createElement("div");
  block.className = "qa-block";

  block.innerHTML = `
    <input
      type="text"
      class="kb-question"
      placeholder="Enter question"
      required
    >

    <textarea
      class="kb-answer"
      placeholder="Enter answer"
      required
    ></textarea>

    <button
      type="button"
      class="remove-question-btn"
      onclick="this.parentElement.remove()"
    >
      ✖ Remove
    </button>
  `;

  container.appendChild(block);
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".tabs .tab").forEach(tab => {
    tab.addEventListener("click", () => {
      // Remove active class
      document.querySelectorAll(".tabs .tab")
        .forEach(t => t.classList.remove("active"));

      tab.classList.add("active");

      const label = tab.textContent.toLowerCase();

      if (label === "all") activeStatusFilter = "all";
      else activeStatusFilter = label; // resolved | escalated | incorrect

      loadConversations();
    });
  });
});

function formatChange(value) {
  const arrow = value >= 0 ? "↑" : "↓";
  const color = value >= 0 ? "green" : "red";
  return `<span class="${color}">${arrow} ${Math.abs(value)}% from last week</span>`;
}

function loadDashboardStats() {
  fetch("http://localhost:5000/api/admin/dashboard-stats")
    .then(res => res.json())
    .then(data => {

      const totalEl = document.getElementById("statTotalQueries");
      if (!totalEl) return; // ⛔ NOT ON DASHBOARD → STOP

      totalEl.textContent = data.total;
      document.getElementById("statResolved").textContent = data.resolved;
      document.getElementById("statEscalated").textContent = data.escalated;
      document.getElementById("statUsers").textContent = data.users;
      document.getElementById("statAvgTime").textContent = data.avg_time + " ms";

      document.getElementById("statSatisfaction").textContent =
        data.satisfaction === 0 ? "No data" : data.satisfaction + "%";

      document.getElementById("chgTotal").innerHTML =
        formatChange(data.total_change);

      document.getElementById("chgResolved").innerHTML =
        formatChange(data.resolved_change);

      document.getElementById("chgEscalated").innerHTML =
        formatChange(data.escalated_change);

      document.getElementById("chgUsers").innerHTML =
        formatChange(data.users_change);

      document.getElementById("chgAvgTime").innerHTML =
        typeof data.avg_change === "number"
          ? formatChange(data.avg_change)
          : "—";

      document.getElementById("chgSatisfaction").innerHTML =
        formatChange(data.satisfaction_change);
    });
}

function loadMostAskedQuestions() {
  fetch("http://localhost:5000/api/admin/most-asked")
    .then(res => res.json())
    .then(data => {
      const list = document.querySelector(".question-list");
      if (!list) return;

      list.innerHTML = "";

      data.forEach((item, index) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <span class="badge">${index + 1}</span>
          ${item.question}
          <small>${item.total} times</small>
        `;
        list.appendChild(li);
      });
    })
    .catch(err => {
  console.error(err);
  showToast("Network error. Please refresh the page.", "error");
});

}

function loadRecentActivity() {
  fetch("http://localhost:5000/api/admin/recent-activity")
    .then(res => res.json())
    .then(data => {

      // 🔹 FULL PAGE VERSION
      const fullContainer = document.getElementById("activityList");

      // 🔹 DASHBOARD VERSION
      const dashboardList = document.querySelector(".activity-list");

      if (!fullContainer && !dashboardList) return;

      if (fullContainer) fullContainer.innerHTML = "";
      if (dashboardList) dashboardList.innerHTML = "";

      if (data.length === 0) {
        if (fullContainer) {
          fullContainer.innerHTML = "<p>No recent activity found.</p>";
        }
        if (dashboardList) {
          dashboardList.innerHTML = "<li>No activity found</li>";
        }
        return;
      }

      data.slice(0, 5).forEach(item => {

        // FULL PAGE STYLE
        if (fullContainer) {
          const div = document.createElement("div");
          div.className = "activity-item";
          div.innerHTML = `
            <strong>${item.first_name} ${item.last_name}</strong>
            <span>${item.user_message}</span>
            <span class="status-badge ${item.status}">
              ${formatStatus(item.status)}
            </span>
          `;
          fullContainer.appendChild(div);
        }

        // DASHBOARD STYLE
        if (dashboardList) {
          const li = document.createElement("li");
          li.innerHTML = `
            <span class="status ${item.status}">
              ${item.status}
            </span>
            ${item.first_name}: ${item.user_message}
          `;
          dashboardList.appendChild(li);
        }

      });
    })
    .catch(err => {
  console.error(err);
  showToast("Network error. Please refresh the page.", "error");
});

}

function formatStatus(status) {
  if (status === "resolved") return "✔ Resolved";
  if (status === "escalated") return "⚠ Escalated";
  if (status === "incorrect") return "✖ Incorrect";
  return status;
}


function loadUsers() {
  fetch(`http://localhost:5000/api/admin/users?role=${activeUserRole}`)
    .then(res => {
      if (!res.ok) throw new Error("Server error");
      return res.json();
    })
    .then(users => {
      const tbody = document.getElementById("usersTableBody");
      if (!tbody) return;

      tbody.innerHTML = "";

      users.forEach(user => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>
            <strong>${user.name}</strong><br>
            <small>${user.email}</small>
          </td>
          <td><span class="tag ${user.role.toLowerCase()}">${user.role}</span></td>
          <td><span class="status ${user.status}">${user.status}</span></td>
          <td>—</td>
          <td>${formatPHTime(user.created_at)}</td>
          <td>
            <td>
              <span class="action-btn" onclick="openEditUserModal(${user.id}, '${user.role}', '${user.status}')">✏️</span>
              <span class="action-btn" onclick="deleteUser(${user.id})">🗑️</span>
            </td>
          </td>
        `;
        tbody.appendChild(tr);
      });
    })
    .catch(err => {
  console.error(err);
  showToast("Network error. Please refresh the page.", "error");
});

}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.classList.contains("users-page")) {
    loadUsers();
  }
});

function deleteUser(userId) {
  if (!confirm("Are you sure you want to delete this user?")) return;

  fetch(`http://localhost:5000/api/admin/users/${userId}`, {
    method: "DELETE"
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast("User deleted successfully", "success");
      loadUsers();
      loadUserStats();
    } else {
      showToast("Delete failed", "error");
    }
  })
  .catch(err => {
    console.error("Delete error:", err);
    showToast("Server error", "error");
  });
}

function editUser(userId) {
  const newRole = prompt("Enter new role (student/admin):");
  const newStatus = prompt("Enter new status (active/inactive):");

  if (!newRole || !newStatus) {
    showToast("Role and status required", "warn");
    return;
  }

  fetch(`http://localhost:5000/api/admin/users/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role: newRole,
      status: newStatus
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast("User updated successfully", "success");
      loadUsers();
    } else {
      showToast("Update failed", "error");
    }
  })
  .catch(err => {
    console.error("Update error:", err);
    showToast("Server error", "error");
  });
}

function loadUserStats() {
  fetch("http://localhost:5000/api/admin/users/stats")
    .then(res => {
      if (!res.ok) throw new Error("Stats fetch failed");
      return res.json();
    })
    .then(stats => {
      document.getElementById("statUsersTotal").textContent = stats.total;
      document.getElementById("statStudents").textContent = stats.students;
      document.getElementById("statAdmins").textContent = stats.admins;
    })
    .catch(err => {
  console.error(err);
  showToast("Network error. Please refresh the page.", "error");
});

}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.classList.contains("users-page")) {
    loadUsers();
    loadUserStats(); // 👈 ADD THIS
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const roleButtons = document.querySelectorAll(".kb-categories button");

  roleButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      // UI active state
      roleButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // Set role filter
      activeUserRole = btn.dataset.role;

      // Reload users
      loadUsers();
    });
  });
});

function loadAnalytics(range = "7d") {
  const resolutionEl = document.getElementById("resolutionRate");
  if (!resolutionEl) return; // ⛔ NOT ON ANALYTICS PAGE

  fetch(`http://localhost:5000/api/admin/analytics?range=${range}`)
    .then(res => res.json())
    .then(data => {
      resolutionEl.textContent = data.resolution_rate + "%";
      document.getElementById("avgResponse").textContent =
        data.avg_response_time + "s";
      document.getElementById("escalationRate").textContent =
        data.escalation_rate + "%";
      document.getElementById("satisfaction").textContent =
        data.satisfaction + "%";

      document.getElementById("resolutionChange").textContent = "Live data";
      document.getElementById("avgChange").textContent = "Live data";
      document.getElementById("escalationChange").textContent = "Live data";
      document.getElementById("satisfactionChange").textContent = "Live data";
    })
    .catch(err => {
  console.error(err);
  showToast("Network error. Please refresh the page.", "error");
});

}


function loadCategoryDistribution(range = "7d") {
  fetch(`http://localhost:5000/api/admin/analytics/categories?range=${range}`)
    .then(res => res.json())
    .then(data => {
      const container = document.getElementById("categoryBars");
      if (!container) return;

      container.innerHTML = "";

      data.forEach(item => {
        const bar = document.createElement("div");
        bar.className = "bar-item";

        bar.innerHTML = `
          <label>
            ${item.category}
            <span>${item.total} queries (${item.percent}%)</span>
          </label>
          <div class="bar">
            <div class="fill ${categoryColor(item.category)}"
                 style="width:${item.percent}%"></div>
          </div>
        `;

        container.appendChild(bar);
      });
    })
    .catch(err => {
    console.error(err);
    showToast("Network error. Please refresh the page.", "error");
});

}

document.addEventListener("DOMContentLoaded", () => {
  const filter = document.getElementById("dateFilter");
  if (!filter) return; // ⛔ not analytics page

  const range = filter.value;
  loadAnalytics(range);
  loadCategoryDistribution(range);
  loadPeakUsageHours(range);

  filter.addEventListener("change", () => {
    const r = filter.value;
    loadAnalytics(r);
    loadCategoryDistribution(r);
    loadPeakUsageHours(r);
  });
});


function categoryColor(category) {
  const map = {
    Enrollment: "blue",
    Grades: "green",
    Finance: "purple",
    Scholarship: "orange",
    Schedule: "teal",
    Academic: "pink"
  };
  return map[category] || "blue";
}

function formatHour(hour) {
  const h = hour % 12 || 12;
  const suffix = hour < 12 ? "AM" : "PM";
  return `${h}${suffix}`;
}

function loadPeakUsageHours(range = "7d") {
  fetch(`http://localhost:5000/api/admin/analytics/hours?range=${range}`)
    .then(res => res.json())
    .then(data => {
      const container = document.getElementById("peakHours");
      if (!container) return;

      container.innerHTML = "";

      const max = Math.max(...data.map(d => d.total), 1);

      data.forEach(item => {
        const percent = Math.round((item.total / max) * 100);

        const row = document.createElement("div");
        row.className = "hour";

        row.innerHTML = `
          <span>${formatHour(item.hour)}</span>
          <div class="hour-bar">
            <div style="width:${percent}%">${item.total}</div>
          </div>
        `;

        container.appendChild(row);
      });
    })
    .catch(err => {
  console.error(err);
  showToast("Network error. Please refresh the page.", "error");
});

}

document.addEventListener("DOMContentLoaded", () => {
  const filter = document.getElementById("dateFilter");
  if (!filter) return;

  // Initial load
  const initialRange = filter.value;
  loadAnalytics(initialRange);
  loadCategoryDistribution(initialRange);
  loadPeakUsageHours(initialRange);

  // On change
  filter.addEventListener("change", () => {
    const range = filter.value;

    loadAnalytics(range);
    loadCategoryDistribution(range);
    loadPeakUsageHours(range);
  });
});

function loadGeneralSettings() {
  fetch("http://localhost:5000/api/admin/settings/general")
    .then(res => res.json())
    .then(data => {
      document.getElementById("systemName").value = data.system_name;
      document.getElementById("institutionName").value = data.institution_name;
      document.getElementById("timezone").value = data.timezone;
      document.getElementById("maintenanceMode").checked = !!data.maintenance_mode;
    })
    .catch(err => {
  console.error(err);
  showToast("Network error. Please refresh the page.", "error");
});

}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("general")) {
    loadGeneralSettings();
    loadChatbotSettings();
    loadAdminProfile();
  }
});

function saveGeneralSettings() {
  const payload = {
    system_name: document.getElementById("systemName").value.trim(),
    institution_name: document.getElementById("institutionName").value.trim(),
    timezone: document.getElementById("timezone").value,
    maintenance_mode: document.getElementById("maintenanceMode").checked ? 1 : 0
  };

  fetch("http://localhost:5000/api/admin/settings/general", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(res => res.json())
    .then(() => {
      showToast("General settings saved successfully", "success");
    })
    .catch(err => {
  console.error(err);
  showToast("Network error. Please refresh the page.", "error");
});

}

function loadChatbotSettings() {
  fetch("http://localhost:5000/api/admin/settings/chatbot")
    .then(res => res.json())
    .then(data => {
      document.getElementById("chatbotName").value = data.chatbot_name;
      document.getElementById("welcomeMessage").value = data.welcome_message;
      document.getElementById("fallbackMessage").value = data.fallback_message;

      document.getElementById("confidenceThreshold").value =
        data.confidence_threshold;

      document.getElementById("confidenceValue").textContent =
        data.confidence_threshold + "%";

      document.getElementById("autoEscalation").checked =
        !!data.auto_escalation;
    })
    .catch(err => {
  console.error(err);
  showToast("Network error. Please refresh the page.", "error");
});

}

function saveSettings() {
  saveGeneralSettings();
  saveChatbotSettings();
  saveAdminProfile();  // 👈 ADD THIS
}

function saveAdminProfile() {
  const formData = new FormData();

  formData.append("name",
    document.getElementById("adminNameInput").value.trim()
  );

  formData.append("email",
    document.getElementById("adminEmailInput").value.trim()
  );

  const photoFile =
    document.getElementById("adminPhotoInput").files[0];

  if (photoFile) {
    formData.append("photo", photoFile);
  }

  fetch("http://localhost:5000/api/admin/profile", {
    method: "PUT",
    body: formData
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast("Profile updated successfully", "success");
        loadAdminProfile();
      } else {
        showToast(data.message || "Profile update failed", "error");
      }
    })
   .catch(err => {
  console.error(err);
  showToast("Network error. Please refresh the page.", "error");
});

}

function saveChatbotSettings() {
  const payload = {
    chatbot_name: document.getElementById("chatbotName").value.trim(),
    welcome_message: document.getElementById("welcomeMessage").value.trim(),
    fallback_message: document.getElementById("fallbackMessage").value.trim(),
    confidence_threshold:
      Number(document.getElementById("confidenceThreshold").value),
    auto_escalation:
      document.getElementById("autoEscalation").checked ? 1 : 0
  };

  fetch("http://localhost:5000/api/admin/settings/chatbot", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(res => res.json())
    .then(() => {
      showToast("Chatbot configuration saved successfully", "success");
    })
   .catch(err => {
  console.error(err);
  showToast("Network error. Please refresh the page.", "error");
});

}

function startNewChat() {
  fetch("http://localhost:5000/api/chat/new", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id })
  }).then(() => {
    document.getElementById("chatBox").innerHTML = "";
    loadChatHistory();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const addUserModal = document.getElementById("addUserModal");
  const addUserBtn = document.querySelector(".add-user-btn");

  if (!addUserModal || !addUserBtn) return;

  addUserBtn.addEventListener("click", () => {
    addUserModal.classList.add("active");
  });

  addUserModal.addEventListener("click", (e) => {
    if (e.target === addUserModal) {
      addUserModal.classList.remove("active");
    }
  });

  window.closeAddUserModal = () => {
    addUserModal.classList.remove("active");
  };
});

function submitAddUser() {
  const modal = document.getElementById("addUserModal");

  const name = modal.querySelector("input[placeholder='Enter full name']").value.trim();
  const email = modal.querySelector("input[type='email']").value.trim();
  const role = modal.querySelector("select").value;
  const password = modal.querySelector("input[type='password']").value;

  if (!name || !email || !role || !password) {
    showToast("Please fill in all fields", "warn");
    return;
  }

  fetch("http://localhost:5000/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      email,
      role,
      password
    })
  })
    .then(res => res.json())
    .then(data => {
      if (!data.success) {
        showToast(data.message || "Failed to add user", "error");
        return;
      }

      showToast("User added successfully", "success");
      closeAddUserModal();
      loadUsers();       // refresh table
      loadUserStats();   // refresh stats

      // reset form
      modal.querySelectorAll("input").forEach(i => i.value = "");
      modal.querySelector("select").selectedIndex = 0;
    })
    .catch(err => {
      console.error("ADD USER ERROR:", err);
      showToast("Server error", "error");
    });
}

function loadMostAskedTable(range = "7d") {
  fetch(`http://localhost:5000/api/admin/most-asked?range=${range}`)
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById("mostAskedTable");
      if (!tbody) return;

      tbody.innerHTML = "";

      data.slice(0, 5).forEach((item, index) => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
          <td><span class="rank-badge">${index + 1}</span></td>
          <td>${item.question}</td>
          <td>
            <span class="tag ${item.category?.toLowerCase() || 'general'}">
              ${item.category || "General"}
            </span>
          </td>
          <td>${item.total}</td>
        `;

        tbody.appendChild(tr);
      });
    })
    .catch(err => {
  console.error(err);
  showToast("Network error. Please refresh the page.", "error");
});

}

document.addEventListener("DOMContentLoaded", () => {
  const filter = document.getElementById("analyticsFilter");
  if (!filter) return;

  loadMostAskedTable("7d"); // default

  filter.addEventListener("change", () => {
    const value = filter.value;

    let range = "7d";
    if (value.includes("30")) range = "30d";
    if (value.includes("90")) range = "90d";

    loadMostAskedTable(range);
  });
});

document.addEventListener("DOMContentLoaded", () => {

  // DASHBOARD
  if (document.querySelector(".question-list")) {
    loadDashboardStats();
    loadMostAskedQuestions();
    loadRecentActivity();
  }

  // CONVERSATIONS PAGE
  if (document.getElementById("conversationList")) {
    loadConversations();
  }

  // KNOWLEDGE BASE
  if (document.getElementById("kbList")) {
    loadKnowledgeBase();
  }

});

function loadAdminProfile() {
  console.log("LOAD ADMIN PROFILE RUNNING");
  fetch("http://localhost:5000/api/admin/profile")
    .then(res => res.json())
    .then(data => {

      const name = data.name || "Administrator";

      // Inputs
      document.getElementById("adminNameInput").value = name;
      document.getElementById("adminEmailInput").value = data.email || "";

      // Topbar Name
      document.getElementById("topbarAdminName").textContent = name;

      const defaultImage = "images/ai-profile.jpg";

      // If photo exists in DB
      if (data.photo) {
        const photoURL = "http://localhost:5000/uploads/" + data.photo;

        document.getElementById("adminPhotoPreview").src = photoURL;
        document.getElementById("topbarPhoto").src = photoURL;
      } else {
        // fallback
        document.getElementById("adminPhotoPreview").src = defaultImage;
        document.getElementById("topbarPhoto").src = defaultImage;
      }
    })
    .catch(err => {
  console.error(err);
  showToast("Network error. Please refresh the page.", "error");
});

}

function registerAdmin() {

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirm_password").value;

  if (!username || !password || !confirmPassword) {
    showToast("All fields are required", "warn");
    return;
  }

  if (password !== confirmPassword) {
    showToast("Passwords do not match", "warn");
    return;
  }

  fetch("http://localhost:5000/api/admin/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      username: username,
      password: password
    })
  })
  .then(res => res.json())
  .then(data => {

    if (!data.success) {
      showToast(data.message, "error");
      return;
    }

   showToast("Admin account created successfully", "success");
    setTimeout(() => {
      window.location.href = "admin-login.html";
    }, 1200);
  })
  .catch(err => {
    console.error("Register error:", err);
    showToast("Server error", "error");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("activityList")) {
    loadRecentActivity();
  }
});

