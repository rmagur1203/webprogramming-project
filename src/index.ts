import { serve } from "bun";
import index from "./index.html";
import { initializeStorage } from "./services/fileStorage";
import { initializeDatabase } from "./services/database";
import {
  handleLogin,
  handleLogout,
  handleRegister,
  handleFileUpload,
  handleFileCreate,
  handleFileList,
  handleFileContent,
  handleFileContentUpdate,
  handleFileGet,
  handleGetMe,
  handleUserFilesDirectory,
  handleUserFilesSubPath,
  handleUserFileContentPath,
  handleStaticUserFilePath,
  handleCreateDirectory,
  handleUserFileContentPathUpdate,
  handleDeleteFileOrDirectory,
  handleUserDirectAccess,
  handleGetDiskUsage,
  handleRenameFileOrDirectory,
} from "./services/api";
import { requireAuth } from "./services/auth";
import {
  calculateUserDiskUsage,
  MAX_USER_STORAGE,
} from "./services/fileStorage";

// 데이터베이스 초기화
await initializeDatabase();

// 스토리지 초기화
await initializeStorage();

const server = serve({
  routes: {
    // API 라우트들
    "/api/auth/login": {
      POST: handleLogin,
    },

    "/api/auth/logout": {
      POST: handleLogout,
    },

    "/api/auth/register": {
      POST: handleRegister,
    },

    // 현재 사용자 정보 확인 API
    "/api/me": {
      GET: handleGetMe,
    },

    // 유저별 파일 시스템 접근 API (기본 디렉토리 목록)
    "/api/users/:userId/files": {
      GET: handleUserFilesDirectory,
    },

    // 유저별 파일 시스템 경로 접근 API (하위 경로 목록)
    "/api/users/:userId/files/*": {
      GET: handleUserFilesSubPath,
    },

    // 유저별 파일 업로드 API
    "/api/users/:userId/upload": {
      POST: handleFileUpload,
    },

    // 유저별 텍스트 파일 생성 API
    "/api/users/:userId/files/create": {
      POST: handleFileCreate,
    },

    // 유저별 폴더 생성 API
    "/api/users/:userId/directory/create": {
      POST: handleCreateDirectory,
    },

    // 유저별 파일/폴더 삭제 API
    "/api/users/:userId/files/delete": {
      POST: handleDeleteFileOrDirectory,
    },

    // 유저별 파일/폴더 이름 변경 API
    "/api/users/:userId/files/rename": {
      POST: handleRenameFileOrDirectory,
    },

    // 유저별 파일 내용 접근 API
    "/api/users/:userId/content/*": {
      GET: handleUserFileContentPath,
      PUT: handleUserFileContentPathUpdate,
    },

    // 유저별 파일 직접 접근 (/:userId/파일경로)
    "/static/users/:userId/*": {
      GET: handleUserDirectAccess,
    },

    // 사용자 디스크 사용량 확인 API
    "/api/storage/usage": {
      GET: handleGetDiskUsage,
    },

    // 기본 정적 파일 서빙 - 가장 마지막에 배치
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production",

  // 오류 처리기
  error(error) {
    console.error("서버 오류:", error);
    return new Response(
      JSON.stringify({ error: "서버 오류가 발생했습니다." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  },
});

// 서버 실행 메시지
console.log(`🚀 서버가 http://localhost:3000에서 실행 중입니다.`);
