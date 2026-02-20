from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from db import get_db_connection
import hashlib
import mysql.connector
import time
import re
import os
from werkzeug.utils import secure_filename
import pytz
from datetime import datetime
import secrets
from datetime import timedelta
from flask_mail import Mail, Message

app = Flask(__name__)
CORS(app,
     resources={r"/*": {"origins": ["http://localhost:5500", "http://127.0.0.1:5500"]}},
     supports_credentials=True)

app.config["MAIL_SERVER"] = "smtp.gmail.com"
app.config["MAIL_PORT"] = 587
app.config["MAIL_USE_TLS"] = True
app.config["MAIL_USERNAME"] = "bernabeelvin@gmail.com"
app.config["MAIL_PASSWORD"] = "odgp nfua mivk bwqv"

mail = Mail(app)

UPLOAD_FOLDER = "uploads"
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

UTC = pytz.utc
PH = pytz.timezone("Asia/Manila")

def iso_time(dt):
    if not dt:
        return None

    # force UTC and remove local conversions
    if dt.tzinfo is None:
        dt = UTC.localize(dt)

    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.000Z")

@app.route("/forgot-password", methods=["POST", "OPTIONS"])
def forgot_password():

    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200

    data = request.json
    email = data.get("email")

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    cursor.execute("SELECT id FROM users WHERE email=%s", (email,))
    user = cursor.fetchone()

    if not user:
        return jsonify({"success": True})

    token = secrets.token_urlsafe(32)
    expiry = datetime.utcnow() + timedelta(minutes=15)

    cursor.execute("""
        INSERT INTO password_resets (user_id, token, expires_at)
        VALUES (%s,%s,%s)
    """, (user["id"], token, expiry))
    db.commit()

    reset_link = f"http://127.0.0.1:5500/reset-password.html?token={token}"

    print("RESET LINK:", reset_link)

    msg = Message(
        "Password Reset",
        sender=app.config["MAIL_USERNAME"],
        recipients=[email]
    )

    msg.body = f"Click this link to reset your password:\n{reset_link}"
    mail.send(msg)

    return jsonify({"success": True})

@app.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.json
    token = data.get("token")
    new_password = data.get("password")

    hashed = hashlib.sha256(new_password.encode()).hexdigest()

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    cursor.execute("""
        SELECT * FROM password_resets
        WHERE token=%s AND used=0 AND expires_at > UTC_TIMESTAMP()
    """, (token,))
    record = cursor.fetchone()

    if not record:
        return jsonify({"success": False, "message": "Invalid or expired token"})

    cursor.execute("""
        UPDATE users SET password=%s WHERE id=%s
    """, (hashed, record["user_id"]))

    cursor.execute("""
        UPDATE password_resets SET used=1 WHERE id=%s
    """, (record["id"],))

    db.commit()

    return jsonify({"success": True})

@app.route("/api/admin/profile", methods=["GET"])
def get_admin_profile():
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    cursor.execute("""
        SELECT id, name, email, photo
        FROM admins
        LIMIT 1
    """)

    admin = cursor.fetchone()

    cursor.close()
    db.close()

    if not admin:
        return jsonify({})

    return jsonify(admin)

@app.route("/api/admin/profile", methods=["PUT"])
def update_admin_profile():
    name = request.form.get("name")
    email = request.form.get("email")
    photo_file = request.files.get("photo")

    db = get_db_connection()
    cursor = db.cursor()

    photo_filename = None

    # 🔹 If new photo uploaded
    if photo_file:
        filename = secure_filename(photo_file.filename)
        photo_filename = f"admin_{int(time.time())}_{filename}"
        photo_path = os.path.join(app.config["UPLOAD_FOLDER"], photo_filename)
        photo_file.save(photo_path)

        cursor.execute("""
            UPDATE admins
            SET name=%s, email=%s, photo=%s
            LIMIT 1
        """, (name, email, photo_filename))
    else:
        cursor.execute("""
            UPDATE admins
            SET name=%s, email=%s
            LIMIT 1
        """, (name, email))

    db.commit()
    cursor.close()
    db.close()

    return jsonify({"success": True})

