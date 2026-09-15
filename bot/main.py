import telebot
from telebot.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton
import os
import json
import requests
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
GEMINI_KEY = os.getenv('GEMINI_API_KEY')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-3.1-flash-lite')
API_BASE_URL = 'https://nandi.pythonanywhere.com'

# Definisikan Zona Waktu WIB (UTC+7)
WIB = timezone(timedelta(hours=7))

# Inisialisasi Bot & Client Gemini AI
bot = telebot.TeleBot(BOT_TOKEN) if BOT_TOKEN else None
client = genai.Client(api_key=GEMINI_KEY) if GEMINI_KEY else None

USER_STATE = {}
SAVED_CHAT_ID = None

def save_chat_id(chat_id):
    global SAVED_CHAT_ID
    SAVED_CHAT_ID = chat_id

def get_saved_chat_id():
    return SAVED_CHAT_ID

# --- ESCALATION SCHEDULER ABSENSI PERKULIAHAN (TIAP 1 MENIT) VIA API (WIB) ---
def check_attendance_escalation():
    chat_id = get_saved_chat_id()
    if not bot or not chat_id:
        return

    now = datetime.now(WIB)
    current_day = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'][now.weekday()]
    today_str = now.strftime('%Y-%m-%d')

    try:
        res = requests.get(f"{API_BASE_URL}/api/schedules", timeout=5)
        if not res.ok:
            return
        schedules = res.json()
    except Exception as e:
        print("Error fetch schedules for escalation:", e)
        return

    today_schedules = [s for s in schedules if s.get('day_of_week') == current_day]

    for s in today_schedules:
        status = s.get('attendance_status', 'BELUM ABSEN')

        if status == 'BELUM ABSEN':
            try:
                start_dt = datetime.strptime(f"{today_str} {s['start_time']}", '%Y-%m-%d %H:%M').replace(tzinfo=WIB)
                diff_minutes = int((now - start_dt).total_seconds() / 60)

                if diff_minutes in [0, 5, 10, 15, 20, 25]:
                    msg = (
                        f"⏰ *PENGINGAT ABSENSI ({diff_minutes} Min)*\n\n"
                        f"Hai Nandi! Udah absen belum untuk kelas:\n"
                        f"📚 *{s['course_name']}*\n"
                        f"👨‍🏫 Dosen: {s['lecturer_name']}\n"
                        f"🏛️ Ruang: {s['room']}\n"
                        f"⏰ Waktu: {s['start_time']} WIB"
                    )
                    markup = InlineKeyboardMarkup()
                    markup.add(InlineKeyboardButton("✅ Sudah Absen", callback_data=f"att_done_{s['id']}"))
                    bot.send_message(chat_id, msg, parse_mode='Markdown', reply_markup=markup)
            except Exception as ex:
                print("Error parsing time/sending escalation:", ex)

# --- SCHEDULER NOTIFIKASI H-1 DEADLINE TUGAS (DICEK TIAP 1 JAM) ---
def check_task_deadlines():
    chat_id = get_saved_chat_id()
    if not bot or not chat_id:
        return

    try:
        res = requests.get(f"{API_BASE_URL}/api/tasks", timeout=5)
        if not res.ok:
            return
        tasks = res.json()
    except Exception as e:
        print("Error fetch tasks for deadline check:", e)
        return

    now = datetime.now(WIB)

    for task in tasks:
        if task.get('status') != 'Selesai' and task.get('deadline'):
            try:
                deadline_dt = datetime.strptime(task['deadline'], '%Y-%m-%d').replace(tzinfo=WIB)
                time_diff = deadline_dt - now
                
                if 0 <= time_diff.total_seconds() <= 86400:
                    msg = (
                        f"🚨 *PERINGATAN DEADLINE (H-1)* 🚨\n\n"
                        f"Tugas ini udah mepet nih Nandi, buruan dikerjain!\n\n"
                        f"📌 *{task['title']}*\n"
                        f"🏷️ Mata Kuliah: {task.get('tag') or 'Umum'}\n"
                        f"⏰ Tenggat Waktu: {task['deadline']}"
                    )
                    markup = InlineKeyboardMarkup()
                    markup.add(
                        InlineKeyboardButton("✅ Selesai", callback_data=f"task_done_{task['id']}"),
                        InlineKeyboardButton("📝 Revisi", callback_data=f"note_task_{task['id']}"),
                        InlineKeyboardButton("🗑️ Hapus", callback_data=f"task_delete_{task['id']}")
                    )
                    bot.send_message(chat_id, msg, parse_mode='Markdown', reply_markup=markup)
            except Exception as ex:
                print("Error parsing task deadline date:", ex)

