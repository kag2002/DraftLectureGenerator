import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CourseRoadmap from './pages/CourseRoadmap';
import CourseConfig from './pages/CourseConfig';
import LessonPlanner from './pages/LessonPlanner';
import QuestionBank from './pages/QuestionBank';
import MatrixDashboard from './pages/MatrixDashboard';
import KnowledgeBase from './pages/KnowledgeBase';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeView, setActiveView] = useState('login'); // 'login' | 'dashboard' | 'course_roadmap' | 'course_config' | 'lesson_planner' | 'question_bank' | 'matrix_dashboard'
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [activeChapterId, setActiveChapterId] = useState(null);
  const [activeCloId, setActiveCloId] = useState(null);
  const [activeCloCode, setActiveCloCode] = useState(null);
  const [activeBloomLevel, setActiveBloomLevel] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- States và Refs cho Hàng đợi Tự động Khắc phục Điểm mù Toàn cục ---
  const [queue, setQueue] = useState([]);
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [showQueuePanel, setShowQueuePanel] = useState(false);
  const [queueProgressMsg, setQueueProgressMsg] = useState('');
  const [queueMode, setQueueMode] = useState('questions'); // 'questions' | 'materials'
  const [isQueueMinimized, setIsQueueMinimized] = useState(false);
  const [queuePosition, setQueuePosition] = useState(null); // { x, y }
  const [isFastMode, setIsFastMode] = useState(false); // Chế độ sinh nhanh

  const cancelRef = React.useRef(false);
  const dragRef = React.useRef(null);
  const dragStartOffset = React.useRef({ x: 0, y: 0 });
  const isDragging = React.useRef(false);

  const resetQueueState = () => {
    setQueue([]);
    setIsQueueRunning(false);
    setShowQueuePanel(false);
    setIsQueueMinimized(false);
    setQueuePosition(null);
    setIsFastMode(false);
    cancelRef.current = true;
  };

  // Draggable handlers
  const handleMouseDown = (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    const panel = dragRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragStartOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    isDragging.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const newX = e.clientX - dragStartOffset.current.x;
    const newY = e.clientY - dragStartOffset.current.y;
    // Giới hạn panel nằm trong cửa sổ trình duyệt
    const boundedX = Math.max(10, Math.min(window.innerWidth - (isQueueMinimized ? 250 : 420), newX));
    const boundedY = Math.max(10, Math.min(window.innerHeight - (isQueueMinimized ? 80 : 530), newY));
    setQueuePosition({ x: boundedX, y: boundedY });
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // Chạy hàng đợi tuần tự để tránh quá tải cho Local LLM bằng SSE Streams
  const runGlobalQueue = async (currentQueue, mode, courseId) => {
    setIsQueueRunning(true);
    setQueueMode(mode);
    const updatedQueue = [...currentQueue];
    const token = localStorage.getItem('token');
    
    for (let i = 0; i < updatedQueue.length; i++) {
      if (updatedQueue[i].status === 'success') continue;
      
      if (cancelRef.current) {
        setIsQueueRunning(false);
        setQueueProgressMsg('⏸️ Hàng đợi đã tạm dừng theo yêu cầu của bạn.');
        return;
      }
      
      updatedQueue[i].status = 'generating';
      updatedQueue[i].activeStageMessage = '🚀 Khởi động AI...';
      setQueue([...updatedQueue]);
      setQueueProgressMsg(`⏳ Đang tự động bổ sung cho ${updatedQueue[i].cloCode} - Bloom B${updatedQueue[i].bloomLevel}...`);
      
      try {
        if (mode === 'questions') {
          // Sinh câu hỏi qua SSE Stream
          const response = await fetch(
            `http://localhost:8000/api/courses/${courseId}/questions/generate-stream`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                clo_id: updatedQueue[i].cloId,
                bloom_level: updatedQueue[i].bloomLevel,
                count: 2,
                fast_mode: isFastMode
              })
            }
          );
          
          if (!response.ok) {
            throw new Error(`Lỗi server: ${response.status}`);
          }
          
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            
            let currentEvent = '';
            for (const line of lines) {
              if (line.startsWith('event: ')) {
                currentEvent = line.slice(7).trim();
              } else if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (currentEvent === 'stage') {
                    updatedQueue[i].activeStageMessage = data.message;
                    setQueue([...updatedQueue]);
                  } else if (currentEvent === 'question') {
                    updatedQueue[i].activeStageMessage = `✅ Đã lưu câu hỏi ${data.index}/${data.total}`;
                    setQueue([...updatedQueue]);
                  } else if (currentEvent === 'error') {
                    throw new Error(data.message);
                  }
                } catch (_) {}
              }
            }
          }
        } else {
          // Sinh slide mới qua SSE Stream
          const chId = updatedQueue[i].chapterId;
          if (!chId) {
            throw new Error('Không có chương học nào để bổ sung slide.');
          }
          
          const response = await fetch(
            `http://localhost:8000/api/courses/chapters/${chId}/append-slide-for-clo-stream`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                clo_id: updatedQueue[i].cloId,
                bloom_level: updatedQueue[i].bloomLevel
              })
            }
          );
          
          if (!response.ok) {
            throw new Error(`Lỗi server: ${response.status}`);
          }
          
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            
            let currentEvent = '';
            for (const line of lines) {
              if (line.startsWith('event: ')) {
                currentEvent = line.slice(7).trim();
              } else if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (currentEvent === 'stage') {
                    updatedQueue[i].activeStageMessage = data.message;
                    setQueue([...updatedQueue]);
                  } else if (currentEvent === 'error') {
                    throw new Error(data.message);
                  }
                } catch (_) {}
              }
            }
          }
        }
        
        updatedQueue[i].status = 'success';
        updatedQueue[i].activeStageMessage = '';
        setQueue([...updatedQueue]);
      } catch (err) {
        console.error(err);
        updatedQueue[i].status = 'failed';
        updatedQueue[i].activeStageMessage = '';
        updatedQueue[i].errorMsg = err.message || 'Lỗi hệ thống';
        setQueue([...updatedQueue]);
      }
    }
    
    setIsQueueRunning(false);
    const completedAll = updatedQueue.every(item => item.status === 'success');
    if (completedAll) {
      setQueueProgressMsg('🎉 Tất cả điểm mù chất lượng đã được tự động khắc phục thành công!');
    } else {
      setQueueProgressMsg('⚠️ Hàng đợi kết thúc. Hãy khắc phục các mục bị lỗi.');
    }
  };

  const handleNavigate = (view, extra = null) => {
    if (extra !== null) {
      if (typeof extra === 'object') {
        if (extra.chapterId !== undefined) setActiveChapterId(extra.chapterId);
        if (extra.cloId !== undefined) {
          setActiveCloId(extra.cloId);
        } else {
          setActiveCloId(null);
        }
        if (extra.cloCode !== undefined) {
          setActiveCloCode(extra.cloCode);
        } else {
          setActiveCloCode(null);
        }
        if (extra.bloomLevel !== undefined) {
          setActiveBloomLevel(extra.bloomLevel);
        } else {
          setActiveBloomLevel(null);
        }
      } else if (typeof extra === 'number') {
        setActiveChapterId(extra);
        setActiveCloId(null);
        setActiveCloCode(null);
        setActiveBloomLevel(null);
      }
    } else {
      setActiveCloId(null);
      setActiveCloCode(null);
      setActiveBloomLevel(null);
    }
    setActiveView(view);
  };

  useEffect(() => {
    // Tự động đăng nhập nếu có token và user trong localStorage
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
      setUser(JSON.parse(savedUser));
      setActiveView('dashboard');
    } else {
      setActiveView('login');
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    setActiveView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setSelectedCourse(null);
    setActiveView('login');
    resetQueueState();
  };

  const handleSelectCourse = (course) => {
    setSelectedCourse(course);
    setActiveView('course_roadmap');
    resetQueueState();
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div>Đang tải ứng dụng...</div>
      </div>
    );
  }

  return (
    <>
      {activeView === 'login' && (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
      {activeView === 'dashboard' && (
        <Dashboard
          user={user}
          onLogout={handleLogout}
          onSelectCourse={handleSelectCourse}
        />
      )}
      {selectedCourse && ['course_roadmap', 'course_config', 'lesson_planner', 'question_bank', 'matrix_dashboard', 'knowledge_base'].includes(activeView) && (
        <div key={selectedCourse.id}>
          <div style={{ display: activeView === 'course_roadmap' ? 'block' : 'none' }}>
            <CourseRoadmap
              course={selectedCourse}
              onBack={() => setActiveView('dashboard')}
              onLogout={handleLogout}
              onNavigate={handleNavigate}
            />
          </div>
          <div style={{ display: activeView === 'course_config' ? 'block' : 'none' }}>
            <CourseConfig
              course={selectedCourse}
              onBack={() => setActiveView('course_roadmap')}
              onNavigate={handleNavigate}
              onStartPlanning={() => setActiveView('lesson_planner')}
            />
          </div>
          <div style={{ display: activeView === 'lesson_planner' ? 'block' : 'none' }}>
            <LessonPlanner
              course={selectedCourse}
              initialChapterId={activeChapterId}
              initialCloId={activeCloId}
              initialCloCode={activeCloCode}
              initialBloomLevel={activeBloomLevel}
              onBack={() => setActiveView('course_roadmap')}
              onLogout={handleLogout}
              onNavigate={handleNavigate}
              onGoToQuestionBank={() => setActiveView('question_bank')}
            />
          </div>
          <div style={{ display: activeView === 'question_bank' ? 'block' : 'none' }}>
            <QuestionBank
              course={selectedCourse}
              initialChapterId={activeChapterId}
              initialCloId={activeCloId}
              initialBloomLevel={activeBloomLevel}
              onBack={() => setActiveView('course_roadmap')}
              onGoToLessonPlanner={() => setActiveView('lesson_planner')}
              onViewDashboard={() => setActiveView('matrix_dashboard')}
              onNavigate={handleNavigate}
            />
          </div>
          <div style={{ display: activeView === 'matrix_dashboard' ? 'block' : 'none' }}>
            <MatrixDashboard
              course={selectedCourse}
              onBack={() => setActiveView('course_roadmap')}
              onNavigate={handleNavigate}
              queue={queue}
              isQueueRunning={isQueueRunning}
              showQueuePanel={showQueuePanel}
              queueProgressMsg={queueProgressMsg}
              setIsQueueRunning={setIsQueueRunning}
              setQueue={setQueue}
              setShowQueuePanel={setShowQueuePanel}
              setQueueProgressMsg={setQueueProgressMsg}
              setQueueMode={setQueueMode}
              cancelRef={cancelRef}
              runGlobalQueue={runGlobalQueue}
            />
          </div>
          <div style={{ display: activeView === 'knowledge_base' ? 'block' : 'none' }}>
            <KnowledgeBase
              course={selectedCourse}
              onBack={() => setActiveView('course_roadmap')}
              onLogout={handleLogout}
              onNavigate={(view) => setActiveView(view)}
              activeView={activeView}
            />
          </div>

        </div>
      )}

      {/* FLOATING BATCH REMEDIATION QUEUE DRAWER/PANEL */}
      {selectedCourse && showQueuePanel && (
        isQueueMinimized ? (
          /* Minimized state */
          <div 
            ref={dragRef}
            style={{
              position: 'fixed',
              ...(queuePosition 
                ? { left: `${queuePosition.x}px`, top: `${queuePosition.y}px` } 
                : { right: '24px', bottom: '24px' }),
              width: '240px',
              background: 'rgba(15, 23, 42, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '12px',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.5)',
              zIndex: 9999,
              fontFamily: '"Outfit", "Inter", sans-serif',
              cursor: 'move',
              userSelect: 'none',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              animation: 'fadeIn 0.2s ease-in-out',
            }}
            onMouseDown={handleMouseDown}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isQueueRunning ? '#fbbf24' : '#64748b',
                boxShadow: isQueueRunning ? '0 0 8px #fbbf24' : 'none',
                flexShrink: 0
              }} />
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', textAlign: 'left' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ⚡ Hàng đợi Điểm Mù
                </span>
                <span style={{ fontSize: '11px', color: '#cbd5e1', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  Tiến độ: {queue.filter(q => q.status === 'success').length}/{queue.length} ({Math.round((queue.filter(q => q.status === 'success').length / queue.length) * 100)}%)
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
              <button 
                onClick={() => setIsQueueMinimized(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#cbd5e1',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  fontWeight: 'bold'
                }}
                title="Mở rộng"
              >
                🗖
              </button>
              <button 
                onClick={() => {
                  cancelRef.current = true;
                  setShowQueuePanel(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: '2px 4px'
                }}
                title="Đóng"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          /* Maximized state */
          <div 
            ref={dragRef}
            style={{
              position: 'fixed',
              ...(queuePosition 
                ? { left: `${queuePosition.x}px`, top: `${queuePosition.y}px` } 
                : { right: '24px', bottom: '24px' }),
              width: '400px',
              maxHeight: '520px',
              background: 'rgba(15, 23, 42, 0.96)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              fontFamily: '"Outfit", "Inter", sans-serif',
              animation: 'fadeIn 0.2s ease-in-out',
            }}
          >
            {/* Header */}
            <div 
              onMouseDown={handleMouseDown}
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(30, 41, 59, 0.4)',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px',
                cursor: 'move',
                userSelect: 'none'
              }}
            >
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ margin: 0, fontSize: '14px', color: '#f59e0b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚡ Hàng đợi Khắc phục Điểm mù
                </h4>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Khắc phục chuẩn CLO - Bloom ({queueMode === 'questions' ? 'Đề thi' : 'Bài giảng'})
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  onClick={() => setIsQueueMinimized(true)}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#cbd5e1',
                    borderRadius: '4px',
                    width: '22px',
                    height: '22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '700'
                  }}
                  title="Thu gọn"
                >
                  _
                </button>
                <button 
                  onClick={() => {
                    cancelRef.current = true;
                    setShowQueuePanel(false);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#cbd5e1',
                    borderRadius: '50%',
                    width: '22px',
                    height: '22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '700',
                  }}
                  title="Đóng"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Body List */}
            <div style={{ padding: '20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', textAlign: 'left' }}>
                {queueProgressMsg || 'Hàng đợi đang chờ khởi chạy...'}
              </div>

              {/* Fast Mode Toggle */}
              {queueMode === 'questions' && !isQueueRunning && queue.every(q => q.status !== 'success') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 4px', margin: '4px 0', textAlign: 'left' }}>
                  <input 
                    type="checkbox" 
                    id="fast-mode-checkbox"
                    checked={isFastMode} 
                    onChange={(e) => setIsFastMode(e.target.checked)}
                    style={{ cursor: 'pointer', width: '14px', height: '14px' }}
                  />
                  <label htmlFor="fast-mode-checkbox" style={{ fontSize: '12px', color: '#fbbf24', cursor: 'pointer', userSelect: 'none', fontWeight: '600' }} title="Bỏ qua bước giải đề thử của Solver giúp rút ngắn thời gian sinh">
                    ⚡ Chế độ sinh nhanh (Fast Mode - Bỏ qua tự sửa sai)
                  </label>
                </div>
              )}

              {/* Progress bar */}
              {queue.length > 0 && (
                <div style={{ margin: '5px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                    <span>Tiến độ: {queue.filter(q => q.status === 'success').length}/{queue.length}</span>
                    <span>{Math.round((queue.filter(q => q.status === 'success').length / queue.length) * 100)}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${(queue.filter(q => q.status === 'success').length / queue.length) * 100}%`,
                      background: 'linear-gradient(90deg, #f59e0b 0%, #10b981 100%)',
                      transition: 'width 0.3s ease-in-out'
                    }} />
                  </div>
                </div>
              )}

              {/* Queue items list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                {queue.map((item, idx) => (
                  <div 
                    key={idx} 
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      padding: '8px 12px',
                      background: item.status === 'generating' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(15, 23, 42, 0.4)',
                      border: item.status === 'generating' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: '600', color: '#cbd5e1' }}>
                        {item.cloCode} — Bloom B{item.bloomLevel}
                      </span>
                      <div>
                        {item.status === 'pending' && <span style={{ color: '#94a3b8', fontSize: '11px' }}>Chờ xử lý</span>}
                        {item.status === 'generating' && <span style={{ color: '#fbbf24', fontSize: '11px' }}>🔄 Đang xử lý</span>}
                        {item.status === 'success' && <span style={{ color: '#10b981', fontSize: '11px', fontWeight: '700' }}>✅ Đã phủ</span>}
                        {item.status === 'failed' && <span style={{ color: '#ef4444', fontSize: '11px', fontWeight: '700' }}>❌ Lỗi</span>}
                      </div>
                    </div>
                    
                    {/* Real-time Stage message */}
                    {item.status === 'generating' && item.activeStageMessage && (
                      <div style={{ fontSize: '11px', color: '#fcd34d', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', textAlign: 'left' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#fbbf24', animation: 'pulse 1.5s infinite' }} />
                        {item.activeStageMessage}
                      </div>
                    )}
                    
                    {item.errorMsg && (
                      <span style={{ fontSize: '10px', color: '#f87171', marginTop: '2px', textAlign: 'left' }}>
                        Lỗi: {item.errorMsg}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Actions */}
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(30, 41, 59, 0.2)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              borderBottomLeftRadius: '16px',
              borderBottomRightRadius: '16px',
            }}>
              {!isQueueRunning ? (
                <button
                  onClick={() => {
                    cancelRef.current = false;
                    runGlobalQueue(queue, queueMode, selectedCourse.id);
                  }}
                  disabled={queue.length === 0 || queue.every(q => q.status === 'success')}
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 4px 10px rgba(245, 158, 11, 0.2)',
                  }}
                >
                  ▶ Bắt đầu
                </button>
              ) : (
                <button
                  onClick={() => {
                    cancelRef.current = true;
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fbbf24',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  ⏸ Tạm dừng
                </button>
              )}
              <button
                onClick={() => {
                  cancelRef.current = true;
                  setShowQueuePanel(false);
                }}
                style={{
                  background: 'none',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#94a3b8',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        )
      )}
    </>
  );
};

const styles = {
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'radial-gradient(circle at 10% 20%, rgb(15, 23, 42) 0%, rgb(9, 13, 26) 90%)',
    color: '#94a3b8',
    fontFamily: '"Outfit", "Inter", sans-serif',
  }
};
