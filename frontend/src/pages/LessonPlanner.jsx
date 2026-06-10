import React, { useState, useEffect } from 'react';
import client from '../api/client';
import FlowSteps from '../components/FlowSteps';
import LessonPlannerSidebar from '../components/LessonPlannerSidebar';
import AIProposalPanel from '../components/AIProposalPanel';
import EditorPanel from '../components/EditorPanel';
import PedagogicalConfigModal from '../components/PedagogicalConfigModal';
import { renderMarkdown, MarkdownPreview, renderBoldRuns } from '../utils/markdown';
import { THEMES, parseMarkdownToSlidesJS, extractAndCleanCitations } from '../utils/slideParser';


export default function LessonPlanner({ course, initialChapterId, initialCloId, initialCloCode, initialBloomLevel, onBack, onLogout, onNavigate, onGoToQuestionBank }) {
  // Navigation & States
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [activeLeftTab, setActiveLeftTab] = useState('outline'); // 'outline' | 'documents' | 'compliance'
  const [clos, setClos] = useState([]);
  const [ragReferences, setRagReferences] = useState([]);
  const [selectedCitation, setSelectedCitation] = useState(null);
  const [currentStage, setCurrentStage] = useState(0);
  const [activeWorkTab, setActiveWorkTab] = useState('slides'); // 'slides' | 'script'
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Chapter material states
  const [slideContent, setSlideContent] = useState('');
  const [activeLearningScript, setActiveLearningScript] = useState('');
  const [savedSlideContent, setSavedSlideContent] = useState('');
  const [savedScript, setSavedScript] = useState('');
  const [slideEditMode, setSlideEditMode] = useState('edit'); // 'edit' | 'preview'
  const [scriptEditMode, setScriptEditMode] = useState('edit'); // 'edit' | 'preview'
  const [slideProposalViewMode, setSlideProposalViewMode] = useState('visual'); // 'visual' | 'code'
  const [selectedTheme, setSelectedTheme] = useState('deep_space');
  
  // AI recommendations
  const [aiSlideProposal, setAiSlideProposal] = useState('');
  const [aiActiveLearningProposal, setAiActiveLearningProposal] = useState('');
  
  // Document manager states
  const [documents, setDocuments] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  
  // AI Config modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [classSize, setClassSize] = useState(40);
  const [hasWifi, setHasWifi] = useState(true);
  const [furnitureType, setFurnitureType] = useState('movable');

  // Logs & stats (Monitoring badges)
  const [latency, setLatency] = useState(0);
  const [cost, setCost] = useState(0);
  const [apiStatus, setApiStatus] = useState('idle'); // 'idle' | 'generating' | 'success' | 'error'
  const [genLog, setGenLog] = useState('');

  // Messages & Errors
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Academic Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [expandedSearch, setExpandedSearch] = useState({});
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [maxResults, setMaxResults] = useState(10);
  const [credibilityThreshold, setCredibilityThreshold] = useState(0.7);
  const [suggestedQueries, setSuggestedQueries] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [summarizing, setSummarizing] = useState({});
  const [showMetricGuide, setShowMetricGuide] = useState(false);
  const [selectedRejected, setSelectedRejected] = useState({});

  // Fetch chapters & documents list
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const chResponse = await client.get(`/api/courses/${course.id}/chapters`);
      setChapters(chResponse.data);
      if (chResponse.data.length > 0) {
        const found = initialChapterId ? chResponse.data.find(ch => ch.id === initialChapterId) : null;
        handleSelectChapter(found || chResponse.data[0]);
      }
      
      const docResponse = await client.get(`/api/courses/${course.id}/documents`);
      setDocuments(docResponse.data.documents || []);

      // Fetch course CLOs
      const cloResponse = await client.get(`/api/courses/${course.id}/clos`);
      setClos(cloResponse.data || []);
    } catch (err) {
      console.error(err);
      setError('Lỗi khi tải dữ liệu bài giảng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [course.id]);

  // Đồng bộ hóa chương học được chọn khi prop initialChapterId thay đổi từ Roadmap
  useEffect(() => {
    if (initialChapterId && chapters.length > 0) {
      const found = chapters.find(ch => ch.id === initialChapterId);
      if (found && (!selectedChapter || selectedChapter.id !== found.id)) {
        handleSelectChapter(found);
      }
    }
  }, [initialChapterId, chapters, selectedChapter]);

  // Chọn chương học và load nội dung hiện có
  const handleSelectChapter = async (chapter) => {
    // Tự động lưu chương cũ nếu có thay đổi chưa đồng bộ
    if (selectedChapter) {
      const hasChanges = slideContent !== savedSlideContent || activeLearningScript !== savedScript;
      if (hasChanges) {
        try {
          await client.put(`/api/courses/chapters/${selectedChapter.id}/materials`, {
            slide_content: slideContent,
            active_learning_script: activeLearningScript
          });
        } catch (saveErr) {
          console.error("Auto-save failed on chapter switch:", saveErr);
        }
      }
    }

    setSelectedChapter(chapter);
    setError('');
    setMessage('');
    
    try {
      const response = await client.get(`/api/courses/chapters/${chapter.id}/materials`);
      const sCont = response.data.slide_content || '';
      const aScript = response.data.active_learning_script || '';
      
      setSlideContent(sCont);
      setActiveLearningScript(aScript);
      setSavedSlideContent(sCont);
      setSavedScript(aScript);

      // Fetch RAG references for citation matching
      try {
        const ragRes = await client.get(`/api/courses/chapters/${chapter.id}/rag-references`);
        setRagReferences(ragRes.data.references || []);
      } catch (ragErr) {
        console.error("Error loading RAG references:", ragErr);
        setRagReferences([]);
      }

      // Clear AI proposals on select
      setAiSlideProposal('');
      setAiActiveLearningProposal('');
      // Clear academic search result & suggest queries
      setSearchResult(null);
      setSuggestedQueries([]);
      try {
        const suggestRes = await client.get(`/api/courses/chapters/${chapter.id}/suggest-queries`);
        setSuggestedQueries(suggestRes.data.suggestions || []);
      } catch (suggestErr) {
        console.error("Error loading suggested queries:", suggestErr);
      }
    } catch (err) {
      console.error(err);
      setError('Không thể load nội dung chương học.');
    }
  };

  // AI sinh cấu trúc Outline chương học từ CLOs
  const handleGenerateOutline = async () => {
    if (!window.confirm('AI sẽ sinh lại toàn bộ dàn ý chương học dựa trên CLOs. Các chương học cũ sẽ bị ghi đè. Bạn có chắc chắn không?')) return;
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      const response = await client.post(`/api/courses/${course.id}/generate-outline`);
      setChapters(response.data.chapters);
      if (response.data.chapters.length > 0) {
        handleSelectChapter(response.data.chapters[0]);
      }
      setMessage('Đã sinh cấu trúc chương học bằng AI thành công!');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Không thể sinh cấu trúc Outline.');
    } finally {
      setLoading(false);
    }
  };

  // AI Sinh slide thô & kịch bản Active Learning bám RAG qua SSE stream
  const handleGenerateMaterials = async () => {
    if (!selectedChapter) {
      setError('Vui lòng chọn hoặc sinh một chương học trước.');
      return;
    }
    
    setError('');
    setMessage('');
    setApiStatus('generating');
    setGenLog('🚀 Khởi động AI Material Generator...');
    setCurrentStage(1);
    setAiSlideProposal('');
    setAiActiveLearningProposal('');
    setShowConfigModal(false);
    const startTime = Date.now();
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(
        `http://localhost:8000/api/courses/chapters/${selectedChapter.id}/generate-materials-stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            class_size: classSize,
            has_wifi: hasWifi,
            furniture_type: furnitureType
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Lỗi server: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Giữ lại dòng chưa hoàn chỉnh

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (currentEvent === 'stage') {
                setGenLog(data.message);
                if (data.stage) {
                  setCurrentStage(data.stage);
                }
              } else if (currentEvent === 'token') {
                accumulatedText += data.token;
                
                // Parse accumulated text in real-time
                let slideText = "";
                let activeText = "";
                if (accumulatedText.includes("---SLIDES---")) {
                  const parts = accumulatedText.split("---SLIDES---", 1)[1];
                  if (parts.includes("---ACTIVE_LEARNING---")) {
                    [slideText, activeText] = parts.split("---ACTIVE_LEARNING---", 1);
                  } else {
                    slideText = parts;
                  }
                } else {
                  if (accumulatedText.includes("---ACTIVE_LEARNING---")) {
                    [slideText, activeText] = accumulatedText.split("---ACTIVE_LEARNING---", 1);
                  } else {
                    slideText = accumulatedText;
                  }
                }

                if (activeText.trim() && currentStage < 3) {
                  setCurrentStage(3);
                }

                setAiSlideProposal(slideText.trim());
                setAiActiveLearningProposal(activeText.trim());
              } else if (currentEvent === 'done') {
                setAiSlideProposal(data.slide_content);
                setAiActiveLearningProposal(data.active_learning_script);
                setLatency(((Date.now() - startTime) / 1000).toFixed(1));
                setCost(0.04);
                setApiStatus('success');
                setCurrentStage(4);
                setMessage(data.message);
                setGenLog('');
                
                // Refresh RAG references after generating
                try {
                  const ragRes = await client.get(`/api/courses/chapters/${selectedChapter.id}/rag-references`);
                  setRagReferences(ragRes.data.references || []);
                } catch (ragErr) {
                  console.error("Error refreshing RAG references:", ragErr);
                }
              } else if (currentEvent === 'error') {
                setError(data.message);
                setApiStatus('error');
                setGenLog('');
              }
            } catch (_) {}
          }
        }
      }

    } catch (err) {
      console.error(err);
      setApiStatus('error');
      setError(`Lỗi kết nối stream: ${err.message}`);
      setGenLog('');
    }
  };

  // Upload tài liệu giáo trình RAG
  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;
    
    setError('');
    setMessage('');
    setLoading(true);

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      await client.post(`/api/courses/${course.id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setDocuments([uploadFile.name, ...documents]);
      setUploadFile(null);
      setMessage('Nạp tài liệu nguồn thành công! Vector DB đã được cập nhật.');
    } catch (err) {
      console.error(err);
      setError('Lỗi khi tải tài liệu lên Vector DB.');
    } finally {
      setLoading(false);
    }
  };

  // Xóa tài liệu RAG
  const handleDeleteDocument = async (fileName) => {
    if (!window.confirm(`Bạn muốn xóa tài liệu tham chiếu '${fileName}' khỏi RAG?`)) return;
    setError('');
    
    try {
      await client.delete(`/api/courses/${course.id}/documents/${fileName}`);
      setDocuments(documents.filter(d => d !== fileName));
      setMessage('Đã xóa tài liệu khỏi Vector DB.');
    } catch (err) {
      console.error(err);
      setError('Lỗi khi xóa tài liệu.');
    }
  };

  // Lưu bản soạn thảo chính của giảng viên xuống DB
  const handleSaveMaterials = async () => {
    if (!selectedChapter) return;
    setError('');
    setMessage('');
    setSaving(true);

    try {
      await client.put(`/api/courses/chapters/${selectedChapter.id}/materials`, {
        slide_content: slideContent,
        active_learning_script: activeLearningScript
      });
      setSavedSlideContent(slideContent);
      setSavedScript(activeLearningScript);
      setMessage('Đã lưu học liệu thành công lên hệ thống Cloud!');
    } catch (err) {
      console.error(err);
      setError('Lỗi khi lưu học liệu.');
    } finally {
      setSaving(false);
    }
  };

  // Reset/Xóa học liệu chương học
  const handleResetMaterials = async () => {
    if (!selectedChapter) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa/reset toàn bộ học liệu (slide + kịch bản) của chương học này không?')) return;

    setError('');
    setMessage('');
    setSaving(true);

    try {
      await client.delete(`/api/courses/chapters/${selectedChapter.id}/materials`);
      setSlideContent('');
      setActiveLearningScript('');
      setSavedSlideContent('');
      setSavedScript('');
      setMessage('Đã xóa/reset học liệu chương thành công.');
    } catch (err) {
      console.error(err);
      setError('Lỗi khi xóa học liệu.');
    } finally {
      setSaving(false);
    }
  };


  // Chạy Web Search Ingestion
  const handleWebSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    setError('');
    setMessage('');
    setSearching(true);
    setSearchResult(null);
    setExpandedSearch({});
    setSummaries({});

    try {
      const response = await client.post(`/api/courses/${course.id}/web-search-ingest`, {
        query: searchQuery,
        max_results: maxResults,
        threshold: credibilityThreshold
      });
      setSearchResult(response.data);
      setMessage('Đã hoàn thành khảo sát độ uy tín và nạp RAG!');
    } catch (err) {
      console.error(err);
      setError('Lỗi trong quá trình tìm kiếm học thuật.');
    } finally {
      setSearching(false);
    }
  };

  const toggleSearchDetail = (key) => {
    setExpandedSearch(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Gọi API tóm tắt nội dung
  const handleSummarizeContent = async (key, title, content) => {
    if (summaries[key]) return; // Đã tóm tắt rồi
    setSummarizing(prev => ({ ...prev, [key]: true }));
    try {
      const response = await client.post(`/api/courses/summarize-content`, {
        content: content,
        title: title
      });
      setSummaries(prev => ({
        ...prev,
        [key]: response.data.summary
      }));
    } catch (err) {
      console.error(err);
      setSummaries(prev => ({
        ...prev,
        [key]: 'Lỗi khi kết nối với máy chủ AI để tóm tắt.'
      }));
    } finally {
      setSummarizing(prev => ({ ...prev, [key]: false }));
    }
  };

  const renderJustifications = (justification) => {
    if (!justification) return null;
    const items = justification.split('; ');
    return (
      <div style={styles.badgeContainer}>
        {items.map((item, idx) => {
          const isPositive = item.includes('+');
          const isNegative = item.includes('-');
          let badgeStyle = styles.badgeNeutral;
          if (isPositive) badgeStyle = styles.badgePositive;
          if (isNegative) badgeStyle = styles.badgeNegative;
          return (
            <span key={idx} style={badgeStyle}>
              {item}
            </span>
          );
        })}
      </div>
    );
  };

  const getRecommendation = (score) => {
    const pct = Math.round(score * 100);
    if (pct >= 80) {
      return {
        label: "Khuyên dùng (Highly Recommended)",
        color: "#10b981",
        bgColor: "rgba(16, 185, 129, 0.15)",
        borderColor: "rgba(16, 185, 129, 0.4)",
        desc: "Nguồn chính thống/độ tin cậy học thuật rất cao. Rất khuyên dùng để nạp vào RAG."
      };
    } else if (pct >= 60) {
      return {
        label: "Đáng tin cậy (Credible)",
        color: "#3b82f6",
        bgColor: "rgba(59, 130, 246, 0.15)",
        borderColor: "rgba(59, 130, 246, 0.4)",
        desc: "Tài liệu học thuật/tổ chức giáo dục hợp lệ. Rất phù hợp làm học liệu bổ trợ."
      };
    } else if (pct >= 40) {
      return {
        label: "Cần cân nhắc (Average)",
        color: "#f59e0b",
        bgColor: "rgba(245, 158, 11, 0.15)",
        borderColor: "rgba(245, 158, 11, 0.4)",
        desc: "Nguồn tin phổ thông phi học thuật (.org, .com). Hãy cân nhắc kiểm duyệt trước khi nạp RAG."
      };
    } else {
      return {
        label: "Không khuyến nghị (Low Credibility)",
        color: "#ef4444",
        bgColor: "rgba(239, 68, 68, 0.15)",
        borderColor: "rgba(239, 68, 68, 0.4)",
        desc: "Blog cá nhân, diễn đàn hoặc mạng xã hội. Độ tin cậy thấp, không khuyến nghị nạp RAG."
      };
    }
  };

  const handleForceIngest = async () => {
    const selectedUrls = Object.keys(selectedRejected).filter(url => selectedRejected[url]);
    if (selectedUrls.length === 0) return;
    
    setLoading(true);
    setError('');
    setMessage('');
    
    let successCount = 0;
    try {
      for (const url of selectedUrls) {
        const item = searchResult.rejected.find(r => r.url === url);
        if (!item) continue;
        
        const response = await client.post(`/api/courses/${course.id}/force-ingest-url`, {
          url: item.url,
          title: item.title,
          content: item.content
        });
        
        successCount++;
      }
      
      // Reload documents list
      const docResponse = await client.get(`/api/courses/${course.id}/documents`);
      setDocuments(docResponse.data.documents || []);
      
      // Clear selection
      setSelectedRejected({});
      
      setMessage(`Đã nạp thủ công thành công ${successCount} tài liệu vào RAG.`);
    } catch (err) {
      console.error(err);
      setError('Lỗi khi nạp thủ công tài liệu vào RAG.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportLessonPlan = () => {
    if (!selectedChapter) return;
    const token = localStorage.getItem('token');
    window.open(`http://localhost:8000/api/courses/chapters/${selectedChapter.id}/export-lesson-plan?token=${token}`, '_blank');
  };

  const renderSlideCharCheckers = () => {
    const parsed = parseMarkdownToSlidesJS(slideContent);
    const warnings = [];
    
    parsed.forEach((s, idx) => {
      const textItems = s.items.filter(item => item.type === 'text');
      let slideCharCount = 0;
      textItems.forEach(item => { slideCharCount += item.rawText.length; });
      
      if (slideCharCount > 600) {
        warnings.push(`⚠️ Slide ${idx + 1} ("${s.title}") có dung lượng lớn (${slideCharCount} kí tự). Hãy cân nhắc chia nhỏ.`);
      } else if (textItems.length > 5) {
        warnings.push(`⚠️ Slide ${idx + 1} ("${s.title}") chứa nhiều ý gạch đầu dòng (${textItems.length} ý). Slide có thể bị đè chữ.`);
      }
    });
    
    if (warnings.length === 0) return null;
    
    return (
      <div style={{
        marginTop: '8px',
        padding: '10px 12px',
        background: 'rgba(245, 158, 11, 0.1)',
        border: '1px solid rgba(245, 158, 11, 0.25)',
        borderRadius: '8px',
        fontSize: '11px',
        color: '#fbbf24',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        lineHeight: '140%'
      }}>
        {warnings.map((w, wIdx) => (
          <div key={wIdx}>{w}</div>
        ))}
      </div>
    );
  };

  const [exporting, setExporting] = useState(false);

  const handleExportPPTX = async () => {
    if (!selectedChapter) return;
    setError('');
    setMessage('');
    setExporting(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:8000/api/courses/chapters/${selectedChapter.id}/export-pptx?theme=${selectedTheme}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Lỗi server: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Bai_Giang_Chuong_${selectedChapter.id}.pptx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setMessage('Xuất slide PPTX thành công!');
    } catch (err) {
      console.error(err);
      setError(`Không thể xuất slide PPTX: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleCitationClick = (citationStr) => {
    const cleaned = citationStr.replace(/^(Nguon|Nguồn|Source|Ref|Trang|Page):\s*/i, '');
    const parts = cleaned.split(/-\s*(?:Trang|Page|trang|page):\s*/i);
    const fileName = parts[0]?.trim();
    const pageNum = parts[1] ? parseInt(parts[1].trim()) : null;

    let matchedRef = null;
    if (ragReferences && ragReferences.length > 0) {
      matchedRef = ragReferences.find(ref => {
        const refFile = ref.file_name?.toLowerCase();
        const refPage = ref.page_number;
        const fileMatch = refFile && fileName && (refFile.includes(fileName.toLowerCase()) || fileName.toLowerCase().includes(refFile));
        const pageMatch = pageNum === null || refPage === pageNum;
        return fileMatch && pageMatch;
      });
    }

    if (matchedRef) {
      setSelectedCitation({
        citation: citationStr,
        fileName: matchedRef.file_name,
        pageNumber: matchedRef.page_number,
        text: matchedRef.text
      });
    } else {
      setSelectedCitation({
        citation: citationStr,
        fileName: fileName || "Không rõ tài liệu",
        pageNumber: pageNum || "N/A",
        text: "Không tìm thấy nội dung đoạn trích gốc trong Vector DB của chương học này. Có thể slide này được trích xuất từ tài liệu khác hoặc cấu trúc trang không khớp."
      });
    }
  };

  const parseActiveLearningScript = (scriptText) => {
    if (!scriptText) return { mainScript: '', rationale: '' };
    const marker = '---RATIONALE---';
    const parts = scriptText.split(marker);
    const mainScript = parts[0]?.trim() || '';
    const rationale = parts[1]?.trim() || '';
    return { mainScript, rationale };
  };

  const isCloCovered = (cloCode) => {
    if (!cloCode) return false;
    const escapedCode = cloCode.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\[CLO:\\s*${escapedCode}\\s*\\]`, 'i');
    return regex.test(slideContent) || regex.test(aiSlideProposal);
  };

  const renderCitationDrawer = () => {
    if (!selectedCitation) return null;
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '450px',
        height: '100vh',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"Outfit", sans-serif'
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(30, 41, 59, 0.3)'
        }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '15px', color: '#00d2ff', fontWeight: '700' }}>📖 Đối chiếu nguồn gốc</h4>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Xác minh độ chính xác của AI từ RAG</span>
          </div>
          <button 
            onClick={() => setSelectedCitation(null)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#cbd5e1',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '700'
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Tài liệu tham chiếu</div>
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#cbd5e1'
            }}>
              📄 {selectedCitation.fileName} (Trang {selectedCitation.pageNumber})
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px' }}>Đoạn văn bản gốc từ giáo trình</div>
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '16px',
              fontSize: '13px',
              lineHeight: '160%',
              color: '#e2e8f0',
              overflowY: 'auto',
              flex: 1,
              whiteSpace: 'pre-wrap'
            }}>
              {selectedCitation.text}
            </div>
          </div>
        </div>
        <div style={{
          padding: '20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 23, 42, 0.4)',
          fontSize: '12px',
          color: '#64748b',
          lineHeight: '1.4'
        }}>
          💡 Hệ thống sử dụng tìm kiếm ngữ nghĩa (Vector RAG) để trích xuất ngữ cảnh liên quan nhất trước khi gửi cho mô hình ngôn ngữ lớn (LLM).
        </div>
      </div>
    );
  };

  const renderStepper = () => {
    const steps = [
      { id: 1, name: "Truy xuất RAG", desc: "Tìm các đoạn trích từ tài liệu nguồn" },
      { id: 2, name: "Dàn ý Slide", desc: "AI thiết kế nội dung các slide bài giảng" },
      { id: 3, name: "Kịch bản Tương tác", desc: "Thiết kế hoạt động Active Learning lớp học" },
      { id: 4, name: "Lưu trữ & Đồng bộ", desc: "Đồng bộ hóa học liệu vào Vector DB" }
    ];

    return (
      <div style={{
        background: 'rgba(30, 41, 59, 0.45)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#818cf8', animation: 'pulse 1.5s infinite' }} />
          TIẾN TRÌNH AI SOẠN BÀI GIẢNG:
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginTop: '5px' }}>
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '30px',
            right: '30px',
            height: '2px',
            background: 'rgba(255, 255, 255, 0.08)',
            zIndex: 1
          }} />
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '30px',
            width: `${((currentStage - 1) / 3) * 100}%`,
            height: '2px',
            background: 'linear-gradient(90deg, #6366f1, #00d2ff)',
            zIndex: 1,
            transition: 'width 0.3s ease'
          }} />

          {steps.map((step) => {
            const isActive = currentStage === step.id;
            const isCompleted = currentStage > step.id;
            
            let circleBg = 'rgba(15, 23, 42, 0.8)';
            let circleBorder = '1px solid rgba(255, 255, 255, 0.08)';
            let iconColor = '#64748b';
            let icon = step.id;

            if (isActive) {
              circleBg = 'rgba(99, 102, 241, 0.15)';
              circleBorder = '2px solid #6366f1';
              iconColor = '#a5b4fc';
            } else if (isCompleted) {
              circleBg = 'rgba(16, 185, 129, 0.15)';
              circleBorder = '1px solid #10b981';
              iconColor = '#34d399';
              icon = '✓';
            }

            return (
              <div key={step.id} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '80px',
                textAlign: 'center',
                zIndex: 2
              }}>
                <div style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: circleBg,
                  border: circleBorder,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: iconColor,
                  transition: 'all 0.3s ease',
                  boxShadow: isActive ? '0 0 10px rgba(99, 102, 241, 0.3)' : 'none'
                }}>
                  {icon}
                </div>
                <span style={{
                  fontSize: '9px',
                  fontWeight: '700',
                  color: isActive ? '#f8fafc' : isCompleted ? '#34d399' : '#64748b',
                  marginTop: '6px',
                  transition: 'color 0.3s ease'
                }}>
                  {step.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const [saving, setSaving] = useState(false);

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button onClick={onBack} style={styles.backBtn}>← Sơ đồ</button>
          <div>
            <span style={styles.badge}>{course.course_code}</span>
            <h2 style={styles.courseTitle}>{course.course_name}</h2>
          </div>
        </div>

        {onNavigate && <FlowSteps activeStep="slides" onNavigate={onNavigate} />}

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onGoToQuestionBank} style={styles.questionBankBtn}>
            📝 Thiết kế Câu hỏi (MCQs)
          </button>
          <div style={styles.monitorBadge}>
            <span style={styles.statusIndicator(apiStatus)}>
              ● {apiStatus === 'generating' ? 'AI Đang sinh...' : apiStatus === 'success' ? 'AI Sẵn sàng' : apiStatus === 'error' ? 'Lỗi kết nối' : 'AI Chờ lệnh'}
            </span>
            <span>Xử lý: {latency}s</span>
            <span>Tài nguyên: ${cost}</span>
          </div>
        </div>
      </header>

      {error && <div style={styles.errorAlert}>{error}</div>}
      {message && <div style={styles.successAlert}>{message}</div>}

      {initialCloCode && initialBloomLevel && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          color: '#f59e0b',
          padding: '12px 20px',
          borderRadius: '10px',
          fontSize: '13px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          animation: 'fadeIn 0.3s ease-in-out'
        }}>
          <div>
            ⚠️ <strong>Đang khắc phục điểm mù chất lượng bài giảng:</strong> Hãy chọn chương học phù hợp ở cột trái, sau đó bổ sung nội dung slide có gắn thẻ chuẩn đầu ra <strong>[{initialCloCode}]</strong> và mức Bloom mục tiêu <strong>[Bloom: B{initialBloomLevel}]</strong>.
          </div>
          {selectedChapter && (
            <button
              onClick={() => {
                const template = `\n# Slide bổ sung cho ${initialCloCode}\n* [CLO: ${initialCloCode}]\n* [Bloom: B${initialBloomLevel}]\n* Ý chính slide...\n`;
                setSlideContent(prev => prev + template);
                setActiveWorkTab('slides');
              }}
              style={{
                background: '#f59e0b',
                border: 'none',
                color: '#0f172a',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                marginLeft: '12px',
                whiteSpace: 'nowrap'
              }}
            >
              ➕ Chèn mẫu Slide nháp
            </button>
          )}
        </div>
      )}

      <div style={styles.workTabContainer}>
        <button 
          onClick={() => setActiveWorkTab('slides')} 
          style={activeWorkTab === 'slides' ? styles.activeWorkTabBtn : styles.inactiveWorkTabBtn}
        >
          🖼️ Soạn Slide Bài giảng
        </button>
        <button 
          onClick={() => setActiveWorkTab('script')} 
          style={activeWorkTab === 'script' ? styles.activeWorkTabBtn : styles.inactiveWorkTabBtn}
        >
          🏃 Kịch bản Lớp học (Active Learning)
        </button>
      </div>

      <div style={styles.layout}>
        <LessonPlannerSidebar
          chapters={chapters}
          selectedChapter={selectedChapter}
          activeLeftTab={activeLeftTab}
          setActiveLeftTab={setActiveLeftTab}
          clos={clos}
          documents={documents}
          uploadFile={uploadFile}
          setUploadFile={setUploadFile}
          loading={loading}
          handleSelectChapter={handleSelectChapter}
          handleGenerateOutline={handleGenerateOutline}
          handleUploadDocument={handleUploadDocument}
          handleDeleteDocument={handleDeleteDocument}
          handleWebSearch={handleWebSearch}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searching={searching}
          showAdvancedSearch={showAdvancedSearch}
          setShowAdvancedSearch={setShowAdvancedSearch}
          maxResults={maxResults}
          setMaxResults={setMaxResults}
          credibilityThreshold={credibilityThreshold}
          setCredibilityThreshold={setCredibilityThreshold}
          suggestedQueries={suggestedQueries}
          searchResult={searchResult}
          expandedSearch={expandedSearch}
          toggleSearchDetail={toggleSearchDetail}
          handleSummarizeContent={handleSummarizeContent}
          summarizing={summarizing}
          summaries={summaries}
          selectedRejected={selectedRejected}
          setSelectedRejected={setSelectedRejected}
          handleForceIngest={handleForceIngest}
          isCloCovered={isCloCovered}
          renderJustifications={renderJustifications}
          styles={styles}
        />

        <AIProposalPanel
          selectedChapter={selectedChapter}
          activeWorkTab={activeWorkTab}
          aiSlideProposal={aiSlideProposal}
          aiActiveLearningProposal={aiActiveLearningProposal}
          apiStatus={apiStatus}
          genLog={genLog}
          slideContent={slideContent}
          setSlideContent={setSlideContent}
          activeLearningScript={activeLearningScript}
          setActiveLearningScript={setActiveLearningScript}
          selectedTheme={selectedTheme}
          slideProposalViewMode={slideProposalViewMode}
          setSlideProposalViewMode={setSlideProposalViewMode}
          handleCitationClick={handleCitationClick}
          setShowConfigModal={setShowConfigModal}
          currentStage={currentStage}
          parseActiveLearningScript={parseActiveLearningScript}
          styles={styles}
        />

        <EditorPanel
          selectedChapter={selectedChapter}
          activeWorkTab={activeWorkTab}
          slideContent={slideContent}
          setSlideContent={setSlideContent}
          savedSlideContent={savedSlideContent}
          activeLearningScript={activeLearningScript}
          setActiveLearningScript={setActiveLearningScript}
          savedScript={savedScript}
          slideEditMode={slideEditMode}
          setSlideEditMode={setSlideEditMode}
          scriptEditMode={scriptEditMode}
          setScriptEditMode={setScriptEditMode}
          selectedTheme={selectedTheme}
          setSelectedTheme={setSelectedTheme}
          exporting={exporting}
          saving={saving}
          isFullscreen={isFullscreen}
          setIsFullscreen={setIsFullscreen}
          handleExportPPTX={handleExportPPTX}
          handleExportLessonPlan={handleExportLessonPlan}
          handleSaveMaterials={handleSaveMaterials}
          handleResetMaterials={handleResetMaterials}
          handleCitationClick={handleCitationClick}
          renderSlideCharCheckers={renderSlideCharCheckers}
          parseActiveLearningScript={parseActiveLearningScript}
          styles={styles}
        />
      </div>

      <PedagogicalConfigModal
        showConfigModal={showConfigModal}
        setShowConfigModal={setShowConfigModal}
        classSize={classSize}
        setClassSize={setClassSize}
        hasWifi={hasWifi}
        setHasWifi={setHasWifi}
        furnitureType={furnitureType}
        setFurnitureType={setFurnitureType}
        handleGenerateMaterials={handleGenerateMaterials}
        styles={styles}
      />
      {renderCitationDrawer()}
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'radial-gradient(circle at 10% 20%, rgb(15, 23, 42) 0%, rgb(9, 13, 26) 90%)',
    fontFamily: '"Outfit", "Inter", sans-serif',
    color: '#f8fafc',
    padding: '25px 30px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '15px',
    marginBottom: '20px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
  },
  backBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#cbd5e1',
    borderRadius: '8px',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
  },
  questionBankBtn: {
    background: 'rgba(99, 102, 241, 0.1)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    color: '#a5b4fc',
    borderRadius: '8px',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
    marginLeft: '15px',
    transition: 'background 0.2s',
  },
  badge: {
    background: 'rgba(99, 102, 241, 0.15)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    color: '#a5b4fc',
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '4px',
    display: 'inline-block',
  },
  courseTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
  },
  monitorBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    padding: '6px 15px',
    fontSize: '11px',
    color: '#94a3b8',
  },
  statusIndicator: (status) => ({
    color: status === 'generating' ? '#f59e0b' : status === 'success' ? '#10b981' : status === 'error' ? '#ef4444' : '#64748b',
    fontWeight: '700',
  }),
  traceBtn: {
    background: 'none',
    border: 'none',
    color: '#6366f1',
    cursor: 'pointer',
    fontWeight: '600',
    textDecoration: 'underline',
    padding: 0,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '360px 1fr 1fr',
    gap: '20px',
    height: 'calc(100vh - 180px)',
  },
  workTabContainer: {
    display: 'flex',
    background: 'rgba(15, 23, 42, 0.45)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '12px',
    padding: '4px',
    width: 'fit-content',
    margin: '0 0 15px 380px',
    gap: '4px',
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
    backdropFilter: 'blur(8px)',
  },
  activeWorkTabBtn: {
    background: 'rgba(99, 102, 241, 0.15)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    color: '#a5b4fc',
    borderRadius: '8px',
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  inactiveWorkTabBtn: {
    background: 'transparent',
    border: '1px solid transparent',
    color: '#64748b',
    borderRadius: '8px',
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  sidebar: {
    background: 'rgba(30, 41, 59, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sidebarHeader: {
    padding: '15px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    background: 'rgba(15, 23, 42, 0.2)',
  },
  sidebarContent: {
    padding: '20px',
    flex: 1,
    overflowY: 'auto',
  },
  outlineActions: {
    marginBottom: '15px',
  },
  aiOutlineBtn: {
    width: '100%',
    background: 'rgba(99, 102, 241, 0.1)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    color: '#a5b4fc',
    borderRadius: '8px',
    padding: '10px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  chapterList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  chapterCard: {
    display: 'flex',
    gap: '10px',
    padding: '12px',
    borderRadius: '10px',
    background: 'rgba(15, 23, 42, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  activeChapterCard: {
    display: 'flex',
    gap: '10px',
    padding: '12px',
    borderRadius: '10px',
    background: 'rgba(99, 102, 241, 0.15)',
    border: '1px solid rgba(99, 102, 241, 0.4)',
    cursor: 'pointer',
    boxShadow: '0 0 10px rgba(99, 102, 241, 0.1)',
  },
  chapterOrder: {
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#94a3b8',
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '12px',
    fontWeight: '700',
  },
  chapterTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: '4px',
  },
  chapterDesc: {
    fontSize: '11px',
    color: '#64748b',
    lineHeight: '130%',
  },
  uploadForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '20px',
  },
  fileInput: {
    color: '#94a3b8',
    fontSize: '12px',
  },
  uploadBtn: {
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  docList: {
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '15px',
  },
  subTitle: {
    fontSize: '12px',
    color: '#cbd5e1',
    margin: '0 0 10px 0',
  },
  docItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'rgba(15, 23, 42, 0.2)',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '12px',
    color: '#94a3b8',
    marginBottom: '8px',
  },
  docName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '220px',
  },
  deleteDocBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
  },
  aiProposalPanel: {
    background: 'rgba(30, 41, 59, 0.15)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px 20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    background: 'rgba(15, 23, 42, 0.2)',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#e2e8f0',
    margin: 0,
  },
  generateBtn: {
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  proposalScroll: {
    padding: '20px',
    flex: 1,
    overflowY: 'auto',
  },
  proposalBlocks: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  proposalBlock: {
    background: 'rgba(15, 23, 42, 0.45)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  blockHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'rgba(255, 255, 255, 0.02)',
    padding: '10px 15px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
  },
  blockTitle: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#cbd5e1',
  },
  insertBtn: {
    background: 'rgba(99, 102, 241, 0.1)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    color: '#a5b4fc',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  proposalCode: {
    padding: '15px',
    margin: 0,
    fontSize: '12px',
    fontFamily: 'Consolas, monospace',
    color: '#e2e8f0',
    whiteSpace: 'pre-wrap',
    background: '#090d1a',
  },
  proposalText: {
    padding: '15px',
    fontSize: '13px',
    color: '#cbd5e1',
    lineHeight: '145%',
    whiteSpace: 'pre-wrap',
  },
  editorPanel: {
    background: 'rgba(30, 41, 59, 0.35)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  saveBtn: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  exportBtn: {
    background: 'linear-gradient(135deg, #00d2ff 0%, #0086ff 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  tabToggleContainer: {
    display: 'flex',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '6px',
    padding: '2px',
  },
  tabToggleActive: {
    background: 'rgba(99, 102, 241, 0.2)',
    border: 'none',
    color: '#a5b4fc',
    borderRadius: '4px',
    padding: '3px 8px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  tabToggleInactive: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    padding: '3px 8px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  editorContainer: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    flex: 1,
    overflowY: 'auto',
  },
  editorField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  fieldLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#cbd5e1',
  },
  textareaEditor: {
    width: '100%',
    background: '#0f172a',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '15px',
    color: '#f8fafc',
    fontSize: '13px',
    fontFamily: 'inherit',
    lineHeight: '145%',
    outline: 'none',
    resize: 'none',
    height: 'calc(100vh - 350px)',
  },
  emptyState: {
    color: '#64748b',
    textAlign: 'center',
    padding: '60px 20px',
    fontSize: '13px',
  },
  errorAlert: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#fca5a5',
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '12px',
    marginBottom: '15px',
  },
  successAlert: {
    background: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    color: '#a7f3d0',
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '12px',
    marginBottom: '15px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalCard: {
    background: '#1e293b',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '20px',
    padding: '30px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
  },
  modalTitle: {
    margin: '0 0 20px 0',
    fontSize: '18px',
    fontWeight: '700',
    textAlign: 'center',
  },
  modalField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '15px',
  },
  modalLabel: {
    fontSize: '12px',
    color: '#cbd5e1',
    fontWeight: '600',
  },
  modalInput: {
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '10px',
    color: '#f8fafc',
    fontSize: '13px',
    outline: 'none',
  },
  modalSelect: {
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '10px',
    color: '#f8fafc',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '25px',
  },
  modalCancelBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    padding: '10px 15px',
  },
  modalConfirmBtn: {
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  searchForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '20px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '15px',
  },
  searchFormGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    padding: '10px',
    color: '#f8fafc',
    fontSize: '13px',
    outline: 'none',
  },
  searchActionRow: {
    display: 'flex',
    gap: '10px',
  },
  searchSubmitBtn: {
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    flex: 2,
    boxShadow: '0 4px 10px rgba(99, 102, 241, 0.2)',
  },
  filterToggleBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#cbd5e1',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    flex: 1,
    textAlign: 'center',
  },
  advancedPanel: {
    background: 'rgba(15, 23, 42, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '10px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  advancedRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  advancedLabel: {
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: '600',
  },
  advancedInput: {
    background: 'rgba(30, 41, 59, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    padding: '6px 10px',
    color: '#f8fafc',
    fontSize: '12px',
    outline: 'none',
    cursor: 'pointer',
  },
  advancedSliderContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  advancedSlider: {
    flex: 1,
    cursor: 'pointer',
  },
  advancedValue: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#a5b4fc',
    minWidth: '35px',
    textAlign: 'right',
  },
  suggestionSection: {
    marginTop: '6px',
  },
  suggestionTitle: {
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  suggestionChips: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    alignItems: 'stretch',
  },
  suggestionChip: {
    background: 'rgba(99, 102, 241, 0.08)',
    border: '1px solid rgba(99, 102, 241, 0.2)',
    color: '#a5b4fc',
    fontSize: '11px',
    fontWeight: '500',
    padding: '8px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'block',
    textAlign: 'left',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'all 0.15s ease',
  },
  searchResults: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '20px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '15px',
    maxHeight: '400px',
    overflowY: 'auto',
  },
  searchResultHeader: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: '5px',
  },
  resultItemGreen: {
    background: 'rgba(16, 185, 129, 0.05)',
    border: '1px solid rgba(16, 185, 129, 0.15)',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '8px',
  },
  resultItemRed: {
    background: 'rgba(239, 68, 68, 0.05)',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '8px',
  },
  resultTitle: {
    fontSize: '12px',
    color: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  scoreBadgeGreen: {
    background: 'rgba(16, 185, 129, 0.2)',
    color: '#34d399',
    fontSize: '10px',
    fontWeight: '700',
    padding: '1px 5px',
    borderRadius: '4px',
  },
  scoreBadgeRed: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    fontSize: '10px',
    fontWeight: '700',
    padding: '1px 5px',
    borderRadius: '4px',
  },
  resultUrl: {
    fontSize: '10px',
    color: '#64748b',
    marginTop: '2px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  actionBtnRow: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
  },
  actionMiniBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#cbd5e1',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '10px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  scrapedContentBox: {
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '6px',
    padding: '8px',
    fontSize: '10px',
    fontFamily: 'Consolas, monospace',
    color: '#cbd5e1',
    whiteSpace: 'pre-wrap',
    maxHeight: '150px',
    overflowY: 'auto',
    marginTop: '6px',
    margin: 0,
  },
  summaryBox: {
    background: 'rgba(99, 102, 241, 0.05)',
    border: '1px dashed rgba(99, 102, 241, 0.3)',
    borderRadius: '6px',
    padding: '10px',
    marginTop: '8px',
    fontSize: '11px',
    color: '#cbd5e1',
    lineHeight: '1.4',
  },
  summaryTitle: {
    fontWeight: '700',
    color: '#a5b4fc',
    marginBottom: '4px',
    fontSize: '11px',
  },
  badgeContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '6px',
  },
  badgePositive: {
    background: 'rgba(16, 185, 129, 0.15)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    color: '#34d399',
    fontSize: '10px',
    fontWeight: '600',
    padding: '2px 8px',
    borderRadius: '6px',
    display: 'inline-block',
  },
  badgeNegative: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#f87171',
    fontSize: '10px',
    fontWeight: '600',
    padding: '2px 8px',
    borderRadius: '6px',
    display: 'inline-block',
  },
  badgeNeutral: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#cbd5e1',
    fontSize: '10px',
    fontWeight: '600',
    padding: '2px 8px',
    borderRadius: '6px',
    display: 'inline-block',
  },
  metricGuideBox: {
    background: 'rgba(15, 23, 42, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    padding: '12px',
    marginBottom: '15px',
  },
  metricGuideHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '700',
    color: '#cbd5e1',
  },
  metricGuideContent: {
    marginTop: '10px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    paddingTop: '8px',
  },
  recommendationBadge: {
    fontSize: '10px',
    fontWeight: '700',
    padding: '1px 6px',
    borderRadius: '4px',
    marginLeft: '6px',
  },
  forceIngestBtn: {
    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)',
  },
  genLogBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(15, 23, 42, 0.6)',
    borderRadius: '8px',
    padding: '12px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    marginBottom: '15px',
  },
  pulseDot: {
    width: '8px',
    height: '8px',
    background: '#818cf8',
    borderRadius: '50%',
    animation: 'pulse 1.5s infinite',
  },
  logText: {
    fontSize: '12px',
    color: '#a5b4fc',
    lineHeight: '1.4',
  }
};
