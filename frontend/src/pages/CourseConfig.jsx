import React, { useState, useEffect } from 'react';
import client from '../api/client';
import FlowSteps from '../components/FlowSteps';

export default function CourseConfig({ course, onBack, onNavigate, onStartPlanning }) {
  const [clos, setClos] = useState([]);
  const [file, setFile] = useState(null);
  const [rawText, setRawText] = useState('');
  const [useTextarea, setUseTextarea] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [streamLog, setStreamLog] = useState('');
  const [streamStage, setStreamStage] = useState(0); // 0 -> 4

  // Lấy các CLO hiện có của môn học từ API
  const fetchClos = async () => {
    setLoading(true);
    try {
      const response = await client.get(`/api/courses/${course.id}/clos`);
      setClos(response.data);
    } catch (err) {
      console.error(err);
      setError('Không thể lấy danh sách CLO hiện tại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClos();
  }, [course.id]);

  // Xử lý upload file Syllabus và gửi API parse bằng Stream SSE
  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file && !useTextarea) {
      setError('Vui lòng chọn file Syllabus hoặc nhập văn bản thô.');
      return;
    }

    setError('');
    setMessage('');
    setLoading(true);
    setStreamLog('🚀 Đang kết nối tới AI...');
    setStreamStage(0);
    setClos([]); // Xóa danh sách cũ để cập nhật mới từ stream

    const token = localStorage.getItem('token');

    try {
      let finalFile;
      if (useTextarea) {
        const blob = new Blob([rawText], { type: 'text/plain' });
        finalFile = new File([blob], 'syllabus_pasted.txt', { type: 'text/plain' });
      } else {
        finalFile = file;
      }

      const formData = new FormData();
      formData.append('file', finalFile);

      const response = await fetch(
        `http://localhost:8000/api/courses/${course.id}/parse-syllabus-stream`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `Lỗi server: ${response.status}`);
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
                setStreamStage(data.stage);
                setStreamLog(data.message);
              } else if (currentEvent === 'clo') {
                // Thêm dần CLO nhận được từ stream để hiển thị thời gian thực
                setClos(prev => {
                  if (prev.some(c => c.id === data.clo.id || c.clo_code === data.clo.clo_code)) {
                    return prev.map(c => c.clo_code === data.clo.clo_code ? data.clo : c);
                  }
                  return [...prev, data.clo];
                });
                setStreamLog(`✅ Đã trích xuất CLO ${data.index}/${data.total}: ${data.clo.clo_code}`);
              } else if (currentEvent === 'done') {
                setClos(data.clos);
                setMessage(data.message);
                setLoading(false);
                setStreamLog('');
                setStreamStage(0);
              } else if (currentEvent === 'error') {
                setError(data.message);
                setLoading(false);
                setStreamLog('');
                setStreamStage(0);
              }
            } catch (jsonErr) {
              console.error("Lỗi parse JSON stream:", jsonErr);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setError(`Lỗi phân tích Syllabus: ${err.message}`);
      setLoading(false);
      setStreamLog('');
      setStreamStage(0);
    }
  };

  // Thêm một dòng CLO trống
  const handleAddRow = () => {
    const newCode = `CLO${clos.length + 1}`;
    setClos([
      ...clos,
      { id: Date.now(), clo_code: newCode, description: '', bloom_level: 2 }
    ]);
  };

  // Xóa một dòng CLO
  const handleRemoveRow = (index) => {
    setClos(clos.filter((_, idx) => idx !== index));
  };

  // Cập nhật giá trị một trường của CLO trong danh sách
  const handleFieldChange = (index, field, value) => {
    const updated = [...clos];
    updated[index][field] = value;
    setClos(updated);
  };

  // Lưu danh sách CLO xuống DB
  const handleSaveClos = async () => {
    setError('');
    setMessage('');
    setSaving(true);

    try {
      // Vì API post /api/courses/{course_id}/clos tạo lẻ tẻ, 
      // để update đồng loạt, ta có thể gửi tuần tự hoặc ghi đè Syllabus API.
      // Dễ nhất cho MVP: Gửi danh sách CLOs lên, backend đã xóa cũ và lưu mới khi upload.
      // Ta sẽ tạo một endpoint giả lập hoặc lưu từng CLO.
      // Để đồng nhất với backend CRUD, ta sẽ gọi tuần tự: xóa hết closet cũ và tạo mới.
      
      // Ở đây ta gọi lưu Syllabus bằng cách truyền blob JSON thô
      const textData = JSON.stringify({ clos: clos });
      const blob = new Blob([`{"clos": ${textData}}`], { type: 'text/plain' });
      const jsonFile = new File([blob], 'syllabus_updated.txt', { type: 'text/plain' });
      
      const formData = new FormData();
      formData.append('file', jsonFile);
      
      await client.post(`/api/courses/${course.id}/parse-syllabus`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setMessage('Đã lưu danh sách CLO thành công!');
      // Refresh danh sách từ DB để lấy id thật
      fetchClos();
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.detail || err.response?.data?.message || err.response?.data?.details || 'Lỗi khi lưu danh sách CLO.';
      setError(typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button onClick={onBack} style={styles.backBtn}>← Sơ đồ</button>
          <div>
            <span style={styles.badge}>{course.course_code}</span>
            <h2 style={styles.courseTitle}>{course.course_name}</h2>
          </div>
        </div>
        {onNavigate && <FlowSteps activeStep="syllabus" onNavigate={onNavigate} />}
        <div>
          <button onClick={onStartPlanning} style={styles.startPlanningBtn}>
            Bắt đầu soạn bài (AI Planner) →
          </button>
        </div>
      </header>

      {error && <div style={styles.errorAlert}>{error}</div>}
      {message && <div style={styles.successAlert}>{message}</div>}

      <div style={styles.grid}>
        {/* CỘT TRÁI: UPLOAD SYLLABUS */}
        <section style={styles.uploadCard}>
          <h3 style={styles.sectionTitle}>Nạp Tri Thức Đề Cương</h3>
          <div style={styles.tabHeader}>
            <button 
              onClick={() => setUseTextarea(false)} 
              style={!useTextarea ? styles.activeTab : styles.inactiveTab}
            >
              Tải File Lên
            </button>
            <button 
              onClick={() => setUseTextarea(true)} 
              style={useTextarea ? styles.activeTab : styles.inactiveTab}
            >
              Dán Văn Bản Thô
            </button>
          </div>

          <form onSubmit={handleFileUpload} style={styles.uploadForm}>
            {!useTextarea ? (
              <div style={styles.dropzone}>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={(e) => setFile(e.target.files[0])}
                  style={styles.fileInput}
                  id="syllabus-file"
                />
                <label htmlFor="syllabus-file" style={styles.dropzoneLabel}>
                  <div style={{fontSize: '32px', marginBottom: '10px'}}>📄</div>
                  {file ? (
                    <strong style={{color: '#a5b4fc'}}>{file.name}</strong>
                  ) : (
                    <>
                      <strong>Chọn file Syllabus của bạn</strong>
                      <span style={{fontSize: '12px', color: '#64748b', marginTop: '4px'}}>
                        Hỗ trợ PDF, DOCX, TXT (Tối đa 50MB)
                      </span>
                    </>
                  )}
                </label>
              </div>
            ) : (
              <textarea
                placeholder="Dán toàn bộ nội dung text Syllabus vào đây..."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                style={styles.textarea}
                rows={10}
                required
              />
            )}

            <button type="submit" disabled={loading} style={styles.parseBtn}>
              {loading ? 'Đang phân tích (LLM)...' : 'Bắt đầu phân tích Syllabus (AI)'}
            </button>
          </form>

          {loading && streamStage > 0 && (
            <div style={styles.progressContainer}>
              <div style={styles.progressBarWrapper}>
                <div 
                  style={{
                    ...styles.progressBar,
                    width: `${(streamStage / 4) * 100}%`,
                    background: streamStage === 4 
                      ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)' 
                      : 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)'
                  }}
                />
              </div>
              <div style={styles.progressText}>
                <span>Giai đoạn {streamStage}/4</span>
                <span>{Math.round((streamStage / 4) * 100)}%</span>
              </div>
              {streamLog && (
                <div style={styles.streamLogText}>
                  <span style={styles.pulseDot} /> {streamLog}
                </div>
              )}
            </div>
          )}
        </section>

        {/* CỘT PHẢI: MAPPER CLO & BLOOM TAXONOMY */}
        <section style={styles.mapperCard}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>Ma Trận Chuẩn Đầu Ra (CLOs)</h3>
            <button onClick={handleAddRow} style={styles.addBtn}>+ Thêm CLO</button>
          </div>

          {clos.length === 0 && !loading ? (
            <div style={styles.emptyState}>
              <p>Chưa cấu hình Chuẩn đầu ra môn học.</p>
              <p style={{fontSize: '12px', color: '#64748b'}}>Hãy upload Syllabus ở bên trái để AI tự động trích xuất.</p>
            </div>
          ) : clos.length === 0 && loading ? (
            <div style={styles.loadingState}>
              <div style={styles.spinner} />
              <p style={{marginTop: '15px', color: '#94a3b8', fontSize: '13px'}}>AI đang khởi động phân tích đề cương...</p>
            </div>
          ) : (
            <div style={styles.list}>
              {clos.map((clo, index) => (
                <div key={clo.id || index} style={styles.row}>
                  <input
                    type="text"
                    value={clo.clo_code}
                    onChange={(e) => handleFieldChange(index, 'clo_code', e.target.value)}
                    style={styles.cloCodeInput}
                    placeholder="Mã CLO"
                    required
                  />
                  <input
                    type="text"
                    value={clo.description}
                    onChange={(e) => handleFieldChange(index, 'description', e.target.value)}
                    style={styles.cloDescInput}
                    placeholder="Mô tả chuẩn đầu ra môn học (động từ hành động Bloom)"
                    required
                  />
                  <select
                    value={clo.bloom_level}
                    onChange={(e) => handleFieldChange(index, 'bloom_level', parseInt(e.target.value))}
                    style={styles.bloomSelect}
                  >
                    <option value={1}>Nhớ (B1)</option>
                    <option value={2}>Hiểu (B2)</option>
                    <option value={3}>Vận dụng (B3)</option>
                    <option value={4}>Phân tích (B4)</option>
                    <option value={5}>Đánh giá (B5)</option>
                    <option value={6}>Sáng tạo (B6)</option>
                  </select>
                  <button onClick={() => handleRemoveRow(index)} style={styles.rowDeleteBtn}>🗑️</button>
                </div>
              ))}
              
              <div style={styles.saveContainer}>
                <button onClick={handleSaveClos} disabled={saving} style={styles.saveBtn}>
                  {saving ? 'Đang lưu...' : 'Lưu & Đồng bộ CLOs'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'radial-gradient(circle at 10% 20%, rgb(15, 23, 42) 0%, rgb(9, 13, 26) 90%)',
    fontFamily: '"Outfit", "Inter", sans-serif',
    color: '#f8fafc',
    padding: '30px 40px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '20px',
    marginBottom: '35px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  startPlanningBtn: {
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  backBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#cbd5e1',
    borderRadius: '10px',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
  },
  badge: {
    background: 'rgba(99, 102, 241, 0.15)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    color: '#a5b4fc',
    fontSize: '11px',
    fontWeight: '700',
    padding: '2px 8px',
    borderRadius: '6px',
    display: 'inline-block',
    marginBottom: '4px',
  },
  courseTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '700',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '400px 1fr',
    gap: '40px',
    alignItems: 'start',
  },
  uploadCard: {
    background: 'rgba(30, 41, 59, 0.4)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '20px',
    padding: '24px',
  },
  mapperCard: {
    background: 'rgba(30, 41, 59, 0.25)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '20px',
    padding: '24px',
    minHeight: '400px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: '#f1f5f9',
    margin: 0,
    borderLeft: '3px solid #6366f1',
    paddingLeft: '10px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  tabHeader: {
    display: 'flex',
    background: 'rgba(15, 23, 42, 0.6)',
    borderRadius: '10px',
    padding: '4px',
    margin: '20px 0',
  },
  activeTab: {
    flex: 1,
    background: 'rgba(99, 102, 241, 0.2)',
    border: '1px solid rgba(99, 102, 241, 0.4)',
    color: '#a5b4fc',
    borderRadius: '8px',
    padding: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  inactiveTab: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: '#64748b',
    borderRadius: '8px',
    padding: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  uploadForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  dropzone: {
    border: '2px dashed rgba(255, 255, 255, 0.1)',
    borderRadius: '14px',
    padding: '30px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    position: 'relative',
    transition: 'border-color 0.3s',
  },
  fileInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer',
  },
  dropzoneLabel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    color: '#94a3b8',
    fontSize: '14px',
  },
  textarea: {
    background: 'rgba(15, 23, 42, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '14px',
    color: '#f8fafc',
    fontSize: '13px',
    width: '100%',
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  parseBtn: {
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '14px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(99, 102, 241, 0.2)',
  },
  addBtn: {
    background: 'rgba(99, 102, 241, 0.1)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    color: '#a5b4fc',
    borderRadius: '8px',
    padding: '6px 14px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  row: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    background: 'rgba(15, 23, 42, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    borderRadius: '10px',
    padding: '10px',
  },
  cloCodeInput: {
    width: '90px',
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    padding: '8px 10px',
    color: '#f8fafc',
    fontSize: '13px',
    textAlign: 'center',
    fontWeight: '700',
    outline: 'none',
  },
  cloDescInput: {
    flex: 1,
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    padding: '8px 12px',
    color: '#f8fafc',
    fontSize: '13px',
    outline: 'none',
  },
  bloomSelect: {
    width: '140px',
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    padding: '8px 10px',
    color: '#f8fafc',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
  },
  rowDeleteBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
  },
  saveContainer: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '15px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '15px',
  },
  saveBtn: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)',
  },
  loadingState: {
    color: '#94a3b8',
    textAlign: 'center',
    padding: '40px',
  },
  emptyState: {
    background: 'rgba(30, 41, 59, 0.1)',
    border: '1px dashed rgba(255, 255, 255, 0.05)',
    borderRadius: '14px',
    padding: '60px 40px',
    textAlign: 'center',
    color: '#94a3b8',
  },
  errorAlert: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#fca5a5',
    padding: '12px 20px',
    borderRadius: '10px',
    fontSize: '13px',
    marginBottom: '20px',
  },
  successAlert: {
    background: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    color: '#a7f3d0',
    padding: '12px 20px',
    borderRadius: '10px',
    fontSize: '13px',
    marginBottom: '20px',
  },
  progressContainer: {
    marginTop: '20px',
    background: 'rgba(15, 23, 42, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    padding: '15px',
  },
  progressBarWrapper: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    height: '8px',
    overflow: 'hidden',
    marginBottom: '10px',
  },
  progressBar: {
    height: '100%',
    transition: 'width 0.4s ease-out',
  },
  progressText: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: '10px',
  },
  streamLogText: {
    fontSize: '13px',
    color: '#cbd5e1',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    lineHeight: '1.4',
  },
  pulseDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#818cf8',
    boxShadow: '0 0 8px #818cf8',
    display: 'inline-block',
    animation: 'pulse 1.5s infinite',
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '3px solid rgba(99, 102, 241, 0.1)',
    borderTop: '3px solid #6366f1',
    borderRadius: '50%',
    margin: '0 auto',
    animation: 'spin 1s linear infinite',
  }
};
