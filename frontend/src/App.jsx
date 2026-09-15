import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'https://nandi.pythonanywhere.com';

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [knowledgeBase, setKnowledgeBase] = useState([]);

  const [isAdmin, setIsAdmin] = useState(false);
  const [authToken, setAuthToken] = useState(localStorage.getItem('produser_token') || '');
  const [pinInput, setPinInput] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [activeTab, setActiveTab] = useState('monitor');
  const [calendarFilter, setCalendarFilter] = useState('Semua');

  const [now, setNow] = useState(new Date());

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  // Form State Task
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState('Manajemen Penyiaran');
  const [customTag, setCustomTag] = useState('');
  const [deadline, setDeadline] = useState('');
  const [description, setDescription] = useState('');

  // Form State AI Preview Modal
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiDraftSubtasks, setAiDraftSubtasks] = useState([]);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Form State Upload Insight (file/foto + teks manual -> knowledge_base)
  const [insightFile, setInsightFile] = useState(null);
  const [insightText, setInsightText] = useState('');
  const [insightSource, setInsightSource] = useState('');
  const [isUploadingInsight, setIsUploadingInsight] = useState(false);

  // Pop-up Detail Item (Klik Kalender)
  const [selectedCalendarItem, setSelectedCalendarItem] = useState(null);

  // Form State Schedule (Produser Mode)
  const [courseName, setCourseName] = useState('');
  const [lecturerName, setLecturerName] = useState('');
  const [room, setRoom] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('Rabu');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('09:30');
  const [meetingNo, setMeetingNo] = useState(1);

  useEffect(() => {
    document.body.style.backgroundColor = '#060913';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
  }, []);

  const fetchData = async () => {
    try {
      const [resTasks, resInsights, resSched] = await Promise.all([
        fetch(`${API_BASE_URL}/api/tasks`),
        fetch(`${API_BASE_URL}/api/insights`),
        fetch(`${API_BASE_URL}/api/schedules`)
      ]);
      if (resTasks.ok) setTasks(await resTasks.json());
      if (resInsights.ok) setKnowledgeBase(await resInsights.json());
      if (resSched.ok) setSchedules(await resSched.json());
    } catch (err) {
      console.error("Gagal mengambil data server:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeTasks = tasks.filter(t => t.status !== 'Selesai');
  const nearestTask = activeTasks.length > 0 ? activeTasks[0] : null;

  // Logika Hitung Progress Tugas & Sub-task secara Real-Time
  let totalSubtasks = 0;
  let completedSubtasks = 0;

  tasks.forEach(t => {
    if (t.subtasks && t.subtasks.length > 0) {
      t.subtasks.forEach(st => {
        totalSubtasks++;
        if (st.completed) completedSubtasks++;
      });
    } else {
      totalSubtasks++;
      if (t.status === 'Selesai') completedSubtasks++;
    }
  });

  const progressPercentage = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  const getCountdown = (targetDateStr) => {
    if (!targetDateStr) return null;
    const target = new Date(targetDateStr + 'T23:59:59');
    const diff = target - now;
    if (diff <= 0) return 'AIRTIME EXPIRED';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    const secs = Math.floor((diff / 1000) % 60);
    return `${days}d ${hours}h ${mins}m ${secs}s`;
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleToggleAttendance = async (schedId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule_id: schedId })
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error("Toggle attendance error:", err);
    }
  };

  const handleGenerateAiSubtasks = async () => {
    if (!title) { alert("Isi judul tugas dulu!"); return; }
    setIsGeneratingAi(true);
    try {
      const finalTag = tag === 'CUSTOM' ? customTag : tag;
      const res = await fetch(`${API_BASE_URL}/api/ai/breakdown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ title, description, tag: finalTag, deadline })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setAiDraftSubtasks(data.subtasks);
        setShowAiModal(true);
      } else if (res.status === 401) {
        alert("🔒 Sesi Produser sudah habis, login ulang ya.");
        setIsAdmin(false);
      } else {
        alert(`⚠️ AI gagal bikin breakdown: ${data.error || 'Error tidak diketahui'}`);
      }
    } catch (err) {
      alert("Gagal menghubungi server AI. Cek koneksi backend.");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleUploadInsight = async () => {
    if (!insightFile && !insightText.trim()) {
      alert("Isi minimal salah satu: pilih file/foto, atau ketik catatan manual.");
      return;
    }
    setIsUploadingInsight(true);
    try {
      const formData = new FormData();
      if (insightFile) formData.append('file', insightFile);
      if (insightText.trim()) formData.append('text', insightText.trim());
      if (insightSource.trim()) formData.append('source', insightSource.trim());

      const res = await fetch(`${API_BASE_URL}/api/insights/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData
      });
      const data = await res.json();

      if (res.ok && data.success) {
        alert(`✅ ${data.entries.length} insight berhasil disimpan!`);
        setInsightFile(null);
        setInsightText('');
        setInsightSource('');
        document.getElementById('insightFileInput').value = '';
        fetchData();
      } else if (res.status === 401) {
        alert("🔒 Sesi Produser sudah habis, login ulang ya.");
        setIsAdmin(false);
      } else {
        alert(`⚠️ Gagal simpan insight: ${data.error || 'Error tidak diketahui'}`);
      }
    } catch (err) {
      alert("Gagal menghubungi server. Cek koneksi backend.");
    } finally {
      setIsUploadingInsight(false);
    }
  };

  const handleAddCustomSubtask = () => {
    setAiDraftSubtasks([
      ...aiDraftSubtasks,
      { title: '', deadline: deadline || '2026-09-20' }
    ]);
  };

  const handleRemoveSubtask = (index) => {
    const updated = aiDraftSubtasks.filter((_, idx) => idx !== index);
    setAiDraftSubtasks(updated);
  };

  const handleSaveTaskPermanent = async () => {
    const finalTag = tag === 'CUSTOM' ? customTag : tag;
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ title, tag: finalTag, deadline, description, subtasks: aiDraftSubtasks })
      });
      if (res.ok) {
        alert("✅ Tugas & Breakdown Berhasil Disimpan!");
        setTitle(''); setCustomTag(''); setDescription(''); setDeadline(''); setShowAiModal(false);
        fetchData();
      } else if (res.status === 401) {
        alert("🔒 Sesi Produser sudah habis, login ulang ya.");
        setIsAdmin(false);
      }
    } catch (err) { alert("Gagal menyimpan tugas."); }
  };

  const handleCompleteTaskFromModal = async (taskId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: 'Selesai' })
      });
      if (res.ok) {
        alert("🎉 Tugas Berhasil Ditandai Selesai!");
        setSelectedCalendarItem(null);
        fetchData();
      } else {
        alert("Gagal memperbarui tugas.");
      }
    } catch (err) {
      alert("Gagal menghubungi server.");
    }
  };

  const handleToggleSubtaskFromModal = async (subtaskId, currentCompleted) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/subtasks/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: subtaskId, completed: !currentCompleted })
      });
      if (res.ok) {
        setSelectedCalendarItem(null);
        fetchData();
      } else {
        alert("Gagal memperbarui sub-task.");
      }
    } catch (err) {
      alert("Gagal menghubungi server.");
    }
  };

  const handleClearAllData = async () => {
    if (!window.confirm("⚠️ PERINGATAN PRODUSER: Apakah kamu yakin ingin MENGHAPUS SELURUH DATA (Semua Tugas & Semua Jadwal Kuliah) dari database SQLite?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/data/clear-all`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        alert("🗑️ Seluruh Data Berhasil Dibersihkan!");
        fetchData();
      } else if (res.status === 401) {
        alert("🔒 Sesi Produser sudah habis, login ulang ya.");
        setIsAdmin(false);
      }
    } catch (err) {
      alert("Gagal menghapus seluruh data.");
    }
  };

  const handleAddSchedule = async (e) => {
    e.preventDefault();
    if (!courseName || !lecturerName || !room) { alert("Semua field jadwal wajib diisi!"); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/api/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ course_name: courseName, lecturer_name: lecturerName, room, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime, meeting_no: parseInt(meetingNo) })
      });
      if (res.ok) {
        alert("✅ Jadwal Kuliah Berhasil Disimpan!");
        setCourseName(''); setLecturerName(''); setRoom('');
        fetchData();
      } else if (res.status === 401) {
        alert("🔒 Sesi Produser sudah habis, login ulang ya.");
        setIsAdmin(false);
      }
    } catch (err) { console.error("Error add schedule:", err); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAdmin(true);
        setAuthToken(data.token);
        localStorage.setItem('produser_token', data.token);
        setShowPinModal(false); setPinInput(''); setActiveTab('input');
      } else { alert('🔒 PIN Salah!'); }
    } catch (err) { alert('Gagal menghubungi server auth.'); }
  };

  const nextClass = schedules.length > 0 ? schedules[0] : null;

  const monthNames = [
    "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
    "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"
  ];
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;

  return (
    <div style={{ backgroundColor: '#060913', color: '#f8fafc', minHeight: '100vh', padding: '1.2rem', fontFamily: 'sans-serif', boxSizing: 'border-box' }}>
      
      {/* HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.8rem' }}>
        <div>
          <h1 style={{ margin: 0, color: '#ec4899', fontSize: '1.8rem', fontWeight: '800' }}>ROAD TO S.I.Kom</h1>
          <p style={{ margin: 0, color: '#38bdf8', fontSize: '0.8rem', fontWeight: '700' }}>JURNAL PINTAR & CONTROL ROOM</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          {isAdmin && (
            <div style={{ backgroundColor: '#0f172a', padding: '0.2rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button onClick={() => setActiveTab('monitor')} style={{ backgroundColor: activeTab === 'monitor' ? '#ec4899' : 'transparent', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Monitor</button>
              <button onClick={() => setActiveTab('input')} style={{ backgroundColor: activeTab === 'input' ? '#ec4899' : 'transparent', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Input & Produser</button>
            </div>
          )}
          <button onClick={() => isAdmin ? setIsAdmin(false) : setShowPinModal(true)} style={{ backgroundColor: isAdmin ? 'rgba(21,128,61,0.3)' : '#0f172a', color: isAdmin ? '#4ade80' : '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem 1rem', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}>
            {isAdmin ? "🔓 PRODUSER" : "🔒 PUBLIC"}
          </button>
        </div>
      </header>

      {/* AIRTIME TICKER BAR */}
      <div style={{ backgroundColor: '#0f172a', border: '1px solid #eab308', borderRadius: '12px', padding: '0.8rem 1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <span style={{ backgroundColor: '#eab308', color: '#000', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: '900', fontSize: '0.85rem' }}>⚠️ AIRTIME WARNING</span>
          <span style={{ color: '#facc15', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1.1rem' }}>{now.toLocaleTimeString('id-ID')} WIB</span>
        </div>
        <div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>COUNTDOWN TARGET: {nearestTask ? nearestTask.title.toUpperCase() : 'NO TARGET'}</span>
          <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#ec4899', fontFamily: 'monospace' }}>⏱️ {nearestTask ? getCountdown(nearestTask.deadline) : '--:--:--'}</span>
        </div>
      </div>

      {/* WIDGET KELAS & MINI CARDS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        
        {/* Card Utama Kelas Berikutnya */}
        <div style={{ backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: '16px', display: 'flex', overflow: 'hidden', border: '1px solid #0284c7', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', flexWrap: 'wrap' }}>
          <div style={{ backgroundColor: '#0284c7', color: '#ffffff', padding: '1.2rem 1.8rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: '160px' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>KELAS BERIKUTNYA</span>
            <span style={{ fontSize: '1.3rem', fontWeight: '900', marginTop: '0.2rem' }}>Besok, pukul {nextClass ? nextClass.start_time : '07:00'}</span>
          </div>
          <div style={{ padding: '1.2rem 1.8rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: '#38bdf8' }}>{nextClass ? nextClass.course_name : 'Metode Penelitian Komunikasi Kuantitatif'}</h2>
            <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: '#94a3b8', fontWeight: '600' }}>
              <span style={{ backgroundColor: 'rgba(2,132,199,0.2)', color: '#38bdf8', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: 'bold' }}>{nextClass ? `${nextClass.start_time} – ${nextClass.end_time}` : '07:00 – 09:30'}</span>
              <span>{nextClass ? nextClass.room : 'Ruang R616 (H) Jakarta'}</span>
              <span>• Pertemuan ke-{nextClass ? nextClass.meeting_no : 1}</span>
              <span>• {nextClass ? nextClass.day_of_week : 'Rabu'}, {now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* 3 Mini Cards (Card 2 diubah jadi Progress Tugas) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div style={{ backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: '14px', padding: '1rem', textAlign: 'center', border: '1px solid #8b5cf6' }}>
            <h3 style={{ margin: 0, fontSize: '1.8rem', color: '#a78bfa', fontWeight: '900' }}>{schedules.length}</h3>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' }}>KELAS PER PEKAN</span>
          </div>

          <div style={{ backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: '14px', padding: '1rem', textAlign: 'center', border: '1px solid #22c55e' }}>
            <h3 style={{ margin: 0, fontSize: '1.8rem', color: '#4ade80', fontWeight: '900' }}>{progressPercentage}%</h3>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' }}>PROGRESS TUGAS</span>
            <div style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 'bold', marginTop: '0.2rem' }}>{completedSubtasks} dari {totalSubtasks} selesai</div>
          </div>

          <div style={{ backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: '14px', padding: '1rem', textAlign: 'center', border: nextClass?.attendance_status === 'SUDAH ABSEN' ? '1px solid #22c55e' : '1px solid #f97316', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' }}>STATUS ABSENSI</span>
            <h4 style={{ margin: '0.2rem 0', color: nextClass?.attendance_status === 'SUDAH ABSEN' ? '#4ade80' : '#fb923c', fontSize: '1rem', fontWeight: '900' }}>
              {nextClass?.attendance_status === 'SUDAH ABSEN' ? '✅ SUDAH ABSEN' : '⚠️ BELUM ABSEN'}
            </h4>
            {nextClass && (
              <button onClick={() => handleToggleAttendance(nextClass.id)} style={{ backgroundColor: nextClass.attendance_status === 'SUDAH ABSEN' ? '#334155' : '#ea580c', color: '#fff', border: 'none', padding: '0.3rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '0.3rem' }}>
                {nextClass.attendance_status === 'SUDAH ABSEN' ? '↩ Batalkan' : '⚡ 1-Klik Sudah Absen'}
              </button>
            )}
          </div>
        </div>

      </div>

      {/* KALENDER GRID INTERAKTIF DENGAN SUBTASK & KELAS */}
      {activeTab === 'monitor' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', backgroundColor: '#0f172a', padding: '0.3rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
              {['Semua', 'Mingguan', 'Bulanan'].map(f => (
                <button key={f} onClick={() => setCalendarFilter(f)} style={{ backgroundColor: calendarFilter === f ? '#ec4899' : 'transparent', color: calendarFilter === f ? '#fff' : '#94a3b8', border: 'none', padding: '0.3rem 0.9rem', borderRadius: '15px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>{f}</button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button onClick={handlePrevMonth} style={{ backgroundColor: '#1e293b', color: '#ec4899', border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>‹</button>
              <h3 style={{ margin: 0, color: '#ec4899', fontSize: '1.1rem', fontWeight: '800', letterSpacing: '1px' }}>
                {monthNames[currentMonth]} {currentYear}
              </h3>
              <button onClick={handleNextMonth} style={{ backgroundColor: '#1e293b', color: '#ec4899', border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>›</button>
            </div>
          </div>

          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(236, 72, 153, 0.3)', borderRadius: '16px', padding: '1rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center', marginBottom: '8px', minWidth: '320px' }}>
              {['SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB', 'MING'].map(d => (
                <div key={d} style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold' }}>{d}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', minWidth: '320px' }}>
              {Array.from({ length: firstDayIndex }).map((_, i) => (
                <div key={`empty-${i}`} style={{ minHeight: '65px', borderRadius: '8px', backgroundColor: 'rgba(15, 23, 42, 0.2)' }} />
              ))}

              {Array.from({ length: daysInMonth }, (_, i) => {
                const dayNum = i + 1;
                const mStr = (currentMonth + 1) < 10 ? `0${currentMonth + 1}` : `${currentMonth + 1}`;
                const dStr = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
                const dateStr = `${currentYear}-${mStr}-${dStr}`;

                const matchedTasks = tasks.filter(t => t.deadline === dateStr);
                
                const matchedSubtasks = [];
                tasks.forEach(t => {
                  if (t.subtasks) {
                    t.subtasks.forEach(st => {
                      if (st.deadline === dateStr) {
                        matchedSubtasks.push({ ...st, parentTaskTitle: t.title, parentTaskId: t.id });
                      }
                    });
                  }
                });

                const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                const currentDayName = dayNames[new Date(currentYear, currentMonth, dayNum).getDay()];
                const matchedSchedules = schedules.filter(s => s.day_of_week === currentDayName);

                return (
                  <div key={dayNum} style={{ minHeight: '65px', padding: '6px', borderRadius: '8px', backgroundColor: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold' }}>{dayNum}</span>
                    
                    {matchedSchedules.map((s, idx) => (
                      <div key={`sc-${idx}`} onClick={() => setSelectedCalendarItem({ type: 'SCHEDULE', data: s })} style={{ backgroundColor: '#0284c7', color: '#fff', fontSize: '0.55rem', padding: '2px 4px', borderRadius: '3px', marginTop: '2px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        🎓 {s.course_name}
                      </div>
                    ))}

                    {matchedTasks.map((t, idx) => (
                      <div key={`mt-${idx}`} onClick={() => setSelectedCalendarItem({ type: 'TASK', data: t })} style={{ backgroundColor: '#ec4899', color: '#fff', fontSize: '0.55rem', padding: '2px 4px', borderRadius: '3px', marginTop: '2px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        📌 {t.title}
                      </div>
                    ))}

                    {matchedSubtasks.map((st, idx) => (
                      <div key={`st-${idx}`} onClick={() => setSelectedCalendarItem({ type: 'SUBTASK', data: st })} style={{ backgroundColor: '#9333ea', color: '#fff', fontSize: '0.52rem', padding: '2px 4px', borderRadius: '3px', marginTop: '2px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        🔹 {st.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* LIST MONITOR TUGAS */}
          <div style={{ backgroundColor: '#0f172a', padding: '1.2rem', borderRadius: '16px' }}>
            <h3 style={{ color: '#ec4899', marginTop: 0 }}>🎯 TASK & DEADLINE MONITOR (LIVE SQLITE)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {tasks.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Belum ada tugas terdaftar di database.</p>
              ) : (
                tasks.map(t => (
                  <div key={t.id} onClick={() => setSelectedCalendarItem({ type: 'TASK', data: t })} style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap', gap: '0.5rem', cursor: 'pointer' }}>
                    <div>
                      <h4 style={{ margin: 0, color: '#f8fafc' }}>{t.title}</h4>
                      <span style={{ fontSize: '0.75rem', color: '#38bdf8' }}>🏷️ {t.tag} • ⏰ Deadline: {t.deadline}</span>
                    </div>
                    <span style={{ backgroundColor: t.status === 'Selesai' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)', color: t.status === 'Selesai' ? '#4ade80' : '#facc15', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>{t.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* KNOWLEDGE BASE / INSIGHTS PANEL */}
          <div style={{ backgroundColor: '#0f172a', padding: '1.2rem', borderRadius: '16px', marginTop: '1.5rem', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
            <h3 style={{ color: '#a78bfa', marginTop: 0 }}>🧠 KNOWLEDGE BASE & INSIGHTS</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {knowledgeBase.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Belum ada catatan/insight tersimpan.</p>
              ) : (
                knowledgeBase.map((kb, idx) => (
                  <div key={idx} style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {kb.source && (
                      <span style={{ fontSize: '0.7rem', color: '#a78bfa', fontWeight: 'bold', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                        📌 {kb.source}
                      </span>
                    )}
                    <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{kb.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* PRODUSER MODE FORMS */}
      {activeTab === 'input' && isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
          
          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)', border: '1px solid #ec4899', borderRadius: '16px', padding: '1.2rem' }}>
            <h3 style={{ color: '#ec4899', marginTop: 0 }}>📌 PRODUSER MODE: Input Tugas & Breakdown AI</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem' }}>
              <input type="text" placeholder="Judul Tugas" value={title} onChange={e=>setTitle(e.target.value)} style={{ padding: '0.6rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px' }} />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <select value={tag} onChange={e=>setTag(e.target.value)} style={{ padding: '0.6rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px' }}>
                  <option value="Manajemen Penyiaran">Manajemen Penyiaran</option>
                  <option value="Komunikasi Politik">Komunikasi Politik</option>
                  <option value="Main Control Room">Main Control Room</option>
                  <option value="Metode Penelitian Komunikasi Kuantitatif">Metode Penelitian Komunikasi Kuantitatif</option>
                  <option value="Kewirausahaan 1">Kewirausahaan 1</option>
                  <option value="Sistem Siaran TV dan Radio">Sistem Siaran TV dan Radio</option>
                  <option value="CUSTOM">+ Tambah Matkul Custom...</option>
                </select>
                {tag === 'CUSTOM' && (
                  <input type="text" placeholder="Ketik Nama Matkul Custom..." value={customTag} onChange={e=>setCustomTag(e.target.value)} style={{ padding: '0.5rem', backgroundColor: '#0f172a', border: '1px solid #ec4899', color: '#fff', borderRadius: '6px', fontSize: '0.85rem' }} />
                )}
              </div>

              <input type="date" value={deadline} onChange={e=>setDeadline(e.target.value)} style={{ padding: '0.6rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px' }} />
            </div>
            
            <textarea placeholder="Deskripsi Tugas / Catatan Khusus" value={description} onChange={e=>setDescription(e.target.value)} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px', marginTop: '0.8rem', boxSizing: 'border-box' }} />
            
            <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.8rem' }}>
              <button onClick={handleGenerateAiSubtasks} style={{ backgroundColor: '#ec4899', color: '#fff', border: 'none', padding: '0.7rem 1.2rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                {isGeneratingAi ? "⏳ AI Sedang Menyusun Breakdown..." : "⚡ Minta AI Buat Breakdown (Tahap 1)"}
              </button>
            </div>
          </div>

          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)', border: '1px solid #38bdf8', borderRadius: '16px', padding: '1.2rem' }}>
            <h3 style={{ color: '#38bdf8', marginTop: 0 }}>📅 PRODUSER MODE: Input Jadwal Kuliah Utama</h3>
            <form onSubmit={handleAddSchedule} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem' }}>
              <input type="text" placeholder="Nama Mata Kuliah" value={courseName} onChange={e=>setCourseName(e.target.value)} style={{ padding: '0.6rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px' }} />
              <input type="text" placeholder="Nama Dosen" value={lecturerName} onChange={e=>setLecturerName(e.target.value)} style={{ padding: '0.6rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px' }} />
              <input type="text" placeholder="Ruangan / Platform" value={room} onChange={e=>setRoom(e.target.value)} style={{ padding: '0.6rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px' }} />
              <select value={dayOfWeek} onChange={e=>setDayOfWeek(e.target.value)} style={{ padding: '0.6rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px' }}>
                <option value="Senin">Senin</option><option value="Selasa">Selasa</option><option value="Rabu">Rabu</option><option value="Kamis">Kamis</option><option value="Jumat">Jumat</option><option value="Sabtu">Sabtu</option>
              </select>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} style={{ flex: 1, padding: '0.5rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} />
                <input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} style={{ flex: 1, padding: '0.5rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} />
              </div>
              <button type="submit" style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '0.7rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>💾 Simpan Jadwal Perkuliahan</button>
            </form>
          </div>

          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)', border: '1px solid #a78bfa', borderRadius: '16px', padding: '1.2rem' }}>
            <h3 style={{ color: '#a78bfa', marginTop: 0 }}>🧠 PRODUSER MODE: Tambah Insight / Materi</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0 0 0.8rem 0' }}>
              Upload foto/file materi (AI otomatis rangkum atau jawab kalau isinya soal), dan/atau ketik catatan manual. Semua masuk ke Knowledge Base yang sama dipakai bot Telegram.
            </p>
            <div style={{ display: 'grid', gap: '0.8rem' }}>
              <input
                id="insightFileInput"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.txt"
                onChange={e => setInsightFile(e.target.files[0] || null)}
                style={{ padding: '0.5rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px' }}
              />
              <input
                type="text"
                placeholder="Label/Sumber (opsional, misal: 'Metode Penelitian')"
                value={insightSource}
                onChange={e => setInsightSource(e.target.value)}
                style={{ padding: '0.6rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px' }}
              />
              <textarea
                placeholder="Atau ketik catatan/jawaban manual di sini (opsional, gak wajib upload file)..."
                value={insightText}
                onChange={e => setInsightText(e.target.value)}
                rows={3}
                style={{ padding: '0.6rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px', resize: 'vertical' }}
              />
              <button onClick={handleUploadInsight} disabled={isUploadingInsight} style={{ backgroundColor: '#8b5cf6', color: '#fff', border: 'none', padding: '0.7rem', borderRadius: '8px', fontWeight: 'bold', cursor: isUploadingInsight ? 'not-allowed' : 'pointer', opacity: isUploadingInsight ? 0.6 : 1 }}>
                {isUploadingInsight ? '⏳ Memproses...' : '📤 Simpan ke Knowledge Base'}
              </button>
            </div>
          </div>

          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '16px', padding: '1.2rem' }}>
            <h4 style={{ color: '#ef4444', marginTop: 0, margin: '0 0 0.5rem 0' }}>⚠️ SYSTEM RESET CONTROL</h4>
            <button onClick={handleClearAllData} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '0.7rem 1.2rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              🗑️ Hapus Seluruh Data (Tugas & Kuliah)
            </button>
          </div>

        </div>
      )}

      {/* MODAL AI SUBTASKS */}
      {showAiModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '16px', border: '1px solid #ec4899', width: '100%', maxWidth: '460px', boxSizing: 'border-box' }}>
            <h3 style={{ color: '#ec4899', marginTop: 0 }}>🤖 Draf Sub-Task AI</h3>
            
            {aiDraftSubtasks.map((st, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.8rem' }}>
                <div style={{ flex: 1 }}>
                  <input type="text" value={st.title} onChange={e => { const updated = [...aiDraftSubtasks]; updated[idx].title = e.target.value; setAiDraftSubtasks(updated); }} style={{ width: '100%', padding: '0.4rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px', marginBottom: '0.2rem', boxSizing: 'border-box' }} />
                  <input type="date" value={st.deadline} onChange={e => { const updated = [...aiDraftSubtasks]; updated[idx].deadline = e.target.value; setAiDraftSubtasks(updated); }} style={{ padding: '0.4rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} />
                </div>
                <button onClick={() => handleRemoveSubtask(idx)} style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid #ef4444', padding: '0.4rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>❌</button>
              </div>
            ))}

            <button onClick={handleAddCustomSubtask} style={{ backgroundColor: '#334155', color: '#38bdf8', border: '1px dashed #38bdf8', width: '100%', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '1rem' }}>
              ➕ Tambah Sub-task Manual
            </button>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleSaveTaskPermanent} style={{ flex: 1, backgroundColor: '#ec4899', color: '#fff', border: 'none', padding: '0.6rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>💾 Simpan Permanen ke SQLite</button>
              <button onClick={() => setShowAiModal(false)} style={{ backgroundColor: '#334155', color: '#fff', border: 'none', padding: '0.6rem', borderRadius: '8px', cursor: 'pointer' }}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL POP-UP DETAIL ITEM KALENDER */}
      {selectedCalendarItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '16px', border: selectedCalendarItem.type === 'TASK' ? '1px solid #ec4899' : '1px solid #0284c7', width: '100%', maxWidth: '380px', boxSizing: 'border-box' }}>
            
            {selectedCalendarItem.type === 'TASK' ? (
              <>
                <h3 style={{ color: '#ec4899', marginTop: 0 }}>📌 DETAIL TUGAS</h3>
                <h4 style={{ color: '#fff', margin: '0.4rem 0' }}>{selectedCalendarItem.data.title}</h4>
                <p style={{ color: '#38bdf8', fontSize: '0.85rem', margin: '0.2rem 0' }}>🏷️ Matkul: {selectedCalendarItem.data.tag}</p>
                <p style={{ color: '#fb923c', fontSize: '0.85rem', margin: '0.2rem 0' }}>⏰ Deadline: {selectedCalendarItem.data.deadline}</p>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.5rem 0 1rem 0' }}>📝 Catatan: {selectedCalendarItem.data.description || 'Tidak ada catatan.'}</p>
                
                {selectedCalendarItem.data.status !== 'Selesai' && (
                  <button onClick={() => handleCompleteTaskFromModal(selectedCalendarItem.data.id)} style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '0.6rem', borderRadius: '8px', width: '100%', fontWeight: 'bold', cursor: 'pointer', marginBottom: '0.5rem' }}>
                    ✅ Tandai Tugas Selesai
                  </button>
                )}
              </>
            ) : selectedCalendarItem.type === 'SUBTASK' ? (
              <>
                <h3 style={{ color: '#9333ea', marginTop: 0 }}>🔹 DETAIL SUB-TASK</h3>
                <h4 style={{ color: '#fff', margin: '0.4rem 0' }}>{selectedCalendarItem.data.title}</h4>
                <p style={{ color: '#ec4899', fontSize: '0.85rem', margin: '0.2rem 0' }}>📌 Tugas Utama: {selectedCalendarItem.data.parentTaskTitle}</p>
                <p style={{ color: '#fb923c', fontSize: '0.85rem', margin: '0.2rem 0 1rem 0' }}>⏰ Deadline Sub-task: {selectedCalendarItem.data.deadline}</p>

                <button onClick={() => handleToggleSubtaskFromModal(selectedCalendarItem.data.id, selectedCalendarItem.data.completed)} style={{ backgroundColor: selectedCalendarItem.data.completed ? '#334155' : '#22c55e', color: '#fff', border: 'none', padding: '0.6rem', borderRadius: '8px', width: '100%', fontWeight: 'bold', cursor: 'pointer', marginBottom: '0.5rem' }}>
                  {selectedCalendarItem.data.completed ? '↩️ Batalkan Tanda Selesai' : '✅ Tandai Sub-task Selesai'}
                </button>
              </>
            ) : (
              <>
                <h3 style={{ color: '#0284c7', marginTop: 0 }}>🎓 DETAIL JADWAL KULIAH</h3>
                <h4 style={{ color: '#fff', margin: '0.4rem 0' }}>{selectedCalendarItem.data.course_name}</h4>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.2rem 0' }}>👨‍🏫 Dosen: {selectedCalendarItem.data.lecturer_name}</p>
                <p style={{ color: '#38bdf8', fontSize: '0.85rem', margin: '0.2rem 0' }}>🏛️ Ruangan: {selectedCalendarItem.data.room}</p>
                <p style={{ color: '#4ade80', fontSize: '0.85rem', margin: '0.2rem 0' }}>⏰ Waktu: {selectedCalendarItem.data.day_of_week}, {selectedCalendarItem.data.start_time} – {selectedCalendarItem.data.end_time}</p>
              </>
            )}

            <button onClick={() => setSelectedCalendarItem(null)} style={{ backgroundColor: '#334155', color: '#fff', border: 'none', padding: '0.5rem', borderRadius: '8px', width: '100%', cursor: 'pointer', marginTop: '0.5rem' }}>Tutup</button>
          </div>
        </div>
      )}

      {/* MODAL PIN LOGIN */}
      {showPinModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <form onSubmit={handleLogin} style={{ backgroundColor: '#0f172a', padding: '1.8rem', borderRadius: '16px', border: '1px solid #ec4899', textTransform: 'none', width: '280px' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#ec4899', textAlign: 'center' }}>🔑 PIN Produser</h3>
            <input type="password" placeholder="PIN" value={pinInput} onChange={(e) => setPinInput(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff', textAlign: 'center', marginBottom: '1rem', fontSize: '1.1rem', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" style={{ flex: 1, backgroundColor: '#ec4899', color: '#fff', border: 'none', padding: '0.6rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Buka</button>
              <button type="button" onClick={() => setShowPinModal(false)} style={{ flex: 1, backgroundColor: '#334155', color: '#fff', border: 'none', padding: '0.6rem', borderRadius: '8px', cursor: 'pointer' }}>Batal</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}