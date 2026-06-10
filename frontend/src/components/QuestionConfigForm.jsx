import React from 'react';

export default function QuestionConfigForm({
  selectedClo,
  setSelectedClo,
  clos,
  selectedChapter,
  setSelectedChapter,
  chapters,
  bloomLevel,
  setBloomLevel,
  count,
  setCount,
  generating,
  loading,
  genLog,
  handleGenerateQuestions,
  isFastMode,
  setIsFastMode,
  styles
}) {
  return (
    <aside style={styles.sidebar}>
      
      {/* SECTION 1: AI GENERATOR */}
      <section style={styles.card}>
        <h3 style={styles.cardTitle}>Tạo câu hỏi trắc nghiệm bằng AI</h3>
        <form onSubmit={handleGenerateQuestions} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Chuẩn đầu ra (CLO)</label>
            <select 
              value={selectedClo} 
              onChange={(e) => setSelectedClo(e.target.value)}
              style={styles.select}
              required
            >
              {clos.map(c => (
                <option key={c.id} value={c.id}>[{c.clo_code}] {c.description.substring(0, 35)}...</option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Chương học liên quan</label>
            <select 
              value={selectedChapter} 
              onChange={(e) => setSelectedChapter(e.target.value)}
              style={styles.select}
            >
              <option value="">Không bắt buộc</option>
              {chapters.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Mức Bloom</label>
              <select 
                value={bloomLevel} 
                onChange={(e) => setBloomLevel(e.target.value)}
                style={styles.select}
              >
                <option value={1}>Nhớ (B1)</option>
                <option value={2}>Hiểu (B2)</option>
                <option value={3}>Vận dụng (B3)</option>
                <option value={4}>Phân tích (B4)</option>
                <option value={5}>Đánh giá (B5)</option>
                <option value={6}>Sáng tạo (B6)</option>
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Số lượng</label>
              <input 
                type="number" 
                min="1" 
                max="5"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                style={styles.input}
              />
            </div>
          </div>

          {/* Fast Mode Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 4px', margin: '4px 0', textAlign: 'left' }}>
            <input 
              type="checkbox" 
              id="config-fast-mode-checkbox"
              checked={isFastMode} 
              onChange={(e) => setIsFastMode(e.target.checked)}
              style={{ cursor: 'pointer', width: '14px', height: '14px' }}
            />
            <label htmlFor="config-fast-mode-checkbox" style={{ fontSize: '12.5px', color: '#fbbf24', cursor: 'pointer', userSelect: 'none', fontWeight: '600' }} title="Bỏ qua bước giải đề thử của Solver giúp rút ngắn thời gian sinh">
              ⚡ Chế độ sinh nhanh (Fast Mode)
            </label>
          </div>

          <button type="submit" disabled={generating || loading} style={styles.submitBtn}>
            {generating ? 'AI Đang tạo câu hỏi...' : 'Bắt đầu tạo câu hỏi'}
          </button>

          {generating && (
            <div style={styles.genLogBox}>
              <div style={styles.pulseDot}></div>
              <span style={styles.logText}>{genLog}</span>
            </div>
          )}
        </form>
      </section>

    </aside>
  );
}