scheduler = BackgroundScheduler(daemon=True)
scheduler.add_job(check_attendance_escalation, 'interval', minutes=1)
scheduler.add_job(check_task_deadlines, 'interval', hours=1)
scheduler.start()

# --- HELPER: AMBIL KONTEKS TUGAS & CATATAN VIA API ---
def fetch_active_tasks():
    try:
        res = requests.get(f"{API_BASE_URL}/api/tasks", timeout=5)
        if res.ok:
            tasks = res.json()
            return [t for t in tasks if t.get('status') != 'Selesai']
        return []
    except Exception as e:
        print("Error fetching tasks via API:", e)
        return []

def fetch_knowledge_base():
    try:
        res = requests.get(f"{API_BASE_URL}/api/insights", timeout=5)
        if res.ok:
            return res.json()
        return []
    except Exception as e:
        print("Error fetching insights via API:", e)
        return []

def build_context_text():
    tasks = fetch_active_tasks()
    kb = fetch_knowledge_base()

    if tasks:
        task_lines = []
        for t in tasks:
            sub_summary = ""
            if t.get('subtasks'):
                done = sum(1 for s in t['subtasks'] if s.get('completed'))
                sub_summary = f" ({done}/{len(t['subtasks'])} sub-task selesai: " + ", ".join(s['title'] for s in t['subtasks']) + ")"
            task_lines.append(f"- [{t.get('tag') or 'Umum'}] {t['title']} | deadline: {t.get('deadline') or '-'} | status: {t.get('status')}{sub_summary}")
        tasks_text = "\n".join(task_lines)
    else:
        tasks_text = "(belum ada tugas aktif)"

    kb_text = "\n".join([f"- ({k.get('source') or 'Umum'}) {k.get('text')}" for k in kb]) if kb else "(belum ada catatan tersimpan)"

    return f"DAFTAR TUGAS AKTIF:\n{tasks_text}\n\nCATATAN/INSIGHT TERSIMPAN:\n{kb_text}"

# --- MENU UTAMA (TOMBOL PERMANEN DI BAWAH) ---
MENU_TUGAS = "📋 Tugas Aktif"
MENU_TAMBAH_TUGAS = "➕ Tambah Tugas"
MENU_CATATAN = "📝 Tambah Catatan"
MENU_TANYA = "❓ Tanya AI"
MENU_ABSEN = "✅ Sudah Absen"
MENU_JADWAL = "📅 Jadwal Kuliah"
MENU_BATAL = "❌ Batal"

def main_menu():
    markup = ReplyKeyboardMarkup(resize_keyboard=True, row_width=2)
    markup.add(KeyboardButton(MENU_TUGAS), KeyboardButton(MENU_TAMBAH_TUGAS))
    markup.add(KeyboardButton(MENU_CATATAN), KeyboardButton(MENU_TANYA))
    markup.add(KeyboardButton(MENU_JADWAL), KeyboardButton(MENU_ABSEN))
    return markup

def cancel_menu():
    markup = ReplyKeyboardMarkup(resize_keyboard=True)
    markup.add(KeyboardButton(MENU_BATAL))
    return markup

def clear_state(chat_id):
    USER_STATE.pop(chat_id, None)

# --- /start & /help ---
@bot.message_handler(commands=['start', 'help'])
def handle_help(message):
    save_chat_id(message.chat.id)
    clear_state(message.chat.id)
    bot.send_message(
        message.chat.id,
        "🤖 *Bot Road to S.I.Kom*\n\n"
        "Tinggal pencet tombol di bawah, gak perlu ngetik command 👇\n\n"
        "📎 *Bonus:* kirim foto/file (PDF/gambar) kapan aja — kalau isinya materi, AI bakal rangkum; "
        "kalau isinya soal/pertanyaan, AI langsung jawab. Hasilnya otomatis tersimpan jadi insight di dashboard web juga.",
        parse_mode='Markdown',
        reply_markup=main_menu()
    )

