import { write } from "bun";
import {
  mkdir,
  stat,
  readFile,
  writeFile,
  access,
  readdir,
  rm,
  exists,
} from "node:fs/promises";
import { join, relative, dirname, basename } from "path";
import {
  saveFile,
  getFileById,
  getFilesByUserId,
  type UploadedFile,
} from "./database";

// 파일 저장소 디렉토리
const STORAGE_DIR = "./uploads";

// 최대 사용자 저장 공간 (10MB)
export const MAX_USER_STORAGE = 10 * 1024 * 1024; // 10MB

// 스토리지 디렉토리 초기화
export async function initializeStorage(): Promise<void> {
  try {
    await stat(STORAGE_DIR);
  } catch (error) {
    // 디렉토리가 없으면 생성
    await mkdir(STORAGE_DIR, { recursive: true });
  }
}

// 유저별 디렉토리 생성 또는 확인
async function ensureUserDirectory(userId: string): Promise<string> {
  const userDir = join(STORAGE_DIR, userId);
  try {
    await access(userDir);
  } catch (error) {
    // 디렉토리가 없으면 생성
    await mkdir(userDir, { recursive: true });
  }
  return userDir;
}

// 특정 경로의 디렉토리 확인 또는 생성
async function ensureDirectory(path: string): Promise<boolean> {
  try {
    await access(path);
    const stats = await stat(path);
    return stats.isDirectory();
  } catch (error) {
    try {
      await mkdir(path, { recursive: true });
      return true;
    } catch (err) {
      return false;
    }
  }
}

// 사용자 폴더 내 경로 확인
export async function resolvePath(
  userId: string,
  subPath: string = ""
): Promise<string> {
  console.log(`resolvePath 호출: userId=${userId}, subPath=${subPath}`);

  try {
    // URL 디코딩 적용
    const decodedSubPath = decodeURIComponent(subPath);

    // 경로 정규화
    const normalizedPath = decodedSubPath
      .replace(/\\/g, "/") // 백슬래시를 슬래시로 변환
      .replace(/\/+/g, "/") // 여러 개의 연속된 슬래시를 하나로 변환
      .replace(/^\//, ""); // 맨 앞의 슬래시 제거

    console.log(`경로 정규화: ${subPath} → ${normalizedPath}`);

    const userDir = await ensureUserDirectory(userId);
    console.log(`사용자 디렉토리: ${userDir}`);

    const fullPath = join(userDir, normalizedPath);
    console.log(`최종 경로: ${fullPath}`);

    // 보안: 사용자 디렉토리를 벗어나는 경로 접근 방지
    const relativePath = relative(userDir, fullPath);
    if (relativePath.startsWith("..") || relativePath.includes("../")) {
      console.error(`보안 위반 시도: ${fullPath}`);
      throw new Error("잘못된 경로 접근입니다");
    }

    return fullPath;
  } catch (err) {
    console.error(`resolvePath 오류:`, err);
    throw err;
  }
}

// 경로가 디렉토리인지 확인
export async function isDirectory(path: string): Promise<boolean> {
  console.log(`isDirectory 검사: ${path}`);
  try {
    const stats = await stat(path);
    const result = stats.isDirectory();
    console.log(`${path}는 디렉토리${result ? "입니다" : "가 아닙니다"}`);
    return result;
  } catch (error) {
    console.error(`디렉토리 검사 오류 (${path}):`, error);
    return false;
  }
}

// 디렉토리 내용 조회
export async function listDirectory(
  path: string
): Promise<
  { name: string; isDirectory: boolean; size: number; mtime: Date }[]
> {
  console.log(`디렉토리 목록 조회: ${path}`);
  try {
    // 경로가 존재하는지, 디렉토리인지 확인
    const pathExists = await exists(path);
    if (!pathExists) {
      console.error(`디렉토리가 존재하지 않음: ${path}`);
      return [];
    }

    const isDir = await isDirectory(path);
    if (!isDir) {
      console.error(`디렉토리가 아님: ${path}`);
      return [];
    }

    const entries = await readdir(path, { withFileTypes: true });
    console.log(`${path}에서 ${entries.length}개 항목 발견`);

    const result = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = join(path, entry.name);
        try {
          const stats = await stat(entryPath);
          return {
            name: entry.name,
            isDirectory: entry.isDirectory(),
            size: stats.size,
            mtime: new Date(stats.mtime),
          };
        } catch (err) {
          console.error(`항목 정보 조회 실패 (${entryPath}):`, err);
          // 오류가 발생해도 기본 정보는 반환
          return {
            name: entry.name,
            isDirectory: entry.isDirectory(),
            size: 0,
            mtime: new Date(),
          };
        }
      })
    );

    return result;
  } catch (error) {
    console.error(`디렉토리 목록 조회 오류 (${path}):`, error);
    return [];
  }
}

