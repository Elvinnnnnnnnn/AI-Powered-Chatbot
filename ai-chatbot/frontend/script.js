/* =====================================================
   REGISTRATION FLOW
   register.html
   register-step2.html
   register-step3.html
===================================================== */

let isInCategoryFlow = false;

/* STEP 1 → SAVE PERSONAL INFO */
function saveStep1() {
    localStorage.setItem("first_name", document.getElementById("first_name").value);
    localStorage.setItem("middle_name", document.getElementById("middle_name").value);
    localStorage.setItem("last_name", document.getElementById("last_name").value);
    localStorage.setItem("birth_date", document.getElementById("birth_date").value);
    localStorage.setItem("gender", document.getElementById("gender").value);

    window.location.href = "register-step2.html";
}

/* STEP 2 → SAVE CONTACT INFO */
function saveStep2() {
    localStorage.setItem("email", document.getElementById("email").value);
    localStorage.setItem("phone", document.getElementById("phone").value);
    localStorage.setItem("address", document.getElementById("address").value);
    localStorage.setItem("program", document.getElementById("program").value);
    localStorage.setItem("year_level", document.getElementById("year_level").value);

    window.location.href = "register-step3.html";
}

/* STEP 3 → SEND EVERYTHING TO BACKEND */
function registerUser() {
    const data = {
        first_name: localStorage.getItem("first_name"),
        middle_name: localStorage.getItem("middle_name"),
        last_name: localStorage.getItem("last_name"),
        birth_date: localStorage.getItem("birth_date"),
        gender: localStorage.getItem("gender"),

        email: localStorage.getItem("email"),
        phone: localStorage.getItem("phone"),
        address: localStorage.getItem("address"),
        program: localStorage.getItem("program"),
        year_level: localStorage.getItem("year_level"),

        username: document.getElementById("username").value,
        password: document.getElementById("password").value
    };

    fetch("http://127.0.0.1:5000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(response => {
        alert(response.message);
        if (response.success) {
            localStorage.clear();
            window.location.href = "login.html";
        }
    });
}

/* =====================================================
   AUTHENTICATION
   login.html
===================================================== */

function loginUser() {
    const data = {
        email: document.getElementById("login_email").value,
        password: document.getElementById("login_password").value
    };

    fetch("http://127.0.0.1:5000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(response => {
        if (response.success) {
            sessionStorage.setItem("user", JSON.stringify(response.user));
            window.location.href = "dashboard.html";
        } else {
            alert(response.message);
        }
    });
}

/* CHECK IF USER IS LOGGED IN */
function requireLogin() {
    const user = sessionStorage.getItem("user");
    if (!user) {
        window.location.href = "login.html";
    }
}

/* =====================================================
   USER INFO (TOPBAR / DASHBOARD)
===================================================== */

function loadUserInfo() {
    const user = JSON.parse(sessionStorage.getItem("user"));
    if (!user) return;

    document.querySelectorAll(".student-name")
        .forEach(el => el.textContent = user.first_name + " " + user.last_name);

    document.querySelectorAll(".student-role")
        .forEach(el => el.textContent = user.role);
}

/* =====================================================
   SETTINGS PAGE
   settings.html
===================================================== */

/* LOAD USER SETTINGS INTO FORM */
function loadSettings() {
    const user = JSON.parse(sessionStorage.getItem("user"));

    fetch(`http://127.0.0.1:5000/user/${user.id}`)
        .then(res => res.json())
        .then(data => {
            document.getElementById("set_first_name").value = data.first_name;
            document.getElementById("set_last_name").value = data.last_name;
            document.getElementById("set_email").value = data.email;
            document.getElementById("set_phone").value = data.phone;
            document.getElementById("set_address").value = data.address;
            document.getElementById("set_birthdate").value = data.birth_date;
        });
}

/* UPDATE PROFILE INFO */
function updateProfile() {
    const user = JSON.parse(sessionStorage.getItem("user"));

    fetch("http://127.0.0.1:5000/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            id: user.id,
            first_name: set_first_name.value,
            last_name: set_last_name.value,
            email: set_email.value,
            phone: set_phone.value,
            address: set_address.value,
            birth_date: set_birthdate.value
        })
    })
    .then(res => res.json())
    .then(() => alert("Profile updated"));
}

/* CHANGE ACCOUNT PASSWORD */
function changePassword() {
    const user = JSON.parse(sessionStorage.getItem("user"));

    if (new_password.value !== confirm_password.value) {
        alert("Passwords do not match");
        return;
    }

    fetch("http://127.0.0.1:5000/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            id: user.id,
            current: current_password.value,
            new: new_password.value
        })
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) alert("Password changed");
        else alert(res.message);
    });
}

/* TAB SWITCHING (PROFILE / ACCOUNT) */
function showTab(tabId) {
    document.querySelectorAll(".tab-content").forEach(tab => {
        tab.classList.remove("active");
    });

    document.querySelectorAll(".tabs button").forEach(btn => {
        btn.classList.remove("active");
    });

    document.getElementById(tabId).classList.add("active");
    event.target.classList.add("active");
}

