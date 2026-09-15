from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import json
import os
import uuid
from datetime import datetime
from functools import wraps
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Coba import libsql jika tersedia di environment (Turso Cloud DB)
try:
    import libsql_experimental as libsql
    HAS_LIBSQL = True
except ImportError:
    HAS_LIBSQL = False

load_dotenv(dotenv_path='../.env')
GEMINI_KEY = os.getenv('GEMINI_API_KEY')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-3.1-flash-lite')
TURSO_URL = os.getenv('TURSO_DATABASE_URL')
TURSO_TOKEN = os.getenv('TURSO_AUTH_TOKEN')

app = Flask(__name__)
CORS(app)

DB_FILE = '../database.db' if os.path.exists('../database.db') else './database.db'

client = genai.Client(api_key=GEMINI_KEY) if GEMINI_KEY else None
ACTIVE_TOKENS = set()

def require_producer(f):
    """Wajibkan header Authorization: Bearer <token> yang valid (hasil dari /api/login).
    Pakai buat route yang SELURUH method-nya butuh auth (mis. DELETE-only)."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not is_authorized():
            return jsonify({"error": "Akses ditolak. Login sebagai Produser dulu."}), 401
        return f(*args, **kwargs)
    return decorated

def is_authorized():
    """Cek token Bearer di header Authorization. Dipakai manual di route yang
    campur GET (publik) & POST (khusus Produser) dalam satu function."""
    auth_header = request.headers.get('Authorization', '')
    token = auth_header.replace('Bearer ', '').strip()
    return bool(token) and token in ACTIVE_TOKENS

def get_db_connection():
    # Gunakan Turso Cloud DB jika konfigurasinya tersedia, jika tidak fallback ke SQLite lokal
    if HAS_LIBSQL and TURSO_URL and TURSO_TOKEN:
        conn = libsql.connect(TURSO_URL, auth_token=TURSO_TOKEN)
    else:
        conn = sqlite3.connect(DB_FILE, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            tag TEXT NOT NULL,
            deadline TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'In Revision'
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS subtasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            deadline TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS knowledge_base (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT,
            text TEXT NOT NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_name TEXT NOT NULL,
            lecturer_name TEXT NOT NULL,
            room TEXT NOT NULL,
            day_of_week TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            meeting_no INTEGER DEFAULT 1
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attendance_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            schedule_id INTEGER NOT NULL,
            date_str TEXT NOT NULL,
            status TEXT DEFAULT 'BELUM ABSEN',
            FOREIGN KEY (schedule_id) REFERENCES schedules (id) ON DELETE CASCADE
        )
    ''')

    conn.commit()
    conn.close()

init_db()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    pin = data.get('pin', '')
    if pin == '251206':
        token = str(uuid.uuid4())
        ACTIVE_TOKENS.add(token)
        return jsonify({"success": True, "token": token}), 200
    return jsonify({"error": "PIN Produser Salah"}), 401

@app.route('/api/tasks', methods=['GET', 'POST'])
def handle_tasks():
    conn = get_db_connection()
    cursor = conn.cursor()

    if request.method == 'POST':
        if not is_authorized():
            conn.close()
            return jsonify({"error": "Akses ditolak. Login sebagai Produser dulu."}), 401

        data = request.get_json() or {}
        title = data.get('title')
        tag = data.get('tag', 'GENERAL')
        deadline = data.get('deadline')
        description = data.get('description', '')
        subtasks = data.get('subtasks', [])

        cursor.execute(
            "INSERT INTO tasks (title, tag, deadline, description, status) VALUES (?, ?, ?, ?, ?)",
            (title, tag, deadline, description, 'In Revision')
        )
        task_id = cursor.lastrowid

        for st in subtasks:
            cursor.execute(
                "INSERT INTO subtasks (task_id, title, deadline, completed) VALUES (?, ?, ?, ?)",
                (task_id, st.get('title'), st.get('deadline', deadline), 0)
            )

        conn.commit()
        conn.close()
        return jsonify({"success": True, "task_id": task_id}), 201

    cursor.execute("SELECT * FROM tasks ORDER BY deadline ASC")
    tasks_rows = cursor.fetchall()
    
    tasks_list = []
    for t in tasks_rows:
        t_id = t['id']
        cursor.execute("SELECT id, title, deadline, completed FROM subtasks WHERE task_id = ?", (t_id,))
        sub_rows = cursor.fetchall()
        
        subtasks = [{
            "id": st['id'],
            "title": st['title'],
            "deadline": st['deadline'],
            "completed": bool(st['completed'])
        } for st in sub_rows]
        
        tasks_list.append({
            "id": t['id'],
            "title": t['title'],
            "tag": t['tag'],
            "deadline": t['deadline'],
            "description": t['description'],
            "status": t['status'],
            "subtasks": subtasks
        })
        
    conn.close()
    return jsonify(tasks_list)

@app.route('/api/tasks/status', methods=['POST'])
def update_task_status():
    data = request.get_json() or {}
    task_id = data.get('id')
    status = data.get('status', 'Selesai')

    if not task_id:
        return jsonify({"error": "Task ID diperlukan"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE tasks SET status = ? WHERE id = ?", (status, task_id))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Status tugas diperbarui"})

@app.route('/api/data/clear-all', methods=['DELETE'])
@require_producer
def clear_all_data():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM subtasks")
    cursor.execute("DELETE FROM tasks")
    cursor.execute("DELETE FROM attendance_logs")
    cursor.execute("DELETE FROM schedules")
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Seluruh data dibersihkan"}), 200

@app.route('/api/schedules', methods=['GET', 'POST'])
def handle_schedules():
    conn = get_db_connection()
    cursor = conn.cursor()

    if request.method == 'POST':
        if not is_authorized():
            conn.close()
            return jsonify({"error": "Akses ditolak. Login sebagai Produser dulu."}), 401

        data = request.get_json() or {}
        cursor.execute('''
            INSERT INTO schedules (course_name, lecturer_name, room, day_of_week, start_time, end_time, meeting_no)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            data.get('course_name'),
            data.get('lecturer_name'),
            data.get('room'),
            data.get('day_of_week'),
            data.get('start_time'),
            data.get('end_time'),
            data.get('meeting_no', 1)
        ))
        conn.commit()
        conn.close()
        return jsonify({"success": True}), 201

    cursor.execute("SELECT * FROM schedules ORDER BY start_time ASC")
    rows = cursor.fetchall()
    
    today_str = datetime.now().strftime('%Y-%m-%d')
    schedules = []
    for r in rows:
        cursor.execute("SELECT status FROM attendance_logs WHERE schedule_id = ? AND date_str = ?", (r['id'], today_str))
        att = cursor.fetchone()
        att_status = att['status'] if att else 'BELUM ABSEN'

        schedules.append({
            "id": r['id'],
            "course_name": r['course_name'],
            "lecturer_name": r['lecturer_name'],
            "room": r['room'],
            "day_of_week": r['day_of_week'],
            "start_time": r['start_time'],
            "end_time": r['end_time'],
            "meeting_no": r['meeting_no'],
            "attendance_status": att_status
        })
    conn.close()
    return jsonify(schedules)

@app.route('/api/attendance/toggle', methods=['POST'])
def toggle_attendance():
    data = request.get_json() or {}
    schedule_id = data.get('schedule_id')
    today_str = datetime.now().strftime('%Y-%m-%d')

    if not schedule_id:
        return jsonify({"error": "Schedule ID diperlukan"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, status FROM attendance_logs WHERE schedule_id = ? AND date_str = ?", (schedule_id, today_str))
    log = cursor.fetchone()

    if log:
        new_status = 'SUDAH ABSEN' if log['status'] == 'BELUM ABSEN' else 'BELUM ABSEN'
        cursor.execute("UPDATE attendance_logs SET status = ? WHERE id = ?", (new_status, log['id']))
    else:
        new_status = 'SUDAH ABSEN'
        cursor.execute("INSERT INTO attendance_logs (schedule_id, date_str, status) VALUES (?, ?, ?)", (schedule_id, today_str, 'SUDAH ABSEN'))

    conn.commit()
    conn.close()
    return jsonify({"success": True, "status": new_status})

@app.route('/api/insights', methods=['GET'])
def get_insights():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT source, text FROM knowledge_base")
    rows = cursor.fetchall()
    conn.close()
    return jsonify([{"source": r['source'], "text": r['text']} for r in rows])

SUPPORTED_INSIGHT_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain']

@app.route('/api/insights/upload', methods=['POST'])
@require_producer
def upload_insight():
    uploaded_file = request.files.get('file')
    manual_text = (request.form.get('text') or '').strip()
    source_label = (request.form.get('source') or '').strip()

    if not uploaded_file and not manual_text:
        return jsonify({"error": "Isi minimal salah satu: file atau teks catatan."}), 400

    saved_entries = []

    if uploaded_file:
        mime_type = uploaded_file.mimetype or 'application/octet-stream'
        if mime_type not in SUPPORTED_INSIGHT_MIMES:
            return jsonify({"error": f"Format file '{mime_type}' belum didukung. Pakai PDF, JPG/PNG/WebP, atau TXT."}), 400

        if not client:
            return jsonify({"error": "GEMINI_API_KEY belum diset di .env"}), 500

        file_bytes = uploaded_file.read()
        prompt = """Kamu asisten belajar mahasiswa. Lihat isi file/gambar ini, lalu tentukan:
