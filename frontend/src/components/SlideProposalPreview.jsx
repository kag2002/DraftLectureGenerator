import React, { useState, useEffect } from 'react';
import { parseMarkdownToSlidesJS, optimizeSlideItemsJS, splitBulletText, THEMES } from '../utils/slideParser';
import { renderBoldRuns } from '../utils/markdown';

/**
 * Component hiển thị slide preview 16:9 trực quan (trình chiếu hoặc lưới tổng quan).
 * Props:
 * - mdContent: nội dung Markdown thô của slide
 * - apiStatus: trạng thái API ('idle' | 'generating' | 'success' | 'error')
 * - themeName: tên chủ đề giao diện (key trong THEMES)
 * - onCitationClick: callback khi click vào citation tag
 */
export default function SlideProposalPreview({ mdContent, apiStatus, themeName = 'deep_space', onCitationClick }) {
  const slides = parseMarkdownToSlidesJS(mdContent);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState('slideshow'); // 'slideshow' | 'grid'
  
  useEffect(() => {
    setCurrentIndex(0);
  }, [mdContent]);
  
  if (apiStatus === 'generating' && slides.length === 0) {
    return <div style={{ padding: '20px', color: '#cbd5e1', fontSize: '13px' }}>⏳ Đang thiết kế slide...</div>;
  }
  
  if (slides.length === 0) {
    return <div style={{ padding: '20px', color: '#64748b', fontSize: '13px' }}>Không có slide đề xuất.</div>;
  }
  
  const safeIndex = currentIndex >= slides.length ? 0 : currentIndex;
  const slide = slides[safeIndex];

  const theme = THEMES[themeName] || THEMES.deep_space;

  // Helper to render slide content inside high-fidelity 16:9 card
  const renderSlideContent = (s, idx, isThumbnail = false) => {
    const optimizedItems = optimizeSlideItemsJS(s.items);
    const tableItem = optimizedItems.find(item => item.type === 'table');
    const textItems = optimizedItems.filter(item => item.type === 'text');
    const useCardLayout = !tableItem && textItems.length >= 1 && textItems.length <= 4;

    const accentColors = theme.accents;

    let bodySection = null;

    if (tableItem) {
      bodySection = (
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: isThumbnail ? '2px' : '15px', marginTop: '5px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isThumbnail ? '8px' : '11px', background: 'rgba(255,255,255,0.01)' }}>
            <thead>
              <tr>
                {tableItem.rows[0].map((cell, cIdx) => (
                  <th key={cIdx} style={{ background: theme.accents[0] + '40', color: theme.accents[0], fontWeight: '700', border: '1px solid rgba(255,255,255,0.08)', padding: isThumbnail ? '2px 4px' : '6px 10px', textAlign: 'left' }}>
                    {isThumbnail ? cell.replace(/\*\*/g, '') : renderBoldRuns(cell, theme.titleColor)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableItem.rows.slice(1, isThumbnail ? 3 : undefined).map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} style={{ border: '1px solid rgba(255,255,255,0.05)', padding: isThumbnail ? '2px 4px' : '6px 10px', color: theme.textColor }}>
                      {isThumbnail ? cell.replace(/\*\*/g, '') : renderBoldRuns(cell, theme.titleColor)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    } else if (useCardLayout) {
      let gridStyle = { display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'center' };
      if (!isThumbnail) {
        if (textItems.length === 2) {
          gridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', flex: 1, alignItems: 'stretch' };
        } else if (textItems.length === 3) {
          gridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', flex: 1, alignItems: 'stretch' };
        } else if (textItems.length === 4) {
          gridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '10px', flex: 1, alignItems: 'stretch' };
        }
      } else {
        gridStyle = { display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, justifyContent: 'center' };
      }

      bodySection = (
        <div style={gridStyle}>
          {textItems.slice(0, isThumbnail ? 2 : undefined).map((item, itemIdx) => {
            const borderAccent = accentColors[itemIdx % accentColors.length];
            const { title, body } = splitBulletText(item.rawText);

            return (
              <div key={itemIdx} style={{
                background: theme.cardBg,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderLeft: `${isThumbnail ? '2px' : '4px'} solid ${borderAccent}`,
                borderRadius: '6px',
                padding: isThumbnail ? '4px 6px' : '8px 12px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                boxSizing: 'border-box',
                overflow: 'hidden'
              }}>
                {title && (
                  <div style={{ color: theme.titleColor, fontSize: isThumbnail ? '8px' : '12px', fontWeight: '700', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {title}
                  </div>
                )}
                <div style={{ color: theme.textColor, fontSize: isThumbnail ? '7px' : '11px', lineHeight: '135%', display: '-webkit-box', WebkitLineClamp: isThumbnail ? 2 : 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {isThumbnail ? body.replace(/\*\*/g, '') : renderBoldRuns(body, theme.titleColor)}
                </div>
              </div>
            );
          })}
        </div>
      );
    } else {
      // Dynamic Font Sizing on Frontend (Character Budgeting)
      let textLength = 0;
      textItems.forEach(item => { textLength += item.rawText.length; });
      let fontSize = isThumbnail ? '8px' : '12px';
      if (!isThumbnail) {
        if (textLength > 800) fontSize = '10px';
        else if (textLength > 500) fontSize = '11px';
        else if (textLength > 300) fontSize = '12px';
        else {
          const numParas = textItems.length;
          if (numParas > 8) fontSize = '11px';
          else if (numParas > 5) fontSize = '12px';
          else fontSize = '13px';
        }
      }

      bodySection = (
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: isThumbnail ? '2px' : '15px' }}>
          <ul style={{ margin: '0', paddingLeft: isThumbnail ? '10px' : '18px', listStyleType: 'disc', color: theme.textColor }}>
            {textItems.slice(0, isThumbnail ? 3 : undefined).map((item, itemIdx) => (
              <li key={itemIdx} style={{ marginBottom: isThumbnail ? '2px' : '5px', fontSize: fontSize, lineHeight: '135%' }}>
                {isThumbnail ? item.rawText.replace(/\*\*/g, '') : renderBoldRuns(item.rawText, theme.titleColor)}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    return (
      <div style={{
        background: theme.bg,
        backgroundImage: theme.bgGradient,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: isThumbnail ? '10px' : '16px 20px',
        aspectRatio: '16 / 9',
        width: '100%',
        minHeight: isThumbnail ? '120px' : '280px',
        position: 'relative',
        boxShadow: isThumbnail ? '0 4px 12px rgba(0,0,0,0.2)' : '0 8px 32px rgba(0,0,0,0.4)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
        overflow: 'hidden',
        cursor: isThumbnail ? 'pointer' : 'default',
        transition: 'transform 0.2s, border-color 0.2s'
      }}>
        <div>
          <h4 style={{ 
            margin: '0 0 4px 0', 
            fontSize: isThumbnail ? '11px' : '18px', 
            color: theme.titleColor, 
            fontWeight: '700',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {s.title}
          </h4>
          <div style={{ height: isThumbnail ? '1px' : '2px', background: theme.divider, marginBottom: isThumbnail ? '6px' : '12px' }} />
          
          {bodySection}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '4px' }}>
          <div style={{ 
            fontSize: isThumbnail ? '6px' : '10px', 
            color: '#5b6a80', 
            fontStyle: 'italic',
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            maxWidth: '75%',
            overflow: 'hidden'
          }}>
            {s.citations.length > 0 && <span>📖</span>}
            {s.citations.map((cit, citIdx) => (
              <button
                key={citIdx}
                disabled={isThumbnail}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onCitationClick) onCitationClick(cit);
                }}
                style={{
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  color: '#a5b4fc',
                  borderRadius: '4px',
                  padding: isThumbnail ? '1px 3px' : '2px 6px',
                  fontSize: isThumbnail ? '6px' : '10px',
                  cursor: isThumbnail ? 'default' : 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  outline: 'none',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => {
                  if (!isThumbnail) {
                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.3)';
                    e.currentTarget.style.borderColor = '#a5b4fc';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isThumbnail) {
                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)';
                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
                  }
                }}
              >
                {cit}
              </button>
            ))}
          </div>
          <div style={{ fontSize: isThumbnail ? '7px' : '10px', color: '#5b6a80', fontWeight: '600' }}>
            {idx + 1}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '15px', background: 'rgba(15, 23, 42, 0.25)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button 
            onClick={() => setViewMode('slideshow')}
            style={{
              background: viewMode === 'slideshow' ? 'rgba(0, 210, 255, 0.15)' : 'transparent',
              border: viewMode === 'slideshow' ? '1px solid #00D2FF' : '1px solid rgba(255,255,255,0.08)',
              color: viewMode === 'slideshow' ? '#00D2FF' : '#94a3b8',
              padding: '4px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            📺 Trình chiếu
          </button>
          <button 
            onClick={() => setViewMode('grid')}
            style={{
              background: viewMode === 'grid' ? 'rgba(124, 77, 255, 0.15)' : 'transparent',
              border: viewMode === 'grid' ? '1px solid #7C4DFF' : '1px solid rgba(255,255,255,0.08)',
              color: viewMode === 'grid' ? '#a5b4fc' : '#94a3b8',
              padding: '4px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            📱 Tổng quan ({slides.length})
          </button>
        </div>

        {viewMode === 'slideshow' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>{safeIndex + 1} / {slides.length}</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button 
                disabled={safeIndex === 0} 
                onClick={() => setCurrentIndex(safeIndex - 1)}
                style={{
                  background: safeIndex === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(99,102,241,0.1)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: safeIndex === 0 ? '#475569' : '#a5b4fc',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  cursor: safeIndex === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '11px'
                }}
              >
                ◀ Trước
              </button>
              <button 
                disabled={safeIndex === slides.length - 1} 
                onClick={() => setCurrentIndex(safeIndex + 1)}
                style={{
                  background: safeIndex === slides.length - 1 ? 'rgba(255,255,255,0.02)' : 'rgba(99,102,241,0.1)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: safeIndex === slides.length - 1 ? '#475569' : '#a5b4fc',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  cursor: safeIndex === slides.length - 1 ? 'not-allowed' : 'pointer',
                  fontSize: '11px'
                }}
              >
                Sau ▶
              </button>
            </div>
          </div>
        )}
      </div>
      
      {viewMode === 'slideshow' ? (
        <div style={{ width: '100%' }}>
          {renderSlideContent(slide, safeIndex, false)}
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
          gap: '12px',
          maxHeight: '450px',
          overflowY: 'auto',
          padding: '4px'
        }}>
          {slides.map((s, idx) => (
            <div 
              key={idx} 
              onClick={() => {
                setCurrentIndex(idx);
                setViewMode('slideshow');
              }}
              style={{
                transition: 'transform 0.2s',
                borderRadius: '12px',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.firstChild.style.borderColor = '#7C4DFF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.firstChild.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              }}
            >
              {renderSlideContent(s, idx, true)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
