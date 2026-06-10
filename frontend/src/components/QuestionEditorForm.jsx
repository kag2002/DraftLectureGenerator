import React from 'react';

export default function QuestionEditorForm({
  editingQuestion,
  setEditingQuestion,
  clos,
  handleUpdateQuestion,
  styles
}) {
  if (!editingQuestion) return null;

  return (
    <section style={styles.editorCard}>
      <h3 style={styles.editorTitle}>{editingQuestion.id === 'new' ? '➕ Thêm Câu Hỏi Mới' : '✏️ Chỉnh sửa Câu hỏi'}</h3>
      <form onSubmit={handleUpdateQuestion} style={styles.form}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Nội dung câu hỏi</label>
          <textarea
            value={editingQuestion.question_text}
            onChange={(e) => setEditingQuestion({...editingQuestion, question_text: e.target.value})}
            style={styles.textarea}
            rows={3}
            required
          />
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Lựa chọn A</label>
            <input
              type="text"
              value={editingQuestion.options[0]}
              onChange={(e) => {
                const newOpts = [...editingQuestion.options];
                newOpts[0] = e.target.value;
                setEditingQuestion({...editingQuestion, options: newOpts});
              }}
              style={styles.input}
              required
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Lựa chọn B</label>
            <input
              type="text"
              value={editingQuestion.options[1]}
              onChange={(e) => {
                const newOpts = [...editingQuestion.options];
                newOpts[1] = e.target.value;
                setEditingQuestion({...editingQuestion, options: newOpts});
              }}
              style={styles.input}
              required
            />
          </div>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Lựa chọn C</label>
            <input
              type="text"
              value={editingQuestion.options[2]}
              onChange={(e) => {
                const newOpts = [...editingQuestion.options];
                newOpts[2] = e.target.value;
                setEditingQuestion({...editingQuestion, options: newOpts});
              }}
              style={styles.input}
              required
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Lựa chọn D</label>
            <input
              type="text"
              value={editingQuestion.options[3]}
              onChange={(e) => {
                const newOpts = [...editingQuestion.options];
                newOpts[3] = e.target.value;
                setEditingQuestion({...editingQuestion, options: newOpts});
              }}
              style={styles.input}
              required
            />
          </div>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Đáp án đúng (chọn trùng khớp)</label>
            <select
              value={editingQuestion.correct_answer}
              onChange={(e) => setEditingQuestion({...editingQuestion, correct_answer: e.target.value})}
              style={styles.select}
            >
              {editingQuestion.options.map((opt, i) => (
                <option key={i} value={opt}>{opt || `Lựa chọn ${String.fromCharCode(65 + i)}`}</option>
              ))}
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Mức Bloom</label>
            <select
              value={editingQuestion.bloom_level}
              onChange={(e) => setEditingQuestion({...editingQuestion, bloom_level: parseInt(e.target.value)})}
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
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Chuẩn đầu ra (CLO)</label>
          <select
            value={editingQuestion.clo_id || ''}
            onChange={(e) => setEditingQuestion({...editingQuestion, clo_id: e.target.value ? parseInt(e.target.value) : null})}
            style={styles.select}
          >
            <option value="">Không liên kết</option>
            {clos.map(c => (
              <option key={c.id} value={c.id}>[{c.clo_code}] {c.description}</option>
            ))}
          </select>
        </div>

        <div style={styles.editorActionRow}>
          <button type="submit" style={styles.saveEditorBtn}>{editingQuestion.id === 'new' ? 'Tạo câu hỏi' : 'Lưu cập nhật'}</button>
          <button type="button" onClick={() => setEditingQuestion(null)} style={styles.cancelEditorBtn}>Hủy</button>
        </div>
      </form>
    </section>
  );
}
