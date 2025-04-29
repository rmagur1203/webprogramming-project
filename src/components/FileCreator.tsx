import React, { useState } from "react";

interface FileCreatorProps {
  onFileCreated: (fileId: string) => void;
  onCancel: () => void;
  userId: string;
  currentPath: string;
}

interface FileTemplate {
  label: string;
  filename: string;
  mimeType: string;
  content: string;
}

export function FileCreator({
  onFileCreated,
  onCancel,
  userId,
  currentPath,
}: FileCreatorProps) {
  const [filename, setFilename] = useState("");
  const [content, setContent] = useState("");
  const [mimeType, setMimeType] = useState("text/html");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 템플릿 리스트
  const templates: FileTemplate[] = [
    {
      label: "HTML 페이지",
      filename: "index.html",
      mimeType: "text/html",
      content: `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>내 페이지</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      color: #333;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>환영합니다!</h1>
    <p>이 페이지를 원하는대로 수정하세요.</p>
  </div>
</body>
</html>`,
    },
    {
      label: "CSS 스타일시트",
      filename: "styles.css",
      mimeType: "text/css",
      content: `/* 기본 스타일 */
body {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 0;
  line-height: 1.6;
  color: #333;
  background-color: #f5f5f5;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

h1, h2, h3 {
  color: #2c3e50;
}

a {
  color: #3498db;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}
`,
    },
    {
      label: "JavaScript 파일",
      filename: "script.js",
      mimeType: "application/javascript",
      content: `// 기본 JavaScript 파일
document.addEventListener('DOMContentLoaded', function() {
  console.log('문서가 로드되었습니다!');
  
  // 예제 함수
  function showMessage(message) {
    alert(message);
  }
  
  // DOM 요소 찾기 예제
  const heading = document.querySelector('h1');
  if (heading) {
    heading.addEventListener('click', function() {
      showMessage('제목을 클릭하셨습니다!');
    });
  }
});
`,
    },
  ];

  // 템플릿 선택 처리
  const selectTemplate = (template: FileTemplate) => {
    setFilename(template.filename);
    setContent(template.content);
    setMimeType(template.mimeType);
  };

  // 파일 생성 폼 제출 처리
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!filename.trim()) {
      setError("파일 이름을 입력해주세요.");
      setLoading(false);
      return;
    }

    try {
      // 현재 경로에 파일 경로 추가
      const path =
        currentPath === "/"
          ? `${currentPath}${filename}`
          : `${currentPath}/${filename}`;

      const response = await fetch(`/api/users/${userId}/files/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path,
          content,
          mimeType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // 디스크 용량 초과 오류 처리
        if (data.error && data.error.includes("디스크 용량 초과")) {
          const requiredSpace = data.diskUsage?.required
            ? formatFileSize(data.diskUsage.required)
            : "추가 공간";

          setError(
            `디스크 용량 부족: 파일 생성을 위해 ${requiredSpace}이(가) 필요합니다. 일부 파일을 삭제하여 공간을 확보하세요.`
          );
        } else {
          setError(data.error || "파일 생성에 실패했습니다.");
        }
        return;
      }

      if (data.success) {
        onFileCreated(filename);
      } else {
        throw new Error("알 수 없는 오류가 발생했습니다.");
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "파일 생성 중 오류가 발생했습니다.";
      setError(message);
      setLoading(false);
    }
  };

  // 파일 크기 포맷팅 함수
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " bytes";
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">새 파일 만들기</h2>
        <button
          onClick={onCancel}
          className="text-gray-600 hover:text-gray-800"
        >
          ✕
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>
      )}

      <div className="mb-6">
        <h3 className="text-md font-semibold mb-2">템플릿 선택</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {templates.map((template, index) => (
            <button
              key={index}
              onClick={() => selectTemplate(template)}
              className="p-3 border rounded hover:bg-blue-50 text-left transition-colors"
            >
              <div className="font-medium">{template.label}</div>
              <div className="text-sm text-gray-500">{template.filename}</div>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label
            htmlFor="filename"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            파일 이름
          </label>
          <input
            id="filename"
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예: index.html"
            required
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="mimeType"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            콘텐츠 유형
          </label>
          <select
            id="mimeType"
            value={mimeType}
            onChange={(e) => setMimeType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="text/html">HTML</option>
            <option value="text/css">CSS</option>
            <option value="application/javascript">JavaScript</option>
            <option value="text/plain">텍스트</option>
            <option value="application/json">JSON</option>
            <option value="text/markdown">Markdown</option>
          </select>
        </div>

        <div className="mb-6">
          <label
            htmlFor="content"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            내용
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            placeholder="여기에 파일 내용을 입력하세요..."
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? "생성 중..." : "파일 생성"}
          </button>
        </div>
      </form>
    </div>
  );
}
