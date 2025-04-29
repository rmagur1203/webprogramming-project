import React, { useState, useEffect } from "react";
import { CodeEditor } from "./CodeEditor";

interface FileEditorProps {
  fileId?: string | null;
  contentPath?: string;
  onClose: () => void;
  userId?: string;
  filename?: string;
}

interface FileDetails {
  id: string;
  filename: string;
  mimeType: string;
  userId?: string;
}

interface User {
  id: string;
  username: string;
}

export function FileEditor({
  fileId,
  contentPath,
  onClose,
  userId,
  filename: propFilename,
}: FileEditorProps) {
  const [file, setFile] = useState<FileDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [content, setContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [filename, setFilename] = useState<string>(propFilename || "");

  // 파일 크기 포맷팅 함수
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " bytes";
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // 현재 사용자 정보 가져오기
  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const response = await fetch("/api/me");
        if (response.ok) {
          const data = await response.json();
          setCurrentUser(data.user);
        }
      } catch (error) {
        console.error("사용자 정보를 가져오는데 실패했습니다:", error);
      }
    }

    fetchCurrentUser();
  }, []);

  // 파일 내용 불러오기
  useEffect(() => {
    const fetchContent = async () => {
      if (!contentPath) return;

      try {
        console.log(`파일 내용 불러오기: ${contentPath}`);

        // contentPath에서 파일명 추출
        const pathParts = contentPath.split("/");
        const extractedFilename = pathParts[pathParts.length - 1];
        if (extractedFilename) {
          setFilename(extractedFilename);
        }

        const response = await fetch(contentPath);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        setContent(text);
        setOriginalContent(text); // 원본 내용 저장
      } catch (err) {
        console.error("파일 내용 로드 오류:", err);
        setError(
          err instanceof Error
            ? `파일을 불러오는데 실패했습니다: ${err.message}`
            : "파일을 불러오는데 실패했습니다."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [contentPath]);

  // 파일 저장
  const handleSave = async () => {
    if (!contentPath) {
      setError("파일 경로가 정의되지 않았습니다.");
      return;
    }

    if (content === originalContent) {
      // 변경 사항이 없으면 저장하지 않고 닫기
      onClose();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(contentPath, {
        method: "PUT",
        headers: {
          "Content-Type": "text/plain",
        },
        body: content,
      });

      const data = await response.json();

      if (!response.ok) {
        // 디스크 용량 초과 오류 처리
        if (data.error && data.error.includes("디스크 용량 초과")) {
          const requiredSpace = data.diskUsage?.required
            ? formatFileSize(data.diskUsage.required)
            : "추가 공간";

          setError(
            `디스크 용량 부족: 파일을 저장하기 위해 ${requiredSpace}이(가) 필요합니다. 일부 파일을 삭제하여 공간을 확보하세요.`
          );
        } else {
          setError(data.error || "파일 저장에 실패했습니다.");
        }
        return;
      }

      // 저장 성공 시 원본 내용 업데이트
      setOriginalContent(content);
      onClose(); // 편집기 닫기
    } catch (err) {
      console.error("파일 저장 오류:", err);
      setError(
        err instanceof Error
          ? `파일 저장에 실패했습니다: ${err.message}`
          : "파일 저장에 실패했습니다."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-full w-full mx-auto py-6 px-6 bg-white rounded-lg shadow-md">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full w-full mx-auto py-6 px-6 bg-white rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">
          {filename ? `파일 편집: ${filename}` : "파일 편집"}
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving || content === originalContent}
            className={`px-4 py-2 rounded-md text-white focus:outline-none ${
              saving || content === originalContent
                ? "bg-gray-400"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded">{error}</div>
      )}

      <div className="w-full border border-gray-300 rounded-md mb-4 overflow-hidden">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-[70vh] p-4 font-mono text-gray-800 focus:outline-none resize-none"
          spellCheck="false"
        ></textarea>
      </div>
    </div>
  );
}
