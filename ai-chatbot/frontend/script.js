/* =====================================================
   REGISTRATION FLOW
   register.html
   register-step2.html
   register-step3.html
===================================================== */

let lastChatId = null;        // ⭐ REQUIRED
let isInCategoryFlow = false;
let cachedWelcomeMessage = null;
let notifPanelOpen = false;
let stepHistory = [];

/* STEP 1 → SAVE PERSONAL INFO */
function saveStep1() {

    const first = document.getElementById("first_name").value.trim();
    const middle = document.getElementById("middle_name").value.trim();
    const last = document.getElementById("last_name").value.trim();
    const birth = document.getElementById("birth_date").value;
    const gender = document.getElementById("gender").value;

    if(!first){
        showToast("First name is required","error");
        return;
    }

    if(!last){
        showToast("Last name is required","error");
        return;
    }

    if(!birth){
        showToast("Birth date is required","error");
        return;
    }

    if(!gender){
        showToast("Please select gender","error");
        return;
    }

    localStorage.setItem("first_name", first);
    localStorage.setItem("middle_name", middle);
    localStorage.setItem("last_name", last);
    localStorage.setItem("birth_date", birth);
    localStorage.setItem("gender", gender);

    window.location.href = "register-step2.html";
}

/* STEP 2 → SAVE CONTACT INFO */
function saveStep2(){

    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const address = document.getElementById("address").value.trim();
    const program = document.getElementById("program").value;
    const year = document.getElementById("year_level").value;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[0-9]{11}$/;

    if(!email){
        showToast("Email is required","error");
        return;
    }

    if(!emailRegex.test(email)){
        showToast("Invalid email format","error");
        return;
    }

    if(!phone){
        showToast("Phone number is required","error");
        return;
    }

    if(!phoneRegex.test(phone)){
        showToast("Phone must be 11 digits","error");
        return;
    }

    if(!address){
        showToast("Address is required","error");
        return;
    }

    if(!program){
        showToast("Select your program","error");
        return;
    }

    if(!year){
        showToast("Select year level","error");
        return;
    }

    localStorage.setItem("email", email);
    localStorage.setItem("phone", phone);
    localStorage.setItem("address", address);
    localStorage.setItem("program", program);
    localStorage.setItem("year_level", year);

    window.location.href = "register-step3.html";
}

/* STEP 3 → SEND EVERYTHING TO BACKEND */
function registerUser(){

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const confirm = document.getElementById("confirm_password").value;

    if(!username){
        showToast("Username is required","error");
        return;
    }

    if(password.length < 6){
        showToast("Password must be at least 6 characters","error");
        return;
    }

    if(password !== confirm){
        showToast("Passwords do not match","error");
        return;
    }

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
        username: username,
        password: password
    };

    fetch("http://127.0.0.1:5000/register",{
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify(data)
    })
    .then(res=>res.json())
    .then(res=>{
        if(!res.success){
            showToast(res.message || "Registration failed","error");
            return;
        }

        localStorage.clear();
        showToast("Account created successfully","success");
        setTimeout(()=>location.href="login.html",900);
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
            showToast(response.message || "Invalid email or password", "error");
        }
    });
}

/* CHECK IF USER IS LOGGED IN */
function requireLogin() {
    const user = sessionStorage.getItem("user");
    if (!user) {
        showToast("Login successful", "success");
        setTimeout(() => window.location.href = "dashboard.html", 900);
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
            if (data.birth_date) {
                const date = new Date(data.birth_date);
                const formatted = date.toISOString().split("T")[0];
                document.getElementById("set_birthdate").value = formatted;
            }
        });
}

function loadProfilePhoto() {
    const savedPhoto = localStorage.getItem("profile_photo");
    if (!savedPhoto) return;

    const avatar = document.getElementById("profileAvatar");
    avatar.textContent = "";
    avatar.style.backgroundImage = `url(${savedPhoto})`;
    avatar.style.backgroundSize = "cover";
    avatar.style.backgroundPosition = "center";
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
    .then(res => {
        if (!res.success) {
            showToast(res.message, "error");
            return;
        }

        // 🔥 Update session user
        sessionStorage.setItem("user", JSON.stringify(res.user));

        // 🔄 Refresh topbar name
        loadUserInfo();
        loadAvatarEverywhere();

        showToast("Profile updated successfully", "success");
    })
    .catch(() => showToast("Network error. Please try again.", "error"));
}


