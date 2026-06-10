/**
 * Bộ phân tích cú pháp slide từ Markdown.
 * Chịu trách nhiệm chuyển đổi nội dung Markdown thô thành cấu trúc dữ liệu slide
 * phục vụ cho việc hiển thị preview trực quan.
 */

/**
 * Bộ chủ đề giao diện slide (themes).
 */
export const THEMES = {
  deep_space: {
    name: "🌌 Deep Space (Tối)",
    bg: '#070a13',
    bgGradient: 'radial-gradient(circle at top right, rgba(124, 77, 255, 0.08), transparent)',
    titleColor: '#00D2FF',
    textColor: '#E2E8F0',
    divider: 'linear-gradient(90deg, #7C4DFF, #00D2FF)',
    accents: ["#7C4DFF", "#00D2FF", "#10B981", "#FFC000"],
    cardBg: 'rgba(18, 20, 38, 0.5)',
  },
  warm_academic: {
    name: "📚 Warm Academic (Sáng)",
    bg: '#FAF6EE',
    bgGradient: 'radial-gradient(circle at top right, rgba(140, 98, 57, 0.1), transparent)',
    titleColor: '#1A365D',
    textColor: '#2D3748',
    divider: 'linear-gradient(90deg, #8C6239, #1A365D)',
    accents: ["#8C6239", "#1A365D", "#9A3412", "#D97706"],
    cardBg: 'rgba(255, 255, 255, 0.7)',
  },
  mint_techno: {
    name: "🍃 Mint Techno (Tối)",
    bg: '#0B132B',
    bgGradient: 'radial-gradient(circle at top right, rgba(29, 233, 182, 0.08), transparent)',
    titleColor: '#1DE9B6',
    textColor: '#E2E8F0',
    divider: 'linear-gradient(90deg, #00B0FF, #1DE9B6)',
    accents: ["#00B0FF", "#1DE9B6", "#00E5FF", "#76FF03"],
    cardBg: 'rgba(28, 37, 65, 0.5)',
  },
  sunset_crimson: {
    name: "🌅 Sunset Crimson (Tối)",
    bg: '#1A0813',
    bgGradient: 'radial-gradient(circle at top right, rgba(255, 64, 129, 0.08), transparent)',
    titleColor: '#FF5252',
    textColor: '#F8FAFC',
    divider: 'linear-gradient(90deg, #FF4081, #FF9100)',
    accents: ["#FF4081", "#FF9100", "#FF5252", "#E040FB"],
    cardBg: 'rgba(59, 15, 37, 0.4)',
  }
};

/**
 * Trích xuất và loại bỏ citation tag từ một dòng text.
 * @param {string} lineText - Dòng text gốc
 * @returns {{ cleanedText: string, citation: string|null }}
 */
export function extractAndCleanCitations(lineText) {
  const pattern = /\s*\[(nguồn|source|ref|trang|page)\s*:\s*([^\]]+)\]/i;
  const match = lineText.match(pattern);
  let citation = null;
  let cleanedText = lineText;
  if (match) {
    const fullMatch = match[0];
    const prefix = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    const detail = match[2].trim();
    citation = `${prefix}: ${detail}`;
    cleanedText = lineText.replace(fullMatch, '').trim();
  }
  return { cleanedText, citation };
}

/**
 * Tách một bullet text thành phần title và body dựa trên patterns:
 * 1. **Title**: Body
 * 2. Title: Body
 * 3. Title - Body
 * @param {string} textStr - Chuỗi text cần tách
 * @returns {{ title: string, body: string }}
 */
