import React, { useState, FormEvent, useRef } from "react";

interface FileUploaderProps {
  onUploadSuccess: (fileId?: string, filename?: string) => void;
  onCancel: () => void;
  userId: string;
  currentPath: string;
}

export function FileUploader({
  onUploadSuccess,
  onCancel,
  userId,
  currentPath,
}: FileUploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " bytes";
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const fileInput = fileInputRef.current;
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      setError("파일을 선택해주세요.");
      return;
    }

    const file = fileInput.files[0];

    // 10MB 크기 제한 검사
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      setError("파일 크기는 10MB를 초과할 수 없습니다.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // 사용자 ID와 현재 경로 추가
      formData.append("userId", userId);
      formData.append("path", currentPath);

      // 디버깅 로그 추가
      console.log("업로드 요청 정보:", {
        url: `/api/users/${userId}/upload`,
        파일명: file.name,
        파일크기: file.size,
        경로: currentPath,
      });

      // 사용자별 API 엔드포인트 사용
      const response = await fetch(`/api/users/${userId}/upload`, {
        method: "POST",
        body: formData,
      });

      // 응답 상태 디버깅
      console.log("업로드 응답 상태:", {
        상태코드: response.status,
        상태텍스트: response.statusText,
      });

      const data = await response.json();
      console.log("업로드 응답 데이터:", data);

      if (!response.ok) {
        // 디스크 용량 초과 오류 처리
        if (data.error && data.error.includes("디스크 용량 초과")) {
          const requiredSpace = data.diskUsage?.required
            ? formatFileSize(data.diskUsage.required)
            : "추가 공간";

          setError(
            `디스크 용량 부족: 파일 업로드를 위해 ${requiredSpace}이(가) 필요합니다. 일부 파일을 삭제하여 공간을 확보하세요.`
          );
        } else {
          setError(data.error || "파일 업로드에 실패했습니다.");
        }
        return;
      }

      if (data.success) {
        onUploadSuccess();
        // 업로드 후 입력 필드 초기화
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        setError("알 수 없는 오류가 발생했습니다.");
      }
    } catch (err) {
      console.error("파일 업로드 오류:", err);
      let errorMessage = "서버 연결에 실패했습니다";
      if (err instanceof Error) {
        errorMessage += ` (${err.message})`;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">파일 업로드</h2>
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

      <div className="mb-3">
        <p className="text-gray-600">현재 경로: {currentPath}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="file"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            파일 선택 (최대 10MB)
          </label>
          <input
            id="file"
            type="file"
            ref={fileInputRef}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            허용되는 파일 유형: 모든 유형 (최대 크기: 10MB)
          </p>
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
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
          >
            {loading ? "업로드 중..." : "업로드"}
          </button>
        </div>
      </form>
    </div>
  );
}
