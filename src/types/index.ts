// 사용자 타입 정의
export interface User {
  id: string;
  username: string;
  password: string; // 실제 환경에서는 해싱된 비밀번호를 저장해야 함
  createdAt: Date;
}

// 파일 타입 정의
export interface UploadedFile {
  id: string;
  userId: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  path: string;
}

// 세션 타입 정의
export interface Session {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}
