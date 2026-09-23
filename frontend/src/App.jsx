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
  
  // NAVBAR 6 TAB STATE
  const [activeTab, setActiveTab] = useState('dashboard');
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

  // --- UNIFIED WORKSPACE STATE ---
  const [workspaceMode, setWorkspaceMode] = useState('notes');
  
  // Sub-state: Ketik Catatan Lisan
  const [noteCourse, setNoteCourse] = useState('');
  const [noteMeetingNo, setNoteMeetingNo] = useState(1);
  const [rawNotesInput, setRawNotesInput] = useState('');
  const [visualNotesOutput, setVisualNotesOutput] = useState('');
  const [isFormattingNotes, setIsFormattingNotes] = useState(false);

  // Sub-state: Upload File Materi
  const [fileCourse, setFileCourse] = useState('');
  const [fileMeetingNo, setFileMeetingNo] = useState(1);
  const [workspaceFile, setWorkspaceFile] = useState(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [fileExtractionResult, setFileExtractionResult] = useState('');

  const [isInitialCourseLoaded, setIsInitialCourseLoaded] = useState(false);
  const [libraryCourseFilter, setLibraryCourseFilter] = useState('SEMUA');

  // Pop-up Detail Item (Klik Kalender)
  const [selectedCalendarItem, setSelectedCalendarItem] = useState(null);

  // Pop-up Kontrol Absensi Interaktif
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);

  // Form State Schedule
  const [courseName, setCourseName] = useState('');
  const [lecturerName, setLecturerName] = useState('');
  const [room, setRoom] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('Rabu');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('09:30');
  const [meetingNo, setMeetingNo] = useState(1);

  // --- ACADEMIC ARCADE ENGINE STATES ---
  const [arcadeCourse, setArcadeCourse] = useState('');
  const [arcadeMeeting, setArcadeMeeting] = useState('1');
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizData, setQuizData] = useState(null);
  const [arcadeStep, setArcadeStep] = useState(1);
  const [userQuizAnswers, setUserQuizAnswers] = useState({});
  const [userSparringAnswer, setUserSparringAnswer] = useState('');
  const [isEvaluatingSparring, setIsEvaluatingSparring] = useState(false);
  const [sparringEvaluation, setSparringEvaluation] = useState(null);

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
      if (resSched.ok) {
        const schedData = await resSched.json();
        setSchedules(schedData);
        if (schedData.length > 0 && !isInitialCourseLoaded) {
          setNoteCourse(schedData[0].course_name);
          setFileCourse(schedData[0].course_name);
          setArcadeCourse(schedData[0].course_name);
          setIsInitialCourseLoaded(true);
        }
      }
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
  }, [isInitialCourseLoaded]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- HANDLER ACADEMIC ARCADE ---
  const handleStartArcadeQuiz = async () => {
    if (!arcadeCourse) { alert("Pilih Mata Kuliah terlebih dahulu!"); return; }
    setIsGeneratingQuiz(true);
    setQuizData(null);
    setArcadeStep(1);
    setUserQuizAnswers({});
    setUserSparringAnswer('');
    setSparringEvaluation(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/arcade/generate-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_name: arcadeCourse, meeting_no: arcadeMeeting })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setQuizData(data.data);
      } else {
        alert(`⚠️ ${data.error || 'Gagal menyusun kuis.'}`);
      }
    } catch (err) {
      alert("Gagal menghubungi server Arcade.");
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleSelectQuizOption = (questionId, optionIdx) => {
    setUserQuizAnswers(prev => ({ ...prev, [questionId]: optionIdx }));
  };

  const handleSubmitSparring = async () => {
    if (!userSparringAnswer.trim()) { alert("Ketik jawaban studi kasusmu dulu!"); return; }
    setIsEvaluatingSparring(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/arcade/evaluate-sparring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: quizData.fase3_sparring_question,
          user_answer: userSparringAnswer
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSparringEvaluation(data.evaluation);
        setArcadeStep(4);
      } else {
        alert(`⚠️ ${data.error || 'Gagal mengevaluasi jawaban.'}`);
      }
    } catch (err) {
      alert("Gagal menghubungi server evaluasi.");
    } finally {
      setIsEvaluatingSparring(false);
    }
  };

  const calculateQuizScore = () => {
    if (!quizData || !quizData.fase2_quiz) return 0;
    let correctCount = 0;
    quizData.fase2_quiz.forEach(q => {
      if (userQuizAnswers[q.id] === q.correct_index) correctCount++;
    });
    return Math.round((correctCount / quizData.fase2_quiz.length) * 100);
  };

  // --- SAKELAR LIBUR & SWITCHER PEKAN ---
  const handleToggleCancelCourse = async (scheduleId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/schedules/toggle-cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ schedule_id: scheduleId })
      });
      if (res.ok) {
        fetchData();
      } else if (res.status === 401) {
        alert("🔒 Sesi Produser habis, silakan login lagi.");
        setIsAdmin(false);
      }
    } catch (err) {
      alert("Gagal mengubah sakelar libur.");
    }
  };

  const handleSetWeekType = async (type) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings/week-type`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ week_type: type })
      });
      if (res.ok) {
        fetchData();
      } else if (res.status === 401) {
        alert("🔒 Sesi Produser habis, silakan login lagi.");
        setIsAdmin(false);
      }
    } catch (err) {
      alert("Gagal memperbarui mode pekan.");
    }
  };

  // --- PARSER RENDER CLEAN FORMATTING BAGAN VISUAL AI ---
  const renderFormattedNotes = (text) => {
    if (!text) return null;
    const lines = text.split('\n');

    return lines.map((line, index) => {
      let trimmed = line.trim();
      if (!trimmed) return <div key={index} style={{ height: '8px' }} />;

      if (trimmed === '---') {
        return <hr key={index} style={{ border: 'none', borderTop: '1px solid #ec4899', margin: '1rem 0', opacity: 0.5 }} />;
      }

      const isHeader = trimmed.startsWith('#');
      if (isHeader) {
        const cleanHeader = trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, '');
        return (
          <h4 key={index} style={{ color: '#ec4899', fontSize: '1.05rem', fontWeight: '800', margin: '0.8rem 0 0.4rem 0', letterSpacing: '0.5px' }}>
            📌 {cleanHeader}
          </h4>
        );
      }

      if (trimmed.startsWith('*') && trimmed.endsWith('*') && !trimmed.startsWith('* ')) {
        const cleanSub = trimmed.replace(/^\*|\*$/g, '');
        return (
          <p key={index} style={{ color: '#38bdf8', fontStyle: 'italic', margin: '0 0 0.8rem 0', fontSize: '0.85rem' }}>
            {cleanSub}
          </p>
        );
      }

      const isBullet = trimmed.startsWith('* ') || trimmed.startsWith('- ');
      if (isBullet) {
        let content = trimmed.replace(/^[*|-]\s*/, '');
        const parts = content.split(/(\*\*.*?\*\*)/g);

        return (
          <div key={index} style={{ display: 'flex', gap: '0.5rem', marginLeft: '0.5rem', marginBottom: '0.4rem', fontSize: '0.88rem', color: '#cbd5e1' }}>
            <span style={{ color: '#4ade80' }}>⚡</span>
            <div>
              {parts.map((part, pIdx) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return <strong key={pIdx} style={{ color: '#facc15', fontWeight: 'bold' }}>{part.slice(2, -2)}</strong>;
                }
                return part;
              })}
            </div>
          </div>
        );
      }

      const parts = trimmed.split(/(\*\*.*?\*\*|`.*?`)/g);
      return (
        <p key={index} style={{ margin: '0.3rem 0', color: '#cbd5e1', fontSize: '0.88rem', lineHeight: '1.5' }}>
          {parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <u key={pIdx} style={{ color: '#4ade80', fontWeight: 'bold', textDecorationColor: '#ec4899' }}>{part.slice(2, -2)}</u>;
            }
            if (part.startsWith('`') && part.endsWith('`')) {
              return <span key={pIdx} style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.1rem 0.4rem', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.82rem' }}>{part.slice(1, -1)}</span>;
            }
            return part;
          })}
        </p>
      );
    });
  };

  // --- HANDLER WORKSPACE ---
  const handleAiFormatNotes = async () => {
    if (!rawNotesInput.trim()) { alert("Ketik catatan mentah kamu dulu!"); return; }
    setIsFormattingNotes(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/format-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_notes: rawNotesInput })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setVisualNotesOutput(data.formatted_notes);
      } else {
        alert("⚠️ Gagal memformat catatan AI.");
      }
    } catch (err) {
      alert("Error memproses AI notes.");
    } finally {
      setIsFormattingNotes(false);
    }
  };

  const handleSaveSmartNotes = async () => {
    if (!rawNotesInput.trim()) { alert("Catatan tidak boleh kosong!"); return; }
    try {
      const notePayload = {
        course_name: noteCourse,
        meeting_no: parseInt(noteMeetingNo),
        raw_notes: rawNotesInput,
        structured_visual_notes: visualNotesOutput
      };

      const resNotes = await fetch(`${API_BASE_URL}/api/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notePayload)
      });

      if (resNotes.ok) {
        alert(`✅ Catatan ${noteCourse} Pertemuan ${noteMeetingNo} Berhasil Disimpan & Masuk ke Library!`);
        fetchData();
      } else {
        const errorData = await resNotes.json();
        alert(`⚠️ Gagal menyimpan: ${errorData.error || 'Server error'}`);
      }
    } catch (err) {
      alert("Gagal terhubung ke server backend.");
    }
  };

  const handleUploadWorkspaceFile = async () => {
    if (!workspaceFile || !fileCourse) {
      alert("Pilih file materi dan tentukan Mata Kuliah terlebih dahulu!");
      return;
    }
    setIsUploadingFile(true);
    setFileExtractionResult('');

    try {
      const formData = new FormData();
      formData.append('file', workspaceFile);
      formData.append('course_name', fileCourse);
      formData.append('meeting_no', fileMeetingNo);

      const res = await fetch(`${API_BASE_URL}/api/workspace/upload-file`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setFileExtractionResult(data.extracted_text);
        alert(`✅ Materi file berhasil diekstrak dan disimpan mendalam ke Library!`);
        setWorkspaceFile(null);
        document.getElementById('workspaceFileInput').value = '';
        fetchData();
      } else {
        alert(`⚠️ Gagal ekstrak file: ${data.error || 'Error tidak diketahui'}`);
      }
    } catch (err) {
      alert("Gagal menghubungi server backend.");
    } finally {
      setIsUploadingFile(false);
    }
  };

  // --- HANDLER HAPUS PER-ITEM ---
  const handleDeleteTask = async (taskId, e) => {
    if (e) e.stopPropagation();
    if (!isAdmin) { alert("🔒 Akses ditolak! Masuk sebagai Produser terlebih dahulu."); return; }
    if (!window.confirm("Apakah kamu yakin ingin menghapus tugas ini?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) { setSelectedCalendarItem(null); fetchData(); }
    } catch (err) { alert("Error menghapus tugas."); }
  };

  const handleDeleteInsight = async (insightId) => {
    if (!isAdmin) { alert("🔒 Akses ditolak! Masuk sebagai Produser terlebih dahulu."); return; }
    if (!window.confirm("Apakah kamu yakin ingin menghapus item ini dari Library?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/insights/${insightId}`, { method: 'DELETE' });
      if (res.ok) { fetchData(); }
    } catch (err) { alert("Error menghapus insight."); }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!isAdmin) { alert("🔒 Akses ditolak! Masuk sebagai Produser terlebih dahulu."); return; }
    if (!window.confirm("Apakah kamu yakin ingin menghapus jadwal kuliah ini?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/schedules/${scheduleId}`, { method: 'DELETE' });
      if (res.ok) { setSelectedCalendarItem(null); fetchData(); }
    } catch (err) { alert("Error menghapus jadwal."); }
  };

  const activeTasks = tasks.filter(t => t.status !== 'Selesai');
  const nearestTask = activeTasks.length > 0 ? activeTasks[0] : null;

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
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else { setCurrentMonth(currentMonth - 1); }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else { setCurrentMonth(currentMonth + 1); }
  };

  const playControlRoomBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } catch (e) {}
  };

  const handleToggleAttendance = async (schedId) => {
    playControlRoomBeep();
    if (navigator.vibrate) navigator.vibrate(50);
    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule_id: schedId })
      });
      if (res.ok) { fetchData(); }
    } catch (err) { console.error("Toggle attendance error:", err); }
  };

  const handleGenerateAiSubtasks = async () => {
    if (!title.trim()) { alert("⚠️ Isi judul tugas terlebih dahulu!"); return; }
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
        alert("🔒 Sesi Produser sudah habis, silakan login ulang.");
        setIsAdmin(false);
      } else {
        alert(`⚠️ AI gagal menyusun breakdown: ${data.error || 'Error tidak diketahui'}`);
      }
    } catch (err) {
      alert("Gagal menghubungi server AI breakdown.");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleAddCustomSubtask = () => {
    setAiDraftSubtasks([...aiDraftSubtasks, { title: '', deadline: deadline || '2026-09-20' }]);
  };

  const handleRemoveSubtask = (index) => {
    setAiDraftSubtasks(aiDraftSubtasks.filter((_, idx) => idx !== index));
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
        alert("🔒 Sesi Produser sudah habis, silakan login ulang.");
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
      }
    } catch (err) { alert("Gagal memperbarui tugas."); }
  };

  const handleToggleSubtaskFromModal = async (subtaskId, currentCompleted) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/subtasks/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: subtaskId, completed: !currentCompleted })
      });
      if (res.ok) { setSelectedCalendarItem(null); fetchData(); }
    } catch (err) { alert("Gagal menghubungi server."); }
  };

  const handleClearAllData = async () => {
    if (!window.confirm("⚠️ PERINGATAN PRODUSER: Apakah kamu yakin ingin MENGHAPUS SELURUH DATA dari database SQLite?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/data/clear-all`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) { alert("🗑️ Seluruh Data Berhasil Dibersihkan!"); fetchData(); }
    } catch (err) { alert("Gagal menghapus seluruh data."); }
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
        setShowPinModal(false); setPinInput(''); setActiveTab('producer');
      } else { alert('🔒 PIN Salah!'); }
    } catch (err) { alert('Gagal menghubungi server auth.'); }
  };

  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const todayDayName = dayNames[now.getDay()];

  const todaySchedules = schedules.filter(s => (s.day_of_week || '').trim().toLowerCase() === todayDayName.toLowerCase());
  const activeTodaySchedules = todaySchedules.filter(s => !s.is_cancelled);
  
  const uncompletedTodayClass = activeTodaySchedules.find(s => {
    const st = (s.attendance_status || '').toUpperCase();
    return st !== 'SUDAH ABSEN' && st !== 'SUDAH' && s.is_attended !== true && s.is_attended !== 1;
  });

  const getNextUpcomingClass = () => {
    if (activeTodaySchedules.length > 0 && uncompletedTodayClass) {
      return uncompletedTodayClass;
    }
    const currentDayIdx = now.getDay();
    for (let offset = 1; offset <= 7; offset++) {
      const targetDayIdx = (currentDayIdx + offset) % 7;
      const targetDayName = dayNames[targetDayIdx];
      const found = schedules.find(s => (s.day_of_week || '').trim().toLowerCase() === targetDayName.toLowerCase() && !s.is_cancelled);
      if (found) return found;
    }
    return schedules.find(s => !s.is_cancelled) || null;
  };

  const nextClass = getNextUpcomingClass();
  const isClassToday = nextClass && (nextClass.day_of_week || '').trim().toLowerCase() === todayDayName.toLowerCase();
  const globalWeekType = schedules.length > 0 ? (schedules[0].week_type || 'REGULAR') : 'REGULAR';

  const uniqueCoursesFromSchedules = Array.from(new Set(schedules.map(s => s.course_name))).filter(Boolean);

  const monthNames = [
    "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
    "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"
  ];
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;

  return (
    <div style={{ backgroundColor: '#060913', color: '#f8fafc', minHeight: '100vh', padding: '1.2rem', fontFamily: 'sans-serif', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      
      <div style={{ flex: 1 }}>
        {/* HEADER & MAIN NAVIGATION BAR */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
          <div>
            <h1 style={{ margin: 0, color: '#ec4899', fontSize: '1.8rem', fontWeight: '800' }}>ROAD TO S.I.Kom 🎬</h1>
            <p style={{ margin: 0, color: '#38bdf8', fontSize: '0.8rem', fontWeight: '700' }}>
              JURNAL PINTAR & CONTROL ROOM 
              {globalWeekType !== 'REGULAR' && (
                <span style={{ backgroundColor: '#ef4444', color: '#fff', padding: '0.1rem 0.5rem', borderRadius: '4px', marginLeft: '0.5rem', fontSize: '0.7rem', fontWeight: '900' }}>
                  🚨 MODE {globalWeekType}
                </span>
              )}
            </p>
          </div>

          <nav style={{ display: 'flex', gap: '0.4rem', backgroundColor: '#0f172a', padding: '0.3rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap' }}>
            {[
              { id: 'dashboard', label: '📊 Dashboard' },
              { id: 'workspace', label: '📝 Workspace' },
              { id: 'library', label: '📚 Library' },
              { id: 'arcade', label: '🎮 Arcade' },
              { id: 'tasks', label: '📋 Tasks' },
              { id: 'producer', label: '🎬 Produser' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  backgroundColor: activeTab === tab.id ? '#ec4899' : 'transparent',
                  color: activeTab === tab.id ? '#fff' : '#94a3b8',
                  border: 'none', padding: '0.5rem 0.9rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem'
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button onClick={() => isAdmin ? setIsAdmin(false) : setShowPinModal(true)} style={{ backgroundColor: isAdmin ? 'rgba(21,128,61,0.3)' : '#0f172a', color: isAdmin ? '#4ade80' : '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem 1rem', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}>
              {isAdmin ? "🔓 PRODUSER" : "🔒 PUBLIC"}
            </button>
          </div>
        </header>

        {/* --- AIRTIME TICKER BAR --- */}
        <div style={{ backgroundColor: '#0f172a', border: '1px solid #eab308', borderRadius: '12px', padding: '0.8rem 1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
            <span style={{ backgroundColor: '#eab308', color: '#000', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: '900', fontSize: '0.85rem' }}>⚠️ AIRTIME WARNING</span>
            <span style={{ color: '#facc15', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1rem' }}>
              {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':')} WIB, {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>COUNTDOWN TARGET: {nearestTask ? nearestTask.title.toUpperCase() : 'NO TARGET'}</span>
            <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#ec4899', fontFamily: 'monospace' }}>⏱️ {nearestTask ? getCountdown(nearestTask.deadline) : '--:--:--'}</span>
          </div>
        </div>

        {/* --- TAB 1: DASHBOARD --- */}
        {activeTab === 'dashboard' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: '16px', display: 'flex', overflow: 'hidden', border: '1px solid #0284c7', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', flexWrap: 'wrap' }}>
                <div style={{ backgroundColor: nextClass ? '#0284c7' : '#64748b', color: '#ffffff', padding: '1.2rem 1.8rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: '160px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>KELAS BERIKUTNYA</span>
                  <span style={{ fontSize: '1.3rem', fontWeight: '900', marginTop: '0.2rem' }}>
                    {!nextClass ? 'Tidak Ada Kelas' : (isClassToday ? `Hari ini, pukul ${nextClass.start_time}` : `Besok, pukul ${nextClass.start_time}`)}
                  </span>
                </div>
                <div style={{ padding: '1.2rem 1.8rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
                  <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: '#38bdf8' }}>{nextClass ? nextClass.course_name : '☕ Tidak ada perkuliahan aktif'}</h2>
                  <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: '#94a3b8', fontWeight: '600' }}>
                    <span style={{ backgroundColor: 'rgba(2,132,199,0.2)', color: '#38bdf8', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: 'bold' }}>{nextClass ? `${nextClass.start_time} – ${nextClass.end_time}` : '--:--'}</span>
                    <span>{nextClass ? nextClass.room : 'Platform Siaran'}</span>
                    <span>• Pertemuan ke-{nextClass ? nextClass.meeting_no : 1}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div style={{ backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: '14px', padding: '1rem', textAlign: 'center', border: '1px solid #8b5cf6' }}>
                  <h3 style={{ margin: 0, fontSize: '1.8rem', color: '#a78bfa', fontWeight: '900' }}>{schedules.length}</h3>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' }}>KELAS PER PEKAN</span>
                </div>

                <div style={{ backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: '14px', padding: '1rem', textAlign: 'center', border: '1px solid #22c55e' }}>
                  <h3 style={{ margin: 0, fontSize: '1.8rem', color: '#4ade80', fontWeight: '900' }}>{progressPercentage}%</h3>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' }}>PROGRESS TUGAS</span>
                </div>

                {/* CARD 3 ABSENSI DENGAN INDIKATOR LAMPU WARNA DINAMIS */}
                {(() => {
                  const hasActiveTodayClass = activeTodaySchedules.length > 0;
                  const isTodayUncompleted = hasActiveTodayClass && activeTodaySchedules.some(s => {
                    const st = (s.attendance_status || '').toUpperCase();
                    return st !== 'SUDAH ABSEN' && st !== 'SUDAH' && s.is_attended !== true && s.is_attended !== 1;
                  });

                  return (
                    <div 
                      onClick={() => setShowAttendanceModal(true)} 
                      style={{ 
                        backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: '14px', padding: '1rem', 
                        textAlign: 'center', border: isTodayUncompleted ? '1px solid #f97316' : (hasActiveTodayClass ? '1px solid #22c55e' : '1px solid #64748b'), 
                        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', 
                        cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 2px 10px rgba(0,0,0,0.3)' 
                      }}
                      title="Klik untuk atur absensi hari ini"
                    >
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' }}>STATUS ABSENSI HARI INI</span>
                      
                      <div style={{ display: 'flex', gap: '6px', margin: '0.5rem 0', justifyContent: 'center', alignItems: 'center' }}>
                        {hasActiveTodayClass ? (
                          activeTodaySchedules.map((s, idx) => {
                            const st = (s.attendance_status || '').toUpperCase();
                            const isDone = st === 'SUDAH ABSEN' || st === 'SUDAH' || s.is_attended === true || s.is_attended === 1;
                            return (
                              <span 
                                key={idx} 
                                style={{ 
                                  width: '10px', 
                                  height: '10px', 
                                  borderRadius: '50%', 
                                  backgroundColor: isDone ? '#4ade80' : '#f97316',
                                  boxShadow: isDone ? '0 0 8px #4ade80' : '0 0 8px #f97316',
                                  transition: 'all 0.3s ease'
                                }} 
                                title={`${s.course_name}: ${isDone ? 'Sudah Absen (Hijau)' : 'Belum Absen (Orange)'}`} 
                              />
                            );
                          })
                        ) : (
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#64748b' }} title="Tidak ada kelas hari ini" />
                        )}
                      </div>

                      <h4 style={{ margin: '0.1rem 0', color: isTodayUncompleted ? '#fb923c' : (hasActiveTodayClass ? '#4ade80' : '#94a3b8'), fontSize: '0.85rem', fontWeight: '900' }}>
                        {!hasActiveTodayClass ? '☕ LIBUR HARI INI' : (isTodayUncompleted ? '⚠️ BELUM ABSEN' : '✨ ABSEN AMAN')}
                      </h4>
                      
                      <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 'bold', marginTop: '0.2rem', textDecoration: 'underline' }}>
                        👆 Klik Atur Absen
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* KALENDER GRID INTERAKTIF */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.4rem', backgroundColor: '#0f172a', padding: '0.3rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                {['Semua', 'Mingguan', 'Bulanan'].map(f => (
                  <button key={f} onClick={() => setCalendarFilter(f)} style={{ backgroundColor: calendarFilter === f ? '#ec4899' : 'transparent', color: calendarFilter === f ? '#fff' : '#94a3b8', border: 'none', padding: '0.3rem 0.9rem', borderRadius: '15px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>{f}</button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button onClick={handlePrevMonth} style={{ backgroundColor: '#1e293b', color: '#ec4899', border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>‹</button>
                <h3 style={{ margin: 0, color: '#ec4899', fontSize: '1.1rem', fontWeight: '800', letterSpacing: '1px' }}>{monthNames[currentMonth]} {currentYear}</h3>
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

                  const isTodayBox = dayNum === now.getDate() && currentMonth === now.getMonth() && currentYear === now.getFullYear();
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

                  const currentDayName = dayNames[new Date(currentYear, currentMonth, dayNum).getDay()];
                  const matchedSchedules = schedules.filter(s => s.day_of_week === currentDayName);

                  return (
                    <div key={dayNum} style={{ minHeight: '65px', padding: '6px', borderRadius: '8px', backgroundColor: isTodayBox ? 'rgba(236, 72, 153, 0.12)' : 'rgba(30, 41, 59, 0.5)', border: isTodayBox ? '2px solid #ec4899' : '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <span style={{ fontSize: '0.75rem', color: isTodayBox ? '#ec4899' : '#94a3b8', fontWeight: isTodayBox ? '900' : 'bold' }}>{dayNum}</span>
                      </div>
                      
                      {matchedSchedules.map((s, idx) => (
                        <div key={`sc-${idx}`} onClick={() => setSelectedCalendarItem({ type: 'SCHEDULE', data: s })} style={{ backgroundColor: s.is_cancelled ? '#475569' : '#0284c7', color: '#fff', fontSize: '0.55rem', padding: '2px 4px', borderRadius: '3px', marginTop: '2px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', textDecoration: s.is_cancelled ? 'line-through' : 'none', opacity: s.is_cancelled ? 0.6 : 1 }}>
                          🎓 {s.is_cancelled ? '⛔ ' : ''}{s.course_name}
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
          </>
        )}

        {/* --- TAB 2: UNIFIED WORKSPACE --- */}
        {activeTab === 'workspace' && (
          <div style={{ backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '16px', border: '1px solid #ec4899' }}>
            <h2 style={{ color: '#ec4899', marginTop: 0 }}>📝 UNIFIED WORKSPACE: PUSAT PENGETAHUAN</h2>
            <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
              <button onClick={() => setWorkspaceMode('notes')} style={{ backgroundColor: workspaceMode === 'notes' ? '#ec4899' : '#1e293b', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
                📝 Ketik Catatan Lisan (Smart Notes)
              </button>
              <button onClick={() => setWorkspaceMode('file')} style={{ backgroundColor: workspaceMode === 'file' ? '#8b5cf6' : '#1e293b', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
                📄 Upload File Materi (Deep PDF/Foto Extraction)
              </button>
            </div>

            {workspaceMode === 'notes' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 'bold' }}>Pilih Matkul & Pertemuan:</label>
                  <div style={{ display: 'flex', gap: '0.5rem', margin: '0.4rem 0 1rem 0' }}>
                    <select value={noteCourse} onChange={e => setNoteCourse(e.target.value)} style={{ flex: 1, padding: '0.55rem', backgroundColor: '#1e293b', border: '1px solid #0284c7', color: '#fff', borderRadius: '6px', fontWeight: 'bold' }}>
                      {uniqueCoursesFromSchedules.length > 0 ? (
                        uniqueCoursesFromSchedules.map((cName, idx) => (
                          <option key={idx} value={cName}>{cName}</option>
                        ))
                      ) : (
                        <option value="Main Control Room">Main Control Room</option>
                      )}
                    </select>
                    <input type="number" min="1" max="14" value={noteMeetingNo} onChange={e => setNoteMeetingNo(e.target.value)} style={{ width: '70px', padding: '0.5rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} />
                  </div>
                  <textarea placeholder="Ketik catatan lisan mentah dosen di sini..." value={rawNotesInput} onChange={e => setRawNotesInput(e.target.value)} rows={12} style={{ width: '100%', padding: '0.8rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px', boxSizing: 'border-box', resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem' }}>
                    <button onClick={handleAiFormatNotes} disabled={isFormattingNotes} style={{ backgroundColor: '#ec4899', color: '#fff', border: 'none', padding: '0.6rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                      {isFormattingNotes ? '⏳ Merapikan...' : '⚡ Rapikan AI (Bagan Visual)'}
                    </button>
                    <button onClick={handleSaveSmartNotes} style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '0.6rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                      💾 Simpan Catatan
                    </button>
                  </div>
                </div>

                <div style={{ backgroundColor: '#1e293b', padding: '1.2rem', borderRadius: '12px', border: '1px solid #334155' }}>
                  <h4 style={{ color: '#4ade80', marginTop: 0, marginBottom: '0.8rem', borderBottom: '1px solid #334155', paddingBottom: '0.4rem' }}>✨ Hasil Bagan Visual AI:</h4>
                  <div>{visualNotesOutput ? renderFormattedNotes(visualNotesOutput) : <span style={{ color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic' }}>Hasil format visual tersusun di sini...</span>}</div>
                </div>
              </div>
            )}

            {workspaceMode === 'file' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#a78bfa', fontWeight: 'bold' }}>Pilih Target Mata Kuliah & Pertemuan:</label>
                  <div style={{ display: 'flex', gap: '0.5rem', margin: '0.4rem 0 1rem 0' }}>
                    <select value={fileCourse} onChange={e => setFileCourse(e.target.value)} style={{ flex: 1, padding: '0.55rem', backgroundColor: '#1e293b', border: '1px solid #8b5cf6', color: '#fff', borderRadius: '6px', fontWeight: 'bold' }}>
                      {uniqueCoursesFromSchedules.length > 0 ? (
                        uniqueCoursesFromSchedules.map((cName, idx) => (
                          <option key={idx} value={cName}>{cName}</option>
                        ))
                      ) : (
                        <option value="Main Control Room">Main Control Room</option>
                      )}
                    </select>
                    <input type="number" min="1" max="14" value={fileMeetingNo} onChange={e => setFileMeetingNo(e.target.value)} style={{ width: '70px', padding: '0.5rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} />
                  </div>
                  <input id="workspaceFileInput" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt" onChange={e => setWorkspaceFile(e.target.files[0] || null)} style={{ width: '100%', padding: '0.8rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px', boxSizing: 'border-box', marginBottom: '1.2rem' }} />
                  <button onClick={handleUploadWorkspaceFile} disabled={isUploadingFile} style={{ backgroundColor: '#8b5cf6', color: '#fff', border: 'none', padding: '0.7rem 1.2rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}>
                    {isUploadingFile ? '⏳ AI Sedang Menguras Dokumen...' : '⚡ Ekstrak & Simpan ke Knowledge Base'}
                  </button>
                </div>

                <div style={{ backgroundColor: '#1e293b', padding: '1.2rem', borderRadius: '12px', border: '1px solid #334155' }}>
                  <h4 style={{ color: '#a78bfa', marginTop: 0, marginBottom: '0.8rem', borderBottom: '1px solid #334155', paddingBottom: '0.4rem' }}>📄 Hasil Ekstraksi Mendalam AI:</h4>
                  <div>{fileExtractionResult ? renderFormattedNotes(fileExtractionResult) : <span style={{ color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic' }}>Hasil bedah materi komprehensif muncul di sini...</span>}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- TAB 3: LIBRARY --- */}
        {activeTab === 'library' && (
          <div style={{ backgroundColor: '#0f172a', padding: '1.2rem', borderRadius: '16px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
              <h3 style={{ color: '#a78bfa', margin: 0 }}>📚 DUAL-SOURCE KNOWLEDGE LIBRARY</h3>
              <select value={libraryCourseFilter} onChange={e => setLibraryCourseFilter(e.target.value)} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#1e293b', border: '1px solid #a78bfa', color: '#fff', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                <option value="SEMUA">🌐 Semua Mata Kuliah</option>
                {uniqueCoursesFromSchedules.map((cName, idx) => (
                  <option key={idx} value={cName}>{cName}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {knowledgeBase.length === 0 ? <p style={{ color: '#64748b' }}>Belum ada materi tersimpan.</p> : knowledgeBase.filter(kb => libraryCourseFilter === 'SEMUA' || (kb.source || '').toLowerCase().includes(libraryCourseFilter.toLowerCase()) || (kb.course_name || '').toLowerCase().includes(libraryCourseFilter.toLowerCase())).map((kb, idx) => {
                const isFileSource = (kb.source || '').includes('MATERI FILE') || (kb.source || '').includes('FILE:');
                return (
                  <div key={kb.id || idx} style={{ backgroundColor: isFileSource ? '#1e1b4b' : '#042f2e', padding: '1.2rem', borderRadius: '12px', border: isFileSource ? '1px solid #8b5cf6' : '1px solid #06b6d4' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.4rem' }}>
                      <span style={{ backgroundColor: isFileSource ? '#8b5cf6' : '#06b6d4', color: isFileSource ? '#fff' : '#000', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '900' }}>
                        {isFileSource ? '📄 MATERI FILE' : '📝 NOTES KETIKAN'} — {kb.source || kb.course_name}
                      </span>
                      {kb.id && isAdmin && <button onClick={() => handleDeleteInsight(kb.id)} style={{ backgroundColor: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer' }}>🗑️ Hapus</button>}
                    </div>
                    <div style={{ color: '#cbd5e1', fontSize: '0.88rem' }}>{renderFormattedNotes(kb.text)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- TAB 4: ARCADE --- */}
        {activeTab === 'arcade' && (
          <div style={{ backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '16px', border: '1px solid #eab308' }}>
            <div style={{ borderBottom: '1px solid rgba(234, 179, 8, 0.3)', paddingBottom: '1rem', marginBottom: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
              <div>
                <h2 style={{ color: '#facc15', margin: 0 }}>🎮 ACADEMIC ARCADE ENGINE</h2>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <select value={arcadeCourse} onChange={e => setArcadeCourse(e.target.value)} style={{ padding: '0.5rem 0.8rem', backgroundColor: '#1e293b', border: '1px solid #eab308', color: '#fff', borderRadius: '8px', fontWeight: 'bold' }}>
                  {uniqueCoursesFromSchedules.map((cName, idx) => <option key={idx} value={cName}>{cName}</option>)}
                </select>
                <select value={arcadeMeeting} onChange={e => setArcadeMeeting(e.target.value)} style={{ padding: '0.5rem 0.8rem', backgroundColor: '#1e293b', border: '1px solid #eab308', color: '#fff', borderRadius: '8px', fontWeight: 'bold' }}>
                  {Array.from({ length: 14 }, (_, i) => i + 1).map(num => <option key={num} value={num.toString()}>Pertemuan {num}</option>)}
                  <option value="UTS">🚨 CHECKPOINT UTS (Pertemuan 1–7)</option>
                  <option value="UAS">🔥 CHECKPOINT UAS (Pertemuan 8–14)</option>
                </select>
                <button onClick={handleStartArcadeQuiz} disabled={isGeneratingQuiz} style={{ backgroundColor: '#eab308', color: '#000', border: 'none', padding: '0.55rem 1.2rem', borderRadius: '8px', fontWeight: '900', cursor: 'pointer' }}>
                  {isGeneratingQuiz ? '⏳ Menyusun...' : '🚀 MULAI KUIS'}
                </button>
              </div>
            </div>

            {quizData && (
              <div style={{ backgroundColor: '#1e293b', borderRadius: '14px', padding: '1.2rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.2rem' }}>
                  {[{ step: 1, label: 'FASE 1: LITERASI' }, { step: 2, label: 'FASE 2: KUIS PG' }, { step: 3, label: 'FASE 3: SPARRING' }, { step: 4, label: '📊 DIAGNOSTIC' }].map(s => (
                    <div key={s.step} style={{ flex: 1, padding: '0.5rem', textAlign: 'center', borderRadius: '8px', backgroundColor: arcadeStep === s.step ? '#ec4899' : (arcadeStep > s.step ? '#22c55e' : '#0f172a'), color: '#fff', fontWeight: 'bold', fontSize: '0.75rem' }}>{s.label}</div>
                  ))}
                </div>

                {arcadeStep === 1 && (
                  <div>
                    <h3 style={{ color: '#38bdf8' }}>📘 FASE 1: BRIEFING LITERASI</h3>
                    {quizData.fase1_literacy.map((item, idx) => (
                      <div key={idx} style={{ backgroundColor: '#0f172a', padding: '1rem', borderRadius: '10px', marginBottom: '0.8rem', borderLeft: '4px solid #38bdf8' }}>
                        <h4 style={{ color: '#facc15', margin: '0 0 0.4rem 0' }}>📌 {item.title}</h4>
                        <p style={{ color: '#cbd5e1', margin: 0 }}>{item.content}</p>
                      </div>
                    ))}
                    <button onClick={() => setArcadeStep(2)} style={{ backgroundColor: '#ec4899', color: '#fff', border: 'none', padding: '0.7rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>➡️ Lanjut ke Kuis PG</button>
                  </div>
                )}

                {arcadeStep === 2 && (
                  <div>
                    <h3 style={{ color: '#4ade80' }}>🎯 FASE 2: KUIS PG</h3>
                    {quizData.fase2_quiz.map((q, qIdx) => (
                      <div key={q.id || qIdx} style={{ backgroundColor: '#0f172a', padding: '1rem', borderRadius: '10px', marginBottom: '1rem' }}>
                        <h4 style={{ color: '#fff', margin: '0 0 0.8rem 0' }}>{qIdx + 1}. {q.question}</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
                          {q.options.map((opt, optIdx) => (
                            <button key={optIdx} onClick={() => handleSelectQuizOption(q.id, optIdx)} style={{ backgroundColor: userQuizAnswers[q.id] === optIdx ? '#ec4899' : '#1e293b', color: '#fff', border: 'none', padding: '0.6rem 0.8rem', borderRadius: '8px', textAlign: 'left', cursor: 'pointer' }}>
                              {String.fromCharCode(65 + optIdx)}. {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button onClick={() => setArcadeStep(3)} style={{ backgroundColor: '#4ade80', color: '#000', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', fontWeight: '900', cursor: 'pointer' }}>➡️ Lanjut ke Sparring</button>
                  </div>
                )}

                {arcadeStep === 3 && (
                  <div>
                    <h3 style={{ color: '#a78bfa' }}>🥊 FASE 3: SPARRING STUDIO</h3>
                    <div style={{ backgroundColor: '#0f172a', padding: '1rem', borderRadius: '10px', borderLeft: '4px solid #a78bfa', marginBottom: '1rem' }}>
                      <p style={{ color: '#fff', fontWeight: 'bold' }}>{quizData.fase3_sparring_question}</p>
                    </div>
                    <textarea placeholder="Ketik analisis penalaran argumenmu..." value={userSparringAnswer} onChange={e => setUserSparringAnswer(e.target.value)} rows={6} style={{ width: '100%', padding: '0.8rem', backgroundColor: '#0f172a', border: '1px solid #a78bfa', color: '#fff', borderRadius: '8px', boxSizing: 'border-box', marginBottom: '1rem' }} />
                    <button onClick={handleSubmitSparring} disabled={isEvaluatingSparring} style={{ backgroundColor: '#a78bfa', color: '#000', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '8px', fontWeight: '900', cursor: 'pointer' }}>
                      {isEvaluatingSparring ? '⏳ Menilai...' : '🚀 KIRIM EVALUASI AI'}
                    </button>
                  </div>
                )}

                {arcadeStep === 4 && (
                  <div>
                    <h3 style={{ color: '#facc15', textAlign: 'center' }}>📊 DIAGNOSTIC REPORT</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div style={{ backgroundColor: '#0f172a', padding: '1.2rem', borderRadius: '12px', textAlign: 'center', border: '1px solid #4ade80' }}>
                        <h2 style={{ fontSize: '2.5rem', color: '#4ade80', margin: 0 }}>{calculateQuizScore()}%</h2>
                      </div>
                      <div style={{ backgroundColor: '#0f172a', padding: '1.2rem', borderRadius: '12px', textAlign: 'center', border: '1px solid #a78bfa' }}>
                        <h2 style={{ fontSize: '2.5rem', color: '#a78bfa', margin: 0 }}>{sparringEvaluation ? sparringEvaluation.score : 0}/100</h2>
                      </div>
                    </div>
                    {sparringEvaluation && (
                      <div style={{ backgroundColor: '#0f172a', padding: '1.2rem', borderRadius: '12px', border: '1px solid #facc15' }}>
                        <p style={{ color: '#cbd5e1' }}>{sparringEvaluation.analysis_summary}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- TAB 5: TASKS --- */}
        {activeTab === 'tasks' && (
          <div style={{ backgroundColor: '#0f172a', padding: '1.2rem', borderRadius: '16px' }}>
            <h3 style={{ color: '#ec4899', marginTop: 0 }}>🎯 TASK MONITOR</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {tasks.map(t => (
                <div key={t.id} onClick={() => setSelectedCalendarItem({ type: 'TASK', data: t })} style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                  <div>
                    <h4 style={{ margin: 0, color: '#f8fafc' }}>{t.title}</h4>
                    <span style={{ fontSize: '0.75rem', color: '#38bdf8' }}>🏷️ {t.tag} • ⏰ {t.deadline}</span>
                  </div>
                  <button onClick={(e) => handleDeleteTask(t.id, e)} style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '6px' }}>🗑️</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- TAB 6: PRODUSER CONTROL PANEL --- */}
        {activeTab === 'producer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '0.5rem' }}>
            {!isAdmin ? (
              <div style={{ backgroundColor: '#0f172a', padding: '2rem', borderRadius: '16px', border: '1px solid #ec4899', textAlign: 'center' }}>
                <button onClick={() => setShowPinModal(true)} style={{ backgroundColor: '#ec4899', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer' }}>🔑 Masukkan PIN Produser</button>
              </div>
            ) : (
              <>
                <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid #eab308', borderRadius: '16px', padding: '1.2rem' }}>
                  <h3 style={{ color: '#facc15', marginTop: 0 }}>🎛️ SAKELAR LIBUR & PEKAN UJIAN</h3>
                  <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '1.2rem' }}>
                    {['REGULAR', 'UTS', 'UAS'].map(mode => (
                      <button key={mode} onClick={() => handleSetWeekType(mode)} style={{ backgroundColor: globalWeekType === mode ? '#ec4899' : '#1e293b', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>{mode}</button>
                    ))}
                  </div>
                </div>

                <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)', border: '1px solid #ec4899', borderRadius: '16px', padding: '1.2rem' }}>
                  <h3 style={{ color: '#ec4899', marginTop: 0 }}>📌 INPUT TUGAS & BREAKDOWN AI</h3>
                  
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
                  
                  <textarea 
                    placeholder="Deskripsi Tugas / Catatan Khusus dari Dosen (Detail Instruksi Tugas)..." 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    rows={4} 
                    style={{ width: '100%', padding: '0.7rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px', marginTop: '0.8rem', boxSizing: 'border-box', resize: 'vertical' }} 
                  />

                  <button 
                    onClick={handleGenerateAiSubtasks} 
                    disabled={isGeneratingAi} 
                    style={{ backgroundColor: '#ec4899', color: '#fff', border: 'none', padding: '0.7rem 1.2rem', borderRadius: '8px', fontWeight: 'bold', cursor: isGeneratingAi ? 'wait' : 'pointer', marginTop: '0.8rem', opacity: isGeneratingAi ? 0.7 : 1 }}
                  >
                    {isGeneratingAi ? '⏳ Gemini Sedang Memecah Tugas...' : '⚡ Minta AI Buat Breakdown (Tahap 1)'}
                  </button>
                </div>

                <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)', border: '1px solid #38bdf8', borderRadius: '16px', padding: '1.2rem' }}>
                  <h3 style={{ color: '#38bdf8', marginTop: 0 }}>📅 INPUT JADWAL KULIAH UTAMA</h3>
                  <form onSubmit={handleAddSchedule} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem' }}>
                    <input type="text" placeholder="Nama Mata Kuliah" value={courseName} onChange={e=>setCourseName(e.target.value)} style={{ padding: '0.6rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px' }} />
                    <input type="text" placeholder="Nama Dosen" value={lecturerName} onChange={e=>setLecturerName(e.target.value)} style={{ padding: '0.6rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px' }} />
                    <input type="text" placeholder="Ruangan" value={room} onChange={e=>setRoom(e.target.value)} style={{ padding: '0.6rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px' }} />
                    <select value={dayOfWeek} onChange={e=>setDayOfWeek(e.target.value)} style={{ padding: '0.6rem', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '8px' }}>
                      <option value="Senin">Senin</option><option value="Selasa">Selasa</option><option value="Rabu">Rabu</option><option value="Kamis">Kamis</option><option value="Jumat">Jumat</option><option value="Sabtu">Sabtu</option>
                    </select>
                    <button type="submit" style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '0.7rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>💾 Simpan Jadwal</button>
                  </form>
                </div>

                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '16px', padding: '1.2rem' }}>
                  <h4 style={{ color: '#ef4444', marginTop: 0 }}>⚠️ SYSTEM RESET CONTROL</h4>
                  <button onClick={handleClearAllData} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '0.7rem 1.2rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>🗑️ Hapus Seluruh Data</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <footer style={{ marginTop: '2.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', fontWeight: '600' }}>Designed & Developed by <span style={{ color: '#ec4899', fontWeight: 'bold' }}>mhrsnndi</span></p>
      </footer>

      {/* MODAL ABSENSI */}
      {showAttendanceModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 120, padding: '1rem' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '16px', border: '1px solid #38bdf8', width: '100%', maxWidth: '400px' }}>
            <h3 style={{ color: '#38bdf8', marginTop: 0 }}>🎛️ Panel Absensi Hari Ini</h3>
            {activeTodaySchedules.map((s) => {
              const isChecked = (s.attendance_status || '').toUpperCase() === 'SUDAH ABSEN';
              return (
                <div key={s.id} style={{ backgroundColor: '#1e293b', padding: '0.8rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#fff', fontSize: '0.85rem' }}>{s.course_name}</span>
                  <button onClick={() => handleToggleAttendance(s.id)} style={{ backgroundColor: isChecked ? '#334155' : '#22c55e', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' }}>
                    {isChecked ? '↩️ Batalkan' : '✅ Absen'}
                  </button>
                </div>
              );
            })}
            <button onClick={() => setShowAttendanceModal(false)} style={{ backgroundColor: '#334155', color: '#fff', border: 'none', padding: '0.6rem', borderRadius: '8px', width: '100%', cursor: 'pointer', marginTop: '1rem' }}>Tutup Panel</button>
          </div>
        </div>
      )}

      {/* ✅ RESTORED MODAL 1: REVIEW & SAVE DRAFT AI SUBTASKS (TAHAP 2) */}
      {showAiModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 130, padding: '1rem' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '16px', border: '1px solid #ec4899', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ color: '#ec4899', marginTop: 0 }}>🤖 BREAKDOWN TUGAS DARI GEMINI AI</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '1rem' }}>Review sub-tugas di bawah ini. Kamu bisa mengubah judul, me-adjust tanggal deadline, atau menambah/menghapus sub-tugas sebelum disimpan.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.2rem' }}>
              {aiDraftSubtasks.map((st, idx) => (
                <div key={idx} style={{ backgroundColor: '#1e293b', padding: '0.7rem', borderRadius: '8px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={st.title}
                    onChange={(e) => {
                      const updated = [...aiDraftSubtasks];
                      updated[idx].title = e.target.value;
                      setAiDraftSubtasks(updated);
                    }}
                    style={{ flex: 1, padding: '0.4rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '0.85rem' }}
                  />
                  <input
                    type="date"
                    value={st.deadline}
                    onChange={(e) => {
                      const updated = [...aiDraftSubtasks];
                      updated[idx].deadline = e.target.value;
                      setAiDraftSubtasks(updated);
                    }}
                    style={{ padding: '0.4rem', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px', fontSize: '0.8rem' }}
                  />
                  <button onClick={() => handleRemoveSubtask(idx)} style={{ backgroundColor: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: '1rem' }} title="Hapus sub-task">✕</button>
                </div>
              ))}
            </div>

            <button onClick={handleAddCustomSubtask} style={{ backgroundColor: '#1e293b', color: '#38bdf8', border: '1px dashed #38bdf8', padding: '0.5rem', borderRadius: '8px', width: '100%', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '1rem' }}>
              ➕ Tambah Sub-task Manual
            </button>

            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button onClick={() => setShowAiModal(false)} style={{ flex: 1, backgroundColor: '#334155', color: '#fff', border: 'none', padding: '0.6rem', borderRadius: '8px', cursor: 'pointer' }}>Batal</button>
              <button onClick={handleSaveTaskPermanent} style={{ flex: 1, backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '0.6rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>💾 Simpan Permanen</button>
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
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.5rem 0 1rem 0' }}>📝 Catatan: {selectedCalendarItem.data.description || 'Tidak ada catatan khusus.'}</p>
                
                {selectedCalendarItem.data.status !== 'Selesai' && (
                  <button onClick={() => handleCompleteTaskFromModal(selectedCalendarItem.data.id)} style={{ backgroundColor: '#22c55e', color: '#fff', border: 'none', padding: '0.6rem', borderRadius: '8px', width: '100%', fontWeight: 'bold', cursor: 'pointer', marginBottom: '0.5rem' }}>
                    ✅ Tandai Tugas Selesai
                  </button>
                )}
                {isAdmin && (
                  <button onClick={() => handleDeleteTask(selectedCalendarItem.data.id)} style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid #ef4444', padding: '0.6rem', borderRadius: '8px', width: '100%', fontWeight: 'bold', cursor: 'pointer', marginBottom: '0.5rem' }}>
                    🗑️ Hapus Tugas Ini
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
                  {selectedCalendarItem.data.completed ? '↩️ Batalkan Selesai' : '✅ Tandai Sub-task Selesai'}
                </button>
              </>
            ) : (
              <>
                <h3 style={{ color: '#0284c7', marginTop: 0 }}>🎓 DETAIL JADWAL KULIAH</h3>
                <h4 style={{ color: '#fff', margin: '0.4rem 0' }}>{selectedCalendarItem.data.course_name}</h4>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.2rem 0' }}>👨‍🏫 Dosen: {selectedCalendarItem.data.lecturer_name}</p>
                <p style={{ color: '#38bdf8', fontSize: '0.85rem', margin: '0.2rem 0' }}>🏛️ Ruangan: {selectedCalendarItem.data.room}</p>
                <p style={{ color: '#4ade80', fontSize: '0.85rem', margin: '0.2rem 0 1rem 0' }}>⏰ Waktu: {selectedCalendarItem.data.day_of_week}, {selectedCalendarItem.data.start_time} – {selectedCalendarItem.data.end_time}</p>
                
                {isAdmin && (
                  <button onClick={() => handleDeleteSchedule(selectedCalendarItem.data.id)} style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid #ef4444', padding: '0.6rem', borderRadius: '8px', width: '100%', fontWeight: 'bold', cursor: 'pointer', marginBottom: '0.5rem' }}>
                    🗑️ Hapus Jadwal Ini
                  </button>
                )}
              </>
            )}

            <button onClick={() => setSelectedCalendarItem(null)} style={{ backgroundColor: '#334155', color: '#fff', border: 'none', padding: '0.5rem', borderRadius: '8px', width: '100%', cursor: 'pointer', marginTop: '0.5rem' }}>Tutup</button>
          </div>
        </div>
      )}

      {/* MODAL PIN PRODUSER */}
      {showPinModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <form onSubmit={handleLogin} style={{ backgroundColor: '#0f172a', padding: '1.8rem', borderRadius: '16px', border: '1px solid #ec4899', width: '280px' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#ec4899', textAlign: 'center' }}>🔑 PIN Produser</h3>
            <input type="password" placeholder="PIN" value={pinInput} onChange={(e) => setPinInput(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff', textAlign: 'center', marginBottom: '1rem', boxSizing: 'border-box' }} />
            <button type="submit" style={{ width: '100%', backgroundColor: '#ec4899', color: '#fff', border: 'none', padding: '0.6rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Buka</button>
          </form>
        </div>
      )}

    </div>
  );
}