1. Kalau isinya MATERI/catatan pembelajaran -> ringkas jadi poin-poin penting yang singkat & actionable.
2. Kalau isinya PERTANYAAN/soal -> jawab pertanyaannya langsung dengan jelas dan benar.

Balas HANYA dengan JSON (tanpa markdown), format:
{"type": "materi" atau "pertanyaan", "title": "judul singkat 3-6 kata", "result": "isi ringkasan atau jawaban dalam Bahasa Indonesia"}
"""
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[types.Part.from_bytes(data=file_bytes, mime_type=mime_type), prompt]
            )
            raw = (response.text or '').strip().replace('```json', '').replace('```', '').strip()
            ai_data = json.loads(raw)
            ai_title = source_label or (ai_data.get('title') or 'Upload Web').strip()
            ai_result = (ai_data.get('result') or '').strip()

            if ai_result:
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute("INSERT INTO knowledge_base (source, text) VALUES (?, ?)", (ai_title, ai_result))
                conn.commit()
                conn.close()
                saved_entries.append({"source": ai_title, "text": ai_result})
        except json.JSONDecodeError:
            return jsonify({"error": "AI gagal memproses isi file (respons tidak valid). Coba upload ulang."}), 502
        except Exception as e:
            return jsonify({"error": f"Gagal menganalisa file: {str(e)}"}), 502

    if manual_text:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO knowledge_base (source, text) VALUES (?, ?)", (source_label, manual_text))
        conn.commit()
        conn.close()
        saved_entries.append({"source": source_label, "text": manual_text})

    if not saved_entries:
        return jsonify({"error": "Tidak ada insight yang berhasil disimpan."}), 500

    return jsonify({"success": True, "entries": saved_entries}), 201

@app.route('/api/subtasks/status', methods=['POST'])
def update_subtask_status():
    data = request.get_json() or {}
    subtask_id = data.get('id')
    completed = data.get('completed')

    if not subtask_id or completed is None:
        return jsonify({"error": "id dan completed diperlukan"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE subtasks SET completed = ? WHERE id = ?", (1 if completed else 0, subtask_id))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "completed": bool(completed)})

@app.route('/api/ai/breakdown', methods=['POST'])
@require_producer
def ai_breakdown_task():
    if not client:
        return jsonify({"error": "GEMINI_API_KEY belum diset di .env"}), 500

    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    description = (data.get('description') or '').strip()
    tag = (data.get('tag') or '').strip()
    deadline = (data.get('deadline') or '').strip()

    if not title:
        return jsonify({"error": "Judul tugas diperlukan"}), 400

    prompt = f"""Kamu asisten manajemen tugas kuliah. Pecah tugas berikut jadi 3-5 sub-tugas yang praktis dan berurutan.