// 디렉토리 생성
export async function createDirectory(path: string): Promise<boolean> {
  try {
    await mkdir(path, { recursive: true });
    return true;
  } catch (error) {
    console.error(`디렉토리 생성 오류: ${error}`);
    return false;
  }
}

// 파일 읽기 (경로 기반)
export async function readFileByPath(
  path: string
): Promise<{ content: string; mimeType: string } | null> {
  try {
    // 파일 확장자에 따른 MIME 타입 추측
    const ext = path.split(".").pop()?.toLowerCase() || "";
    let mimeType = "text/plain";

    if (ext === "html") mimeType = "text/html";
    else if (ext === "css") mimeType = "text/css";
    else if (ext === "js") mimeType = "application/javascript";
    else if (ext === "json") mimeType = "application/json";
    else if (ext === "md") mimeType = "text/markdown";
    else if (ext === "txt") mimeType = "text/plain";
    else if (ext === "png") mimeType = "image/png";
    else if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
    else if (ext === "gif") mimeType = "image/gif";
    else if (ext === "svg") mimeType = "image/svg+xml";

    // 이진 파일 확인
    const isBinary = mimeType.startsWith("image/");

    if (isBinary) {
      // 이미지 같은 이진 파일은 null 반환 (다른 API를 통해 처리)
      return null;
    }

    // 텍스트 파일 읽기
    const content = await readFile(path, "utf-8");
    return { content, mimeType };
  } catch (error) {
    console.error(`파일 읽기 오류: ${error}`);
    return null;
  }
}

// 바이너리 파일 읽기 (경로 기반)
export async function readBinaryFileByPath(
  path: string
): Promise<{ data: Uint8Array; mimeType: string; size: number } | null> {
  try {
    const stats = await stat(path);

    // 파일 확장자에 따른 MIME 타입 추측
    const ext = path.split(".").pop()?.toLowerCase() || "";
    let mimeType = "application/octet-stream";

    if (ext === "html") mimeType = "text/html";
    else if (ext === "css") mimeType = "text/css";
    else if (ext === "js") mimeType = "application/javascript";
    else if (ext === "json") mimeType = "application/json";
    else if (ext === "md") mimeType = "text/markdown";
    else if (ext === "txt") mimeType = "text/plain";
    else if (ext === "png") mimeType = "image/png";
    else if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
    else if (ext === "gif") mimeType = "image/gif";
    else if (ext === "svg") mimeType = "image/svg+xml";

    const fileData = await Bun.file(path).arrayBuffer();
    return {
      data: new Uint8Array(fileData),
      mimeType,
      size: stats.size,
    };
  } catch (error) {
    console.error(`파일 읽기 오류: ${error}`);
    return null;
  }
}

// 파일 저장 (경로 기반)
export async function writeFileByPath(
  path: string,
  content: string | Uint8Array
): Promise<boolean> {
  try {
    // 디렉토리 확인 및 생성
    const dirPath = dirname(path);
    await ensureDirectory(dirPath);

    // 파일 저장
    if (typeof content === "string") {
      await writeFile(path, content, "utf-8");
    } else {
      await write(path, content);
    }

    return true;
  } catch (error) {
    console.error(`파일 저장 오류: ${error}`);
    return false;
  }
}