export function splitBulletText(textStr) {
  textStr = textStr.trim();
  // 1. Match bold prefix: **Title**: Body
  const boldMatch = textStr.match(/^\*\*(.*?)\*\*\s*[:\-—]?\s*(.*)$/);
  if (boldMatch) {
    const title = boldMatch[1].trim();
    const body = boldMatch[2].trim();
    if (title && body) return { title, body };
  }
  // 2. Match colon prefix: Title: Body
  if (textStr.includes(':')) {
    const idx = textStr.indexOf(':');
    const prefix = textStr.substring(0, idx).trim();
    const suffix = textStr.substring(idx + 1).trim();
    if (prefix.length > 0 && prefix.length < 25 && suffix) {
      return { title: prefix, body: suffix };
    }
  }
  // 3. Match dash prefix: Title - Body
  const separators = [' — ', ' - ', ' – '];
  for (const sep of separators) {
    if (textStr.includes(sep)) {
      const idx = textStr.indexOf(sep);
      const prefix = textStr.substring(0, idx).trim();
      const suffix = textStr.substring(idx + sep.length).trim();
      if (prefix.length > 0 && prefix.length < 25 && suffix) {
        return { title: prefix, body: suffix };
      }
    }
  }
  return { title: "", body: textStr };
}

/**
 * Tối ưu hóa layout slide items bằng cách nhóm các mục ưu/nhược điểm.
 * @param {Array} items - Mảng slide items
 * @returns {Array} - Mảng đã được tối ưu
 */
export function optimizeSlideItemsJS(items) {
  const textItems = items.filter(item => item.type === 'text');
  if (textItems.length > 2) {
    const pros = [];
    const cons = [];
    const others = [];
    for (const item of textItems) {
      const raw = item.rawText.toLowerCase();
      const { title } = splitBulletText(item.rawText);
      const tLower = title.toLowerCase();
      const isPro = ["ưu điểm", "pro", "lợi ích", "advantages", "thuận lợi", "tích cực", "mặt tốt"].some(k => tLower.includes(k) || raw.substring(0, 20).includes(k));
      const isCon = ["nhược điểm", "con", "hạn chế", "disadvantages", "khó khăn", "tiêu cực", "mặt xấu"].some(k => tLower.includes(k) || raw.substring(0, 20).includes(k));
      if (isPro) {
        pros.push(item.rawText);
      } else if (isCon) {
        cons.push(item.rawText);
      } else {
        others.push(item);
      }
    }
    if (pros.length > 0 && cons.length > 0) {
      const newItems = [...others];
      const prosText = `**Ưu điểm & Lợi ích**:\n` + pros.map(p => `* ${p}`).join('\n');
      newItems.push({
        type: 'text',
        rawText: prosText,
        bullet: false
      });
      const consText = `**Nhược điểm & Hạn chế**:\n` + cons.map(c => `* ${c}`).join('\n');
      newItems.push({
        type: 'text',
        rawText: consText,
        bullet: false
      });
      // Append non-text items
      items.forEach(item => {
        if (item.type !== 'text') {
          newItems.push(item);
        }
      });
      return newItems;
    }
  }
  return items;
}

/**
 * Phân tích nội dung Markdown thô thành mảng cấu trúc slide.
 * Mỗi slide gồm: { title, items: [...], citations: [...] }
 * @param {string} mdContent - Nội dung Markdown
 * @returns {Array} - Mảng slide objects
 */