/* =====================================================
   CLASS SCHEDULE (TABLE VERSION)
   class-schedule.html
===================================================== */

let selectedProgram = "";
let selectedYear = "";

/* SELECT PROGRAM */
function selectProgram(program) {
    selectedProgram = program;
    loadSchedule();
}

/* SELECT YEAR LEVEL */
function selectYear(year) {
    selectedYear = year;
    loadSchedule();
}

/* LOAD SCHEDULE FROM BACKEND */
function loadSchedule() {
    if (!selectedProgram || !selectedYear) return;

    fetch("http://127.0.0.1:5000/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            program: selectedProgram,
            year: selectedYear
        })
    })
    .then(res => res.json())
    .then(data => renderSchedule(data));
}

/* RENDER SCHEDULE TABLE */
function renderSchedule(data) {
    let html = `<table class="schedule-table">
        <tr><th>Day</th><th>Time</th><th>Subject</th><th>Room</th></tr>`;

    data.forEach(row => {
        html += `<tr>
            <td>${row.day}</td>
            <td>${row.time}</td>
            <td>${row.subject}</td>
            <td>${row.room}</td>
        </tr>`;
    });

    html += `</table>`;
    document.getElementById("scheduleTable").innerHTML = html;
}

/* =====================================================
   SCHOOL CALENDAR
   school-calendar.html
===================================================== */

function loadCalendar() {
    fetch("http://127.0.0.1:5000/calendar")
        .then(res => res.json())
        .then(data => {
            let html = "";
            data.forEach(event => {
                html += `
                <div class="calendar-card">
                    <h3>${event.title}</h3>
                    <p><strong>${event.start_date} - ${event.end_date}</strong></p>
                    <p>${event.description}</p>
                </div>`;
            });
            document.getElementById("calendarList").innerHTML = html;
        });
}

/* =====================================================
   CHATBOT (STUDENT SIDE)
   chatbot.html
===================================================== */

function sendMessage() {
    sessionStorage.removeItem("activeCategory");
    isInCategoryFlow = false;

    const input = document.getElementById("userMessage");
    const msg = input.value.trim();
    if (!msg) return;

    const user = JSON.parse(sessionStorage.getItem("user"));

    addMessage("user", msg);

    fetch("http://127.0.0.1:5000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_id: user.id,
            message: msg
        })
    })
    .then(res => res.json())
    .then(data => {
        addMessage("admin", data.reply, data.chat_id, true);
    });



    input.value = "";
}

/* QUICK REPLY BUTTONS */
function sendQuick(text) {
    document.getElementById("userMessage").value = text;
    sendMessage();
}

/* ADD MESSAGE TO CHAT BOX */
function addMessage(sender, text, chatId = null, withFeedback = false) {
    const box = document.getElementById("chatBox");
    let html = "";

    if (sender === "user") {
        html = `
            <div class="chat-message user">
                <div class="bubble user-bubble">${text}</div>
                <div class="avatar user-avatar">U</div>
            </div>
        `;
    } else {
        html = `
            <div class="chat-message admin">
                <div class="avatar admin-avatar">A</div>
                <div class="bubble admin-bubble">
                    ${text}
                    ${
                      withFeedback && chatId
                        ? `
                          <div class="feedback">
                            <span>Was this helpful?</span>
                            <button onclick="sendFeedback(${chatId}, 'yes')">👍</button>
                            <button onclick="sendFeedback(${chatId}, 'no')">👎</button>
                          </div>
                        `
                        : ""
                    }
                </div>
            </div>
        `;
    }

    box.insertAdjacentHTML("beforeend", html);
    box.scrollTop = box.scrollHeight;
}

function sendFeedback(chatId, feedback) {
    fetch("http://127.0.0.1:5000/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: chatId,
            feedback: feedback
        })
    })
    .then(() => {
        addMessage(
            "admin",
            feedback === "yes"
              ? "Thanks! Glad I could help 😊"
              : "Thanks for the feedback. I’ll forward this to the admin."
        );
    });
}


function loadCategories() {
    fetch("http://127.0.0.1:5000/api/chat/categories")
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById("categoryActions");
            container.innerHTML = "";

            data.forEach(item => {
                const btn = document.createElement("button");
                btn.textContent = item.category;
                btn.onclick = () => selectCategory(item.category);
                container.appendChild(btn);
            });
        });
}