/* CHANGE ACCOUNT PASSWORD */
function changePassword() {
    const user = JSON.parse(sessionStorage.getItem("user"));

    if (new_password.value !== confirm_password.value) {
        showToast("Passwords do not match", "warn");
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
        if (res.success) showToast("Password changed successfully", "success");
        else showToast(res.message || "Password change failed", "error");
    });
}

/* TAB SWITCHING (PROFILE / ACCOUNT) */
function showTab(tabId, btn) {
    // hide all tab contents
    document.querySelectorAll(".tab-content").forEach(tab => {
        tab.classList.remove("active");
    });

    // remove active state from buttons
    document.querySelectorAll(".tabs button").forEach(button => {
        button.classList.remove("active");
    });

    // show selected tab
    document.getElementById(tabId).classList.add("active");
    btn.classList.add("active");
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

    const nowUTC = new Date().toISOString();
    addMessage("user", msg, nowUTC);

    fetch("http://localhost:5000/chat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            user_id: user.id,
            message: msg
        })
    })
    .then(res => res.json())
    .then(data => {

        // ⭐ STORE CHAT ID FOR FEEDBACK
        lastChatId = data.chat_id;

        addMessage("admin", data.reply, data.created_at);
    });

    input.value = "";
}

/* QUICK REPLY BUTTONS */
function sendQuick(text) {
    document.getElementById("userMessage").value = text;
    sendMessage();
}

/* ADD MESSAGE TO CHAT BOX */
function addMessage(sender, text, time = null, chatId = null, withFeedback = false) {
    const box = document.getElementById("chatBox");
    if (!box) return;

    let html = "";

    if (sender === "user") {

        const user = JSON.parse(sessionStorage.getItem("user"));
        if (!user) return;

        const savedPhoto = localStorage.getItem(`profile_photo_${user.id}`);
        const initials = getInitials(user.first_name, user.last_name);

        const avatarStyle = savedPhoto
            ? `background-image:url('${savedPhoto}');
               background-size:cover;
               background-position:center;
               background-repeat:no-repeat;`
            : `background-color:#d32f2f;`;

        const avatarContent = savedPhoto ? "" : initials;

        html = `
            <div class="chat-message user">
                <div class="bubble user-bubble">
                    ${text}
                    <div class="msg-time">${formatTime(time)}</div>
                </div>
                <div class="avatar user-avatar"
                    style="${avatarStyle}">
                    ${avatarContent}
                </div>
            </div>
        `;

    } else {

        const adminPhoto = chatbotAdmin?.photo
            ? `http://127.0.0.1:5000/uploads/${chatbotAdmin.photo}`
            : "images/ai-profile.jpg";

        const adminName = chatbotAdmin?.name || "Administrator";

        html = `
            <div class="chat-message admin">
                <div class="avatar admin-avatar"
                    style="background-image:url('${adminPhoto}');
                           background-size:cover;
                           background-position:center;">
                </div>
                <div class="bubble admin-bubble">
                    <strong>${adminName}</strong><br>
                    ${text}
                    <div class="msg-time">${formatTime(time)}</div>
                </div>
            </div>
        `;
    }

    box.insertAdjacentHTML("beforeend", html);
    box.scrollTop = box.scrollHeight;
}

function openFeedbackModal() {
    document.getElementById("feedbackModal").style.display = "flex";
}

function closeFeedbackModal() {
    document.getElementById("feedbackModal").style.display = "none";
}

function formatTime(datetime) {
    if (!datetime) return "";

    // force ISO UTC if backend forgot the Z
    if (typeof datetime === "string" && !datetime.endsWith("Z")) {
        datetime = datetime.replace(" ", "T") + "Z";
    }

    const date = new Date(datetime);

    return date.toLocaleTimeString("en-PH", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });
}

function submitFeedback(type) {

    if (!lastChatId) {
        showToast("No message to rate yet", "warn");
        return;
    }

    fetch("http://localhost:5000/chat/feedback", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            feedback: type,
            chat_id: lastChatId
        })
    })
    .then(res => {
        if (!res.ok) throw new Error("Server error");
        return res.json();
    })
    .then(data => {
        closeFeedbackModal();
        showToast("Thank you for your feedback!", "success");
    })
    .catch(err => {
        console.error("Feedback error:", err);
        showToast("Something went wrong", "error");
    });
}

