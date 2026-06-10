import React from 'react';

export default function QuestionCard({
  q,
  index,
  clos,
  handleGenerateIsomorphic,
  handleEditClick,
  handleDeleteQuestion,
  getBloomText,
  styles
}) {
  let opts = [];
  try {
    opts = JSON.parse(q.options_json);
  } catch(e) {
    opts = [];
  }
  const linkedClo = clos.find(c => c.id === q.clo_id);
  
  return (
    <div style={styles.questionCard}>
      <div style={styles.questionCardHeader}>
        <div style={styles.questionCardMeta}>
          <span style={styles.idxBadge}>Câu {index + 1}</span>
          <span style={styles.bloomTag}>{getBloomText(q.bloom_level)}</span>
          {linkedClo && (
            <span style={styles.cloTag}>
              [{linkedClo.clo_code}] {linkedClo.description.substring(0, 40)}...
            </span>
          )}
        </div>
        <div style={styles.actionButtons}>
          <button 
            onClick={() => handleGenerateIsomorphic(q.id)}
            style={styles.actionBtnIso}
            title="Sinh câu hỏi tương tự đồng cấu"
          >
            Clone Tương tự
          </button>
          <button 
            onClick={() => handleEditClick(q)}
            style={styles.actionBtnEdit}
          >
            Sửa
          </button>
          <button 
            onClick={() => handleDeleteQuestion(q.id)}
            style={styles.actionBtnDel}
          >
            Xóa
          </button>
        </div>
      </div>

      <div style={styles.questionText}>
        <strong>{q.question_text}</strong>
      </div>

      <div style={styles.optionsGrid}>
        {opts.map((opt, oIdx) => {
          const isCorrect = opt === q.correct_answer;
          return (
            <div 
              key={oIdx} 
              style={isCorrect ? styles.optionItemCorrect : styles.optionItem}
            >
              <span style={isCorrect ? styles.optionLabelCorrect : styles.optionLabel}>
                {String.fromCharCode(65 + oIdx)}
              </span>
              <span>{opt}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
