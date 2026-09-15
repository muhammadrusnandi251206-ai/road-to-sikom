"""
Jalanin ini sekali aja buat cek model apa aja yang bisa diakses
sama GEMINI_API_KEY kamu. Taruh file ini di folder bot/ (sejajar server.py)
biar bisa baca .env yang sama, lalu jalanin:

    python list_gemini_models.py
"""
import os
from google import genai
from dotenv import load_dotenv

load_dotenv(dotenv_path='../.env')
GEMINI_KEY = os.getenv('GEMINI_API_KEY')

if not GEMINI_KEY:
    print("❌ GEMINI_API_KEY tidak ditemukan di .env")
    exit(1)

client = genai.Client(api_key=GEMINI_KEY)

print("📋 Model yang tersedia untuk API key kamu:\n")
for m in client.models.list():
    # generate_content itu action yang kita pakai di server.py,
    # jadi filter yang support itu aja biar gak nampilin model lain (embedding dll)
    actions = getattr(m, 'supported_actions', None) or []
    if not actions or 'generateContent' in actions:
        print(f"- {m.name}")