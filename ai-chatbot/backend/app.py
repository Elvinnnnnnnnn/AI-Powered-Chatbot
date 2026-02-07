from flask import Flask, request, jsonify
from flask_cors import CORS
from db import get_db_connection
import hashlib
import mysql.connector

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

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
    data = request.json
    user_id = data.get("user_id")
    message = data.get("message")

    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    # 1️⃣ Search Knowledge Base
    query = """
        SELECT answer
        FROM knowledge_base
        WHERE status = 'active'
        AND question LIKE %s
        LIMIT 1
    """
    cursor.execute(query, (f"%{message}%",))
    result = cursor.fetchone()

    # 2️⃣ Decide reply & status
    if result:
        reply = result["answer"]
        status = "resolved"
    else:
        reply = (
            "I'm sorry, I couldn't find an answer to your question. "
            "Your concern has been forwarded to the admin."
        )
        status = "escalated"

    # 3️⃣ Save conversation
    insert_query = """
        INSERT INTO chats (user_id, user_message, bot_reply, status)
        VALUES (%s, %s, %s, %s)
    """
    cursor.execute(insert_query, (user_id, message, reply, status))
    db.commit()

    cursor.close()
    db.close()

    # 4️⃣ Send reply back to chatbot
    return jsonify({
        "reply": reply,
        "status": status
    })

@app.route("/chat/history/<int:user_id>")
def chat_history(user_id):
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    cursor.execute("""
        SELECT
            user_message,
            bot_reply
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

    cursor.execute("""
        SELECT id, question, answer
        FROM knowledge_base
        WHERE category = %s
        AND status = 'active'
        ORDER BY id ASC
    """, (category,))

    questions = cursor.fetchall()

    cursor.close()
    db.close()

    return jsonify(questions)


# ---------------- RUN SERVER ----------------
if __name__ == "__main__":
    app.run(debug=True)
