let editingKbId = null;
let kbData = [];
let activeCategory = "All";
let searchText = "";
let activeConversationUserId = null;
let activeConversationChatId = null;

function goTo(page) {
  window.location.href = page;
}

function logout() {
  localStorage.removeItem("admin");
  window.location.href = "admin-login.html";
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
  fetch("http://127.0.0.1:5000/api/admin/conversations")
    .then(res => res.json())
    .then(data => {
      const list = document.getElementById("conversationList");
      list.innerHTML = "";

      data.forEach(chat => {
        const div = document.createElement("div");
          div.className = "conversation-item";
          div.onclick = () => loadConversationThread(chat.user_id);

        div.innerHTML = `
          <div class="item-header">
            <strong>${chat.first_name} ${chat.last_name}</strong>
            <span class="badge ${chat.status}">
              ${chat.status}
            </span>
          </div>

          <p class="last-message">
            ${chat.user_message || "(no message)"}
          </p>

          <div class="item-footer">
            <span class="time">
              ${new Date(chat.created_at).toLocaleString()}
            </span>
          </div>
        `;
;

        list.appendChild(div);
      });
    });
}

function loadConversationThread(userId) {
  fetch(`http://127.0.0.1:5000/api/admin/conversations/${userId}`)
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
      ${user.status}
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
          userMsg.textContent = row.user_message;
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
            botMsg.textContent = row.bot_reply;
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
    alert("Reply box not found");
    return;
  }

  const reply = replyEl.value.trim();

  if (!activeConversationChatId) {
    alert("Chat ID is missing. Click a conversation first.");
    return;
  }

  if (!reply) {
    alert("Reply cannot be empty");
    return;
  }

  fetch("http://127.0.0.1:5000/api/admin/conversations/reply", {
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
      alert(data.message || "Reply failed");
      return;
    }

    const body = document.getElementById("chatBody");
    const adminMsg = document.createElement("div");
    adminMsg.className = "chat bot";
    adminMsg.textContent = reply;

    body.appendChild(adminMsg);
    body.scrollTop = body.scrollHeight;

    replyEl.value = "";
    loadConversations();
  })
  .catch(err => {
    console.error("SEND ERROR:", err);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("conversationList")) {
    loadConversations();
  }
});

function loadKnowledgeBase() {
  fetch("http://127.0.0.1:5000/api/admin/knowledge-base")
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

  const questions = document.querySelectorAll(".kb-question");
  const answers = document.querySelectorAll(".kb-answer");

  if (questions.length === 0 && !categoryAnswer) {
    alert("Please add at least a category answer or one question.");
    return;
  }

  const requests = [];

  // ✅ 1️⃣ SAVE CATEGORY ANSWER
  if (categoryAnswer) {
    requests.push(
      fetch("http://127.0.0.1:5000/api/admin/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: category,
          question: "__CATEGORY__",   // 🔑 MAGIC KEY
          answer: categoryAnswer,
          status: status
        })
      })
    );
  }

  // ✅ 2️⃣ SAVE QUESTIONS
  questions.forEach((qEl, index) => {
    const question = qEl.value.trim();
    const answer = answers[index].value.trim();

    if (!question || !answer) return;

    requests.push(
      fetch("http://127.0.0.1:5000/api/admin/knowledge-base", {
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
  document.getElementById("kbQuestion").value = question;
  document.getElementById("kbAnswer").value = answer;

  document.querySelector(
    `input[name="kbStatus"][value="${status}"]`
  ).checked = true;

  document.querySelector("#kbModal h2").textContent = "Edit Entry";
  document.querySelector(".modal-actions .btn-primary").textContent = "Save Changes";

  openModal();
}

function resetModal() {
  document.getElementById("kbCategory").value = "Enrollment";
  document.getElementById("kbCategoryAnswer").value = "";

  document.getElementById("qaContainer").innerHTML = `
    <div class="qa-block">
      <input type="text" class="kb-question" placeholder="Enter question">
      <textarea class="kb-answer" placeholder="Enter answer"></textarea>
    </div>
  `;

  document.querySelector("input[name='kbStatus'][value='active']").checked = true;
}


function deleteKnowledgeBase(id) {
  if (!confirm("Are you sure you want to delete this entry?")) return;

  fetch(`http://127.0.0.1:5000/api/admin/knowledge-base/${id}`, {
    method: "DELETE"
  })
  .then(res => res.json())
  .then(() => {
    loadKnowledgeBase();
  })
  .catch(err => console.error(err));
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

  fetch(`http://127.0.0.1:5000/api/admin/conversations/${activeConversationUserId}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  })
  .then(res => res.json())
  .then(() => {
    loadConversations(); // refresh left list
    loadConversationThread(activeConversationUserId); // refresh right panel
  })
  .catch(err => console.error(err));
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
    .map(item => new Date(item.updated_at))
    .sort((a, b) => b - a)[0];

  document.getElementById("statUpdated").textContent =
    latest.toLocaleDateString() + " " + latest.toLocaleTimeString();
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