# --- SHORTCUT CEPAT /catat ---
@bot.message_handler(commands=['catat'])
def handle_catat_command(message):
    save_chat_id(message.chat.id)
    raw = message.text.replace('/catat', '', 1).strip()
    if not raw:
        bot.reply_to(message, "Format: `/catat [Sumber |] isi catatan`", parse_mode='Markdown')
        return
    source, text = (raw.split('|', 1) + [''])[:2] if '|' in raw else ('', raw)
    source, text = source.strip(), (text or raw).strip()
    _save_note(source, text)
    bot.reply_to(message, f"📝 Catatan tersimpan!\n\n\"{text}\"")

def _save_note(source, text):
    try:
        requests.post(
            f"{API_BASE_URL}/api/insights/upload",
            data={'source': source, 'text': text},
            timeout=5
        )
    except Exception as e:
        print("Error saving note via API:", e)

# --- TOMBOL: BATAL ---
@bot.message_handler(func=lambda msg: msg.text == MENU_BATAL)
def handle_cancel(message):
    clear_state(message.chat.id)
    bot.send_message(message.chat.id, "Oke, dibatalin. Balik ke menu ya.", reply_markup=main_menu())

# --- TOMBOL: SUDAH ABSEN ---
@bot.message_handler(func=lambda msg: msg.text in [MENU_ABSEN, 'sudah', 'sudah absen', 'udah', 'udah absen'])
def handle_sudah_text(message):
    save_chat_id(message.chat.id)
    try:
        res = requests.get(f"{API_BASE_URL}/api/schedules", timeout=5)
        if res.ok:
            schedules = res.json()
            for s in schedules:
                requests.post(f"{API_BASE_URL}/api/attendance/toggle", json={'schedule_id': s['id']}, timeout=5)
    except Exception as e:
        print("Error updating attendance via API:", e)

    bot.reply_to(message, "✅ *Mantap Nandi! Status absensi kuliah hari ini berhasil diperbarui ke SUDAH ABSEN.* Pengingat otomatis dihentikan!", parse_mode='Markdown', reply_markup=main_menu())

@bot.callback_query_handler(func=lambda call: call.data.startswith("att_done_"))
def handle_att_button(call):
    schedule_id = call.data.replace("att_done_", "")
    try:
        requests.post(f"{API_BASE_URL}/api/attendance/toggle", json={'schedule_id': int(schedule_id)}, timeout=5)
    except Exception as e:
        print("Error toggle attendance button:", e)

    bot.edit_message_text("✅ *Presensi Tercatat! Pengingat otomatis dihentikan.*", chat_id=call.message.chat.id, message_id=call.message.message_id, parse_mode='Markdown')
    bot.answer_callback_query(call.id, text="Absen berhasil dicatat!")

# --- TOMBOL: LIHAT JADWAL KULIAH ---
@bot.message_handler(func=lambda msg: msg.text == MENU_JADWAL)
def handle_list_schedules(message):
    save_chat_id(message.chat.id)
    try:
        res = requests.get(f"{API_BASE_URL}/api/schedules", timeout=5)
        if not res.ok:
            bot.send_message(message.chat.id, "⚠️ Gagal mengambil data jadwal dari server.", reply_markup=main_menu())
            return
        schedules = res.json()
    except Exception as e:
        print("Error fetching schedules via API:", e)
        bot.send_message(message.chat.id, "⚠️ Terjadi kesalahan koneksi ke server backend.", reply_markup=main_menu())
        return

    if not schedules:
        bot.send_message(message.chat.id, "📭 Belum ada jadwal kuliah yang terdaftar di database.", reply_markup=main_menu())
        return

    text = "📅 *DAFTAR JADWAL KULIAH KONTROL ROOM*\n\n"
    for s in schedules:
        status_icon = "✅" if s.get('attendance_status') == 'SUDAH ABSEN' else "⏳"
        text += (
            f"🎓 *{s['course_name']}*\n"
            f"👤 Dosen: {s['lecturer_name']}\n"
            f"🏛️ Ruang: {s['room']}\n"
            f"📆 Hari: {s['day_of_week']} | ⏰ {s['start_time']} - {s['end_time']}\n"
            f"📌 Status Hari Ini: {status_icon} *{s.get('attendance_status', 'BELUM ABSEN')}*\n"
            f"----------------------------------\n"
        )

    bot.send_message(message.chat.id, text, parse_mode='Markdown', reply_markup=main_menu())