function sendFeedback(chatId, feedback) {
    selectedChatId = chatId;
    selectedFeedbackType = feedback;

    const modal = document.getElementById("feedbackModal");
    const text = document.getElementById("feedbackTypeText");

    text.textContent =
        feedback === "yes"
            ? "You selected 👍 Helpful"
            : "You selected 👎 Not Helpful";

    modal.style.display = "flex";
}

function closeFeedbackModal() {
    const modal = document.getElementById("feedbackModal");
    if (modal) modal.style.display = "none";
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

document.addEventListener("DOMContentLoaded", () => {
    const feedbackBtn = document.getElementById("giveFeedbackBtn");

    if (feedbackBtn) {
        feedbackBtn.addEventListener("click", openFeedbackModal);
    }
});

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

    addMessage("user", category, new Date().toISOString());

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
        lastChatId = data.chat_id;
        addMessage("admin", data.reply, new Date().toISOString(), data.chat_id, true);
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
    addMessage("user", question, new Date().toISOString());

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
        lastChatId = data.chat_id;
        addMessage("admin", data.reply, new Date().toISOString(), data.chat_id, true);
    });

}

/* LOAD CHAT HISTORY */
function loadChatHistory() {
    if (isInCategoryFlow) return;

    const box = document.getElementById("chatBox");
    if (!box) return;

    const user = JSON.parse(sessionStorage.getItem("user"));
    if (!user) return;

    fetch(`http://127.0.0.1:5000/chat/history/${user.id}`)
        .then(res => res.json())
        .then(data => {
            box.innerHTML = "";

            if (!data || data.length === 0) {
                showWelcomeMessage();
                return;
            }

            data.forEach(row => {
                if (row.user_message) {
                    addMessage("user", row.user_message, row.created_at);
                }
                if (row.bot_reply) {
                    addMessage("admin", row.bot_reply, row.created_at, row.id, row.feedback === null);
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

/* =====================================================
   CLASS SCHEDULE FLOW (KEEP CURRENT UI DESIGN)
===================================================== */

/* =====================================================
   CLASS SCHEDULE FLOW (KEEP CURRENT UI DESIGN)
===================================================== */

const collegeCourses = ["BSBA", "BSIT", "BSOA", "BSAIS", "BT-FSM", "BT-ET"];
const scheduleBlocks = ["BLK A", "BLK B", "BLK C","BLK D", "BLK E", "BLK F", "BLK G", "BLK H"];
const shsStrands = ["GAS", "ABM", "TVL HE TOURISM HRM", "HUMSS", "ICT"];

let selectedYearLevel = "";
let selectedCourse = "";
let selectedBlock = "";

/* INITIALIZE BUTTONS */
document.addEventListener("DOMContentLoaded", () => {

    const buttons = document.querySelectorAll(".year-btn");

    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            const text = btn.textContent.trim();
            handleYearClick(text);
        });
    });

});

function formatCollegeYear(year) {
    if (year === "1st Year") return "1-2";
    if (year === "2nd Year") return "2-2";
    if (year === "3rd Year") return "3-2";
    if (year === "4th Year") return "4-2";
}


/* FIRST CLICK */
function handleYearClick(year) {

    selectedYearLevel = year;

    // SHS FLOW
    if (year === "SHS") {
        renderNextButtons(["Grade 11", "Grade 12"], handleSHSClick);
    }

    // COLLEGE FLOW
    else {
        renderNextButtons(collegeCourses, handleCourseClick);
    }
}

function handleSHSClick(grade) {

    selectedCourse = grade;

    // Show strand buttons instead of image
    renderNextButtons(shsStrands, handleStrandClick);
}

function formatSHS(text) {
    return text
        .replace("Grade 11", "GRADE11")
        .replace("Grade 12", "GRADE12")
        .replace(/\s+/g, ""); // remove spaces
}


function handleStrandClick(strand) {

    selectedBlock = strand;

    const gradeFormatted = formatSHS(selectedCourse);
    const strandFormatted = strand.replace(/\s+/g, "");

    showScheduleImage(
        `images/schedules/SHS_${gradeFormatted}_${strandFormatted}.jpg`
    );
}

/* COLLEGE → COURSE */
function handleCourseClick(course) {

    selectedCourse = course;

    renderNextButtons(scheduleBlocks, handleBlockClick);
}

/* COLLEGE → BLOCK */
function handleBlockClick(block) {

    selectedBlock = block;

    const yearFormatted = formatCollegeYear(selectedYearLevel);
    const blockFormatted = block.replace(" ", "-"); // BLK A → BLK-A

    showScheduleImage(
        `images/schedules/${selectedCourse}_${yearFormatted}_${blockFormatted}.jpg`
    );
}


/* RENDER BUTTONS (SAME UI STYLE) */
function renderNextButtons(list, clickHandler) {

    const wrapper = document.querySelector(".year-wrapper");

    stepHistory.push(wrapper.innerHTML);

    wrapper.innerHTML = "";

    list.forEach(item => {
        const btn = document.createElement("button");
        btn.className = "year-btn";
        btn.textContent = item;

        btn.addEventListener("click", () => clickHandler(item));

        wrapper.appendChild(btn);
    });

    updateBackButton();
}

/* SHOW IMAGE */
function showScheduleImage(imagePath) {

    const wrapper = document.querySelector(".year-wrapper");

    // save current state
    stepHistory.push(wrapper.innerHTML);

    wrapper.innerHTML = "";

    const img = new Image();
    img.src = imagePath;

    img.onload = function () {
        wrapper.innerHTML = `
            <div class="schedule-image-box">
                <img src="${imagePath}" class="schedule-image">
            </div>
        `;
        updateBackButton();
    };

    img.onerror = function () {
        wrapper.innerHTML = `
            <div style="
                background:white;
                padding:40px;
                border-radius:12px;
                font-weight:bold;
                text-align:center;">
                No schedule available for this selection.
            </div>
        `;
        updateBackButton();
    };
}

function restoreStepLogic(){
    const buttons = document.querySelectorAll(".year-btn");

    buttons.forEach(btn => {

        const text = btn.textContent.trim();

        if(text === "SHS" || text.includes("Year")){
            btn.onclick = () => handleYearClick(text);
        }
        else if(text.startsWith("Grade")){
            btn.onclick = () => handleSHSClick(text);
        }
        else if(collegeCourses.includes(text)){
            btn.onclick = () => handleCourseClick(text);
        }
        else if(scheduleBlocks.includes(text)){
            btn.onclick = () => handleBlockClick(text);
        }
        else if(shsStrands.includes(text)){
            btn.onclick = () => handleStrandClick(text);
        }

    });
}

function goBackStep(){

    if(stepHistory.length === 0) return;

    const wrapper = document.querySelector(".year-wrapper");

    const lastHTML = stepHistory.pop();

    wrapper.innerHTML = lastHTML;

    restoreStepLogic();
    updateBackButton();
}

function rebindYearButtons(){

    const buttons = document.querySelectorAll(".year-btn");

    buttons.forEach(btn=>{
        const text = btn.textContent.trim();

        btn.addEventListener("click", ()=>{
            handleYearClick(text);
        });
    });
}

function updateBackButton(){
    const btn = document.getElementById("backBtn");
    if(!btn) return;

    btn.style.display = stepHistory.length ? "inline-block" : "none";
}

document.addEventListener("DOMContentLoaded", () => {
    updateBackButton();
});

function showWelcomeMessage() {
    if (cachedWelcomeMessage) {
        addMessage("admin", cachedWelcomeMessage);
        return;
    }

    fetch("http://127.0.0.1:5000/api/admin/settings/chatbot")
        .then(res => res.json())
        .then(data => {
            cachedWelcomeMessage =
                data.welcome_message ||
                "Hello! 👋 How can I help you today?";

            addMessage("admin", cachedWelcomeMessage);
        })
        .catch(() => {
            addMessage(
                "admin",
                "Hello! 👋 How can I help you today?"
            );
        });
}

function triggerPhotoUpload() {
    document.getElementById("profilePhotoInput").click();
}

document.getElementById("profilePhotoInput")?.addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        const imageData = reader.result;

        const user = JSON.parse(sessionStorage.getItem("user"));
        if (!user) return;

        const avatar = document.getElementById("profileAvatar");
        avatar.textContent = "";
        avatar.style.backgroundImage = `url(${imageData})`;
        avatar.style.backgroundSize = "cover";
        avatar.style.backgroundPosition = "center";

        // ✅ SAVE PER USER
        localStorage.setItem(`profile_photo_${user.id}`, imageData);
    };

    reader.readAsDataURL(file);
});

