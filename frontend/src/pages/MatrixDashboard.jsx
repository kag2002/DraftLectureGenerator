import React, { useState, useEffect } from 'react';
import client from '../api/client';
import FlowSteps from '../components/FlowSteps';

export default function MatrixDashboard({ 
  course, 
  onBack, 
  onNavigate,
  queue,
  isQueueRunning,
  showQueuePanel,
  queueProgressMsg,
  setIsQueueRunning,
  setQueue,
  setShowQueuePanel,
  setQueueProgressMsg,
  setQueueMode,
  cancelRef,
  runGlobalQueue
}) {
  const [matrixData, setMatrixData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeMode, setActiveMode] = useState('questions'); // 'questions' | 'materials'

  // States & Refs cho hàng đợi tự động khắc phục điểm mù
  const [chapters, setChapters] = useState([]);
  const prevSuccessCount = React.useRef(0);

  const fetchMatrix = async () => {
    setLoading(true);
    try {
      const response = await client.get(`/api/courses/${course.id}/matrix-coverage`);
      setMatrixData(response.data.matrix);
    } catch (err) {
      console.error(err);
      setError('Không thể tải dữ liệu ma trận bao phủ.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMatrixSilent = async () => {
    try {
      const response = await client.get(`/api/courses/${course.id}/matrix-coverage`);
      setMatrixData(response.data.matrix);
    } catch (err) {
      console.error("fetchMatrixSilent error:", err);
    }
  };

  const fetchChapters = async () => {
    try {
      const response = await client.get(`/api/courses/${course.id}/chapters`);
      setChapters(response.data);
    } catch (err) {
      console.error("fetchChapters error:", err);
    }
  };

  useEffect(() => {
    fetchMatrix();
    fetchChapters();
  }, [course.id]);

  // Theo dõi hàng đợi toàn cục: khi có bất kỳ mục nào thành công, tự động reload ma trận
  useEffect(() => {
    if (queue && queue.length > 0) {
      const successCount = queue.filter(q => q.status === 'success').length;
      if (successCount !== prevSuccessCount.current) {
        prevSuccessCount.current = successCount;
        fetchMatrixSilent();
      }
    } else {
      prevSuccessCount.current = 0;
    }
  }, [queue]);

  // Tìm chương học liên quan đến mã CLO dựa trên tiêu đề/mô tả
  const findChapterForClo = (cloCode) => {
    if (!chapters || chapters.length === 0) return null;
    const matched = chapters.find(ch => 
      (ch.title && ch.title.toLowerCase().includes(cloCode.toLowerCase())) ||
      (ch.description && ch.description.toLowerCase().includes(cloCode.toLowerCase()))
    );
    return matched ? matched.id : chapters[0].id;
  };

  // Khởi tạo hàng đợi chứa các điểm mù chất lượng của ma trận hiện tại
  const handleInitQueue = () => {
    if (isQueueRunning) {
      alert('Hàng đợi đang chạy dưới nền. Vui lòng Tạm dừng (Pause) hoặc Đóng hàng đợi hiện tại trước khi khởi tạo hàng đợi mới');
      return;
    }
    if (!matrixData) return;
    const newQueue = [];
    const cloCodes = Object.keys(matrixData);
    
    cloCodes.forEach(code => {
      const clo = matrixData[code];
      const targetLvl = clo.target_bloom;
      const levels = activeMode === 'questions' ? (clo.question_levels || clo.levels) : clo.material_levels;
      const count = levels[String(targetLvl)] || 0;
      
      if (count === 0) {
        newQueue.push({
          cloId: clo.clo_id,
          cloCode: code,
          bloomLevel: targetLvl,
          chapterId: findChapterForClo(code),
          status: 'pending',
          errorMsg: '',
          activeStageMessage: ''
        });
      }
    });
    
    if (newQueue.length === 0) {
      alert('Tuyệt vời! Hiện tại không có điểm mù nào cần khắc phục.');
      return;
    }
    
    setQueue(newQueue);
    setQueueMode(activeMode);
    setShowQueuePanel(true);
    setIsQueueRunning(false);
    setQueueProgressMsg('Hàng đợi đã sẵn sàng. Hãy bấm "Bắt đầu" để khởi chạy.');
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div>Đang phân tích độ phủ ma trận CLO - Bloom...</div>
      </div>
    );
  }

  // 1. Tính toán thống kê tổng quan
  let totalQuestions = 0;
  let totalSlides = 0;
  let totalClos = 0;
  let coveredClosQ = 0;
  let coveredClosM = 0;
  let blindSpotsCountQ = 0;
  let blindSpotsCountM = 0;

  if (matrixData) {
    const cloCodes = Object.keys(matrixData);
    totalClos = cloCodes.length;

    cloCodes.forEach(code => {
      const clo = matrixData[code];
      const targetLvlStr = str(clo.target_bloom);
      
      // Câu hỏi
      const qLevels = clo.question_levels || clo.levels || {};
      let qCount = 0;
      Object.keys(qLevels).forEach(lvl => {
        qCount += qLevels[lvl] || 0;
      });
      totalQuestions += qCount;
      if (qCount > 0) coveredClosQ += 1;
      if ((qLevels[targetLvlStr] || 0) === 0) {
        blindSpotsCountQ += 1;
      }

      // Slide/Học liệu
      const mLevels = clo.material_levels || {};
      let mCount = 0;
      Object.keys(mLevels).forEach(lvl => {
        mCount += mLevels[lvl] || 0;
      });
      totalSlides += mCount;
      if (mCount > 0) coveredClosM += 1;
      if ((mLevels[targetLvlStr] || 0) === 0) {
        blindSpotsCountM += 1;
      }
    });
  }

  const blindSpotsCount = activeMode === 'questions' ? blindSpotsCountQ : blindSpotsCountM;

  // Helper chuyển đổi số sang string cho an toàn
  function str(val) {
    return String(val);
  }

  const getBloomHeader = (lvl) => {
    const headers = ["Nhớ (B1)", "Hiểu (B2)", "Vận dụng (B3)", "Phân tích (B4)", "Đánh giá (B5)", "Sáng tạo (B6)"];
    return headers[lvl - 1];
  };

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button onClick={onBack} style={styles.backBtn}>← Sơ đồ</button>
          <div>
            <span style={styles.badge}>{course.course_code}</span>
            <h2 style={styles.courseTitle}>Báo Cáo Độ Phủ Ma Trận CLO - Bloom</h2>
          </div>
        </div>
        {onNavigate && <FlowSteps activeStep="matrix" onNavigate={onNavigate} />}
      </header>

      {error && <div style={styles.errorAlert}>{error}</div>}

      {matrixData && (
        <div style={styles.content}>
          {/* TAB MODE SELECTOR */}
          <div style={styles.tabContainer}>
            <button 
              onClick={() => {
                if (isQueueRunning) {
                  alert('Hàng đợi đang chạy dưới nền. Vui lòng Tạm dừng (Pause) hoặc Đóng hàng đợi hiện tại trước khi chuyển đổi chế độ.');
                  return;
                }
                setActiveMode('questions');
              }} 
              style={activeMode === 'questions' ? styles.activeTabBtn : styles.inactiveTabBtn}
            >
              📝 Ma trận Đề thi (Câu hỏi)
            </button>
            <button 
              onClick={() => {
                if (isQueueRunning) {
                  alert('Hàng đợi đang chạy dưới nền. Vui lòng Tạm dừng (Pause) hoặc Đóng hàng đợi hiện tại trước khi chuyển đổi chế độ.');
                  return;
                }
                setActiveMode('materials');
              }} 
              style={activeMode === 'materials' ? styles.activeTabBtn : styles.inactiveTabBtn}
            >
              🖼️ Ma trận Bài giảng (Nội dung)
            </button>
          </div>

          {/* STATS OVERVIEW CARDS */}
          <div style={styles.statsRow}>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>{activeMode === 'questions' ? 'Tổng số Câu hỏi' : 'Tổng số Slide bài giảng'}</div>
              <div style={styles.statValue}>{activeMode === 'questions' ? totalQuestions : totalSlides}</div>
              <div style={styles.statSub}>{activeMode === 'questions' ? 'Đã lưu trữ trong ngân hàng đề' : 'Đã thiết kế trong các chương học'}</div>
            </div>
            
            <div style={styles.statCard}>
              <div style={styles.statLabel}>{activeMode === 'questions' ? 'Độ bao phủ CLOs (Câu hỏi)' : 'Độ bao phủ CLOs (Slide)'}</div>
              <div style={styles.statValue}>
                {activeMode === 'questions' ? `${coveredClosQ}/${totalClos}` : `${coveredClosM}/${totalClos}`}
              </div>
              <div style={styles.statSub}>
                {totalClos > 0 ? `${(((activeMode === 'questions' ? coveredClosQ : coveredClosM)/totalClos)*100).toFixed(0)}%` : '0%'} chuẩn đầu ra đã được bao phủ
              </div>
            </div>

            <div style={styles.statCardDanger}>
              <div style={styles.statLabel}>Điểm mù Chất lượng (Blind Spots)</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', marginBottom: '5px' }}>
                <div style={{ ...styles.statValue, margin: 0 }}>{activeMode === 'questions' ? blindSpotsCountQ : blindSpotsCountM}</div>
                {blindSpotsCount > 0 && (
                  <button 
                    onClick={handleInitQueue}
                    style={{
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 14px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      boxShadow: '0 4px 10px rgba(239, 68, 68, 0.3)',
                      transition: 'transform 0.2s',
                    }}
                    title="Tự động khởi chạy hàng đợi sửa chữa tất cả điểm mù chất lượng qua AI"
                  >
                    ⚡ Khắc phục hàng loạt
                  </button>
                )}
              </div>
              <div style={styles.statSubDanger}>{activeMode === 'questions' ? 'CLOs chưa có câu hỏi đúng mức Bloom quy định' : 'CLOs chưa có nội dung slide đúng mức Bloom quy định'}</div>
            </div>
          </div>

          {/* BLIND SPOTS ALERTS SECTION */}
          {blindSpotsCount > 0 && (
            <div style={styles.blindSpotsSection}>
              <h4 style={styles.blindSpotsTitle}>🚨 Danh sách Điểm Mù Chất lượng cần khắc phục ({activeMode === 'questions' ? 'Đánh giá' : 'Giảng dạy'}):</h4>
              <div style={styles.blindSpotsList}>
                {Object.keys(matrixData).map(code => {
                  const clo = matrixData[code];
                  const targetLvl = clo.target_bloom;
                  const levels = activeMode === 'questions' ? (clo.question_levels || clo.levels) : clo.material_levels;
                  const count = levels[str(targetLvl)] || 0;
                  if (count === 0) {
                    return (
                      <div key={code} style={styles.blindSpotAlert}>
                        <strong>Chuẩn đầu ra {code}:</strong> Chưa có {activeMode === 'questions' ? 'câu hỏi trắc nghiệm' : 'nội dung slide'} nào phục vụ mức nhận thức mục tiêu <strong>{getBloomHeader(targetLvl)}</strong>.
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#fca5a5' }}>
                          * Gợi ý: {activeMode === 'questions' ? `Hãy mở Ngân hàng câu hỏi, chọn chuẩn đầu ra ${code} và chọn mức Bloom ${targetLvl} để sinh thêm câu hỏi tương ứng.` : `Hãy mở Soạn bài giảng, chọn chương học liên quan đến ${code} để bổ sung nội dung slide giảng dạy mức Bloom ${targetLvl}.`}
                        </p>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          )}

          {/* HEATMAP TABLE */}
          <section style={styles.heatmapCard}>
            <h3 style={styles.sectionTitle}>Ma trận Phủ Chuẩn đầu ra (Bloom x CLO Heatmap) — {activeMode === 'questions' ? 'Góc nhìn Đánh giá' : 'Góc nhìn Giảng dạy'}</h3>
            <p style={styles.sectionSub}>
              Cột dọc đại diện cho chuẩn đầu ra (CLO), cột ngang đại diện cho các mức nhận thức Bloom.
              Màu tím đậm biểu thị mức độ phủ cao. Ô có đường viền nét đứt <strong style={{color: '#f87171'}}>màu đỏ</strong> có icon ⚠️ chính là <strong>Điểm mù (Blind Spot)</strong> cần bổ sung câu hỏi/nội dung giảng dạy gấp.
            </p>

            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.thLabel}>Chuẩn Đầu Ra (CLOs)</th>
                    <th style={styles.thCenter}>Mức Mục Tiêu</th>
                    {[1, 2, 3, 4, 5, 6].map(b => (
                      <th key={b} style={styles.th}>{getBloomHeader(b)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(matrixData).map(code => {
                    const clo = matrixData[code];
                    return (
                      <tr key={code} style={styles.tr}>
                        <td style={styles.tdLabel}>
                          <strong style={styles.cloCode}>{code}</strong>
                          <span style={styles.cloDesc}>{clo.description}</span>
                        </td>
                        <td style={styles.tdTarget}>
                          <span style={styles.targetBadge}>B{clo.target_bloom}</span>
                        </td>
                        {[1, 2, 3, 4, 5, 6].map(b => {
                          const levels = activeMode === 'questions' ? (clo.question_levels || clo.levels) : clo.material_levels;
                          const count = levels[str(b)] || 0;
                          const isTarget = clo.target_bloom === b;
                          const isBlindSpot = isTarget && count === 0;
                          
                          // Tính toán background color dựa trên số câu hỏi/slides
                          let bg = 'rgba(15, 23, 42, 0.3)';
                          let border = '1px solid rgba(255, 255, 255, 0.04)';
                          
                          if (count > 0) {
                            const opacity = Math.min(0.9, 0.15 + count * 0.18);
                            // Dùng màu tím Indigo cho câu hỏi, màu ngọc lục bảo Emerald/Teal cho slide học liệu
                            const rgbColor = activeMode === 'questions' ? '99, 102, 241' : '20, 184, 166';
                            bg = `rgba(${rgbColor}, ${opacity})`;
                          } else if (isBlindSpot) {
                            bg = 'rgba(239, 68, 68, 0.08)';
                            border = '2px dashed rgba(239, 68, 68, 0.5)';
                          } else if (isTarget) {
                            // Ô mục tiêu nhưng hiện tại rỗng
                            bg = 'rgba(255, 255, 255, 0.02)';
                            border = '1px dashed rgba(255, 255, 255, 0.2)';
                          }

                          return (
                            <td 
                              key={b} 
                              className="matrix-cell-clickable"
                              style={{
                                ...styles.tdCell,
                                backgroundColor: bg,
                                border: border
                              }}
                              onClick={() => {
                                onNavigate(activeMode === 'questions' ? 'question_bank' : 'lesson_planner', {
                                  cloId: clo.clo_id,
                                  cloCode: code,
                                  bloomLevel: b
                                });
                              }}
                              title={
                                isBlindSpot 
                                  ? `Nhấn để khắc phục điểm mù: Thêm ${activeMode === 'questions' ? 'câu hỏi' : 'bài giảng'} còn thiếu cho ${code} - Mức Bloom B${b}` 
                                  : `Thống kê ${code} - Bloom B${b}: có ${count} mục. Nhấn để chuyển đến trang chi tiết.`
                              }
                            >
                              <div style={styles.cellContent}>
                                <span style={count > 0 ? styles.cellCountActive : styles.cellCount}>
                                  {count}
                                </span>
                                {isBlindSpot && (
                                  <span style={styles.blindWarning}>⚠️ Thiếu</span>
                                )}
                                {isTarget && !isBlindSpot && count > 0 && (
                                  <span style={styles.targetTick}>✓ Đạt</span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}


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
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'radial-gradient(circle at 10% 20%, rgb(15, 23, 42) 0%, rgb(9, 13, 26) 90%)',
    color: '#a5b4fc',
    fontSize: '15px',
    fontFamily: '"Outfit", sans-serif',
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
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '35px',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '24px',
  },
  statCard: {
    background: 'rgba(30, 41, 59, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '20px',
    padding: '20px 24px',
  },
  statCardDanger: {
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '20px',
    padding: '20px 24px',
  },
  statLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statValue: {
    fontSize: '32px',
    fontWeight: '800',
    color: '#f8fafc',
    margin: '10px 0 5px 0',
  },
  statSub: {
    fontSize: '12px',
    color: '#64748b',
  },
  statSubDanger: {
    fontSize: '12px',
    color: '#fca5a5',
    fontWeight: '600',
  },
  heatmapCard: {
    background: 'rgba(30, 41, 59, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '20px',
    padding: '30px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '700',
    margin: '0 0 10px 0',
  },
  sectionSub: {
    fontSize: '13px',
    color: '#94a3b8',
    margin: '0 0 30px 0',
    lineHeight: '1.5',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: '10px',
  },
  thLabel: {
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    padding: '10px',
  },
  thCenter: {
    textAlign: 'center',
    fontSize: '12px',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    padding: '10px',
  },
  th: {
    textAlign: 'center',
    fontSize: '11px',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    padding: '10px',
    width: '110px',
  },
  tr: {
    background: 'none',
  },
  tdLabel: {
    background: 'rgba(15, 23, 42, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    borderRadius: '12px',
    padding: '15px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  cloCode: {
    color: '#818cf8',
    fontSize: '14px',
    fontWeight: '800',
  },
  cloDesc: {
    color: '#cbd5e1',
    fontSize: '13px',
    lineHeight: '1.4',
  },
  tdTarget: {
    textAlign: 'center',
    verticalAlign: 'middle',
  },
  targetBadge: {
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    color: '#f59e0b',
    fontSize: '11px',
    fontWeight: '700',
    padding: '4px 10px',
    borderRadius: '6px',
    display: 'inline-block',
  },
  tdCell: {
    textAlign: 'center',
    verticalAlign: 'middle',
    borderRadius: '12px',
    padding: '15px',
    transition: 'transform 0.2s',
  },
  cellContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  cellCount: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#475569',
  },
  cellCountActive: {
    fontSize: '18px',
    fontWeight: '800',
    color: '#ffffff',
  },
  blindWarning: {
    background: '#ef4444',
    color: '#ffffff',
    fontSize: '9px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '4px',
    animation: 'pulse 1.5s infinite',
  },
  targetTick: {
    background: '#10b981',
    color: '#ffffff',
    fontSize: '9px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  blindSpotsSection: {
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    borderRadius: '16px',
    padding: '20px 24px',
  },
  blindSpotsTitle: {
    margin: '0 0 15px 0',
    fontSize: '14px',
    fontWeight: '700',
    color: '#f87171',
    textTransform: 'uppercase',
  },
  blindSpotsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  blindSpotAlert: {
    fontSize: '13px',
    color: '#fca5a5',
    lineHeight: '1.4',
    paddingLeft: '15px',
    borderLeft: '3px solid #ef4444',
    textAlign: 'left',
  },
  tabContainer: {
    display: 'flex',
    gap: '12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '16px',
    marginBottom: '10px'
  },
  activeTabBtn: {
    background: 'rgba(99, 102, 241, 0.25)',
    border: '1px solid #6366f1',
    color: '#ffffff',
    borderRadius: '10px',
    padding: '10px 20px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '700',
    transition: 'all 0.2s',
    outline: 'none'
  },
  inactiveTabBtn: {
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#94a3b8',
    borderRadius: '10px',
    padding: '10px 20px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    transition: 'all 0.2s',
    outline: 'none'
  }
};