# --- TOMBOL: LIHAT TUGAS AKTIF ---
@bot.message_handler(func=lambda msg: msg.text == MENU_TUGAS)
def handle_list_tasks(message):
    save_chat_id(message.chat.id)
    tasks = fetch_active_tasks()

    if not tasks:
        bot.send_message(message.chat.id, "🎉 Gak ada tugas aktif nih, santai dulu!", reply_markup=main_menu())
        return

    bot.send_message(message.chat.id, f"📋 *{len(tasks)} Tugas Aktif:*", parse_mode='Markdown')

    for t in tasks:
        sub_line = ""
        if t.get('subtasks'):
            done = sum(1 for s in t['subtasks'] if s.get('completed'))
            sub_line = f"\n└ Sub-task: {done}/{len(t['subtasks'])} selesai"

        text = f"📌 *{t['title']}*\n🏷️ {t.get('tag') or 'Umum'}   ⏰ {t.get('deadline') or '-'}{sub_line}"

        markup = InlineKeyboardMarkup()
        markup.add(
            InlineKeyboardButton("✅ Selesai", callback_data=f"task_done_{t['id']}"),
            InlineKeyboardButton("📝 Revisi", callback_data=f"note_task_{t['id']}"),
            InlineKeyboardButton("🗑️ Hapus", callback_data=f"task_delete_{t['id']}")
        )
        bot.send_message(message.chat.id, text, parse_mode='Markdown', reply_markup=markup)

@bot.callback_query_handler(func=lambda call: call.data.startswith("task_done_"))
def handle_task_done_button(call):
    task_id = call.data.replace("task_done_", "")
    try:
        requests.post(f"{API_BASE_URL}/api/tasks/status", json={'id': int(task_id), 'status': 'Selesai'}, timeout=5)
    except Exception as e:
        print("Error mark task done:", e)
    bot.edit_message_text("✅ *Tugas ditandai selesai!*", chat_id=call.message.chat.id, message_id=call.message.message_id, parse_mode='Markdown')
    bot.answer_callback_query(call.id, text="Tugas selesai dicatat!")

# --- CALLBACK HANDLER: HAPUS TUGAS ---
@bot.callback_query_handler(func=lambda call: call.data.startswith("task_delete_"))
def handle_task_delete_button(call):
    task_id = call.data.replace("task_delete_", "")
    try:
        res = requests.delete(f"{API_BASE_URL}/api/tasks/{task_id}", timeout=5)
        if res.ok:
            bot.edit_message_text("🗑️ *Tugas berhasil dihapus!*", chat_id=call.message.chat.id, message_id=call.message.message_id, parse_mode='Markdown')
        else:
            bot.answer_callback_query(call.id, text="Gagal menghapus tugas.")
    except Exception as e:
        print("Error deleting task via API:", e)
        bot.answer_callback_query(call.id, text="Terjadi kesalahan jaringan.")

# --- TOMBOL: TAMBAH TUGAS ---
@bot.message_handler(func=lambda msg: msg.text == MENU_TAMBAH_TUGAS)
def handle_add_task_start(message):
    save_chat_id(message.chat.id)
    USER_STATE[message.chat.id] = {'action': 'add_task_title'}
    bot.send_message(message.chat.id, "📌 Ketik *judul tugas*-nya:", parse_mode='Markdown', reply_markup=cancel_menu())

# --- TOMBOL: TAMBAH CATATAN ---
@bot.message_handler(func=lambda msg: msg.text == MENU_CATATAN)
def handle_add_note_start(message):
    save_chat_id(message.chat.id)
    tasks = fetch_active_tasks()

    markup = InlineKeyboardMarkup()
    for t in tasks:
        markup.add(InlineKeyboardButton(f"📌 {t['title']}", callback_data=f"note_task_{t['id']}"))
    markup.add(InlineKeyboardButton("📝 Catatan Umum (bukan buat tugas tertentu)", callback_data="note_general"))

    bot.send_message(message.chat.id, "Catatan ini mau ditaruh di tugas yang mana?", reply_markup=markup)