function loadProfilePhotoEverywhere() {
    const photo = localStorage.getItem("profile_photo");
    if (!photo) return;

    document.querySelectorAll(".avatar").forEach(avatar => {
        avatar.textContent = "";
        avatar.style.backgroundImage = `url(${photo})`;
        avatar.style.backgroundSize = "cover";
        avatar.style.backgroundPosition = "center";
    });
}

function getInitials(firstName, lastName) {
    const first = firstName?.charAt(0).toUpperCase() || "";
    const last = lastName?.charAt(0).toUpperCase() || "";
    return first + last;
}

function loadAvatarEverywhere() {
    const user = JSON.parse(sessionStorage.getItem("user"));
    if (!user) return;

    const savedPhoto = localStorage.getItem(`profile_photo_${user.id}`);
    const initials = getInitials(user.first_name, user.last_name);

    document.querySelectorAll(".avatar").forEach(avatar => {
        if (savedPhoto) {
            avatar.textContent = "";
            avatar.style.backgroundImage = `url(${savedPhoto})`;
            avatar.style.backgroundSize = "cover";
            avatar.style.backgroundPosition = "center";
            avatar.style.backgroundRepeat = "no-repeat";
            avatar.style.backgroundColor = "transparent";
        } else {
            avatar.style.backgroundImage = "none";
            avatar.style.backgroundColor = "#d32f2f";
            avatar.textContent = initials;
        }
    });
}

