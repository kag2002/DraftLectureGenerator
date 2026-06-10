import React, { useState, useEffect, useMemo, useRef } from 'react';
import client from '../api/client';
import './CourseRoadmap.css';

// ─── Helper: status label ────────────────────────────────────────────
const STATUS_META = {
  done:        { label: '✅ Hoàn thành',    icon: '✓' },
  in_progress: { label: '🔄 Đang thực hiện', icon: '◔' },
  pending:     { label: '⬜ Chưa bắt đầu',  icon: '○' },
};

// ─── Single tree node ────────────────────────────────────────────────
function TreeNode({ node, onSelect, onToggleCollapse, isCollapsed, hasChildren }) {
  return (
    <div
      className={`roadmap-node roadmap-node--${node.status}`}
      onClick={(e) => { e.stopPropagation(); onSelect(node); }}
      title={node.label}
    >
      <span className={`roadmap-node-status-dot roadmap-node-status-dot--${node.status}`} />
      <span className="roadmap-node-icon">{node.icon}</span>
      <div className="roadmap-node-label">{node.label}</div>
      {node.detail && <div className="roadmap-node-detail">{node.detail}</div>}
      
      {hasChildren && (
        <button
          className={`roadmap-node-toggle ${isCollapsed ? 'roadmap-node-toggle--collapsed' : ''}`}
          onClick={(e) => onToggleCollapse(node.id, e)}
          title={isCollapsed ? "Mở rộng nhánh con" : "Thu gọn nhánh con"}
        >
          {isCollapsed ? '＋' : '－'}
        </button>
      )}
    </div>
  );
}

// ─── Helper: bezier paths for visual connection ──────────────────────
function getHorizontalBezierPath(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1) * 0.5;
  return `M ${x1} ${y1} C ${x1 + (x2 > x1 ? dx : -dx)} ${y1}, ${x2 + (x2 > x1 ? -dx : dx)} ${y2}, ${x2} ${y2}`;
}

function getVerticalBezierPath(x1, y1, x2, y2) {
  const dy = Math.abs(y2 - y1) * 0.5;
  return `M ${x1} ${y1} C ${x1} ${y1 + (y2 > y1 ? dy : -dy)}, ${x2} ${y2 + (y2 > y1 ? -dy : dy)}, ${x2} ${y2}`;
}