@bot.callback_query_handler(func=lambda call: call.data.startswith("note_task_") or call.data == "note_general")
def handle_note_pick(call):
    if call.data == "note_general":
        USER_STATE[call.message.chat.id] = {'action': 'add_note_text', 'task_title': ''}
        target_label = "Catatan Umum"
    else:
        task_id = call.data.replace("note_task_", "")
        tasks = fetch_active_tasks()
        selected = next((t for t in tasks if str(t['id']) == str(task_id)), None)
        title = selected['title'] if selected else ''
        USER_STATE[call.message.chat.id] = {'action': 'add_note_text', 'task_title': title}
        target_label = title

    bot.answer_callback_query(call.id)
    bot.send_message(call.message.chat.id, f"📝 Ketik isi catatan/revisi buat *{target_label}*:", parse_mode='Markdown', reply_markup=cancel_menu())

# --- TOMBOL: TANYA AI ---
@bot.message_handler(func=lambda msg: msg.text == MENU_TANYA)
def handle_ask_ai_start(message):
    save_chat_id(message.chat.id)
    if not client:
        bot.send_message(message.chat.id, "⚠️ GEMINI_API_KEY belum diset di .env, fitur ini belum bisa dipakai.", reply_markup=main_menu())
        return
    USER_STATE[message.chat.id] = {'action': 'ask_question'}
    bot.send_message(message.chat.id, "❓ Ketik pertanyaan kamu (soal tugas/catatan yang tersimpan):", reply_markup=cancel_menu())

# --- HANDLER STATEFUL INPUT ---
@bot.message_handler(func=lambda msg: msg.text and USER_STATE.get(msg.chat.id, {}).get('action'))
def handle_stateful_input(message):
    chat_id = message.chat.id
    state = USER_STATE.get(chat_id, {})
    action = state.get('action')
    text = message.text.strip()

    if action == 'add_task_title':
        state['title'] = text
        state['action'] = 'add_task_tag'
        bot.send_message(chat_id, "🏷️ Ketik *tag/mata kuliahnya* (atau kirim '-' kalau gak ada):", parse_mode='Markdown')

    elif action == 'add_task_tag':
        state['tag'] = '' if text == '-' else text
        state['action'] = 'add_task_deadline'
        bot.send_message(chat_id, "⏰ Ketik *deadline* format YYYY-MM-DD (atau kirim '-' kalau belum tau):", parse_mode='Markdown')

    elif action == 'add_task_deadline':
        state['deadline'] = None if text == '-' else text
        state['action'] = 'add_task_description'
        bot.send_message(chat_id, "📄 Terakhir, ketik *deskripsi/catatan tugasnya* (atau kirim '-' buat skip):", parse_mode='Markdown')

    elif action == 'add_task_description':
        description = '' if text == '-' else text
        try:
            requests.post(
                f"{API_BASE_URL}/api/tasks",
                json={
                    'title': state.get('title'),
                    'tag': state.get('tag') or 'Umum',
                    'deadline': state.get('deadline'),
                    'description': description
                },
                timeout=5
            )
        except Exception as e:
            print("Error creating task via API:", e)

        bot.send_message(
            chat_id,
            f"✅ Tugas baru tersimpan!\n\n📌 *{state.get('title')}*\n🏷️ {state.get('tag') or 'Umum'}\n⏰ Deadline: {state.get('deadline') or 'belum ditentukan'}",
            parse_mode='Markdown',
            reply_markup=main_menu()
        )
        clear_state(chat_id)

    elif action == 'add_note_text':
        _save_note(state.get('task_title', ''), text)
        label = f" buat *{state['task_title']}*" if state.get('task_title') else ""
        bot.send_message(chat_id, f"📝 Catatan{label} berhasil disimpan!\n\n\"{text}\"", parse_mode='Markdown', reply_markup=main_menu())
        clear_state(chat_id)

    elif action == 'ask_question':
        bot.send_chat_action(chat_id, 'typing')
        context_text = build_context_text()
        prompt = f"""Kamu asisten pribadi mahasiswa. Berikut data yang kamu punya:

{context_text}

Pertanyaan: {text}

Jawab singkat, jelas, Bahasa Indonesia, berdasarkan data di atas. Kalau infonya gak ada, bilang jujur gak ada, jangan mengarang.
"""
        try:
            response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
            answer = (response.text or '').strip()
            bot.send_message(chat_id, answer or "Aku belum nemu jawabannya, coba tanya ulang ya.", reply_markup=main_menu())
        except Exception as e:
            bot.send_message(chat_id, f"⚠️ Gagal menghubungi AI: {str(e)}", reply_markup=main_menu())
        clear_state(chat_id)