let chatbotAdmin = null;

function loadChatbotAdminProfile() {
    fetch("http://127.0.0.1:5000/api/admin/profile")
        .then(res => res.json())
        .then(data => {
            chatbotAdmin = data;
        })
        .catch(err => {
            console.error("Failed to load admin profile:", err);
        });
}

async function checkNotifications() {

    const badge = document.getElementById("notifCount");
    if (!badge) return;

    // ⭐ DO NOT POLL WHILE PANEL OPEN
    if (notifPanelOpen) return;

    const user = JSON.parse(sessionStorage.getItem("user"));
    if (!user) return;

    try {
        const res = await fetch(`http://localhost:5000/api/student/notifications/${user.id}`);
        const data = await res.json();

        badge.textContent = data.length;
        badge.style.display = data.length ? "inline-block" : "none";

    } catch (err) {
        console.error("Notification error:", err);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("notifCount")) {
        checkNotifications();
        setInterval(checkNotifications, 5000);
    }
});

async function openNotifications() {

    const panel = document.getElementById("notifPanel");
    const list = document.getElementById("notifList");
    const badge = document.getElementById("notifCount");

    if (!panel || !list) return;

    const user = JSON.parse(sessionStorage.getItem("user"));
    if (!user) return;

    // TOGGLE
    notifPanelOpen = !notifPanelOpen;
    panel.style.display = notifPanelOpen ? "block" : "none";

    // If closing → stop here
    if (!notifPanelOpen) return;

    // LOAD notifications
    const res = await fetch(`http://localhost:5000/api/student/notifications/${user.id}`);
    const data = await res.json();

    list.innerHTML = "";

    data.forEach(n => {
        list.innerHTML += `
            <div class="notif-item">
                ${n.message}<br>
                <small>${formatTime(n.created_at)}</small>
            </div>`;
    });

    // MARK ALL AS READ
    await fetch(`http://localhost:5000/api/student/notifications/read-all/${user.id}`, {
        method: "PUT"
    });

    // FORCE UI ZERO
    badge.textContent = "0";
    badge.style.display = "none";
}

function requestReset(){
 fetch("http://127.0.0.1:5000/forgot-password",{
   method:"POST",
   headers:{ "Content-Type":"application/json" },
   body:JSON.stringify({
     email: document.getElementById("email").value
   })
 })
 .then(r=>r.json())
 .then(()=> showToast("If email exists, reset link sent","success"));
}

const params = new URLSearchParams(window.location.search);
const token = params.get("token");

function resetPassword(){

    const pass = document.getElementById("new_password").value;
    const confirm = document.getElementById("confirm_password").value;

    if(pass !== confirm){
        showToast("Passwords do not match","error");
        return;
    }

    fetch("http://127.0.0.1:5000/reset-password",{
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({
            token:token,
            password:pass
        })
    })
    .then(r=>r.json())
    .then(res=>{
        if(res.success){
            showToast("Password updated","success");
            setTimeout(()=>location.href="login.html",900);
        }else{
            showToast(res.message,"error");
        }
    });
}