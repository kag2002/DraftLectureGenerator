import React from 'react';

/**
 * Chuyển đổi chuỗi Markdown thô sang HTML inline-styled.
 * Hỗ trợ: tables, headers, bold, bullet lists, paragraphs.
 */
export function renderMarkdown(md) {
  if (!md) return '';
  
  // Clean HTML tags to prevent XSS
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
    
  // 1. Parse Tables
  const lines = html.split('\n');
  let inTable = false;
  let tableRows = [];
  let newLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      if (/^[\s:\-|]+$/.test(line)) {
        continue;
      }
      const cols = line.split('|').slice(1, -1).map(c => c.trim());
      tableRows.push(cols);
      inTable = true;
    } else {
      if (inTable) {
        let tableHtml = '<table style="width:100%; border-collapse:collapse; margin:15px 0; font-size:13px; background:rgba(255,255,255,0.01);">';
        tableRows.forEach((row, rIdx) => {
          tableHtml += '<tr>';
          row.forEach(cell => {
            const tag = rIdx === 0 ? 'th' : 'td';
            const cellStyle = rIdx === 0 
              ? 'background:rgba(99,102,241,0.15); color:#a5b4fc; font-weight:700; border:1px solid rgba(255,255,255,0.08); padding:8px 12px; text-align:left;'
              : 'border:1px solid rgba(255,255,255,0.05); padding:8px 12px; color:#cbd5e1;';
            tableHtml += `<${tag} style="${cellStyle}">${cell}</${tag}>`;
          });
          tableHtml += '</tr>';
        });
        tableHtml += '</table>';
        newLines.push(tableHtml);
        tableRows = [];
        inTable = false;
      }
      newLines.push(lines[i]);
    }
  }
  if (inTable) {
    let tableHtml = '<table style="width:100%; border-collapse:collapse; margin:15px 0; font-size:13px; background:rgba(255,255,255,0.01);">';
    tableRows.forEach((row, rIdx) => {
      tableHtml += '<tr>';
      row.forEach(cell => {
        const tag = rIdx === 0 ? 'th' : 'td';
        const cellStyle = rIdx === 0 
          ? 'background:rgba(99,102,241,0.15); color:#a5b4fc; font-weight:700; border:1px solid rgba(255,255,255,0.08); padding:8px 12px; text-align:left;'
          : 'border:1px solid rgba(255,255,255,0.05); padding:8px 12px; color:#cbd5e1;';
        tableHtml += `<${tag} style="${cellStyle}">${cell}</${tag}>`;
      });
      tableHtml += '</tr>';
    });
    tableHtml += '</table>';
    newLines.push(tableHtml);
  }
  
  html = newLines.join('\n');
  
  // 2. Parse Headers
  html = html.replace(/^# (.*?)$/gm, '<h1 style="color:#00d2ff; font-size:18px; font-weight:700; margin-top:16px; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:5px;">$1</h1>');
  html = html.replace(/^## (.*?)$/gm, '<h2 style="color:#a5b4fc; font-size:15px; font-weight:700; margin-top:14px; margin-bottom:8px;">$1</h2>');
  html = html.replace(/^### (.*?)$/gm, '<h3 style="color:#e2e8f0; font-size:13px; font-weight:700; margin-top:12px; margin-bottom:6px;">$1</h3>');
  
  // 3. Parse bold (**text**)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#00d2ff; font-weight:700;">$1</strong>');
  
  // 4. Parse bullets
  const lines2 = html.split('\n');
  let inList = false;
  let finalLines = [];
  
  for (let i = 0; i < lines2.length; i++) {
    const line = lines2[i];
    const match = line.match(/^([-*+•])\s*(.*)$/);
    if (match) {
      if (!inList) {
        finalLines.push('<ul style="margin:10px 0; padding-left:18px; list-style-type:disc; color:#cbd5e1;">');
        inList = true;
      }
      finalLines.push(`<li style="margin-bottom:6px; line-height:145%;">${match[2]}</li>`);
    } else {
      if (inList) {
        finalLines.push('</ul>');
        inList = false;
      }
      finalLines.push(line);
    }
  }
  if (inList) {
    finalLines.push('</ul>');
  }
  
  html = finalLines.join('\n');
  
  // 5. Clean up simple newlines
  html = html.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<h') || trimmed.startsWith('<u') || trimmed.startsWith('</u') || trimmed.startsWith('<l') || trimmed.startsWith('<t') || trimmed.startsWith('</t') || trimmed.startsWith('<r') || trimmed.startsWith('<p')) {
      return line;
    }
    return `<p style="margin:8px 0; line-height:145%; color:#cbd5e1;">${line}</p>`;
  }).join('\n');
  
  // Support inline HTML br mapping if they are present in markdown output
  html = html.replace(/&lt;br\s*\/?&gt;/g, '<br/>');
  
  return html;
}

/**
 * Component hiển thị nội dung Markdown đã được render thành HTML.
 */
export function MarkdownPreview({ content, style }) {
  const htmlContent = renderMarkdown(content);
  return (
    <div 
      style={{
        padding: '15px',
        background: 'rgba(15, 23, 42, 0.45)',
        borderRadius: '10px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        color: '#e2e8f0',
        fontSize: '13px',
        overflowY: 'auto',
        minHeight: '200px',
        maxHeight: '400px',
        ...style
      }}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}

/**
 * Render chuỗi text có chứa cặp ** thành React elements kèm style bold.
 * @param {string} text - Chuỗi text cần xử lý
 * @param {string} boldColor - Màu cho phần bold (default: '#00D2FF')
 * @returns {Array} - Mảng React elements
 */
export function renderBoldRuns(text, boldColor = '#00D2FF') {
  if (!text) return '';
  const parts = text.split('**');
  return parts.map((part, idx) => {
    if (idx % 2 === 1) {
      return <strong key={idx} style={{ color: boldColor, fontWeight: '700' }}>{part}</strong>;
    }
    return part;
  });
}
