import React, { useState, useEffect } from 'react';
import client from '../api/client';

export default function MatrixDashboard({ course, onBack }) {
  const [matrixData, setMatrixData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  useEffect(() => {
    fetchMatrix();
  }, [course.id]);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div>Đang phân tích độ phủ ma trận CLO - Bloom...</div>
      </div>
    );
  }

  // 1. Tính toán thống kê tổng quan
  let totalQuestions = 0;
  let totalClos = 0;
  let coveredClos = 0;
  let blindSpotsCount = 0;

  if (matrixData) {
    const cloCodes = Object.keys(matrixData);
    totalClos = cloCodes.length;

    cloCodes.forEach(code => {
      const clo = matrixData[code];
      const levels = clo.levels;
      
      // Tính tổng câu hỏi
      let qCount = 0;
      Object.keys(levels).forEach(lvl => {
        qCount += levels[lvl];
      });
      totalQuestions += qCount;

      // Đánh giá covered
      if (qCount > 0) coveredClos += 1;

      // Đánh giá Blind Spot
      // Điểm mù là khi mức Bloom mục tiêu (target_bloom) có 0 câu hỏi bao phủ
      const targetLvlStr = str(clo.target_bloom);
      if (levels[targetLvlStr] === 0) {
        blindSpotsCount += 1;
      }
    });
  }

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
          <button onClick={onBack} style={styles.backBtn}>← Quay lại Ngân hàng câu hỏi</button>
          <div>
            <span style={styles.badge}>{course.course_code}</span>
            <h2 style={styles.courseTitle}>Báo Cáo Độ Phủ Ma Trận CLO - Bloom</h2>
          </div>
        </div>
      </header>

      {error && <div style={styles.errorAlert}>{error}</div>}

      {matrixData && (
        <div style={styles.content}>
          {/* STATS OVERVIEW CARDS */}
          <div style={styles.statsRow}>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Tổng số Câu hỏi</div>
              <div style={styles.statValue}>{totalQuestions}</div>
              <div style={styles.statSub}>Đã lưu trữ trong ngân hàng đề</div>
            </div>
            
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Độ bao phủ CLOs</div>
              <div style={styles.statValue}>
                {coveredClos}/{totalClos}
              </div>
              <div style={styles.statSub}>
                {totalClos > 0 ? `${((coveredClos/totalClos)*100).toFixed(0)}%` : '0%'} chuẩn đầu ra đã có câu hỏi
              </div>
            </div>

            <div style={styles.statCardDanger}>
              <div style={styles.statLabel}>Điểm mù Chất lượng (Blind Spots)</div>
              <div style={styles.statValue}>{blindSpotsCount}</div>
              <div style={styles.statSubDanger}>CLOs chưa có câu hỏi đúng mức Bloom quy định</div>
            </div>
          </div>

          {/* HEATMAP TABLE */}
          <section style={styles.heatmapCard}>
            <h3 style={styles.sectionTitle}>Ma trận Phủ Chuẩn đầu ra (Bloom x CLO Heatmap)</h3>
            <p style={styles.sectionSub}>
              Cột dọc đại diện cho chuẩn đầu ra (CLO), cột ngang đại diện cho các mức nhận thức Bloom.
              Màu tím đậm biểu thị mức độ phủ cao. Ô có đường viền nét đứt <strong style={{color: '#f87171'}}>màu đỏ</strong> có icon ⚠️ chính là <strong>Điểm mù (Blind Spot)</strong> cần bổ sung câu hỏi gấp.
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
                          const count = clo.levels[str(b)] || 0;
                          const isTarget = clo.target_bloom === b;
                          const isBlindSpot = isTarget && count === 0;
                          
                          // Tính toán background color dựa trên số câu hỏi
                          let bg = 'rgba(15, 23, 42, 0.3)';
                          let border = '1px solid rgba(255, 255, 255, 0.04)';
                          
                          if (count > 0) {
                            const opacity = Math.min(0.9, 0.15 + count * 0.18);
                            bg = `rgba(99, 102, 241, ${opacity})`;
                          } else if (isBlindSpot) {
                            bg = 'rgba(239, 68, 68, 0.08)';
                            border = '2px dashed rgba(239, 68, 68, 0.5)';
                          } else if (isTarget) {
                            // Ô mục tiêu nhưng hiện tại rỗng và không bị đánh là blind spot (ví dụ level rỗng khác)
                            bg = 'rgba(255, 255, 255, 0.02)';
                            border = '1px dashed rgba(255, 255, 255, 0.2)';
                          }

                          return (
                            <td 
                              key={b} 
                              style={{
                                ...styles.tdCell,
                                backgroundColor: bg,
                                border: border
                              }}
                            >
                              <div style={styles.cellContent}>
                                <span style={count > 0 ? styles.cellCountActive : styles.cellCount}>
                                  {count}
                                </span>
                                {isBlindSpot && (
                                  <span style={styles.blindWarning} title="Chưa phủ mức Bloom mục tiêu!">⚠️ Mù</span>
                                )}
                                {isTarget && !isBlindSpot && count > 0 && (
                                  <span style={styles.targetTick} title="Đạt yêu cầu Bloom mục tiêu">✓ Đạt</span>
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
  }
};
