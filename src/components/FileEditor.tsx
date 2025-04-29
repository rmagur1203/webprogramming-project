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
  filename,
}: FileEditorProps) {
  const [file, setFile] = useState<FileDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

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

  // contentPath에서 파일 이름 추출
  useEffect(() => {
    if (contentPath && !filename) {
      // contentPath 형식: /api/users/:userId/content/:filename
      const parts = contentPath.split("/");
      const extractedFileName = parts[parts.length - 1];

      if (extractedFileName && !filename) {
        // userId가 없는 경우 contentPath에서 추출
        if (!userId && parts.length >= 4) {
          const extractedUserId = parts[3];
          console.log(
            `추출된 정보: userId=${extractedUserId}, filename=${extractedFileName}`
          );

          // 파일 정보 로드
          loadFileByUserAndFilename(extractedUserId, extractedFileName);
        } else if (userId) {
          console.log(
            `파일 정보: userId=${userId}, filename=${extractedFileName}`
          );
          loadFileByUserAndFilename(userId, extractedFileName);
        }
      }
    }
  }, [contentPath, userId, filename]);

  // 사용자 ID와 파일명으로 파일 정보 로드
  const loadFileByUserAndFilename = async (uid: string, fname: string) => {
    setLoading(true);
    setError(null);

    try {
      // URL 디코딩 추가
      const decodedFileName = decodeURIComponent(fname);
      console.log(`파일 검색: 원본=${fname}, 디코딩=${decodedFileName}`);

      // 사용자별 파일 API에서 파일 목록 가져오기
      const response = await fetch(`/api/users/${uid}/files`);
      if (!response.ok) {
        throw new Error("파일 정보를 가져오는데 실패했습니다");
      }

      const data = await response.json();
      // 원본 이름과 디코딩된 이름 모두 검색
      let fileDetails = data.entries.find((f: any) => f.name === fname);
      if (!fileDetails) {
        fileDetails = data.entries.find((f: any) => f.name === decodedFileName);
      }

      if (!fileDetails) {
        console.warn(`파일을 찾을 수 없음: ${decodedFileName}`);
        // 파일을 찾지 못한 경우에도 기본 정보로 생성
        const mimeType = getMimeTypeFromFileName(decodedFileName);
        setFile({
          id: decodedFileName,
          filename: decodedFileName,
          mimeType: mimeType,
          userId: uid,
        });
      } else {
        setFile({
          id: fileDetails.name,
          filename: fileDetails.name,
          mimeType:
            fileDetails.mimeType || getMimeTypeFromFileName(fileDetails.name),
          userId: uid,
        });
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "파일 정보를 가져오는데 실패했습니다";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // 파일 확장자에 따른 MIME 타입 추론
  const getMimeTypeFromFileName = (filename: string): string => {
    const extension = filename.split(".").pop()?.toLowerCase() || "";
    const mimeTypes: Record<string, string> = {
      txt: "text/plain",
      html: "text/html",
      css: "text/css",
      js: "application/javascript",
      json: "application/json",
      xml: "application/xml",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      pdf: "application/pdf",
      md: "text/markdown",
      csv: "text/csv",
    };

    return mimeTypes[extension] || "text/plain";
  };

  // 파일 정보 가져오기 (fileId 방식)
  useEffect(() => {
    async function fetchFileDetails() {
      if (!fileId) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 현재 사용자 정보가 필요합니다
        if (!currentUser) {
          setError("사용자 정보를 가져오는데 실패했습니다");
          setLoading(false);
          return;
        }

        // URL 디코딩 추가
        const decodedFileId = decodeURIComponent(fileId);
        console.log(`파일 ID 검색: 원본=${fileId}, 디코딩=${decodedFileId}`);

        // 사용자별 파일 API에서 파일 목록 가져오기
        const response = await fetch(`/api/users/${currentUser.id}/files`);
        if (!response.ok) {
          throw new Error("파일 정보를 가져오는데 실패했습니다");
        }

        const data = await response.json();
        // 원본 이름과 디코딩된 이름 모두 검색
        let fileDetails = data.entries.find((f: any) => f.name === fileId);
        if (!fileDetails) {
          fileDetails = data.entries.find((f: any) => f.name === decodedFileId);
        }

        if (!fileDetails) {
          console.warn(`파일을 찾을 수 없음: ${decodedFileId}`);
          // 파일을 찾지 못한 경우에도 기본 정보로 생성
          const mimeType = getMimeTypeFromFileName(decodedFileId);
          setFile({
            id: decodedFileId,
            filename: decodedFileId,
            mimeType: mimeType,
            userId: currentUser.id,
          });
        } else {
          setFile({
            id: fileDetails.name,
            filename: fileDetails.name,
            mimeType:
              fileDetails.mimeType || getMimeTypeFromFileName(fileDetails.name),
            userId: currentUser.id,
          });
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "파일 정보를 가져오는데 실패했습니다";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    // 유저 ID와 파일명이 모두 제공된 경우 (새로운 방식)
    async function fetchFileByUserAndFilename() {
      if (!userId || !filename) {
        return;
      }

      loadFileByUserAndFilename(userId, filename);
    }

    if (userId && filename) {
      fetchFileByUserAndFilename();
    } else if (fileId && currentUser) {
      fetchFileDetails();
    }
  }, [fileId, userId, filename, currentUser]);

  // 파일 내용 저장
  const handleSaveContent = async (content: string): Promise<boolean> => {
    if (!file) return false;

    try {
      // 사용자 기반 경로로 저장
      const response = await fetch(
        `/api/users/${file.userId}/content/${file.filename}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "text/plain",
          },
          body: content,
        }
      );

      return response.ok;
    } catch (error) {
      console.error("파일 저장 중 오류 발생:", error);
      return false;
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex justify-center items-center p-8">
        <p>파일 정보를 로딩 중입니다...</p>
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="w-full h-full p-8">
        <div className="bg-red-100 text-red-700 p-4 rounded-md mb-4">
          {error || "파일을 찾을 수 없습니다"}
        </div>
        <button
          onClick={onClose}
          className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
        >
          돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{file.filename} 편집</h1>
        <button
          onClick={onClose}
          className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300"
        >
          목록으로 돌아가기
        </button>
      </div>

      <CodeEditor
        fileId={file.id}
        filename={file.filename}
        userId={file.userId}
        onSave={handleSaveContent}
      />
    </div>
  );
}
