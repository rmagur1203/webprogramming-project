import React, { useState, useEffect, useRef, useCallback } from "react";
import Prism from "prismjs";

// 테마 (필요한 테마만 로드)
import "prismjs/themes/prism.css"; // 기본 (라이트)
import "prismjs/themes/prism-tomorrow.css"; // 다크
import "prismjs/themes/prism-okaidia.css"; // 오카이디아
import "prismjs/themes/prism-solarizedlight.css"; // 솔라라이즈드
import "prismjs/themes/prism-dark.css"; // 다크2

// 라인 번호 플러그인
import "prismjs/plugins/line-numbers/prism-line-numbers.css";
import "prismjs/plugins/line-numbers/prism-line-numbers";

// 추가 언어 지원
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-css";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-json";
import "prismjs/components/prism-python";
import "prismjs/components/prism-java";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";

// 자동완성을 위한 키워드 목록
const KEYWORDS = {
  javascript: [
    "const",
    "let",
    "var",
    "function",
    "return",
    "if",
    "else",
    "for",
    "while",
    "switch",
    "case",
    "break",
    "continue",
    "try",
    "catch",
    "finally",
    "class",
    "new",
    "import",
    "export",
    "default",
    "from",
    "async",
    "await",
    "this",
    "console",
    "log",
    "true",
    "false",
  ],
  typescript: [
    "const",
    "let",
    "var",
    "function",
    "return",
    "if",
    "else",
    "for",
    "while",
    "switch",
    "case",
    "break",
    "continue",
    "try",
    "catch",
    "finally",
    "class",
    "new",
    "import",
    "export",
    "default",
    "from",
    "async",
    "await",
    "this",
    "console",
    "log",
    "interface",
    "type",
    "enum",
    "namespace",
    "readonly",
    "private",
    "public",
    "protected",
    "static",
    "extends",
    "implements",
    "any",
    "string",
    "number",
    "boolean",
    "void",
    "null",
    "undefined",
  ],
  css: [
    "color",
    "background",
    "margin",
    "padding",
    "border",
    "display",
    "position",
    "width",
    "height",
    "font-size",
    "font-weight",
    "text-align",
    "flex",
    "grid",
    "box-shadow",
    "transition",
    "transform",
    "animation",
    "@media",
    "@keyframes",
    "hover",
    "active",
    "focus",
  ],
  markup: [
    "div",
    "span",
    "p",
    "h1",
    "h2",
    "h3",
    "ul",
    "li",
    "a",
    "img",
    "button",
    "form",
    "input",
    "table",
    "tr",
    "td",
    "th",
    "section",
    "article",
    "header",
    "footer",
    "nav",
    "main",
    "class",
    "id",
    "style",
    "href",
    "src",
    "alt",
  ],
  python: [
    "def",
    "class",
    "import",
    "from",
    "if",
    "elif",
    "else",
    "for",
    "while",
    "try",
    "except",
    "finally",
    "with",
    "as",
    "return",
    "yield",
    "and",
    "or",
    "not",
    "True",
    "False",
    "None",
    "lambda",
    "print",
    "in",
    "is",
    "self",
  ],
};

// 테마 타입 정의
type Theme = "light" | "tomorrow" | "okaidia" | "solarized" | "dark";

interface CodeEditorProps {
  fileId: string;
  filename: string;
  initialContent?: string;
  userId?: string;
  onSave?: (content: string) => Promise<boolean>;
}