// 업로드된 파일을 저장
export async function saveUploadedFile(
  userId: string,
  formData: FormData
): Promise<UploadedFile | null> {
  const file = formData.get("file") as File;

  if (!file) {
    return null;
  }

  // 파일 크기 검증 (10MB 제한)
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_SIZE) {
    throw new Error("파일 크기는 10MB를 초과할 수 없습니다.");
  }

  // 유저 디렉토리 생성 또는 확인
  const userDir = await ensureUserDirectory(userId);

  // 파일명 충돌 방지를 위한 유니크한 파일명 생성
  const timestamp = Date.now();
  const uniqueFilename = `${timestamp}_${file.name}`;
  const filePath = join(userDir, uniqueFilename);

  // 파일 저장
  const buffer = await file.arrayBuffer();
  await write(filePath, buffer);

  // 데이터베이스에 파일 메타데이터 저장
  const fileData: Omit<UploadedFile, "id"> = {
    userId,
    filename: file.name,
    size: file.size,
    mimeType: file.type,
    uploadedAt: new Date().toISOString(),
    path: filePath,
  };

  return saveFile(fileData);
}

// 텍스트 파일 생성
export async function createTextFile(
  userId: string,
  filename: string,
  content: string,
  mimeType: string = "text/plain"
): Promise<UploadedFile | null> {
  // 파일 크기 검증 (10MB 제한)
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  if (Buffer.byteLength(content) > MAX_SIZE) {
    throw new Error("파일 크기는 10MB를 초과할 수 없습니다.");
  }

  // 유저 디렉토리 생성 또는 확인
  const userDir = await ensureUserDirectory(userId);

  // 파일명 충돌 방지를 위한 유니크한 파일명 생성
  const timestamp = Date.now();
  const uniqueFilename = `${timestamp}_${filename}`;
  const filePath = join(userDir, uniqueFilename);

  // 파일 저장
  await writeFile(filePath, content, "utf-8");
  const stats = await stat(filePath);

  // 데이터베이스에 파일 메타데이터 저장
  const fileData: Omit<UploadedFile, "id"> = {
    userId,
    filename,
    size: stats.size,
    mimeType,
    uploadedAt: new Date().toISOString(),
    path: filePath,
  };

  return saveFile(fileData);
}

// 파일 내용 읽기 (텍스트 파일용)
export async function readTextFile(fileId: string): Promise<string | null> {
  const file = getFileById(fileId);
  if (!file) {
    return null;
  }

  try {
    // 텍스트 파일만 허용
    const isText =
      file.mimeType.startsWith("text/") ||
      [
        "application/json",
        "application/javascript",
        "application/xml",
      ].includes(file.mimeType) ||
      [".html", ".css", ".js", ".ts", ".json", ".md", ".txt"].some((ext) =>
        file.filename.endsWith(ext)
      );

    if (!isText) {
      throw new Error("텍스트 파일만 읽을 수 있습니다.");
    }

    const content = await readFile(file.path, "utf-8");
    return content;
  } catch (error) {
    console.error(`파일 읽기 오류: ${error}`);
    return null;
  }
}