// ─── Detail sidebar ─────────────────────────────────────────────────
function Sidebar({ node, onClose, onNavigate }) {
  if (!node) return null;
  const meta = STATUS_META[node.status] || { label: '', icon: '' };

  return (
    <>
      <div className="roadmap-sidebar-overlay" onClick={onClose} />
      <div className="roadmap-sidebar">
        <div className="roadmap-sidebar-header">
          <h3 className="roadmap-sidebar-title">{node.label}</h3>
          <button className="roadmap-sidebar-close" onClick={onClose}>✕</button>
        </div>
        <div className="roadmap-sidebar-body">
          <div className="roadmap-sidebar-icon">{node.icon}</div>
          <div className={`roadmap-sidebar-status roadmap-sidebar-status--${node.status}`}>
            {meta.label}
          </div>
          <p className="roadmap-sidebar-desc">{node.description}</p>

          {node.stats && node.stats.length > 0 && (
            <div className="roadmap-sidebar-stats">
              {node.stats.map((s, i) => (
                <div key={i} className="roadmap-sidebar-stat">
                  <span className="roadmap-sidebar-stat-value">{s.value}</span>
                  <span className="roadmap-sidebar-stat-label">{s.label}</span>
                </div>
              ))}
            </div>
          )}

          {node.targetView && (
            <button
              className="roadmap-sidebar-action"
              onClick={() => {
                onClose();
                let chId = null;
                if (node.id.startsWith('chapter_')) {
                  chId = parseInt(node.id.split('_')[1]);
                } else if (node.id.startsWith('materials_')) {
                  chId = parseInt(node.id.split('_')[1]);
                } else if (node.id.startsWith('questions_')) {
                  chId = parseInt(node.id.split('_')[1]);
                }
                onNavigate(node.targetView, chId);
              }}
            >
              Vào trang chi tiết →
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════
export default function CourseRoadmap({ course, onBack, onLogout, onNavigate }) {
  const [clos, setClos] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [materialsMap, setMaterialsMap] = useState({}); // chapterId -> bool
  const [matrixData, setMatrixData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);

  // Canvas Refs & Control State
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [collapsedChapters, setCollapsedChapters] = useState(new Set());

  // ─── Fetch all data on mount ───────────────────────────────────────
  useEffect(() => {
    if (!course) return;
    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      try {
        const [closRes, outlineRes, questionsRes, matrixRes] = await Promise.allSettled([
          client.get(`/api/courses/${course.id}/clos`),
          client.get(`/api/courses/${course.id}/chapters`),
          client.get(`/api/courses/${course.id}/questions`),
          client.get(`/api/courses/${course.id}/matrix-coverage`),
        ]);

        if (cancelled) return;

        const closData = closRes.status === 'fulfilled' ? closRes.value.data : [];
        const chaptersData = outlineRes.status === 'fulfilled' ? outlineRes.value.data : [];
        const questionsData = questionsRes.status === 'fulfilled' ? questionsRes.value.data : [];
        const matrixObj = matrixRes.status === 'fulfilled' ? matrixRes.value.data : null;

        setClos(Array.isArray(closData) ? closData : []);
        setChapters(Array.isArray(chaptersData) ? chaptersData : []);
        setQuestions(Array.isArray(questionsData) ? questionsData : []);
        setMatrixData(matrixObj);

        // Fetch materials for each chapter
        const matMap = {};
        if (Array.isArray(chaptersData)) {
          const matPromises = chaptersData.map(ch =>
            client.get(`/api/courses/chapters/${ch.id}/materials`)
              .then(r => { matMap[ch.id] = r.data && (r.data.slide_content || r.data.active_learning_script); })
              .catch(() => { matMap[ch.id] = false; })
          );
          await Promise.allSettled(matPromises);
        }
        if (!cancelled) setMaterialsMap(matMap);
      } catch (err) {
        console.error('Roadmap fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [course]);

  // ─── Build tree data structure ─────────────────────────────────────
  const tree = useMemo(() => {
    const hasClos = clos.length > 0;
    const hasChapters = chapters.length > 0;
    const totalQuestions = questions.length;

    // Chapter sub-trees
    const chapterNodes = chapters.map(ch => {
      const chQuestions = questions.filter(q => q.chapter_id === ch.id);
      const hasMat = !!materialsMap[ch.id];
      const hasQ = chQuestions.length > 0;

      const chapterStatus = (hasMat && hasQ) ? 'done' : (hasMat || hasQ) ? 'in_progress' : 'pending';

      return {
        id: `chapter_${ch.id}`,
        icon: '📖',
        label: ch.title,
        detail: ch.description ? ch.description.substring(0, 50) + '…' : null,
        status: chapterStatus,
        targetView: 'lesson_planner',
        description: `Chương "${ch.title}" trong môn ${course.course_name}. Bạn có thể soạn nội dung slide, kịch bản hoạt động tương tác, và sinh câu hỏi kiểm tra cho chương này.`,
        stats: [
          { value: hasMat ? '✓' : '—', label: 'Học liệu' },
          { value: chQuestions.length, label: 'Câu hỏi' },
        ],
        children: [
          {
            id: `materials_${ch.id}`,
            icon: '📑',
            label: 'Slide & Hoạt động',
            detail: hasMat ? 'Đã soạn' : 'Chưa soạn',
            status: hasMat ? 'done' : 'pending',
            targetView: 'lesson_planner',
            description: `Nội dung slide bài giảng và kịch bản Active Learning cho chương "${ch.title}". AI sẽ đề xuất nội dung dựa trên tài liệu nguồn RAG và bạn duyệt/sửa trên giao diện Split-Screen Editor.`,
            stats: [{ value: hasMat ? '✓' : '✕', label: 'Trạng thái' }],
          },
          {
            id: `questions_${ch.id}`,
            icon: '❓',
            label: 'Ngân hàng Câu hỏi',
            detail: `${chQuestions.length} câu`,
            status: hasQ ? 'done' : 'pending',
            targetView: 'question_bank',
            description: `Ngân hàng câu hỏi trắc nghiệm MCQ cho chương "${ch.title}". Câu hỏi được sinh bởi AI với Self-Correction (Generator + Solver) và gán tag CLO + mức Bloom.`,
            stats: [{ value: chQuestions.length, label: 'Tổng câu hỏi' }],
          },
        ],
      };
    });

    // Matrix node
    const matrixNode = {
      id: 'matrix',
      icon: '📊',
      label: 'Ma trận CLO-Bloom',
      detail: totalQuestions > 0 ? `${totalQuestions} câu hỏi` : 'Chưa có dữ liệu',
      status: totalQuestions > 0 ? 'done' : 'pending',
      targetView: 'matrix_dashboard',
      description: 'Bảng tổng hợp độ phủ ngân hàng câu hỏi theo ma trận CLO × Bloom Level. Giúp giảng viên đảm bảo đề thi bao phủ đầy đủ các chuẩn đầu ra và mức độ nhận thức.',
      stats: [
        { value: totalQuestions, label: 'Tổng câu hỏi' },
        { value: clos.length, label: 'Số CLO' },
      ],
    };

    return {
      syllabus: {
        id: 'syllabus',
        icon: '📋',
        label: 'Nạp Đề Cương (Syllabus)',
        detail: hasClos ? `${clos.length} CLO đã bóc tách` : 'Chưa tải Syllabus',
        status: hasClos ? 'done' : 'pending',
        targetView: 'course_config',
        description: 'Tải lên file Syllabus (PDF/Docx) hoặc dán nội dung đề cương. AI sẽ tự động bóc tách các Chuẩn đầu ra (CLO) và ánh xạ mức Bloom Taxonomy.',
        stats: [{ value: clos.length, label: 'CLOs' }],
      },
      clos: {
        id: 'clos',
        icon: '🎯',
        label: 'Chuẩn Đầu Ra (CLOs)',
        detail: hasClos ? `${clos.length} CLO` : 'Chưa cấu hình',
        status: hasClos ? 'done' : 'pending',
        targetView: 'course_config',
        description: 'Danh sách các Chuẩn đầu ra môn học (Course Learning Outcomes) đã trích xuất từ Syllabus. Bạn có thể chỉnh sửa, thêm/xóa CLO và cập nhật mức Bloom Taxonomy.',
        stats: clos.slice(0, 4).map(c => ({ value: c.clo_code, label: `Bloom ${c.bloom_level}` })),
      },
      knowledgeBase: {
        id: 'knowledge_base',
        icon: '📂',
        label: 'Thư viện RAG & Học thuật',
        detail: 'Nạp tài liệu & Duyệt học thuật',
        status: 'done', // Always active / accessible
        targetView: 'knowledge_base',
        description: 'Không gian tìm kiếm tài liệu học thuật trực tuyến và quản lý tài liệu RAG chính thống phục vụ quá trình sinh bài giảng.',
        stats: [],
      },
      chapters: chapterNodes,
      matrix: matrixNode,
    };
  }, [clos, chapters, questions, materialsMap, course, matrixData]);

  // ─── Progress calculation ──────────────────────────────────────────
  const progress = useMemo(() => {
    let total = 0;
    let done = 0;

    function count(node) {
      if (!node) return;
      total++;
      if (node.status === 'done') done++;
      if (node.children) node.children.forEach(count);
    }

    count(tree.syllabus);
    count(tree.clos);
    count(tree.knowledgeBase);
    tree.chapters.forEach(ch => count(ch));
    count(tree.matrix);

    return total === 0 ? 0 : Math.round((done / total) * 100);
  }, [tree]);

  // ─── Spatial Nodes and Coordinate Layout Calculations ──────────────
  const positionedNodes = useMemo(() => {
    const nodes = [];
    
    // Syllabus (Center of Virtual 3000x3000px coordinate space, i.e. 0, 0)
    nodes.push({
      ...tree.syllabus,
      x: 0,
      y: 0,
    });

    // CLOs (Left Top Branch, -320px, -100px)
    nodes.push({
      ...tree.clos,
      x: -320,
      y: -100,
    });

    // Knowledge Base (Left Bottom Branch, -320px, 100px)
    nodes.push({
      ...tree.knowledgeBase,
      x: -320,
      y: 100,
    });

    // Matrix (Bottom Branch, 260px)
    nodes.push({
      ...tree.matrix,
      x: 0,
      y: 260,
    });

    // Chapters (Right Branch, 320px)
    const chCount = tree.chapters.length;
    tree.chapters.forEach((ch, idx) => {
      // Vertically space chapters relative to the center
      const chY = chCount <= 1 ? 0 : (idx - (chCount - 1) / 2) * 240;
      const isCollapsed = collapsedChapters.has(ch.id);

      nodes.push({
        ...ch,
        x: 320,
        y: chY,
        hasChildren: true,
        isCollapsed,
      });

      if (!isCollapsed && ch.children) {
        // Slide & Activities (x = 620px, y = chapter_y - 60px)
        const matChild = ch.children[0];
        if (matChild) {
          nodes.push({
            ...matChild,
            x: 620,
            y: chY - 60,
          });
        }

        // Questions Node (x = 620px, y = chapter_y + 60px)
        const qChild = ch.children[1];
        if (qChild) {
          nodes.push({
            ...qChild,
            x: 620,
            y: chY + 60,
          });
        }
      }
    });

    return nodes;
  }, [tree, collapsedChapters]);

  // ─── SVG Dynamic Connection Calculation ──────────────────────────
  const connections = useMemo(() => {
    const paths = [];

    // Syllabus (0, 0) -> CLOs (-320, -100)
    paths.push({
      id: 'conn-syllabus-clos',
      d: getHorizontalBezierPath(1500 - 120, 1500, 1500 - 320 + 120, 1500 - 100),
      status: tree.clos.status
    });

    // Syllabus (0, 0) -> Knowledge Base (-320, 100)
    paths.push({
      id: 'conn-syllabus-knowledgebase',
      d: getHorizontalBezierPath(1500 - 120, 1500, 1500 - 320 + 120, 1500 + 100),
      status: tree.knowledgeBase.status
    });

    // Syllabus (0, 0) -> Matrix (0, 260)
    // Bottom port = 1500, 1500 + 37; Top port = 1500, 1500 + 260 - 37
    paths.push({
      id: 'conn-syllabus-matrix',
      d: getVerticalBezierPath(1500, 1500 + 37, 1500, 1500 + 260 - 37),
      status: tree.matrix.status
    });

    // Syllabus (0, 0) -> Chapters (320, y_ch)
    const chCount = tree.chapters.length;
    tree.chapters.forEach((ch, idx) => {
      const chY = chCount <= 1 ? 0 : (idx - (chCount - 1) / 2) * 240;
      const isCollapsed = collapsedChapters.has(ch.id);

      paths.push({
        id: `conn-syllabus-${ch.id}`,
        d: getHorizontalBezierPath(1500 + 120, 1500, 1500 + 320 - 120, 1500 + chY),
        status: ch.status
      });

      if (!isCollapsed && ch.children) {
        // Chapter (320, y_ch) -> Slide & Activities (620, y_ch - 60)
        const matChild = ch.children[0];
        if (matChild) {
          paths.push({
            id: `conn-${ch.id}-materials`,
            d: getHorizontalBezierPath(1500 + 320 + 120, 1500 + chY, 1500 + 620 - 120, 1500 + chY - 60),
            status: matChild.status
          });
        }

        // Chapter (320, y_ch) -> Question Bank (620, y_ch + 60)
        const qChild = ch.children[1];
        if (qChild) {
          paths.push({
            id: `conn-${ch.id}-questions`,
            d: getHorizontalBezierPath(1500 + 320 + 120, 1500 + chY, 1500 + 620 - 120, 1500 + chY + 60),
            status: qChild.status
          });
        }
      }
    });

    return paths;
  }, [tree, collapsedChapters]);

  // ─── Panning and Zooming Controls ──────────────────────────────────
  const resetCenter = () => {
    setZoom(1.0);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      // Center the 3000x3000px coordinate system:
      // Point (1500, 1500) should align to the center of the container viewport
      setPan({
        x: rect.width / 2 - 1500,
        y: rect.height / 2 - 1500,
      });
    }
  };

  // Center canvas on first load once loading finishes
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(resetCenter, 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Handle Drag / Pan Events
  const handleMouseDown = (e) => {
    // Drag canvas only with primary left click
    if (e.button !== 0) return;
    // Don't drag if clicking buttons, sidebar, or cards
    if (
      e.target.closest('.roadmap-node') ||
      e.target.closest('.roadmap-controls') ||
      e.target.closest('.roadmap-sidebar') ||
      e.target.closest('.roadmap-back-btn') ||
      e.target.closest('.roadmap-logout-btn')
    ) {
      return;
    }
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.current.x;
    const newY = e.clientY - dragStart.current.y;

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      // Giới hạn tọa độ để tâm canvas (1500, 1500) không bị kéo lệch quá tầm mắt (bán kính 300px từ mép container)
      const minX = -1500 - 300;
      const maxX = rect.width - 1500 + 300;
      const minY = -1500 - 300;
      const maxY = rect.height - 1500 + 300;

      setPan({
        x: Math.max(minX, Math.min(maxX, newX)),
        y: Math.max(minY, Math.min(maxY, newY)),
      });
    } else {
      setPan({ x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Đính kèm sự kiện lăn chuột với giảm chấn độ nhạy (smooth zoom) giúp sử dụng tốt trên trackpad
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      e.preventDefault();
      // Giảm chấn độ nhạy lăn chuột dựa trên biên độ e.deltaY để thu phóng mượt mà
      const delta = e.deltaY;
      const intensity = Math.min(Math.abs(delta) * 0.0008, 0.05); // Cap giới hạn lượng thay đổi mỗi lần
      const factor = 1 + intensity;

      setZoom(prev => {
        if (delta < 0) {
          return Math.min(prev * factor, 2.0);
        } else {
          return Math.max(prev / factor, 0.4);
        }
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const toggleChapterCollapse = (chapterId, e) => {
    e.stopPropagation();
    setCollapsedChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  };

  const zoomIn = () => setZoom(prev => Math.min(prev * 1.15, 2.0));
  const zoomOut = () => setZoom(prev => Math.max(prev / 1.15, 0.4));

  // ─── Render ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="roadmap-page">
        <div className="roadmap-loading">
          <div className="roadmap-spinner" />
          <span>Đang tải lộ trình môn học…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="roadmap-page">
      {/* ── Header ── */}
      <header className="roadmap-header">
        <div className="roadmap-header-left">
          <button className="roadmap-back-btn" onClick={onBack}>← Dashboard</button>
          <div>
            <span className="roadmap-course-badge">{course.course_code}</span>
            <h2 className="roadmap-course-title">{course.course_name}</h2>
          </div>
        </div>
        <button className="roadmap-logout-btn" onClick={onLogout}>Đăng Xuất</button>
      </header>

      {/* ── Progress Bar ── */}
      <div className="roadmap-progress-bar-container">
        <div className="roadmap-progress-label">
          Tiến độ thiết kế bài giảng: {progress}%
        </div>
        <div className="roadmap-progress-track">
          <div className="roadmap-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* ── Spatial Mind Map Viewport ── */}
      <div
        ref={containerRef}
        className={`roadmap-viewport ${isDragging ? 'roadmap-viewport--dragging' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Transformable Canvas (Fixed 3000x3000px coordinates space) */}
        <div
          ref={canvasRef}
          className="roadmap-canvas"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* Infinite Dot Grid */}
          <div className="roadmap-grid" />

          {/* SVG Connection Paths */}
          <svg className="roadmap-svg-overlay">
            {connections.map(conn => (
              <g key={conn.id}>
                {/* Glowing shadow line for active/done states */}
                {conn.status !== 'pending' && (
                  <path
                    d={conn.d}
                    className={`roadmap-path-glow roadmap-path--${conn.status}`}
                  />
                )}
                {/* Main line */}
                <path
                  d={conn.d}
                  className={`roadmap-path-main roadmap-path--${conn.status}`}
                />
                {/* Pulsing signal anim on completed routes */}
                {conn.status === 'done' && (
                  <circle r="3.5" className="roadmap-path-pulse">
                    <animateMotion dur="4s" repeatCount="indefinite" path={conn.d} />
                  </circle>
                )}
              </g>
            ))}
          </svg>

          {/* Render Positioned Nodes */}
          {positionedNodes.map(node => (
            <div
              key={node.id}
              className="roadmap-node-wrapper"
              style={{
                left: `${1500 + node.x - 120}px`,
                top: `${1500 + node.y - 37}px`,
                position: 'absolute',
              }}
            >
              <TreeNode
                node={node}
                onSelect={setSelectedNode}
                onToggleCollapse={toggleChapterCollapse}
                isCollapsed={node.isCollapsed}
                hasChildren={node.hasChildren}
              />
            </div>
          ))}
        </div>

        {/* Floating Controls */}
        <div className="roadmap-controls">
          <button className="roadmap-control-btn" onClick={zoomIn} title="Phóng to">＋</button>
          <button className="roadmap-control-btn" onClick={zoomOut} title="Thu nhỏ">－</button>
          <button className="roadmap-control-btn" onClick={resetCenter} title="Căn giữa">🎯</button>
          <span className="roadmap-zoom-indicator">{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* ── Sidebar ── */}
      <Sidebar
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onNavigate={onNavigate}
      />
    </div>
  );
}
