from flask import Flask, jsonify, render_template, request
from pathlib import Path
import sqlite3
from datetime import datetime, timezone

app = Flask(__name__)
DB = Path("data/miniboard.db")

def connect():
    DB.parent.mkdir(exist_ok=True)
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con

def init_db():
    with connect() as con:
        # メッセージ用テーブル
        con.execute("""CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL
        )""")
        
        # 投票（質問）用テーブル
        con.execute("""CREATE TABLE IF NOT EXISTS polls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT NOT NULL,
            created_at TEXT NOT NULL
        )""")
        
        # 投票（選択肢・得票数）用テーブル
        con.execute("""CREATE TABLE IF NOT EXISTS poll_options (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            poll_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            votes INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
        )""")

@app.get("/")
def index():
    return render_template("index.html")

# --- メッセージ API ---

@app.get("/api/messages")
def get_messages():
    with connect() as con:
        rows = con.execute("SELECT * FROM messages ORDER BY id DESC").fetchall()
    return jsonify([dict(r) for r in rows])

@app.post("/api/messages")
def create_message():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()[:30]
    message = str(data.get("message", "")).strip()[:300]
    if not name or not message:
        return jsonify({"error": "name and message are required"}), 400
    created_at = datetime.now(timezone.utc).isoformat()
    with connect() as con:
        cur = con.execute("INSERT INTO messages(name,message,created_at) VALUES(?,?,?)", (name, message, created_at))
        row = con.execute("SELECT * FROM messages WHERE id=?", (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201

@app.put("/api/messages/<int:message_id>")
def update_message(message_id):
    data = request.get_json(silent=True) or {}
    message = str(data.get("message", "")).strip()[:300]
    if not message:
        return jsonify({"error": "message is required"}), 400
    with connect() as con:
        cur = con.execute("UPDATE messages SET message=? WHERE id=?", (message, message_id))
        if cur.rowcount == 0:
            return jsonify({"error": "not found"}), 404
    return jsonify({"ok": True})

@app.delete("/api/messages/<int:message_id>")
def delete_message(message_id):
    with connect() as con:
        cur = con.execute("DELETE FROM messages WHERE id=?", (message_id,))
        if cur.rowcount == 0:
            return jsonify({"error": "not found"}), 404
    return "", 204

# --- 投票 (Poll) API ---

@app.get("/api/polls")
def get_polls():
    with connect() as con:
        polls = [dict(r) for r in con.execute("SELECT * FROM polls ORDER BY id DESC").fetchall()]
        for poll in polls:
            options = con.execute(
                "SELECT id, text, votes FROM poll_options WHERE poll_id = ? ORDER BY id ASC", 
                (poll["id"],)
            ).fetchall()
            poll["options"] = [dict(opt) for opt in options]
    return jsonify(polls)

@app.post("/api/polls")
def create_poll():
    data = request.get_json(silent=True) or {}
    question = str(data.get("question", "")).strip()[:200]
    raw_options = data.get("options", [])
    
    # バリデーション: 質問文と最低2つの選択肢が必要
    options = [str(opt).strip()[:100] for opt in raw_options if str(opt).strip()]
    if not question or len(options) < 2:
        return jsonify({"error": "question and at least 2 options are required"}), 400

    created_at = datetime.now(timezone.utc).isoformat()
    with connect() as con:
        cur = con.execute("INSERT INTO polls(question, created_at) VALUES(?, ?)", (question, created_at))
        poll_id = cur.lastrowid
        
        created_options = []
        for opt_text in options:
            opt_cur = con.execute(
                "INSERT INTO poll_options(poll_id, text, votes) VALUES(?, ?, 0)",
                (poll_id, opt_text)
            )
            created_options.append({"id": opt_cur.lastrowid, "text": opt_text, "votes": 0})

    return jsonify({
        "id": poll_id,
        "question": question,
        "created_at": created_at,
        "options": created_options
    }), 201

@app.post("/api/polls/<int:poll_id>/vote")
def vote_poll(poll_id):
    data = request.get_json(silent=True) or {}
    option_id = data.get("option_id")
    
    if not option_id or not isinstance(option_id, int):
        return jsonify({"error": "valid option_id is required"}), 400

    with connect() as con:
        # 指定された poll_id と option_id の組み合わせが存在するか検証
        opt = con.execute(
            "SELECT votes FROM poll_options WHERE id = ? AND poll_id = ?", 
            (option_id, poll_id)
        ).fetchone()
        
        if not opt:
            return jsonify({"error": "option or poll not found"}), 404
        
        # 得票数を+1加算
        con.execute("UPDATE poll_options SET votes = votes + 1 WHERE id = ?", (option_id,))
        new_votes = opt["votes"] + 1

    return jsonify({
        "ok": True,
        "poll_id": poll_id,
        "option_id": option_id,
        "votes": new_votes
    })

if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=False)