function loadCategoryQuestions(category) {
    fetch(`http://127.0.0.1:5000/api/chat/questions/${encodeURIComponent(category)}`)
        .then(res => res.json())
        .then(data => {
            const { questions } = data;

            const container = document.getElementById("categoryActions");
            container.innerHTML = "";

            if (!questions || questions.length === 0) {
                addMessage("admin", "No additional questions available.");
                return;
            }

            addMessage("admin", "You may also ask:");

            questions.forEach(item => {
                const btn = document.createElement("button");
                btn.textContent = item.question;
                btn.onclick = () => selectQuestion(item.question, item.answer);
                container.appendChild(btn);
            });

            // ✅ Back to Categories button (HERE ONLY)
            const backBtn = document.createElement("button");
            backBtn.textContent = "⬅ Back to Categories";
            backBtn.classList.add("back-btn");
            backBtn.onclick = () => {
                sessionStorage.removeItem("activeCategory");
                isInCategoryFlow = false;
                container.innerHTML = "";
                loadCategories();
            };

            container.appendChild(backBtn);
        });
}

function selectCategory(category) {
    isInCategoryFlow = true;
    sessionStorage.setItem("activeCategory", category);

    const user = JSON.parse(sessionStorage.getItem("user"));

    addMessage("user", category);

    // 1️⃣ Get category answer
    fetch("http://127.0.0.1:5000/chat/category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_id: user.id,
            category: category
        })
    })
    .then(res => res.json())
    .then(data => {
        addMessage("admin", data.reply, data.chat_id, true);
        loadCategoryQuestions(category);
    })
    .catch(err => {
        console.error("Category error:", err);
        addMessage("admin", "Something went wrong. Please try again.");
    });
}

function selectQuestion(question, answer) {
    isInCategoryFlow = false;

    const user = JSON.parse(sessionStorage.getItem("user"));

    // show user question immediately
    addMessage("user", question);

    fetch("http://127.0.0.1:5000/chat/quick-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_id: user.id,
            question: question,
            answer: answer
        })
    })
    .then(res => res.json())
    .then(data => {
        // show bot answer WITH feedback
        addMessage("admin", data.reply, data.chat_id, true);
    });

}

/* LOAD CHAT HISTORY */
function loadChatHistory() {
    if (isInCategoryFlow) return;

    const user = JSON.parse(sessionStorage.getItem("user"));
    if (!user) return;

    fetch(`http://127.0.0.1:5000/chat/history/${user.id}`)
        .then(res => res.json())
        .then(data => {
            const box = document.getElementById("chatBox");
            box.innerHTML = "";

            // ✅ SHOW WELCOME ONLY WHEN THERE IS NO CHAT HISTORY
            if (!data || data.length === 0) {
                showWelcomeMessage();
                return;
            }

            data.forEach(row => {
                if (row.user_message) {
                    addMessage("user", row.user_message);
                }
                if (row.bot_reply) {
                    addMessage("admin", row.bot_reply, row.id, row.feedback === null);
                }
            });

            const activeCategory = sessionStorage.getItem("activeCategory");
            if (activeCategory) {
                loadCategoryQuestions(activeCategory);
            }
        });
}

/* =====================================================
   CLASS SCHEDULE FLOW (WIZARD STYLE)
   class-schedule.html (EXPERIMENTAL)
===================================================== */

let selectedYearLevel = "";
let selectedCourse = "";
let selectedBlock = "";

const yearLevels = ["SHS", "1st Year", "2nd Year", "3rd Year", "4th Year"];
const courses = ["BSBA", "BSIT", "BSCS", "BSAIS", "BTVTED", "BSOA"];
const blocks = ["BLK A", "BLK B", "BLK C", "BLK D"];

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("stepContainer")) {
        showYearLevelStep();
    }
});

/* STEP 1 → YEAR LEVEL */
function showYearLevelStep() {
    selectedYearLevel = "";
    selectedCourse = "";
    selectedBlock = "";

    document.getElementById("stepTitle").textContent = "Select Year Level";
    renderButtons(yearLevels, selectYearLevel);
}

/* STEP 2 → COURSE */
function selectYearLevel(year) {
    selectedYearLevel = year;
    document.getElementById("stepTitle").textContent = "Select Course";
    renderButtons(courses, selectCourse);
}

/* STEP 3 → BLOCK */
function selectCourse(course) {
    selectedCourse = course;
    document.getElementById("stepTitle").textContent = "Select Block";
    renderButtons(blocks, selectBlock);
}

/* STEP 4 → LOAD SCHEDULE */
function selectBlock(block) {
    selectedBlock = block;
    loadClassSchedule();
}

/* RENDER DYNAMIC BUTTONS */
function renderButtons(list, handler) {
    const container = document.getElementById("stepContainer");
    container.innerHTML = "";

    list.forEach(item => {
        const btn = document.createElement("button");
        btn.textContent = item;
        btn.onclick = () => handler(item);
        container.appendChild(btn);
    });
}

/* LOAD SCHEDULE (WIZARD VERSION) */
function loadClassSchedule() {
    fetch("http://127.0.0.1:5000/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            year_level: selectedYearLevel,
            program: selectedCourse
        })
    })
    .then(res => res.json())
    .then(data => renderSchedule(data));
}

function showWelcomeMessage() {
    addMessage(
        "admin",
        "Hello! 👋 I'm ESCR Academic Chatbot. How can I help you today with your academic inquiries?"
    );
}
