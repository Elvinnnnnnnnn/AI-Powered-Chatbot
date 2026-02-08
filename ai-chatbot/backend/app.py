from flask import Flask, request, jsonify
from flask_cors import CORS
from db import get_db_connection
import hashlib
import mysql.connector
import time

app = Flask(__name__)
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                "http://localhost:5500",
                "http://127.0.0.1:5500"
            ]
        }
    }
)
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
    SELECT id, first_name, last_name, role, program, year_level
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

    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
    UPDATE users SET
        first_name=%s,
        last_name=%s,
        email=%s,
        phone=%s,
        address=%s,
        birth_date=%s
    WHERE id=%s
    """

    cursor.execute(query, (
        data["first_name"],
        data["last_name"],
        data["email"],
        data["phone"],
        data["address"],
        data["birth_date"],
        data["id"]
    ))

    conn.commit()
    return jsonify({"success": True})

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
    events = cursor.fetchall()

    return jsonify(events)

@app.route("/chat", methods=["POST"])
def chat():
    start_time = time.time()  # ⏱ start timing

    data = request.json
    user_id = data.get("user_id")
    message = data.get("message")

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    # 1️⃣ Search Knowledge Base
    cursor.execute("""
        SELECT answer
        FROM knowledge_base
        WHERE status = 'active'
        AND question LIKE %s
        LIMIT 1
    """, (f"%{message}%",))
    result = cursor.fetchone()

    # 2️⃣ Decide status
    status = "resolved" if result else "escalated"

    # 3️⃣ Reply
    reply = result["answer"] if result else (
        "I'm sorry, I couldn't find an answer to your question.\n"
        "Your concern has been escalated."
    )

    # ⏱ stop timing
    end_time = time.time()
    response_time = round((end_time - start_time) * 1000, 2)

    # 4️⃣ Save conversation WITH response time
    cursor.execute("""
        INSERT INTO chats (user_id, user_message, bot_reply, status, response_time)
        VALUES (%s, %s, %s, %s, %s)
    """, (user_id, message, reply, status, response_time))
    db.commit()

    chat_id = cursor.lastrowid

    # 5️⃣ Escalation ticket update
    if status == "escalated":
        reply = (
            "I'm sorry, I couldn't find an answer to your question.\n\n"
            f"Your concern has been escalated.\n"
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
        "chat_id": chat_id
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
            feedback
        FROM chats
        WHERE user_id = %s
        ORDER BY created_at ASC
    """, (user_id,))

    history = cursor.fetchall()

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

    cursor.execute("""
        INSERT INTO chats (user_id, bot_reply, status)
        VALUES (%s, %s, 'resolved')
    """, (user_id, "[ADMIN] " + reply))

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
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    cursor.execute("""
        SELECT 
            user_message AS question,
            COUNT(*) AS total
        FROM chats
        WHERE user_message IS NOT NULL
          AND user_message != ''
        GROUP BY user_message
        ORDER BY total DESC
        LIMIT 5
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
        ORDER BY c.created_at DESC
        LIMIT 5
    """)

    data = cursor.fetchall()
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

    cursor.execute("SELECT COUNT(*) AS total FROM users")
    total = cursor.fetchone()["total"]

    cursor.execute("SELECT COUNT(*) AS students FROM users WHERE role='student'")
    students = cursor.fetchone()["students"]

    cursor.execute("SELECT COUNT(*) AS admins FROM admins")
    admins = cursor.fetchone()["admins"]

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

    db = get_db_connection()
    cursor = db.cursor()

    cursor.execute("""
        UPDATE users
        SET role=%s, status=%s
        WHERE id=%s
    """, (
        data["role"],
        data["status"],
        user_id
    ))

    db.commit()
    cursor.close()
    db.close()

    return jsonify({"success": True})

@app.route("/api/admin/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    db = get_db_connection()
    cursor = db.cursor()

    cursor.execute("DELETE FROM users WHERE id=%s", (user_id,))

    db.commit()
    cursor.close()
    db.close()

    return jsonify({"success": True})


# ---------------- RUN SERVER ----------------
if __name__ == "__main__":
    app.run(debug=True)
