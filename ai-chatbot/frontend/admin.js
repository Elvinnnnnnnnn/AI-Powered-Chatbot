document.getElementById("adminLoginForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Please enter email and password");
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
      // ✅ STORE ADMIN SESSION
      localStorage.setItem("admin", JSON.stringify(data.admin));

      // ✅ REDIRECT TO ADMIN DASHBOARD
      window.location.href = "admin-dashboard.html";
    } else {
      alert(data.message || "Login failed");
    }

  } catch (error) {
    console.error("Login error:", error);
    alert("Cannot connect to server");
  }
});