// 파일 내용 업데이트 (텍스트 파일용)
export async function updateTextFile(
  fileId: string,
  content: string
): Promise<boolean> {
  const file = getFileById(fileId);
  if (!file) {
    return false;
  }

  try {
    // 텍스트 파일만 허용
    const isText =
      file.mimeType.startsWith("text/") ||
      [
        "application/json",
        "application/javascript",
        "application/xml",
      ].includes(file.mimeType) ||
      [".html", ".css", ".js", ".ts", ".json", ".md", ".txt"].some((ext) =>
        file.filename.endsWith(ext)
      );

    if (!isText) {
      throw new Error("텍스트 파일만 수정할 수 있습니다.");
    }

    // 파일 크기 검증 (10MB 제한)
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (Buffer.byteLength(content) > MAX_SIZE) {
      throw new Error("파일 크기는 10MB를 초과할 수 없습니다.");
    }

    await writeFile(file.path, content, "utf-8");

    // 파일 크기 업데이트
    const stats = await stat(file.path);

    // 여기서는 간단하게 구현했지만, 실제로는 db.updateFile 같은 메서드로
    // 데이터베이스의 파일 메타데이터도 업데이트해야 합니다.

    return true;
  } catch (error) {
    console.error(`파일 수정 오류: ${error}`);
    return false;
  }
}

// 사용자의 모든 파일 목록 조회
export function getUserFiles(userId: string): UploadedFile[] {
  return getFilesByUserId(userId);
}

// 파일 서빙
export async function serveFile(
  fileId: string
): Promise<{ file: UploadedFile; data: Uint8Array } | null> {
  const file = getFileById(fileId);
  if (!file) {
    return null;
  }

  try {
    const data = await Bun.file(file.path).arrayBuffer();
    return {
      file,
      data: new Uint8Array(data),
    };
  } catch (error) {
    console.error(`파일 서빙 오류: ${error}`);
    return null;
  }
}

// 파일 또는 디렉토리 삭제 (경로 기반)
export async function deleteFileOrDirectoryByPath(
  path: string
): Promise<boolean> {
  try {
    // 재귀적으로 삭제 (디렉토리인 경우 내부 파일도 모두 삭제)
    await rm(path, { recursive: true, force: true });
    return true;
  } catch (error) {
    console.error(`파일/디렉토리 삭제 오류: ${error}`);
    return false;
  }
}

// 사용자의 디스크 사용량 계산
export async function calculateUserDiskUsage(userId: string): Promise<number> {
  try {
    const userDir = await ensureUserDirectory(userId);
    return calculateDirectorySize(userDir);
  } catch (error) {
    console.error(`디스크 사용량 계산 오류:`, error);
    return 0;
  }
}

// 디렉토리 크기 계산 (재귀적)
async function calculateDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // 디렉토리인 경우 재귀적으로 크기 계산
        totalSize += await calculateDirectorySize(entryPath);
      } else {
        // 파일인 경우 크기 추가
        const stats = await stat(entryPath);
        totalSize += stats.size;
      }
    }

    return totalSize;
  } catch (error) {
    console.error(`디렉토리 크기 계산 오류 (${dirPath}):`, error);
    return totalSize; // 오류 발생시 현재까지 계산된 크기 반환
  }
}

// 파일 또는 디렉토리 이름 변경
export async function renameFileOrDirectory(
  oldPath: string,
  newPath: string
): Promise<boolean> {
  try {
    console.log(`이름 변경 시도: ${oldPath} → ${newPath}`);

    // 원본 경로 존재 확인
    const oldPathExists = await exists(oldPath);
    if (!oldPathExists) {
      console.error(`원본 경로가 존재하지 않음: ${oldPath}`);
      return false;
    }

    // 새 경로의 상위 디렉토리 확인 및 생성
    const newPathDir = dirname(newPath);
    const dirExists = await ensureDirectory(newPathDir);
    if (!dirExists) {
      console.error(`대상 디렉토리 생성 실패: ${newPathDir}`);
      return false;
    }

    // 새 경로 이미 존재하는지 확인
    const newPathExists = await exists(newPath);
    if (newPathExists) {
      console.error(`대상 경로가 이미 존재함: ${newPath}`);
      return false;
    }

    // 파일 시스템 이름 변경 작업 실행
    await Bun.write(newPath, await readFile(oldPath));
    await rm(oldPath, { recursive: true });

    console.log(`이름 변경 성공: ${oldPath} → ${newPath}`);
    return true;
  } catch (error) {
    console.error(`이름 변경 중 오류 발생: ${error}`);
    return false;
  }
}
