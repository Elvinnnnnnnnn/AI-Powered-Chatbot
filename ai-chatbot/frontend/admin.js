const loginForm = document.getElementById("adminLoginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
      showToast("Enter email and password", "warn");
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:5000/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem("admin", JSON.stringify(data.admin));
        showToast("Login successful", "success");

        setTimeout(() => {
          window.location.href = "admin-dashboard.html";
        }, 900);

      } else {
        showToast(data.message || "Invalid email or password", "error");
      }

    } catch (error) {
      console.error("Login error:", error);
      showToast("Cannot connect to server", "error");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const adminData = localStorage.getItem("admin");
  if (!adminData) return;

  const admin = JSON.parse(adminData);

  const nameEl = document.getElementById("topbarAdminName");
  const photoEl = document.getElementById("topbarPhoto");

  if (nameEl) {
    nameEl.textContent = admin.name;
  }

  if (photoEl && admin.photo) {
    photoEl.src = `http://127.0.0.1:5000/uploads/${admin.photo}`;
  }
});

function openEditUserModal(userId, role, status) {
  const modal = document.getElementById("editUserModal");

  document.getElementById("editUserId").value = userId;
  document.getElementById("editUserStatus").value = status;

  modal.classList.add("active");
}

function closeEditUserModal() {
  document.getElementById("editUserModal").classList.remove("active");
}

function submitEditUser() {
  const userId = document.getElementById("editUserId").value;
  const status = document.getElementById("editUserStatus").value;

  fetch(`http://localhost:5000/api/admin/users/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast("User updated successfully", "success");
      closeEditUserModal();
      loadUsers();
      loadUserStats();
    } else {
      showToast(data.message || "Update failed", "error");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const editModal = document.getElementById("editUserModal");

  if (editModal) {
    editModal.addEventListener("click", (e) => {
      if (e.target === editModal) {
        editModal.classList.remove("active");
      }
    });
  }
});