@app.route("/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

@app.after_request
def after_request(response):
    origin = request.headers.get("Origin")
    if origin in ("http://localhost:5500", "http://127.0.0.1:5500"):
        response.headers["Access-Control-Allow-Origin"] = origin

    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS"
    return response

# ---------------- REGISTER ----------------
@app.route("/register", methods=["POST"])
def register():
    data = request.json
    hashed_password = hashlib.sha256(data["password"].encode()).hexdigest()

    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
    INSERT INTO users
    (first_name, middle_name, last_name, birth_date, gender,
     email, phone, address, program, year_level,
     username, password)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """

    values = (
        data["first_name"],
        data["middle_name"],
        data["last_name"],
        data["birth_date"],
        data["gender"],
        data["email"],
        data["phone"],
        data["address"],
        data["program"],
        data["year_level"],
        data["username"],
        hashed_password
    )

    cursor.execute(query, values)
    conn.commit()

    return jsonify({"success": True, "message": "Registration successful!"})


# ---------------- LOGIN (CORS SAFE) ----------------
@app.route("/login", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200

    data = request.json
    email = data["email"]
    password = data["password"]

    hashed_password = hashlib.sha256(password.encode()).hexdigest()

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    query = """
        SELECT id, first_name, last_name, role, program, year_level, status
        FROM users
        WHERE email=%s AND password=%s
        """
    cursor.execute(query, (email, hashed_password))
    user = cursor.fetchone()

    if user:
        return jsonify({
            "success": True,
            "user": user
        })
    else:
        return jsonify({
            "success": False,
            "message": "Invalid email or password"
        })

@app.route("/user/<int:user_id>")
def get_user(user_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM users WHERE id=%s", (user_id,))
    user = cursor.fetchone()

    return jsonify(user)

@app.route("/update-profile", methods=["POST"])
def update_profile():
    data = request.json

    required_fields = [
        "id", "first_name", "last_name",
        "email", "phone", "address", "birth_date"
    ]

    # 1️⃣ Required field validation
    for field in required_fields:
        if field not in data or not str(data[field]).strip():
            return jsonify({
                "success": False,
                "message": f"{field.replace('_', ' ').title()} is required"
            }), 400

    # 2️⃣ Email format validation  ✅ HERE
    email_regex = r"^[\w\.-]+@[\w\.-]+\.\w+$"
    if not re.match(email_regex, data["email"]):
        return jsonify({
            "success": False,
            "message": "Invalid email format"
        }), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # 3️⃣ Check duplicate email (exclude self)
    cursor.execute("""
        SELECT id FROM users
        WHERE email = %s AND id != %s
    """, (data["email"], data["id"]))

    if cursor.fetchone():
        cursor.close()
        conn.close()
        return jsonify({
            "success": False,
            "message": "Email is already in use"
        }), 409

    # 4️⃣ Update profile
    cursor.execute("""
        UPDATE users
        SET
            first_name = %s,
            last_name = %s,
            email = %s,
            phone = %s,
            address = %s,
            birth_date = %s
        WHERE id = %s
    """, (
        data["first_name"].strip(),
        data["last_name"].strip(),
        data["email"].strip(),
        data["phone"].strip(),
        data["address"].strip(),
        data["birth_date"],
        data["id"]
    ))

    conn.commit()

    # 5️⃣ Return updated user
    cursor.execute("""
        SELECT id, first_name, last_name, email, role
        FROM users WHERE id = %s
    """, (data["id"],))

    updated_user = cursor.fetchone()

    cursor.close()
    conn.close()

    return jsonify({
        "success": True,
        "message": "Profile updated successfully",
        "user": updated_user
    })

@app.route("/change-password", methods=["POST"])
def change_password():
    data = request.json

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    hashed_current = hashlib.sha256(data["current"].encode()).hexdigest()
    cursor.execute(
        "SELECT * FROM users WHERE id=%s AND password=%s",
        (data["id"], hashed_current)
    )

    if not cursor.fetchone():
        return jsonify({"success": False, "message": "Wrong current password"})

    new_hashed = hashlib.sha256(data["new"].encode()).hexdigest()
    cursor.execute(
        "UPDATE users SET password=%s WHERE id=%s",
        (new_hashed, data["id"])
    )
    conn.commit()

    return jsonify({"success": True})

@app.route("/schedule", methods=["POST"])
def get_schedule():
    data = request.json

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    query = """
    SELECT day, time, subject, room
    FROM schedules
    WHERE program=%s AND year_level=%s
    """
    cursor.execute(query, (data["program"], data["year"]))
    results = cursor.fetchall()

    return jsonify(results)

@app.route("/calendar")
def get_calendar():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM school_calendar ORDER BY start_date")
    rows = cursor.fetchall()

    events = []
    for e in rows:

        # combine date + time
        if e["start_time"]:
            start_dt = datetime.strptime(
                f"{e['start_date']} {e['start_time']}",
                "%Y-%m-%d %H:%M:%S"
            )
        else:
            start_dt = datetime.strptime(
                f"{e['start_date']} 00:00:00",
                "%Y-%m-%d %H:%M:%S"
            )

        if e["end_date"]:
            end_dt = datetime.strptime(
                f"{e['end_date']} {e['end_time'] or '23:59:59'}",
                "%Y-%m-%d %H:%M:%S"
            )
        else:
            end_dt = None

        # convert to UTC ISO (CRITICAL)
        start_iso = iso_time(start_dt)
        end_iso = iso_time(end_dt) if end_dt else None

        events.append({
            "id": e["id"],
            "title": e["title"],
            "start": start_iso,
            "end": end_iso,
            "color": e["color"],
            "description": e["description"]
        })

    cursor.close()
    conn.close()

    return jsonify(events)

@app.route("/api/admin/calendar", methods=["POST"])
def add_calendar_event():
    data = request.json
    db = get_db_connection()
    cursor = db.cursor()

    cursor.execute("""
        INSERT INTO school_calendar 
        (title, description, start_date, end_date, start_time, end_time, color)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
    """, (
        data["title"],
        data.get("description"),
        data["start_date"],
        data.get("end_date"),
        data.get("start_time"),
        data.get("end_time"),
        data.get("color", "#3788d8")
    ))

    db.commit()
    cursor.close()
    db.close()

    return jsonify({"success": True})

@app.route("/api/admin/calendar", methods=["GET"])
def get_admin_calendar():
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    cursor.execute("SELECT * FROM school_calendar ORDER BY start_date DESC")
    events = cursor.fetchall()

    cursor.close()
    db.close()

    return jsonify(events)

@app.route("/api/admin/calendar/<int:event_id>", methods=["PUT"])
def update_calendar_event(event_id):
    data = request.json
    db = get_db_connection()
    cursor = db.cursor()

    cursor.execute("""
        UPDATE school_calendar
        SET title=%s, description=%s, start_date=%s, end_date=%s,
            start_time=%s, end_time=%s, color=%s
        WHERE id=%s
    """, (
        data["title"],
        data.get("description"),
        data["start_date"],
        data.get("end_date"),
        data.get("start_time"),
        data.get("end_time"),
        data.get("color", "#3788d8"),
        event_id
    ))

    db.commit()
    cursor.close()
    db.close()

    return jsonify({"success": True})

@app.route("/api/admin/calendar/<int:event_id>", methods=["DELETE"])
def delete_calendar_event(event_id):
    db = get_db_connection()
    cursor = db.cursor()

    cursor.execute("DELETE FROM school_calendar WHERE id=%s", (event_id,))

    db.commit()
    cursor.close()
    db.close()

    return jsonify({"success": True})

@app.route("/chat", methods=["POST"])
def chat():
    start_time = time.time()  # ⏱ start timing

    data = request.json
    user_id = data.get("user_id")
    message = (data.get("message") or "").strip()

    settings = get_system_settings()

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    cursor.execute(
        "SELECT COUNT(*) AS total FROM chats WHERE user_id = %s",
        (user_id,)
    )
    is_first_chat = cursor.fetchone()["total"] == 0

    cursor.execute("""
        SELECT answer
        FROM knowledge_base
        WHERE status = 'active'
        AND question LIKE %s
        LIMIT 1
    """, (f"%{message}%",))
    result = cursor.fetchone()

    if result:
        reply = result["answer"]
        status = "resolved"
    else:
        reply = settings["fallback_message"]
        status = "escalated" if settings["auto_escalation"] else "resolved"

    end_time = time.time()
    response_time = round((end_time - start_time) * 1000, 2)

    cursor.execute("""
        INSERT INTO chats (user_id, user_message, bot_reply, status, response_time)
        VALUES (%s, %s, %s, %s, %s)
    """, (user_id, message, reply, status, response_time))
    db.commit()

    chat_id = cursor.lastrowid

    if status == "escalated":
        reply = (
            f"{reply}\n\n"
            f"Ticket No: #{chat_id}"
        )

        cursor.execute("""
            UPDATE chats
            SET bot_reply = %s
            WHERE id = %s
        """, (reply, chat_id))
        db.commit()

    cursor.close()
    db.close()

    return jsonify({
        "reply": reply,
        "status": status,
        "chat_id": chat_id,
        "created_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    })

@app.route("/chat/history/<int:user_id>")
def chat_history(user_id):
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    cursor.execute("""
        SELECT
            id,
            user_message,
            bot_reply,
            feedback,
            created_at
        FROM chats
        WHERE user_id = %s
        ORDER BY created_at ASC
    """, (user_id,))

    history = cursor.fetchall()
    for h in history:
        h["created_at"] = iso_time(h["created_at"])

    cursor.close()
    db.close()

    return jsonify(history)


@app.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    hashed_password = hashlib.sha256(password.encode()).hexdigest()

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    query = """
        SELECT id, name, email
        FROM admins
        WHERE email = %s AND password = %s
    """

    cursor.execute(query, (email, hashed_password))
    admin = cursor.fetchone()

    cursor.close()
    db.close()

    if admin:
        return jsonify({"success": True, "admin": admin})
    else:
        return jsonify({"success": False, "message": "Invalid admin credentials"}), 401
    
@app.route("/api/admin/register", methods=["POST"])
def admin_register():
    data = request.json

    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({
            "success": False,
            "message": "All fields are required"
        }), 400

    hashed_password = hashlib.sha256(password.encode()).hexdigest()

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    # 🔹 Check duplicate username/email
    cursor.execute("SELECT id FROM admins WHERE email=%s", (username,))
    if cursor.fetchone():
        return jsonify({
            "success": False,
            "message": "Admin already exists"
        }), 409

    cursor.execute("""
        INSERT INTO admins (name, email, password)
        VALUES (%s, %s, %s)
    """, (username, username, hashed_password))

    db.commit()
    cursor.close()
    db.close()

    return jsonify({
        "success": True,
        "message": "Admin account created successfully"
    })
    
@app.route("/api/admin/conversations", methods=["GET"])
def get_conversations():
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    query = """
        SELECT 
        c.user_id,
        u.first_name,
        u.last_name,
        c.user_message,
        c.status,
        c.created_at
        FROM chats c
        JOIN users u ON c.user_id = u.id
        WHERE c.user_message IS NOT NULL
        AND c.user_message != ''
        AND c.created_at = (
        SELECT MAX(created_at)
        FROM chats
        WHERE user_id = c.user_id
        AND user_message IS NOT NULL
        )
        ORDER BY c.created_at DESC
    """

    cursor.execute(query)
    conversations = cursor.fetchall()

    cursor.close()
    db.close()

    for c in conversations:
        c["created_at"] = iso_time(c["created_at"])

    return jsonify(conversations)


@app.route("/api/admin/conversations/<int:user_id>", methods=["GET"])
def get_conversation_thread(user_id):
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    query = """
        SELECT 
            chats.id,                -- ✅ REQUIRED
            chats.user_message,
            chats.bot_reply,
            chats.status,
            chats.created_at,
            users.first_name,
            users.last_name,
            users.program,
            users.year_level
        FROM chats
        JOIN users ON chats.user_id = users.id
        WHERE chats.user_id = %s
        ORDER BY chats.created_at ASC
    """

    cursor.execute(query, (user_id,))
    data = cursor.fetchall()

    for d in data:
        d["created_at"] = iso_time(d["created_at"])

    cursor.close()
    db.close()

    return jsonify(data)

@app.route("/api/admin/conversations/<int:user_id>/status", methods=["PUT"])
def update_conversation_status(user_id):
    data = request.json
    status = data.get("status")

    if status not in ["resolved", "escalated", "incorrect"]:
        return jsonify({"success": False, "message": "Invalid status"}), 400

    db = get_db_connection()
    cursor = db.cursor()

    cursor.execute(
        "UPDATE chats SET status=%s WHERE user_id=%s",
        (status, user_id)
    )

    db.commit()
    cursor.close()
    db.close()

    return jsonify({"success": True})

@app.route("/api/admin/knowledge-base", methods=["POST"])
def create_knowledge_base():
    data = request.json

    db = get_db_connection()
    cursor = db.cursor()

    query = """
        INSERT INTO knowledge_base (category, question, answer, status)
        VALUES (%s, %s, %s, %s)
    """

    cursor.execute(query, (
        data["category"],
        data["question"],
        data["answer"],
        data["status"]
    ))

    db.commit()
    cursor.close()
    db.close()

    return jsonify({"success": True})

@app.route("/api/chat/categories", methods=["GET"])
def get_categories():
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    cursor.execute("""
        SELECT DISTINCT category
        FROM knowledge_base
        WHERE status = 'active'
        ORDER BY category ASC
    """)

    categories = cursor.fetchall()

    cursor.close()
    db.close()

    return jsonify(categories)

@app.route("/api/admin/conversations/reply", methods=["POST"])
def admin_reply():
    data = request.json
    user_id = data.get("user_id")
    reply = data.get("reply")

    if not user_id or not reply:
        return jsonify({"success": False, "message": "Missing data"}), 400

    db = get_db_connection()
    cursor = db.cursor()

    # 1️⃣ save admin reply
    cursor.execute("""
        INSERT INTO chats (user_id, bot_reply, status)
        VALUES (%s, %s, 'resolved')
    """, (user_id, "[ADMIN] " + reply))

    chat_id = cursor.lastrowid

    # 2️⃣ create notification for student
    cursor.execute("""
        INSERT INTO notifications (user_id, chat_id, message)
        VALUES (%s, %s, %s)
    """, (user_id, chat_id, "Admin replied to your escalated question"))

    db.commit()
    cursor.close()
    db.close()

    return jsonify({"success": True})

@app.route("/api/student/notifications/<int:user_id>")
def get_notifications(user_id):
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    cursor.execute("""
        SELECT id, message, created_at
        FROM notifications
        WHERE user_id=%s AND is_read=0
        ORDER BY created_at DESC
    """, (user_id,))

    data = cursor.fetchall()

    for n in data:
        n["created_at"] = iso_time(n["created_at"])

    cursor.close()
    db.close()

    return jsonify(data)

@app.route("/api/student/notifications/read/<int:notif_id>", methods=["PUT"])
def mark_notification_read(notif_id):
    db = get_db_connection()
    cursor = db.cursor()

    cursor.execute("""
        UPDATE notifications
        SET is_read=1
        WHERE id=%s
    """, (notif_id,))

    db.commit()
    cursor.close()
    db.close()

    return jsonify({"success": True})

@app.route("/api/student/notifications/read-all/<int:user_id>", methods=["PUT", "OPTIONS"])
def mark_all_notifications_read(user_id):

    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200

    db = get_db_connection()
    cursor = db.cursor()

    cursor.execute("""
        UPDATE notifications
        SET is_read = 1
        WHERE user_id = %s AND is_read = 0
    """, (user_id,))

    db.commit()
    cursor.close()
    db.close()

    return jsonify({"success": True})


@app.route("/api/admin/knowledge-base", methods=["GET"])
def get_knowledge_base():
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    cursor.execute("""
        SELECT id, category, question, answer, status, updated_at
        FROM knowledge_base
        ORDER BY updated_at DESC
    """)
    data = cursor.fetchall()

    cursor.close()
    db.close()

    return jsonify(data)

@app.route("/api/admin/knowledge-base/<int:kb_id>", methods=["PUT"])
def update_knowledge_base(kb_id):
    data = request.json

    db = get_db_connection()
    cursor = db.cursor()

    query = """
        UPDATE knowledge_base
        SET category=%s,
            question=%s,
            answer=%s,
            status=%s,
            updated_at=CURRENT_TIMESTAMP
        WHERE id=%s
    """

    cursor.execute(query, (
        data["category"],
        data["question"],
        data["answer"],
        data["status"],
        kb_id
    ))

    db.commit()
    cursor.close()
    db.close()

    return jsonify({"success": True})

@app.route("/api/admin/knowledge-base/<int:kb_id>", methods=["DELETE"])
def delete_knowledge_base(kb_id):
    db = get_db_connection()
    cursor = db.cursor()

    cursor.execute(
        "DELETE FROM knowledge_base WHERE id=%s",
        (kb_id,)
    )

    db.commit()
    cursor.close()
    db.close()

    return jsonify({"success": True})

@app.route("/api/chat/questions/<category>", methods=["GET"])
def get_questions_by_category(category):
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    # CATEGORY ANSWER
    cursor.execute("""
        SELECT answer
        FROM knowledge_base
        WHERE category = %s
        AND question = '__CATEGORY__'
        AND status = 'active'
        LIMIT 1
    """, (category,))
    category_answer = cursor.fetchone()

    # QUESTIONS
    cursor.execute("""
        SELECT id, question, answer
        FROM knowledge_base
        WHERE category = %s
        AND question != '__CATEGORY__'
        AND status = 'active'
        ORDER BY id ASC
    """, (category,))
    questions = cursor.fetchall()

    cursor.close()
    db.close()

    return jsonify({
        "category_answer": category_answer["answer"] if category_answer else None,
        "questions": questions
    })


@app.route("/chat/feedback", methods=["POST"])
def save_feedback():
    data = request.json

    db = get_db_connection()
    cursor = db.cursor()

    cursor.execute("""
        UPDATE chats
        SET feedback = %s
        WHERE id = %s
    """, (
        data["feedback"],   # 'yes' or 'no'
        data["chat_id"]
    ))

    db.commit()
    cursor.close()
    db.close()

    return jsonify({"success": True})

@app.route("/chat/quick-answer", methods=["POST"])
def quick_answer():
    data = request.json
    user_id = data.get("user_id")
    question = data.get("question")
    answer = data.get("answer")

    db = get_db_connection()
    cursor = db.cursor()

    cursor.execute("""
        INSERT INTO chats (user_id, user_message, bot_reply, status)
        VALUES (%s, %s, %s, 'resolved')
    """, (
        user_id,
        question,
        answer
    ))

    db.commit()
    chat_id = cursor.lastrowid

    cursor.close()
    db.close()

    return jsonify({
        "chat_id": chat_id,
        "reply": answer
    })

@app.route("/chat/category", methods=["POST"])
def chat_category():
    data = request.json
    user_id = data.get("user_id")
    category = data.get("category")

    if not user_id or not category:
        return jsonify({"error": "Missing data"}), 400

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    # 🔹 Get category-level answer from knowledge_base
    cursor.execute("""
        SELECT answer
        FROM knowledge_base
        WHERE category = %s
        AND question = '__CATEGORY__'
        AND status = 'active'
        LIMIT 1
    """, (category,))

    row = cursor.fetchone()

    category_answer = (
        row["answer"]
        if row
        else "Here are some common questions related to this topic."
    )

    # 🔹 Save to chats
    cursor.execute("""
        INSERT INTO chats (user_id, user_message, bot_reply, status)
        VALUES (%s, %s, %s, 'resolved')
    """, (user_id, category, category_answer))

    db.commit()
    chat_id = cursor.lastrowid

    cursor.close()
    db.close()

    return jsonify({
        "reply": category_answer,
        "chat_id": chat_id
    })

@app.route("/api/admin/dashboard-stats", methods=["GET"])
def dashboard_stats():
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    def weekly_count(where="1=1"):
        cursor.execute(f"""
            SELECT COUNT(*) AS count
            FROM chats
            WHERE {where}
            AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        """)
        return cursor.fetchone()["count"]

    def last_week_count(where="1=1"):
        cursor.execute(f"""
            SELECT COUNT(*) AS count
            FROM chats
            WHERE {where}
            AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
            AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
        """)
        return cursor.fetchone()["count"]

    def calc_change(this_week, last_week):
        if last_week == 0:
            return 100 if this_week > 0 else 0
        return round(((this_week - last_week) / last_week) * 100, 1)

    # TOTAL
    cursor.execute("SELECT COUNT(*) AS total FROM chats")
    total = cursor.fetchone()["total"]
    total_change = calc_change(
        weekly_count(),
        last_week_count()
    )

    # RESOLVED
    cursor.execute("SELECT COUNT(*) AS resolved FROM chats WHERE status='resolved'")
    resolved = cursor.fetchone()["resolved"]
    resolved_change = calc_change(
        weekly_count("status='resolved'"),
        last_week_count("status='resolved'")
    )

    # ESCALATED
    cursor.execute("SELECT COUNT(*) AS escalated FROM chats WHERE status='escalated'")
    escalated = cursor.fetchone()["escalated"]
    escalated_change = calc_change(
        weekly_count("status='escalated'"),
        last_week_count("status='escalated'")
    )

    # USERS
    cursor.execute("SELECT COUNT(DISTINCT user_id) AS users FROM chats")
    users = cursor.fetchone()["users"]
    users_change = calc_change(
        weekly_count("1=1"),
        last_week_count("1=1")
    )

    # SATISFACTION
    cursor.execute("""
        SELECT
            SUM(feedback='yes') AS yes_count,
            COUNT(feedback) AS total_count
        FROM chats
        WHERE feedback IS NOT NULL
    """)
    row = cursor.fetchone()

    satisfaction = (
        round((row["yes_count"] / row["total_count"]) * 100, 1)
        if row["total_count"] > 0 else 0
    )

    # ---------- AVG RESPONSE TIME ----------
    cursor.execute("""
        SELECT AVG(response_time) AS avg_time
        FROM chats
        WHERE response_time IS NOT NULL
    """)
    avg_time = cursor.fetchone()["avg_time"]
    avg_time = round(avg_time, 3) if avg_time else 0

    cursor.close()
    db.close()

    return jsonify({
        "total": total,
        "total_change": total_change,
        "resolved": resolved,
        "resolved_change": resolved_change,
        "escalated": escalated,
        "escalated_change": escalated_change,
        "users": users,
        "users_change": users_change,
        "avg_time": avg_time,          # ✅ REAL VALUE
        "avg_change": 0,               # ✅ TEMP (avoid NaN)
        "satisfaction": satisfaction,
        "satisfaction_change": 0
    })

@app.route("/api/admin/most-asked", methods=["GET"])
def most_asked_questions():
    range = request.args.get("range", "7d")

    if range == "30d":
        date_filter = "created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
    elif range == "90d":
        date_filter = "created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)"
    else:
        date_filter = "created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    cursor.execute(f"""
        SELECT 
            c.user_message AS question,
            kb.category AS category,
            COUNT(*) AS total
        FROM chats c
        LEFT JOIN knowledge_base kb
            ON c.user_message = kb.question
        WHERE c.user_message IS NOT NULL
          AND c.user_message != ''
          AND {date_filter}
        GROUP BY c.user_message, kb.category
        ORDER BY total DESC
        LIMIT 10
    """)

    data = cursor.fetchall()

    cursor.close()
    db.close()

    return jsonify(data)

@app.route("/api/admin/recent-activity", methods=["GET"])
def recent_activity():
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    cursor.execute("""
        SELECT 
            u.first_name,
            u.last_name,
            c.user_message,
            c.status,
            c.created_at
        FROM chats c
        JOIN users u ON u.id = c.user_id
        WHERE c.user_message IS NOT NULL
          AND c.user_message != ''
        ORDER BY c.created_at DESC
        LIMIT 20
    """)

    data = cursor.fetchall()
    for d in data:
        d["created_at"] = iso_time(d["created_at"])

    cursor.close()
    db.close()

    return jsonify(data)

@app.route("/api/admin/users", methods=["GET"])
def get_users():
    role = request.args.get("role", "all")
    search = request.args.get("search", "")

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    base_query = """
        SELECT
            id,
            CONCAT(first_name, ' ', last_name) AS name,
            email,
            'student' AS role,
            status,
            created_at,
            NULL AS last_active
        FROM users
        WHERE (first_name LIKE %s OR last_name LIKE %s OR email LIKE %s)

        UNION ALL

        SELECT
            id,
            name,
            email,
            'admin' AS role,
            'active' AS status,
            created_at,
            NULL AS last_active
        FROM admins
    """

    params = [f"%{search}%", f"%{search}%", f"%{search}%"]

    # 🔥 ROLE FILTER (IMPORTANT)
    if role != "all":
        base_query = f"""
            SELECT * FROM ({base_query}) AS all_users
            WHERE role = %s
        """
        params.append(role)

    base_query += " ORDER BY created_at DESC"

    try:
        cursor.execute(base_query, params)
        users = cursor.fetchall()
    except Exception as e:
        print("GET USERS ERROR:", e)
        return jsonify({"error": "Server error"}), 500
    finally:
        cursor.close()
        db.close()

    return jsonify(users)

@app.route("/api/admin/users/stats", methods=["GET"])
def user_stats():
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    cursor.execute("SELECT COUNT(*) AS students FROM users")
    students = cursor.fetchone()["students"]

    cursor.execute("SELECT COUNT(*) AS admins FROM admins")
    admins = cursor.fetchone()["admins"]

    total = students + admins

    cursor.close()
    db.close()

    return jsonify({
        "total": total,
        "students": students,
        "admins": admins
    })

@app.route("/api/admin/users/<int:user_id>", methods=["PUT"])
def update_user(user_id):
    data = request.json
    status = data.get("status")

    db = get_db_connection()
    cursor = db.cursor()

    cursor.execute("""
        UPDATE users
        SET status=%s
        WHERE id=%s
    """, (status, user_id))

    db.commit()
    cursor.close()
    db.close()

    return jsonify({"success": True})

@app.route("/api/admin/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    db = get_db_connection()
    cursor = db.cursor()

    # Try deleting from users
    cursor.execute("DELETE FROM users WHERE id=%s", (user_id,))
    deleted_users = cursor.rowcount

    # Try deleting from admins
    cursor.execute("DELETE FROM admins WHERE id=%s", (user_id,))
    deleted_admins = cursor.rowcount

    db.commit()
    cursor.close()
    db.close()

    if deleted_users or deleted_admins:
        return jsonify({"success": True})
    else:
        return jsonify({"success": False, "message": "User not found"}), 404

@app.route("/api/admin/analytics", methods=["GET"])
def analytics():
    range = request.args.get("range", "7d")

    # date condition
    if range == "30d":
        date_filter = "created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
    elif range == "year":
        date_filter = "YEAR(created_at) = YEAR(NOW())"
    else:
        date_filter = "created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    # ---------- TOTAL CHATS ----------
    cursor.execute(f"""
        SELECT COUNT(*) AS total
        FROM chats
        WHERE {date_filter}
    """)
    total = cursor.fetchone()["total"]

    # ---------- RESOLVED ----------
    cursor.execute(f"""
        SELECT COUNT(*) AS resolved
        FROM chats
        WHERE status='resolved' AND {date_filter}
    """)
    resolved = cursor.fetchone()["resolved"]

    # ---------- ESCALATED ----------
    cursor.execute(f"""
        SELECT COUNT(*) AS escalated
        FROM chats
        WHERE status='escalated' AND {date_filter}
    """)
    escalated = cursor.fetchone()["escalated"]

    # ---------- SATISFACTION ----------
    cursor.execute(f"""
        SELECT
            SUM(feedback='yes') AS yes_count,
            COUNT(feedback) AS total_count
        FROM chats
        WHERE feedback IS NOT NULL AND {date_filter}
    """)
    row = cursor.fetchone()
    satisfaction = (
        round((row["yes_count"] / row["total_count"]) * 100, 1)
        if row["total_count"] else 0
    )

    # ---------- AVG RESPONSE TIME ----------
    cursor.execute(f"""
        SELECT ROUND(AVG(response_time)/1000, 2) AS avg_time
        FROM chats
        WHERE response_time IS NOT NULL AND {date_filter}
    """)
    avg_time = cursor.fetchone()["avg_time"] or 0

    cursor.close()
    db.close()

    return jsonify({
        "total": total,
        "resolved": resolved,
        "escalated": escalated,
        "resolution_rate": round((resolved / total) * 100, 1) if total else 0,
        "escalation_rate": round((escalated / total) * 100, 1) if total else 0,
        "avg_response_time": avg_time,
        "satisfaction": satisfaction
    })

@app.route("/api/admin/analytics/categories", methods=["GET"])
def analytics_categories():
    range = request.args.get("range", "7d")

    if range == "30d":
        date_filter = "created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
    elif range == "year":
        date_filter = "YEAR(created_at) = YEAR(NOW())"
    else:
        date_filter = "created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    cursor.execute(f"""
        SELECT
            user_message AS category,
            COUNT(*) AS total
        FROM chats
        WHERE user_message IN (
            SELECT DISTINCT category FROM knowledge_base
        )
        AND {date_filter}
        GROUP BY user_message
        ORDER BY total DESC
    """)

    rows = cursor.fetchall()
    total = sum(r["total"] for r in rows)

    result = [
        {
            "category": r["category"],
            "total": r["total"],
            "percent": round((r["total"] / total) * 100, 1)
        }
        for r in rows
    ]

    cursor.close()
    db.close()

    return jsonify(result)

@app.route("/api/admin/analytics/hours", methods=["GET"])
def analytics_hours():
    range = request.args.get("range", "7d")

    if range == "30d":
        date_filter = "created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
    elif range == "year":
        date_filter = "YEAR(created_at) = YEAR(NOW())"
    else:
        date_filter = "created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    cursor.execute(f"""
        SELECT
            HOUR(CONVERT_TZ(created_at,'+00:00','+08:00')) AS hour,
            COUNT(*) AS total
        FROM chats
        WHERE {date_filter}
        GROUP BY hour
        ORDER BY hour
    """)

    data = cursor.fetchall()
    cursor.close()
    db.close()

    return jsonify(data)

@app.route("/api/admin/settings/general", methods=["GET"])
def get_general_settings():
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    cursor.execute("""
        SELECT system_name, institution_name, timezone, maintenance_mode
        FROM system_settings
        WHERE id = 1
    """)
    settings = cursor.fetchone()

    cursor.close()
    db.close()

    return jsonify(settings)

@app.route("/api/admin/settings/general", methods=["PUT"])
def update_general_settings():
    data = request.json

    db = get_db_connection()
    cursor = db.cursor()

    cursor.execute("""
        UPDATE system_settings
        SET
          system_name = %s,
          institution_name = %s,
          timezone = %s,
          maintenance_mode = %s
        WHERE id = 1
    """, (
        data["system_name"],
        data["institution_name"],
        data["timezone"],
        data["maintenance_mode"]
    ))

    db.commit()
    cursor.close()
    db.close()

    return jsonify({"success": True})

@app.before_request
def check_maintenance():
    if request.path.startswith("/chat"):
        db = get_db_connection()
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT maintenance_mode FROM system_settings WHERE id=1")
        row = cursor.fetchone()
        cursor.close()
        db.close()

        if row and row["maintenance_mode"]:
            return jsonify({
                "message": "System is under maintenance. Please try again later."
            }), 503

@app.route("/api/admin/settings/chatbot", methods=["GET"])
def get_chatbot_settings():
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    cursor.execute("""
        SELECT
          chatbot_name,
          welcome_message,
          fallback_message,
          confidence_threshold,
          auto_escalation
        FROM system_settings
        WHERE id = 1
    """)

    settings = cursor.fetchone()

    cursor.close()
    db.close()

    return jsonify(settings)

@app.route("/api/admin/settings/chatbot", methods=["PUT"])
def update_chatbot_settings():
    data = request.json

    db = get_db_connection()
    cursor = db.cursor()

    cursor.execute("""
        UPDATE system_settings
        SET
          chatbot_name = %s,
          welcome_message = %s,
          fallback_message = %s,
          confidence_threshold = %s,
          auto_escalation = %s
        WHERE id = 1
    """, (
        data["chatbot_name"],
        data["welcome_message"],
        data["fallback_message"],
        data["confidence_threshold"],
        data["auto_escalation"]
    ))

    db.commit()
    cursor.close()
    db.close()

    return jsonify({"success": True})

def get_system_settings():
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    cursor.execute("""
        SELECT
          maintenance_mode,
          chatbot_name,
          welcome_message,
          fallback_message,
          confidence_threshold,
          auto_escalation
        FROM system_settings
        WHERE id = 1
    """)

    settings = cursor.fetchone()

    cursor.close()
    db.close()

    return settings

@app.route("/api/chat/new", methods=["POST"])
def start_new_chat():
    data = request.json
    user_id = data["user_id"]

    db = get_db_connection()
    cursor = db.cursor()
    cursor.execute("DELETE FROM chats WHERE user_id = %s", (user_id,))
    db.commit()
    cursor.close()
    db.close()

    return jsonify({"success": True})

@app.route("/api/admin/users", methods=["POST"])
def admin_create_user():
    data = request.json

    full_name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    role = data.get("role")
    password = data.get("password")

    # ---------------- VALIDATION ----------------
    if not full_name or not email or not role or not password:
        return jsonify({
            "success": False,
            "message": "All fields are required"
        }), 400

    if role not in ["student", "admin"]:
        return jsonify({
            "success": False,
            "message": "Invalid role"
        }), 400

    email_regex = r"^[\w\.-]+@[\w\.-]+\.\w+$"
    if not re.match(email_regex, email):
        return jsonify({
            "success": False,
            "message": "Invalid email format"
        }), 400

    hashed_password = hashlib.sha256(password.encode()).hexdigest()
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    try:
        # ---------------- STUDENT ----------------
        if role == "student":
            # check duplicate email
            cursor.execute("SELECT id FROM users WHERE email=%s", (email,))
            if cursor.fetchone():
                return jsonify({
                    "success": False,
                    "message": "Email already exists"
                }), 409

            first_name, *last = full_name.split(" ", 1)
            last_name = last[0] if last else ""

            cursor.execute("""
                INSERT INTO users
                (first_name, last_name, email, password, role, status)
                VALUES (%s, %s, %s, %s, 'student', 'active')
            """, (first_name, last_name, email, hashed_password))

        # ---------------- ADMIN ----------------
        else:
            cursor.execute("SELECT id FROM admins WHERE email=%s", (email,))
            if cursor.fetchone():
                return jsonify({
                    "success": False,
                    "message": "Admin email already exists"
                }), 409

            cursor.execute("""
                INSERT INTO admins
                (name, email, password)
                VALUES (%s, %s, %s)
            """, (full_name, email, hashed_password))

        db.commit()

    except Exception as e:
        print("ADD USER ERROR:", e)
        return jsonify({
            "success": False,
            "message": "Server error"
        }), 500
    finally:
        cursor.close()
        db.close()

    return jsonify({
        "success": True,
        "message": "User created successfully"
    })

# ---------------- RUN SERVER ----------------
if __name__ == "__main__":
    app.run(debug=True, use_reloader=False, threaded=True)