Judul Tugas: {title}
Kategori/Matkul: {tag or '-'}
Deskripsi/Catatan: {description or '-'}
Deadline Akhir Tugas: {deadline or '-'}

Balas HANYA dengan JSON array (tanpa markdown, tanpa penjelasan tambahan), format persis seperti ini:
[{{"title": "nama sub-tugas singkat", "deadline": "YYYY-MM-DD"}}, ...]

Ketentuan:
- Deadline tiap sub-tugas harus berurutan mundur/maju dan SEBELUM atau SAMA DENGAN deadline akhir tugas (kalau deadline akhir tersedia).
- Kalau deadline akhir tugas tidak tersedia, buat estimasi wajar dimulai dari beberapa hari ke depan.
- Bahasa Indonesia, judul sub-tugas singkat dan actionable (bukan kalimat panjang).
"""

    try:
        response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
        raw_text = (response.text or '').strip()
        cleaned = raw_text.replace('```json', '').replace('```', '').strip()
        subtasks = json.loads(cleaned)

        if not isinstance(subtasks, list):
            raise ValueError("Format respons AI bukan list")

        result = []
        for st in subtasks:
            st_title = str(st.get('title', '')).strip()
            st_deadline = str(st.get('deadline', deadline or '')).strip()
            if st_title:
                result.append({"title": st_title, "deadline": st_deadline})

        if not result:
            raise ValueError("AI tidak mengembalikan sub-tugas yang valid")

        return jsonify({"success": True, "subtasks": result})

    except json.JSONDecodeError:
        return jsonify({"error": "Gagal parsing respons AI. Coba lagi."}), 502
    except Exception as e:
        return jsonify({"error": f"Gagal menghubungi Gemini: {str(e)}"}), 502

if __name__ == '__main__':
    print("🌐 Backend Dashboard Running di http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)