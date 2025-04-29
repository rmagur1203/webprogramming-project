import React, { useState, useEffect } from "react";
import { FileEditor } from "./FileEditor";
import { FileCreator } from "./FileCreator";
import { FileUploader } from "./FileUploader";

interface FileEntry {
  name: string;
  isDirectory: boolean;
  size: number;
  mtime: string;
  url: string;
  contentUrl?: string;
}

interface DirectoryInfo {
  path: string;
  parentPath: string;
  entries: FileEntry[];
}

interface User {
  id: string;
  username: string;
}

interface DiskUsage {
  used: number;
  total: number;
  percentage: number;
}

export function FileList() {
  const [directoryInfo, setDirectoryInfo] = useState<DirectoryInfo | null>(
    null
  );
  const [currentPath, setCurrentPath] = useState<string>("/");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [diskUsage, setDiskUsage] = useState<DiskUsage | null>(null);

  // 모달 관련 상태 추가
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null);

  // 정렬 상태를 관리하는 상태 추가
  const [sortConfig, setSortConfig] = useState<{
    key: "name" | "size" | "mtime";
    direction: "asc" | "desc";
  }>({
    key: "name",
    direction: "asc",
  });

  // 디스크 사용량 가져오기
  const fetchDiskUsage = async () => {
    if (!currentUser) return;

    try {
      const response = await fetch("/api/storage/usage");
      if (response.ok) {
        const data = await response.json();
        setDiskUsage(data);
      } else {
        console.error("디스크 사용량 정보를 가져오는데 실패했습니다.");
      }
    } catch (error) {
      console.error("디스크 사용량 정보를 가져오는데 실패했습니다:", error);
    }
  };

  // 현재 사용자 정보 가져오기
  const fetchCurrentUser = async () => {
    try {
      const response = await fetch("/api/me");
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
      }
    } catch (error) {
      console.error("사용자 정보를 가져오는데 실패했습니다:", error);
    }
  };

  // 현재 경로의 파일/폴더 목록 가져오기
  const fetchDirectoryContents = async (path = "/") => {
    if (!currentUser) return;

    setLoading(true);
    setError(null);

    try {
      let url;
      if (path === "/") {
        url = `/api/users/${currentUser.id}/files`;
      } else {
        // API 경로에 맞게 경로 형식 조정
        // URL에서 가능한 특수 문자 처리
        const normalizedPath = path.startsWith("/") ? path.substring(1) : path;

        // 경로 부분을 인코딩하여 API 호출
        const encodedSubPath = normalizedPath
          .split("/")
          .map((part) => encodeURIComponent(part))
          .join("/");

        url = `/api/users/${currentUser.id}/files/${encodedSubPath}`;
      }

      console.log(`파일 목록 가져오기: ${url}`); // 디버깅 로그

      const response = await fetch(url);

      console.log(`응답 상태: ${response.status} ${response.statusText}`); // 응답 상태 로그

      if (!response.ok) {
        if (response.status === 401) {
          setError("인증이 필요합니다. 먼저 로그인해주세요.");
        } else {
          // 오류 응답 내용 확인
          try {
            const errorData = await response.json();
            setError(
              `파일 목록을 가져오는데 실패했습니다. 오류: ${
                errorData.error || response.statusText
              }`
            );
            console.error("API 오류 응답:", errorData); // 오류 응답 내용 로그
          } catch (e) {
            setError(
              `파일 목록을 가져오는데 실패했습니다. 상태: ${response.status}`
            );
          }
        }
        setDirectoryInfo(null);
        return;
      }

      const data = await response.json();
      console.log("받은 데이터:", data); // 응답 데이터 로그

      setDirectoryInfo(data);
      setCurrentPath(data.path);
    } catch (err) {
      console.error("파일 목록 가져오기 오류:", err); // 자세한 오류 로그
      setError(
        err instanceof Error
          ? `서버 연결에 실패했습니다: ${err.message}`
          : "서버 연결에 실패했습니다."
      );
      setDirectoryInfo(null);
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시 사용자 정보 가져오기
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  // 사용자 정보가 변경되면 현재 경로의 내용과 디스크 사용량 가져오기
  useEffect(() => {
    if (currentUser) {
      fetchDirectoryContents("/");
      fetchDiskUsage();
    }
  }, [currentUser]);

  // 특정 경로의 내용 가져오기
  const navigateToPath = (path: string) => {
    fetchDirectoryContents(path);
  };

  // 파일 크기 포맷팅 함수
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " bytes";
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // 날짜 포맷팅 함수
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // 파일 에디터 열기
  const handleEditFile = (contentUrl: string | undefined) => {
    if (!contentUrl) return;
    setEditingPath(contentUrl);
  };

  // 파일 에디터 닫기
  const handleCloseEditor = () => {
    setEditingPath(null);
    // 파일 목록 새로고침
    fetchDirectoryContents(currentPath);
    // 파일이 수정되었을 수 있으므로 디스크 사용량도 새로고침
    fetchDiskUsage();
  };

  // 파일 생성 모드 시작
  const handleCreateFile = () => {
    setIsCreatingFile(true);
  };

  // 파일 생성 모드 종료
  const handleCancelCreateFile = () => {
    setIsCreatingFile(false);
  };

  // 파일 생성 완료
  const handleFileCreated = () => {
    setIsCreatingFile(false);
    fetchDirectoryContents(currentPath);
    fetchDiskUsage(); // 디스크 사용량 업데이트
  };

  // 파일 업로드 모드 시작
  const handleUploadFile = () => {
    setIsUploadingFile(true);
  };

  // 파일 업로드 모드 종료
  const handleCancelUpload = () => {
    setIsUploadingFile(false);
  };

  // 파일 업로드 완료
  const handleUploadSuccess = () => {
    setIsUploadingFile(false);
    fetchDirectoryContents(currentPath);
    fetchDiskUsage(); // 디스크 사용량 업데이트
  };

  // API 오류 응답 처리
  const handleApiError = async (response: Response, operation: string) => {
    try {
      const data = await response.json();

      // 디스크 용량 초과 오류인 경우
      if (data.error && data.error.includes("디스크 용량 초과")) {
        // 디스크 사용량 정보 업데이트
        if (data.diskUsage) {
          setDiskUsage(data.diskUsage);
        } else {
          // 디스크 사용량 정보가 없는 경우 새로 가져오기
          fetchDiskUsage();
        }

        // 사용자에게 디스크 용량 부족 알림
        const requiredSpace = data.diskUsage?.required
          ? formatFileSize(data.diskUsage.required)
          : "추가 공간";

        alert(
          `디스크 용량 부족: ${operation}을(를) 완료하기 위해 ${requiredSpace}이(가) 필요합니다. 일부 파일을 삭제하여 공간을 확보하세요.`
        );
      } else {
        // 일반 오류
        alert(`${operation} 실패: ${data.error || "알 수 없는 오류"}`);
      }
      return data.error || "알 수 없는 오류";
    } catch (e) {
      alert(`${operation} 실패: 서버 응답 처리 중 오류가 발생했습니다.`);
      return "서버 응답 처리 중 오류";
    }
  };

  // 폴더 생성 모달 표시
  const openCreateFolderModal = () => {
    setNewFolderName("");
    setShowCreateFolderModal(true);
  };

  // 폴더 생성 처리
  const handleCreateFolder = () => {
    if (showCreateFolderModal) {
      createFolder();
    } else {
      openCreateFolderModal();
    }
  };

  // 폴더 생성 실행
  const createFolder = async () => {
    if (!newFolderName || !currentUser) {
      setShowCreateFolderModal(false);
      return;
    }

    try {
      // 경로 합치기 (현재 경로가 /이면 슬래시 중복 방지)
      const folderPath =
        currentPath === "/"
          ? `${currentPath}${newFolderName}`
          : `${currentPath}/${newFolderName}`;

      const response = await fetch(
        `/api/users/${currentUser.id}/directory/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            path: folderPath,
          }),
        }
      );

      if (!response.ok) {
        await handleApiError(response, "폴더 생성");
        return;
      }

      // 폴더 생성 성공 시 현재 디렉토리 새로고침
      fetchDirectoryContents(currentPath);
      fetchDiskUsage(); // 디스크 사용량 업데이트
      setShowCreateFolderModal(false);
    } catch (error) {
      console.error("폴더 생성 중 오류 발생:", error);
      alert("폴더 생성 중 오류가 발생했습니다.");
    }
  };

  // 이름 변경 모달 표시
  const openRenameModal = (entry: FileEntry) => {
    setSelectedEntry(entry);
    setNewName(entry.name);
    setShowRenameModal(true);
  };

  // 항목 이름 변경 실행
  const renameEntry = async () => {
    if (!selectedEntry || !newName || !currentUser) {
      setShowRenameModal(false);
      return;
    }

    try {
      // 현재 항목의 전체 경로
      const oldPath =
        currentPath === "/"
          ? `${currentPath}${selectedEntry.name}`
          : `${currentPath}/${selectedEntry.name}`;

      // 같은 디렉토리에서 새 이름으로 변경된 경로
      const newPath =
        currentPath === "/"
          ? `${currentPath}${newName}`
          : `${currentPath}/${newName}`;

      const response = await fetch(
        `/api/users/${currentUser.id}/files/rename`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            oldPath,
            newPath,
          }),
        }
      );

      if (!response.ok) {
        await handleApiError(
          response,
          `${selectedEntry.isDirectory ? "폴더" : "파일"} 이름 변경`
        );
        return;
      }

      // 이름 변경 성공 시 현재 디렉토리 새로고침
      fetchDirectoryContents(currentPath);
      fetchDiskUsage(); // 디스크 사용량 업데이트
      setShowRenameModal(false);
    } catch (error) {
      console.error(`이름 변경 중 오류 발생:`, error);
      alert(`이름 변경 중 오류가 발생했습니다.`);
    }
  };

  // 삭제 모달 표시
  const openDeleteModal = (entry: FileEntry) => {
    setSelectedEntry(entry);
    setShowDeleteModal(true);
  };

  // 항목 삭제 실행
  const deleteEntry = async () => {
    if (!selectedEntry || !currentUser) {
      setShowDeleteModal(false);
      return;
    }

    try {
      // 경로 합치기
      const itemPath =
        currentPath === "/"
          ? `${currentPath}${selectedEntry.name}`
          : `${currentPath}/${selectedEntry.name}`;

      const response = await fetch(
        `/api/users/${currentUser.id}/files/delete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            path: itemPath,
          }),
        }
      );

      if (!response.ok) {
        await handleApiError(
          response,
          `${selectedEntry.isDirectory ? "폴더" : "파일"} 삭제`
        );
        return;
      }

      // 삭제 성공 시 현재 디렉토리 새로고침
      fetchDirectoryContents(currentPath);
      fetchDiskUsage(); // 디스크 사용량 업데이트
      setShowDeleteModal(false);
    } catch (error) {
      console.error(`삭제 중 오류 발생:`, error);
      alert(`삭제 중 오류가 발생했습니다.`);
    }
  };

  // 기존 handleRename 함수 수정
  const handleRename = (name: string, isDirectory: boolean) => {
    const entry = directoryInfo?.entries.find((e) => e.name === name);
    if (entry) {
      openRenameModal(entry);
    }
  };

  // 기존 handleDelete 함수 수정
  const handleDelete = (name: string, isDirectory: boolean) => {
    const entry = directoryInfo?.entries.find((e) => e.name === name);
    if (entry) {
      openDeleteModal(entry);
    }
  };

  // 파일 타입에 따른 아이콘 반환
  const getFileIcon = (name: string): string => {
    const extension = name.split(".").pop()?.toLowerCase() || "";

    if (extension === "html" || extension === "htm") {
      return "📄";
    } else if (extension === "css") {
      return "🎨";
    } else if (extension === "js") {
      return "📜";
    } else if (
      ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension)
    ) {
      return "🖼️";
    } else if (["txt", "md", "json", "xml"].includes(extension)) {
      return "📝";
    } else {
      return "📄";
    }
  };

  // 파일이 편집 가능한지 확인
  const isEditable = (name: string): boolean => {
    const editableExtensions = [
      ".txt",
      ".html",
      ".htm",
      ".css",
      ".js",
      ".json",
      ".md",
      ".ts",
      ".jsx",
      ".tsx",
      ".xml",
      ".svg",
      ".yml",
      ".yaml",
    ];

    return editableExtensions.some((ext) => name.toLowerCase().endsWith(ext));
  };

  // 정렬 요청 처리 함수
  const requestSort = (key: "name" | "size" | "mtime") => {
    let direction: "asc" | "desc" = "asc";

    // 같은 키를 다시 클릭한 경우, 방향 전환
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }

    setSortConfig({ key, direction });
  };

  // 정렬 상태에 따른 테이블 헤더 클래스 결정
  const getHeaderClass = (key: "name" | "size" | "mtime") => {
    return sortConfig.key === key
      ? `cursor-pointer select-none flex items-center ${
          sortConfig.direction === "asc" ? "text-blue-600" : "text-blue-800"
        }`
      : "cursor-pointer select-none flex items-center";
  };

  // 정렬 방향 표시 아이콘
  const getSortIcon = (key: "name" | "size" | "mtime") => {
    if (sortConfig.key !== key) return null;

    return sortConfig.direction === "asc" ? (
      <span className="ml-1">↑</span>
    ) : (
      <span className="ml-1">↓</span>
    );
  };

  // 파일 목록 정렬 함수
  const getSortedEntries = () => {
    if (!directoryInfo || !directoryInfo.entries.length) return [];

    const sortableEntries = [...directoryInfo.entries];

    return sortableEntries.sort((a, b) => {
      // 폴더 먼저 정렬하는 로직 유지 (이름으로 정렬할 때만)
      if (sortConfig.key === "name") {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
      }

      // 선택된 키에 따라 정렬
      let comparison = 0;

      if (sortConfig.key === "name") {
        comparison = a.name.localeCompare(b.name, "ko", {
          sensitivity: "base",
        });
      } else if (sortConfig.key === "size") {
        // 폴더는 사이즈가 없으므로 별도 처리
        if (a.isDirectory && b.isDirectory) {
          // 두 항목이 모두 폴더면 이름으로 정렬
          comparison = a.name.localeCompare(b.name, "ko", {
            sensitivity: "base",
          });
        } else if (a.isDirectory) {
          // a가 폴더면 항상 위로
          comparison = -1;
        } else if (b.isDirectory) {
          // b가 폴더면 항상 위로
          comparison = 1;
        } else {
          // 둘 다 파일이면 크기로 정렬
          comparison = a.size - b.size;
        }
      } else if (sortConfig.key === "mtime") {
        // 수정일로 정렬
        const dateA = new Date(a.mtime).getTime();
        const dateB = new Date(b.mtime).getTime();
        comparison = dateA - dateB;
      }

      // 정렬 방향에 따라 결과 반전
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  };

  // 에디터 모드일 때 렌더링
  if (editingPath) {
    if (!currentUser) return null;

    return (
      <FileEditor
        contentPath={editingPath}
        userId={currentUser.id}
        onClose={handleCloseEditor}
      />
    );
  }

  // 파일 생성 모드일 때 렌더링
  if (isCreatingFile) {
    if (!currentUser) return null;

    return (
      <FileCreator
        userId={currentUser.id}
        currentPath={currentPath}
        onFileCreated={handleFileCreated}
        onCancel={handleCancelCreateFile}
      />
    );
  }

  // 파일 업로드 모드일 때 렌더링
  if (isUploadingFile) {
    if (!currentUser) return null;

    return (
      <FileUploader
        userId={currentUser.id}
        currentPath={currentPath}
        onUploadSuccess={handleUploadSuccess}
        onCancel={handleCancelUpload}
      />
    );
  }

  // 로딩 중인 경우
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // 오류가 있는 경우
  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
        <strong className="font-bold">오류!</strong>
        <span className="block sm:inline"> {error}</span>
      </div>
    );
  }

  // 디스크 사용량 표시 컴포넌트
  const DiskUsageBar = () => {
    if (!diskUsage) return null;

    const percentage = Math.min(diskUsage.percentage, 100); // 100% 초과하지 않도록
    const usedSize = formatFileSize(diskUsage.used);
    const totalSize = formatFileSize(diskUsage.total);

    // 퍼센트에 따른 색상 결정
    let barColor = "bg-green-500 dark:bg-green-600";
    if (percentage > 90) barColor = "bg-red-500 dark:bg-red-600";
    else if (percentage > 70) barColor = "bg-yellow-500 dark:bg-yellow-600";

    return (
      <div className="mb-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            디스크 사용량
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {percentage.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div
            className={`${barColor} h-2.5 rounded-full`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span>{usedSize} 사용 중</span>
          <span>총 {totalSize}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 디스크 사용량 표시 */}
      <DiskUsageBar />

      {/* 현재 경로 표시 */}
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
              파일 목록
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              현재 경로: {currentPath || "/"}
            </span>
          </div>
          <button
            onClick={() => {
              console.log(`상위 폴더로 이동: ${directoryInfo?.parentPath}`);
              navigateToPath(directoryInfo?.parentPath || "/");
            }}
            disabled={currentPath === ""}
            className={`px-3 py-1 rounded-md text-sm 
              ${
                currentPath === ""
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500"
                  : "bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
              }`}
          >
            상위 폴더로 이동
          </button>
        </div>

        {/* 파일 작업 버튼 그룹 */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => fetchDirectoryContents(currentPath)}
            className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            새로고침
          </button>
          <button
            onClick={handleCreateFolder}
            className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700"
          >
            폴더 생성
          </button>
          <button
            onClick={handleCreateFile}
            className="px-3 py-1 bg-purple-500 text-white rounded-md hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-700"
          >
            파일 생성
          </button>
          <button
            onClick={handleUploadFile}
            className="px-3 py-1 bg-orange-500 text-white rounded-md hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700"
          >
            파일 업로드
          </button>
        </div>

        {/* 파일 목록 테이블 */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  이름
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  크기
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  수정일
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
              {/* 렌더링 된 파일/폴더 목록은 이 부분에 표시됩니다 */}
              {getSortedEntries().map((entry, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {entry.isDirectory ? (
                      <button
                        onClick={() => {
                          // API URL 대신 실제 경로 사용
                          const directoryPath =
                            currentPath === "/"
                              ? `/${entry.name}`
                              : `${currentPath}/${entry.name}`;
                          console.log(`폴더 경로 이동: ${directoryPath}`);
                          navigateToPath(directoryPath);
                        }}
                        className="flex items-center text-blue-600 hover:underline"
                      >
                        <span className="mr-2">📁</span> {entry.name}
                      </button>
                    ) : (
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-blue-600 hover:underline"
                      >
                        <span className="mr-2">{getFileIcon(entry.name)}</span>{" "}
                        {entry.name}
                      </a>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.isDirectory ? "-" : formatFileSize(entry.size)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(entry.mtime)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      {!entry.isDirectory &&
                        entry.contentUrl &&
                        isEditable(entry.name) && (
                          <button
                            onClick={() => handleEditFile(entry.contentUrl!)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            편집
                          </button>
                        )}
                      <button
                        onClick={() =>
                          handleRename(entry.name, entry.isDirectory)
                        }
                        className="text-yellow-600 hover:text-yellow-900"
                      >
                        이름변경
                      </button>
                      <button
                        onClick={() =>
                          handleDelete(entry.name, entry.isDirectory)
                        }
                        className="text-red-600 hover:text-red-900"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 폴더 생성 모달 */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-96">
            <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">
              새 폴더 생성
            </h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="폴더 이름"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreateFolderModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                취소
              </button>
              <button
                onClick={createFolder}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                생성
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 이름 변경 모달 */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-96">
            <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">
              이름 변경
            </h3>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="새 이름"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRenameModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                취소
              </button>
              <button
                onClick={renameEntry}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                변경
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-96">
            <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">
              삭제 확인
            </h3>
            <p className="mb-4 text-gray-700 dark:text-gray-300">
              '{selectedEntry?.name}'을(를) 삭제하시겠습니까?
              {selectedEntry?.isDirectory && " 폴더 내 모든 파일이 삭제됩니다."}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                취소
              </button>
              <button
                onClick={deleteEntry}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