# --- UPLOAD FOTO / DOKUMEN ---
SUPPORTED_DOC_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain']

def process_uploaded_file(message, file_bytes, mime_type):
    if not client:
        bot.reply_to(message, "⚠️ GEMINI_API_KEY belum diset di .env, fitur baca file belum bisa dipakai.")
        return

    bot.send_chat_action(message.chat.id, 'typing')

    prompt = """Kamu asisten belajar mahasiswa. Lihat isi file/gambar ini, lalu tentukan:
1. Kalau isinya MATERI/catatan pembelajaran → ringkas jadi poin-poin penting yang singkat & actionable.
2. Kalau isinya PERTANYAAN/soal → jawab pertanyaannya langsung dengan jelas dan benar.

Balas HANYA dengan JSON (tanpa markdown), format:
{"type": "materi" atau "pertanyaan", "title": "judul singkat 3-6 kata buat catatan ini", "result": "isi ringkasan atau jawaban dalam Bahasa Indonesia"}
"""

    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=[types.Part.from_bytes(data=file_bytes, mime_type=mime_type), prompt]
        )
        raw = (response.text or '').strip().replace('```json', '').replace('```', '').strip()
        data = json.loads(raw)
    except json.JSONDecodeError:
        bot.reply_to(message, "⚠️ AI gagal memproses isi file ini (format respons tidak valid). Coba upload ulang dengan kualitas lebih jelas.")
        return
    except Exception as e:
        bot.reply_to(message, f"⚠️ Gagal menganalisa file: {str(e)}")
        return

    title = (data.get('title') or 'Upload Telegram').strip()
    result = (data.get('result') or '').strip()
    kind = data.get('type', 'materi')

    if not result:
        bot.reply_to(message, "AI gak berhasil menangkap isi filenya, coba upload ulang ya.")
        return

    _save_note(title, result)

    icon = "📖" if kind == 'materi' else "💬"
    label = "Ringkasan Materi" if kind == 'materi' else "Jawaban"
    bot.reply_to(
        message,
        f"{icon} *{label}: {title}*\n\n{result}\n\n_Otomatis tersimpan sebagai insight di dashboard web._",
        parse_mode='Markdown',
        reply_markup=main_menu()
    )

@bot.message_handler(content_types=['photo'])
def handle_photo_upload(message):
    save_chat_id(message.chat.id)
    try:
        file_info = bot.get_file(message.photo[-1].file_id)
        file_bytes = bot.download_file(file_info.file_path)
        process_uploaded_file(message, file_bytes, 'image/jpeg')
    except Exception as e:
        bot.reply_to(message, f"⚠️ Gagal mengambil foto: {str(e)}")

@bot.message_handler(content_types=['document'])
def handle_document_upload(message):
    save_chat_id(message.chat.id)
    mime_type = message.document.mime_type or 'application/octet-stream'

    if mime_type not in SUPPORTED_DOC_MIMES:
        bot.reply_to(message, "Format file ini belum didukung. Coba kirim PDF, gambar (JPG/PNG), atau file teks ya.")
        return

    try:
        file_info = bot.get_file(message.document.file_id)
        file_bytes = bot.download_file(file_info.file_path)
        process_uploaded_file(message, file_bytes, mime_type)
    except Exception as e:
        bot.reply_to(message, f"⚠️ Gagal mengambil file: {str(e)}")

# --- FALLBACK ---
@bot.message_handler(func=lambda msg: True, content_types=['text'])
def handle_fallback(message):
    save_chat_id(message.chat.id)
    bot.send_message(message.chat.id, "Pilih menu di bawah ya 👇", reply_markup=main_menu())

if __name__ == '__main__':
    print("🚀 Bot PCR Connected with API Cloud & Attendance Escalation System...")
    if bot:
        bot.polling(none_stop=True)