export function parseMarkdownToSlidesJS(mdContent) {
  if (!mdContent) return [];
  const lines = mdContent.replace(/\r\n/g, '\n').split('\n').map(l => l.trim());
  const hashHeaders = lines.filter(line => line.startsWith('#'));
  
  let slidesRaw = [];
  
  if (hashHeaders.length > 1) {
    // Style 1: Split by lines starting with '#'
    let currentSlide = null;
    for (const line of lines) {
      if (!line) continue;
      if (line.startsWith('#')) {
        const matchHash = line.match(/^#+/);
        const headerLevel = matchHash ? matchHash[0].length : 1;
        const title = line.replace(/^#+\s*/, '').trim();
        if (headerLevel <= 3) {
          // Clean up slide title prefixes
          const cleanedTitle = title.replace(/^(slide\s+\d+\s*[:.-]?\s*|chương\s+\d+\s*[:.-]?\s*|\d+\s*[:.-]\s*)/i, '').trim();
          if (currentSlide) {
            slidesRaw.push(currentSlide);
          }
          currentSlide = { title: cleanedTitle || title, lines: [] };
        }
      } else {
        if (currentSlide) {
          currentSlide.lines.push(line);
        }
      }
    }
    if (currentSlide) {
      slidesRaw.push(currentSlide);
    }
  } else {
    // Style 2: Split by top-level list items that have bold text
    const deckTitle = hashHeaders.length > 0 ? hashHeaders[0].replace(/^#+\s*/, '').trim() : "Bài giảng";
    let currentSlide = null;
    const processingLines = lines.filter(line => !line.startsWith('#') && line);
    
    for (const line of processingLines) {
      let matchHeader = line.match(/^[-*+•]\s*\*\*(.*?)\*\*\s*$/);
      if (!matchHeader) {
        matchHeader = line.match(/^\*\*(.*?)\*\*\s*$/);
      }
      
      if (matchHeader) {
        const titleText = matchHeader[1].trim();
        if (currentSlide) {
          slidesRaw.push(currentSlide);
        }
        currentSlide = { title: titleText, lines: [] };
      } else {
        if (currentSlide) {
          currentSlide.lines.push(line);
        } else {
          currentSlide = { title: deckTitle, lines: [line] };
        }
      }
    }
    if (currentSlide) {
      slidesRaw.push(currentSlide);
    }
  }
  
  // Process lines of each slide to parse items (bullets, tables, citations)
  const processedSlides = [];
  for (const slide of slidesRaw) {
    const title = slide.title;
    const bodyItems = [];
    const citations = [];
    
    let inTable = false;
    let tableRows = [];
    
    for (const line of slide.lines) {
      if (!line) continue;
      
      const { cleanedText, citation } = extractAndCleanCitations(line);
      if (citation) {
        citations.push(citation);
      }
      
      if (!cleanedText) continue;
      
      // Skip separator lines or empty bullet indicators like ---, - -, _
      if (/^[-*+•\s_=]+$/.test(cleanedText)) {
        continue;
      }
      
      // Table detection
      if (cleanedText.startsWith('|') && cleanedText.endsWith('|')) {
        if (/^[\s:\-|]+$/.test(cleanedText)) {
          continue;
        }
        const cols = cleanedText.split('|').slice(1, -1).map(c => c.trim());
        tableRows.push(cols);
        inTable = true;
        continue;
      } else {
        if (inTable) {
          bodyItems.push({
            type: 'table',
            rows: tableRows
          });
          tableRows = [];
          inTable = false;
        }
      }
      
      // Bullet point detection
      let isBullet = false;
      if (line.trim().startsWith('*') || line.trim().startsWith('-') || line.trim().startsWith('+') || line.trim().startsWith('•')) {
        isBullet = true;
      }
      
      let lineContent = cleanedText;
      if (lineContent.startsWith('*') || lineContent.startsWith('-') || lineContent.startsWith('+') || lineContent.startsWith('•')) {
        lineContent = lineContent.slice(1).trim();
      }
      if (lineContent.startsWith('*') || lineContent.startsWith('-') || lineContent.startsWith('+') || lineContent.startsWith('•')) {
        lineContent = lineContent.slice(1).trim();
        isBullet = true;
      }
      
      // Strip leading/trailing single asterisks or underscores if they envelope the line, but keep bold ** tags
      if (lineContent.startsWith('*') && lineContent.endsWith('*') && !lineContent.startsWith('**')) {
        lineContent = lineContent.slice(1, -1).trim();
      }
      if (lineContent.startsWith('_') && lineContent.endsWith('_') && !lineContent.startsWith('__')) {
        lineContent = lineContent.slice(1, -1).trim();
      }
      
      if (lineContent) {
        bodyItems.push({
          type: 'text',
          rawText: lineContent,
          bullet: isBullet
        });
      }
    }
    
    if (inTable && tableRows.length > 0) {
      bodyItems.push({
        type: 'table',
        rows: tableRows
      });
    }
    
    processedSlides.push({
      title,
      items: bodyItems,
      citations
    });
  }
  
  return processedSlides;
}
