import { Database } from "bun:sqlite";
import { randomUUID } from "crypto";

// 데이터베이스 파일 경로 설정
const DB_PATH = "./data.sqlite";

// 데이터베이스 연결
export const db = new Database(DB_PATH);

// 사용자 타입 정의
export interface User {
  id: string;
  username: string;
  password: string; // 실제로는 해시된 비밀번호
  createdAt: string;
}

// 세션 타입 정의
export interface Session {
  id: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
}

// 파일 타입 정의
export interface UploadedFile {
  id: string;
  userId: string;
  filename: string;
  size: number;
  mimeType: string;
  path: string;
  uploadedAt: string;
}

// 데이터베이스 초기화 함수
export function initializeDatabase() {
  // 사용자 테이블 생성
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);

  // 세션 테이블 생성
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  // 파일 테이블 생성
  db.run(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      filename TEXT NOT NULL,
      size INTEGER NOT NULL,
      mimeType TEXT NOT NULL,
      path TEXT NOT NULL,
      uploadedAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  // 기본 사용자 생성 (테스트용)
  const defaultUser = findUserByUsername("admin");
  if (!defaultUser) {
    createUser("admin", "admin123");
    console.log("기본 사용자 생성 완료: admin / admin123");
  }
}

// 사용자 생성 함수
export function createUser(username: string, password: string): User | null {
  try {
    const id = randomUUID();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO users (id, username, password, createdAt)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(id, username, password, now);

    return {
      id,
      username,
      password,
      createdAt: now,
    };
  } catch (error) {
    console.error("사용자 생성 오류:", error);
    return null;
  }
}

// 사용자명으로 사용자 찾기
export function findUserByUsername(username: string): User | null {
  try {
    const query = db.prepare("SELECT * FROM users WHERE username = ?");
    const user = query.get(username) as User | null;
    return user;
  } catch (error) {
    console.error("사용자 조회 오류:", error);
    return null;
  }
}

// ID로 사용자 찾기
export function findUserById(id: string): User | null {
  try {
    const query = db.prepare("SELECT * FROM users WHERE id = ?");
    const user = query.get(id) as User | null;
    return user;
  } catch (error) {
    console.error("사용자 조회 오류:", error);
    return null;
  }
}

// 세션 생성 함수
export function createSession(userId: string, expiresAt: Date): Session | null {
  try {
    const id = randomUUID();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO sessions (id, userId, expiresAt, createdAt)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(id, userId, expiresAt.toISOString(), now);

    return {
      id,
      userId,
      expiresAt: expiresAt.toISOString(),
      createdAt: now,
    };
  } catch (error) {
    console.error("세션 생성 오류:", error);
    return null;
  }
}

// 세션 찾기 함수
export function findSessionById(id: string): Session | null {
  try {
    const query = db.prepare("SELECT * FROM sessions WHERE id = ?");
    const session = query.get(id) as Session | null;
    return session;
  } catch (error) {
    console.error("세션 조회 오류:", error);
    return null;
  }
}

// 세션 삭제 함수
export function deleteSession(id: string): boolean {
  try {
    const stmt = db.prepare("DELETE FROM sessions WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  } catch (error) {
    console.error("세션 삭제 오류:", error);
    return false;
  }
}

// 모든 만료된 세션 삭제
export function cleanExpiredSessions(): number {
  try {
    const now = new Date().toISOString();
    const stmt = db.prepare("DELETE FROM sessions WHERE expiresAt < ?");
    const result = stmt.run(now);
    return result.changes;
  } catch (error) {
    console.error("만료 세션 정리 오류:", error);
    return 0;
  }
}

// 파일 저장 함수
export function saveFile(
  fileData: Omit<UploadedFile, "id">
): UploadedFile | null {
  try {
    const id = randomUUID();
    const uploadedAt =
      typeof fileData.uploadedAt === "object"
        ? (fileData.uploadedAt as Date).toISOString()
        : fileData.uploadedAt;

    const stmt = db.prepare(`
      INSERT INTO files (id, userId, filename, size, mimeType, path, uploadedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      fileData.userId,
      fileData.filename,
      fileData.size,
      fileData.mimeType,
      fileData.path,
      uploadedAt
    );

    return {
      id,
      ...fileData,
      uploadedAt: uploadedAt,
    };
  } catch (error) {
    console.error("파일 저장 오류:", error);
    return null;
  }
}

// 파일 ID로 파일 조회
export function getFileById(id: string): UploadedFile | null {
  try {
    const query = db.prepare("SELECT * FROM files WHERE id = ?");
    const file = query.get(id) as UploadedFile | null;
    return file;
  } catch (error) {
    console.error("파일 조회 오류:", error);
    return null;
  }
}

// 사용자 ID로 파일 목록 조회
export function getFilesByUserId(userId: string): UploadedFile[] {
  try {
    const query = db.prepare(
      "SELECT * FROM files WHERE userId = ? ORDER BY uploadedAt DESC"
    );
    const files = query.all(userId) as UploadedFile[];
    return files;
  } catch (error) {
    console.error("파일 목록 조회 오류:", error);
    return [];
  }
}

// 파일 삭제 함수
export function deleteFile(id: string): boolean {
  try {
    const stmt = db.prepare("DELETE FROM files WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  } catch (error) {
    console.error("파일 삭제 오류:", error);
    return false;
  }
}