export function CodeEditor({
  fileId,
  filename,
  initialContent = "",
  userId,
  onSave,
}: CodeEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [previousContent, setPreviousContent] = useState(initialContent);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(
    () =>
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [autoSave, setAutoSave] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [theme, setTheme] = useState<Theme>(
    window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "tomorrow"
      : "light"
  );
  const [autoComplete, setAutoComplete] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ top: 0, left: 0 });
  const [scrollTop, setScrollTop] = useState(0);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLPreElement>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // 자동 저장 타이머
  const autoSaveTimerRef = useRef<number | null>(null);

  // 파일 확장자에 따른 언어 결정
  const getLanguage = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "html":
        return "markup";
      case "css":
        return "css";
      case "js":
        return "javascript";
      case "jsx":
        return "jsx";
      case "ts":
        return "typescript";
      case "tsx":
        return "tsx";
      case "json":
        return "json";
      case "md":
        return "markdown";
      case "py":
        return "python";
      case "java":
        return "java";
      case "c":
        return "c";
      case "cpp":
      case "cc":
      case "cxx":
        return "cpp";
      case "cs":
        return "csharp";
      default:
        return "plaintext";
    }
  };

  const language = getLanguage(filename);

  // 고정폭 글꼴 지정
  const monospaceFontFamily =
    "'Menlo', 'Monaco', 'Consolas', 'Courier New', monospace";

  // 테마 변경 시 CSS 클래스 적용
  useEffect(() => {
    document.body.classList.remove(
      "prism-light",
      "prism-tomorrow",
      "prism-okaidia",
      "prism-solarized",
      "prism-dark"
    );
    document.body.classList.add(`prism-${theme}`);

    // 테마 변경 시 body 배경색도 같이 변경
    if (theme !== "light" && theme !== "solarized") {
      document.body.style.backgroundColor = "#1a202c"; // 다크 모드 배경색
      document.body.style.color = "#f7fafc";
    } else {
      document.body.style.backgroundColor = "#ffffff"; // 라이트 모드 배경색
      document.body.style.color = "#1a202c";
    }

    setIsDarkMode(theme !== "light" && theme !== "solarized");

    // 에디터 컨테이너 찾아서 다크 모드 클래스 추가
    const editorContainer = document.querySelector(".editor-container");
    if (editorContainer) {
      if (theme !== "light" && theme !== "solarized") {
        editorContainer.classList.add("dark-theme");
        editorContainer.classList.remove("light-theme");
      } else {
        editorContainer.classList.add("light-theme");
        editorContainer.classList.remove("dark-theme");
      }
    }

    // Prism 테마의 테두리 스타일 재정의
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      pre[class*="language-"] {
        border: none !important;
        box-shadow: none !important;
      }
      
      code[class*="language-"],
      pre[class*="language-"],
      .token {
        text-shadow: none !important;
      }
      
      /* 다크 모드 테마에서 코드 색상 명확하게 설정 */
      body.prism-tomorrow code[class*="language-"],
      body.prism-okaidia code[class*="language-"],
      body.prism-dark code[class*="language-"] {
        color: #f8f8f2 !important;
      }
      
      /* 토큰별 색상 설정 - 다크 모드 */
      body.prism-tomorrow .token.comment,
      body.prism-okaidia .token.comment,
      body.prism-dark .token.comment {
        color: #6272a4 !important;
      }
      
      body.prism-tomorrow .token.string,
      body.prism-okaidia .token.string,
      body.prism-dark .token.string {
        color: #f1fa8c !important;
      }
      
      body.prism-tomorrow .token.keyword,
      body.prism-okaidia .token.keyword,
      body.prism-dark .token.keyword {
        color: #ff79c6 !important;
      }
      
      body.prism-tomorrow .token.function,
      body.prism-okaidia .token.function,
      body.prism-dark .token.function {
        color: #50fa7b !important;
      }
      
      body.prism-tomorrow .token.number,
      body.prism-okaidia .token.number,
      body.prism-dark .token.number {
        color: #bd93f9 !important;
      }
    `;
    document.head.appendChild(styleEl);

    return () => {
      if (styleEl.parentNode) {
        document.head.removeChild(styleEl);
      }
    };
  }, [theme]);

  // 시스템 다크 모드 설정 변경 감지
  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia(
      "(prefers-color-scheme: dark)"
    );

    const handleDarkModeChange = (e: MediaQueryListEvent) => {
      const newDarkMode = e.matches;
      // 시스템 설정이 변경되면 테마도 자동으로 변경
      setTheme(newDarkMode ? "tomorrow" : "light");
    };

    // 이벤트 리스너 등록 (최신 브라우저)
    if (darkModeMediaQuery.addEventListener) {
      darkModeMediaQuery.addEventListener("change", handleDarkModeChange);
    } else {
      // 이전 브라우저 지원 (Safari 13.0 이하)
      darkModeMediaQuery.addListener(handleDarkModeChange);
    }

    return () => {
      if (darkModeMediaQuery.removeEventListener) {
        darkModeMediaQuery.removeEventListener("change", handleDarkModeChange);
      } else {
        darkModeMediaQuery.removeListener(handleDarkModeChange);
      }
    };
  }, []);

  // 스크롤 동기화
  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (previewRef.current && editorRef.current && lineNumbersRef.current) {
      const scrollTop = editorRef.current.scrollTop;
      previewRef.current.scrollTop = scrollTop;
      previewRef.current.scrollLeft = editorRef.current.scrollLeft;

      // 줄 번호 스크롤 동기화
      if (lineNumbersRef.current.parentElement) {
        lineNumbersRef.current.parentElement.scrollTop = scrollTop;
      }

      setScrollTop(scrollTop);
    }
  };

  // 라인 번호 생성
  const getLineNumbers = () => {
    const lines = content.split("\n").length;
    let lineNumbers = "";
    for (let i = 1; i <= lines; i++) {
      lineNumbers += `<div class="line-number">${i}</div>`;
    }
    return lineNumbers;
  };

  // 코드 업데이트 및 하이라이팅
  useEffect(() => {
    if (previewRef.current) {
      // code 요소를 찾거나 생성
      let codeElement = previewRef.current.querySelector("code");
      if (!codeElement) {
        codeElement = document.createElement("code");
        codeElement.className = `language-${language}`;
        previewRef.current.appendChild(codeElement);
      } else {
        codeElement.className = `language-${language}`;
      }

      // 코드 내용 설정
      codeElement.textContent = content;

      // 하이라이팅 적용
      Prism.highlightElement(codeElement);
    }
  }, [content, language]);

  // 자동완성 제안 업데이트
  const updateSuggestions = useCallback(
    (text: string, cursorPos: number) => {
      if (!autoComplete) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      // 커서 위치 이전의 텍스트 가져오기
      const textBeforeCursor = text.substring(0, cursorPos);

      // 마지막 단어 추출
      const match = textBeforeCursor.match(/[\w\-]+$/);
      if (!match) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      const currentWord = match[0];
      if (currentWord.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      // 현재 언어에 맞는 키워드 목록 가져오기
      const langKeywords =
        KEYWORDS[language as keyof typeof KEYWORDS] || KEYWORDS.javascript;

      // 일치하는 제안 필터링
      const filtered = langKeywords.filter((word) =>
        word.toLowerCase().includes(currentWord.toLowerCase())
      );

      setSuggestions(filtered);
      setSelectedSuggestion(0);
      setShowSuggestions(filtered.length > 0);

      // 커서 위치 계산 - 더 정확한 방법으로 수정
      if (editorRef.current) {
        const textarea = editorRef.current;
        const textBeforeCursor = textarea.value.substring(0, cursorPos);
        const lines = textBeforeCursor.split("\n");
        const currentLineIndex = lines.length - 1;
        const currentLine = lines[currentLineIndex];

        // 임시 요소를 사용하여 정확한 위치 측정
        const measureEl = document.createElement("div");
        measureEl.style.position = "absolute";
        measureEl.style.visibility = "hidden";
        measureEl.style.whiteSpace = "pre";
        measureEl.style.fontFamily = monospaceFontFamily;
        measureEl.style.fontSize = `${fontSize}px`;
        measureEl.style.lineHeight = `${Math.round(fontSize * 1.5)}px`;
        measureEl.textContent = currentLine;
        document.body.appendChild(measureEl);

        // 현재 줄의 너비 계산
        const width = measureEl.offsetWidth;
        document.body.removeChild(measureEl);

        // 라인 높이 계산
        const lineHeight = Math.round(fontSize * 1.5);

        // 실제 에디터 내 위치 계산
        const rect = textarea.getBoundingClientRect();
        const editorPaddingTop = 10; // 에디터 상단 패딩
        const editorPaddingLeft = 16; // 에디터 좌측 패딩

        // 커서의 실제 위치 계산 (패딩 고려)
        const top = currentLineIndex * lineHeight + editorPaddingTop;

        // 텍스트 너비 기반 좌측 위치 계산
        // 단순 계산보다 더 정확하게 하려면 measureEl의 너비를 사용
        // 그러나 monospace 폰트에서는 글자당 고정 너비를 사용해도 충분함
        const charWidth = fontSize * 0.6;
        const left = currentLine.length * charWidth;

        setCursorPosition({ top, left });
      }
    },
    [language, autoComplete, fontSize, monospaceFontFamily]
  );

  // 파일 내용 가져오기
  useEffect(() => {
    async function fetchFileContent() {
      setLoading(true);
      setError(null);

      try {
        let response;

        // 사용자 ID가 있는 경우 사용자 기반 경로 사용
        if (userId) {
          console.log(
            `사용자 기반 파일 내용 로드: userId=${userId}, filename=${filename}`
          );
          response = await fetch(`/api/users/${userId}/content/${filename}`);
        } else {
          // 레거시 방식 (하위 호환성 유지)
          console.log(`레거시 방식 파일 내용 로드: fileId=${fileId}`);
          response = await fetch(`/api/files/${fileId}/content`);
        }

        if (!response.ok) {
          // 404인 경우 빈 내용으로 처리 (새 파일)
          if (response.status === 404) {
            console.log(
              `파일을 찾을 수 없음: ${
                filename || fileId
              }, 빈 파일로 시작합니다.`
            );
            setContent("");
            setPreviousContent("");
            return;
          }

          setError("파일 내용을 가져오는데 실패했습니다.");
          return;
        }

        const text = await response.text();
        setContent(text);
        setPreviousContent(text);
      } catch (err) {
        console.error("파일 내용 로딩 오류:", err);
        setError("서버 연결에 실패했습니다.");
      } finally {
        setLoading(false);
      }
    }

    if (fileId || (userId && filename)) {
      fetchFileContent();
    } else {
      setLoading(false);
    }
  }, [fileId, userId, filename]);

  // 자동 저장 처리
  useEffect(() => {
    // 내용이 변경되었을 때만 자동 저장 타이머 설정
    if (autoSave && onSave && content !== previousContent) {
      // 이전 타이머가 있으면 클리어
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }

      // 2초 후에 저장 실행
      autoSaveTimerRef.current = window.setTimeout(async () => {
        setSaving(true);
        try {
          const success = await onSave(content);
          setSaveSuccess(success);
          if (success) {
            setPreviousContent(content);
          }
        } catch (error) {
          setSaveSuccess(false);
        } finally {
          setSaving(false);
          // 3초 후에 상태 메시지 숨김
          setTimeout(() => setSaveSuccess(null), 3000);
        }
      }, 2000);
    }

    // 컴포넌트 언마운트 시 타이머 클리어
    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [content, autoSave, onSave, previousContent]);

  // 파일 저장
  const handleSave = async () => {
    if (!onSave) return;

    setSaving(true);
    setSaveSuccess(null);

    try {
      const success = await onSave(content);
      setSaveSuccess(success);
      if (success) {
        setPreviousContent(content);
      }
    } catch (err) {
      setSaveSuccess(false);
    } finally {
      setSaving(false);
      // 성공/실패 메시지 5초 후 자동 제거
      if (saveSuccess !== null) {
        setTimeout(() => setSaveSuccess(null), 5000);
      }
    }
  };

  // 폰트 크기 증가
  const increaseFontSize = () => {
    setFontSize((prevSize) => Math.min(prevSize + 2, 28));
  };

  // 폰트 크기 감소
  const decreaseFontSize = () => {
    setFontSize((prevSize) => Math.max(prevSize - 2, 10));
  };

  // 자동완성 제안 선택
  const selectSuggestion = (suggestion: string) => {
    if (!editorRef.current) return;

    const textarea = editorRef.current;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = content.substring(0, cursorPos);

    // 마지막 단어 찾기
    const match = textBeforeCursor.match(/[\w\-]+$/);
    if (!match) return;

    // 마지막 단어의 시작 위치
    const wordStart = cursorPos - match[0].length;

    // 제안으로 단어 대체
    const newText =
      content.substring(0, wordStart) +
      suggestion +
      content.substring(cursorPos);
    setContent(newText);

    // 커서 위치 업데이트
    const newCursorPos = wordStart + suggestion.length;
    setTimeout(() => {
      if (textarea) {
        textarea.selectionStart = textarea.selectionEnd = newCursorPos;
        textarea.focus();
      }
    }, 0);

    // 제안 패널 닫기
    setShowSuggestions(false);
  };

  // 키 입력 처리
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 자동완성 선택 처리
    if (showSuggestions) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestion((prev) => (prev + 1) % suggestions.length);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestion(
          (prev) => (prev - 1 + suggestions.length) % suggestions.length
        );
        return;
      }

      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (suggestions.length > 0) {
          selectSuggestion(suggestions[selectedSuggestion]);
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
    }

    // 탭 키 처리
    if (e.key === "Tab" && !showSuggestions) {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      // 탭 문자 대신 공백 2개 삽입
      const newText =
        content.substring(0, start) + "  " + content.substring(end);
      setContent(newText);

      // 커서 위치 조정
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }

    // Ctrl+S 단축키로 저장
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      handleSave();
    }
  };

  // 내용 변경 처리
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    // 자동완성 제안 업데이트
    updateSuggestions(newContent, e.target.selectionStart);
  };

  // 커서 위치 변경 처리
  const handleCursorChange = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    updateSuggestions(textarea.value, textarea.selectionStart);
  };

  // CSS 스타일 추가를 위한 useEffect 수정
  useEffect(() => {
    // 줄 번호 스타일을 위한 CSS 추가
    const styleEl = document.createElement("style");
    // 정확한 라인 높이 계산
    const lineHeightPx = Math.round(fontSize * 1.5);

    styleEl.textContent = `
      .line-numbers-container {
        overflow-y: auto !important;
        overflow-x: hidden !important;
        scrollbar-width: none !important;
      }
      
      .line-numbers-container::-webkit-scrollbar {
        display: none !important;
      }
      
      .line-number-wrapper {
        padding-top: 10px !important;
        padding-bottom: 10px !important;
      }
      
      .line-number {
        height: ${lineHeightPx}px !important;
        line-height: ${lineHeightPx}px !important;
        padding-right: 8px !important;
        text-align: right !important;
        font-family: ${monospaceFontFamily} !important;
        font-size: ${fontSize}px !important;
      }
      
      .editor-textarea, .editor-preview {
        padding: 10px 16px !important;
        font-size: ${fontSize}px !important;
        line-height: ${lineHeightPx}px !important;
        font-family: ${monospaceFontFamily} !important;
        white-space: pre !important;
        tab-size: 2 !important;
        -moz-tab-size: 2 !important;
      }
      
      .editor-preview code {
        font-size: inherit !important;
        line-height: inherit !important;
        font-family: inherit !important;
        background: transparent !important;
        border: none !important;
        white-space: pre !important;
        tab-size: 2 !important;
        -moz-tab-size: 2 !important;
      }
      
      /* 에디터 스타일 개선 */
      .editor-preview, .editor-preview code {
        color: inherit !important;
      }
      
      /* 다크 모드일 때 에디터 스타일 */
      body.prism-tomorrow .editor-preview,
      body.prism-okaidia .editor-preview,
      body.prism-dark .editor-preview {
        background-color: #282c34 !important;
        color: #f8f8f2 !important;
      }
      
      body.prism-tomorrow .editor-container,
      body.prism-okaidia .editor-container,
      body.prism-dark .editor-container {
        background-color: #1e1e1e !important;
      }
      
      body.prism-tomorrow .line-numbers-container,
      body.prism-okaidia .line-numbers-container,
      body.prism-dark .line-numbers-container {
        background-color: #252526 !important;
        border-color: #333 !important;
      }
      
      /* 라이트 모드일 때 에디터 스타일 */
      body.prism-light .editor-preview,
      body.prism-solarized .editor-preview {
        background-color: white !important;
        color: #333 !important;
      }
      
      body.prism-light .editor-container,
      body.prism-solarized .editor-container {
        background-color: white !important;
      }
      
      body.prism-light .line-numbers-container,
      body.prism-solarized .line-numbers-container {
        background-color: #f9fafb !important;
        border-color: #eee !important;
      }
      
      /* 다크 모드 클래스 스타일 */
      .dark-theme {
        background-color: #1e1e1e !important;
        color: #f8f8f2 !important;
      }
      
      .dark-theme .editor-preview {
        background-color: #282c34 !important;
        color: #f8f8f2 !important;
      }
      
      .dark-theme .line-numbers-container {
        background-color: #252526 !important;
        border-color: #333 !important;
        color: #6c7280 !important;
      }
      
      /* 라이트 모드 클래스 스타일 */
      .light-theme {
        background-color: white !important;
        color: #333 !important;
      }
      
      .light-theme .editor-preview {
        background-color: white !important;
        color: #333 !important;
      }
      
      .light-theme .line-numbers-container {
        background-color: #f9fafb !important;
        border-color: #eee !important;
      }
    `;
    document.head.appendChild(styleEl);

    return () => {
      if (styleEl.parentNode) {
        document.head.removeChild(styleEl);
      }
    };
  }, [fontSize, monospaceFontFamily]);

  // 컴포넌트가 마운트되면 스크롤 동기화 이벤트 리스너 설정
  useEffect(() => {
    const lineNumbersContainer = lineNumbersRef.current?.parentElement;

    if (editorRef.current && lineNumbersContainer) {
      // 줄 번호 스크롤이 변경될 때 텍스트 영역과 동기화
      const handleLineNumbersScroll = () => {
        if (editorRef.current && lineNumbersContainer) {
          editorRef.current.scrollTop = lineNumbersContainer.scrollTop;
        }
      };

      lineNumbersContainer.addEventListener("scroll", handleLineNumbersScroll);

      return () => {
        lineNumbersContainer.removeEventListener(
          "scroll",
          handleLineNumbersScroll
        );
      };
    }
  }, []);

  return (
    <div className="w-full h-full bg-gray-50 dark:bg-gray-900">
      <div className={`p-6 ${isDarkMode ? "bg-gray-900" : "bg-gray-50"}`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{filename}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !onSave}
              className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
            <a
              href={
                userId
                  ? `/static/users/${userId}/${filename}`
                  : `/static/${fileId}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              보기
            </a>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        {saveSuccess === true && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
            파일이 성공적으로 저장되었습니다.
          </div>
        )}

        {saveSuccess === false && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            파일 저장에 실패했습니다.
          </div>
        )}

        <div
          className={`mb-4 p-3 rounded flex flex-wrap items-center gap-4 shadow-sm ${
            isDarkMode ? "bg-gray-800" : "bg-white"
          }`}
        >
          <div className="flex items-center gap-2">
            <label
              htmlFor="theme"
              className={`text-sm ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              테마:{" "}
            </label>
            <select
              id="theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value as Theme)}
              className={`px-2 py-1 rounded ${
                isDarkMode
                  ? "bg-gray-700 text-gray-200"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              <option value="light">라이트</option>
              <option value="tomorrow">다크</option>
              <option value="okaidia">오카이디아</option>
              <option value="solarized">솔라라이즈드</option>
              <option value="dark">다크2</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="lineNumbers"
              checked={showLineNumbers}
              onChange={() => setShowLineNumbers(!showLineNumbers)}
              className={`rounded ${
                isDarkMode
                  ? "bg-gray-700 border-gray-600"
                  : "bg-white border-gray-300"
              }`}
            />
            <label
              htmlFor="lineNumbers"
              className={isDarkMode ? "text-gray-300" : "text-gray-700"}
            >
              행 번호
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoSave"
              checked={autoSave}
              onChange={() => setAutoSave(!autoSave)}
              className={`rounded ${
                isDarkMode
                  ? "bg-gray-700 border-gray-600"
                  : "bg-white border-gray-300"
              }`}
            />
            <label
              htmlFor="autoSave"
              className={isDarkMode ? "text-gray-300" : "text-gray-700"}
            >
              자동 저장
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoComplete"
              checked={autoComplete}
              onChange={() => setAutoComplete(!autoComplete)}
              className={`rounded ${
                isDarkMode
                  ? "bg-gray-700 border-gray-600"
                  : "bg-white border-gray-300"
              }`}
            />
            <label
              htmlFor="autoComplete"
              className={isDarkMode ? "text-gray-300" : "text-gray-700"}
            >
              자동완성
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={decreaseFontSize}
              className={`px-2 py-1 rounded ${
                isDarkMode
                  ? "bg-gray-700 hover:bg-gray-600 text-gray-200"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-800"
              }`}
            >
              A-
            </button>
            <span
              className={`text-sm ${
                isDarkMode ? "text-gray-300" : "text-gray-700"
              }`}
            >
              {fontSize}px
            </span>
            <button
              onClick={increaseFontSize}
              className={`px-2 py-1 rounded ${
                isDarkMode
                  ? "bg-gray-700 hover:bg-gray-600 text-gray-200"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-800"
              }`}
            >
              A+
            </button>
          </div>
        </div>

        {loading ? (
          <div
            className={`flex justify-center items-center h-64 shadow-sm rounded ${
              isDarkMode ? "bg-gray-800" : "bg-white"
            }`}
          >
            <p className={isDarkMode ? "text-gray-300" : "text-gray-700"}>
              로딩 중...
            </p>
          </div>
        ) : (
          <div
            className="relative editor-container"
            style={{
              height: "500px",
              backgroundColor: isDarkMode ? "#1e1e1e" : "white",
              borderRadius: "0.375rem",
              overflow: "hidden",
            }}
          >
            {showLineNumbers && (
              <div
                className="absolute left-0 top-0 h-full bg-gray-50 text-gray-400 select-none border-r border-gray-100 line-numbers-container"
                style={{
                  width: "60px",
                  userSelect: "none",
                  zIndex: 10,
                  pointerEvents: "none",
                  backgroundColor: isDarkMode ? "#252526" : "#f9fafb",
                }}
              >
                <div
                  ref={lineNumbersRef}
                  className="line-number-wrapper"
                  dangerouslySetInnerHTML={{ __html: getLineNumbers() }}
                />
              </div>
            )}

            <textarea
              ref={editorRef}
              value={content}
              onChange={handleContentChange}
              onKeyDown={handleKeyDown}
              onClick={handleCursorChange}
              onKeyUp={handleCursorChange}
              onScroll={syncScroll}
              className="editor-textarea"
              style={{
                position: "absolute",
                top: 0,
                left: showLineNumbers ? "60px" : 0,
                right: 0,
                bottom: 0,
                height: "100%",
                width: showLineNumbers ? "calc(100% - 60px)" : "100%",
                resize: "none",
                outline: "none",
                overflowY: "auto",
                backgroundColor: "transparent",
                color: "transparent",
                caretColor: isDarkMode ? "white" : "black",
                whiteSpace: "pre",
                zIndex: 20,
              }}
              placeholder="여기에 코드를 입력하세요..."
              spellCheck="false"
            />

            <pre
              ref={previewRef}
              className="editor-preview"
              style={{
                position: "absolute",
                top: 0,
                left: showLineNumbers ? "60px" : 0,
                right: 0,
                bottom: 0,
                height: "100%",
                width: showLineNumbers ? "calc(100% - 60px)" : "100%",
                margin: 0,
                overflow: "auto",
                backgroundColor: isDarkMode ? "#282c34" : "white",
                color: isDarkMode ? "#f8f8f2" : "#333",
                zIndex: 10,
                border: "none",
              }}
              aria-hidden="true"
            >
              <code className={`language-${language}`}>{content}</code>
            </pre>

            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionRef}
                className="absolute z-30 shadow-sm rounded overflow-hidden max-h-52 bg-white border border-gray-100"
                style={{
                  top: `${cursorPosition.top + 5}px`,
                  left: `${
                    cursorPosition.left + (showLineNumbers ? 76 : 16)
                  }px`,
                  minWidth: "150px",
                }}
              >
                <ul className="py-1">
                  {suggestions.map((suggestion, index) => (
                    <li
                      key={suggestion}
                      className={`px-3 py-1 cursor-pointer hover:bg-blue-500 hover:text-white ${
                        index === selectedSuggestion
                          ? "bg-blue-500 text-white"
                          : ""
                      }`}
                      onClick={() => selectSuggestion(suggestion)}
                    >
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div
          className={`mt-2 text-xs p-2 ${
            isDarkMode ? "text-gray-400" : "text-gray-500"
          }`}
        >
          키보드 단축키: Ctrl+S (저장), Tab (들여쓰기), ESC (자동완성 닫기)
        </div>
      </div>
    </div>
  );
}
