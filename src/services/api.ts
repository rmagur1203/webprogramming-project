import { authenticate, createSessionCookie, login, requireAuth } from "./auth";
import {
  initializeStorage,
  saveUploadedFile,
  getUserFiles,
  serveFile,
  readTextFile,
  updateTextFile,
  createTextFile,
  resolvePath,
  listDirectory,
  isDirectory,
  readFileByPath,
  readBinaryFileByPath,
  createDirectory,
  writeFileByPath,
  deleteFileOrDirectoryByPath,
  calculateUserDiskUsage,
  MAX_USER_STORAGE,
  renameFileOrDirectory,
} from "./fileStorage";
import { createUser, findUserByUsername, findUserById } from "./database";
import { access, stat } from "fs/promises";
import { join } from "path";

/**
 * 로그인 API 핸들러
 */
export async function handleLogin(req: Request) {
  const formData = await req.formData();
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) {
    return new Response(
      JSON.stringify({ error: "사용자명과 비밀번호를 입력하세요" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const result = await login(username, password);
  if (!result) {
    return new Response(
      JSON.stringify({
        error: "로그인 실패: 잘못된 사용자명 또는 비밀번호",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const { user, sessionId } = result;
  const session = user ? { id: sessionId } : null;

  // 세션 ID를 쿠키에 설정
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const sessionCookie = createSessionCookie(sessionId, expiresAt);

  return new Response(
    JSON.stringify({
      success: true,
      user: { id: user.id, username: user.username },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": sessionCookie,
      },
    }
  );
}

/**
 * 로그아웃 API 핸들러
 */
export async function handleLogout(req: Request) {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie":
        "session_id=; HttpOnly; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    },
  });
}

/**
 * 회원가입 API 핸들러
 */
export async function handleRegister(req: Request) {
  try {
    const formData = await req.formData();
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const passwordConfirm = formData.get("passwordConfirm") as string;

    // 필수 필드 검증
    if (!username || !password || !passwordConfirm) {
      return new Response(
        JSON.stringify({
          error: "사용자명, 비밀번호, 비밀번호 확인이 모두 필요합니다",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 비밀번호 확인 일치 여부 검증
    if (password !== passwordConfirm) {
      return new Response(
        JSON.stringify({
          error: "비밀번호와 비밀번호 확인이 일치하지 않습니다",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 이미 존재하는 사용자명인지 확인
    const existingUser = findUserByUsername(username);
    if (existingUser) {
      return new Response(
        JSON.stringify({ error: "이미 사용 중인 사용자명입니다" }),
        {
          status: 409, // Conflict
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 새 사용자 생성
    const user = createUser(username, password); // 실제 구현에서는 비밀번호 해싱 필요

    if (!user) {
      return new Response(
        JSON.stringify({ error: "회원가입 처리 중 오류가 발생했습니다" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 가입 성공 응답
    return new Response(
      JSON.stringify({
        success: true,
        message: "회원가입이 완료되었습니다",
        user: {
          id: user.id,
          username: user.username,
          createdAt: user.createdAt,
        },
      }),
      {
        status: 201, // Created
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("회원가입 처리 오류:", error);
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * 파일 업로드 API 핸들러
 */
export async function handleFileUpload(req: Request) {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const userId = pathParts[3]; // /api/users/:userId/upload

  const authResult = await requireAuth(req);
  if (authResult.response) {
    return authResult.response;
  }

  // 현재 사용자가 접근하려는 유저와 동일한지 확인
  if (authResult.user.id !== userId) {
    return new Response(
      JSON.stringify({ error: "다른 사용자의 파일에 접근할 권한이 없습니다" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const pathInput = (formData.get("path") as string) || "";

    if (!file) {
      return new Response(JSON.stringify({ error: "파일이 필요합니다" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 파일 크기 검증 (10MB 제한)
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      return new Response(
        JSON.stringify({ error: "파일 크기는 10MB를 초과할 수 없습니다" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 현재 디스크 사용량 확인
    const currentUsage = await calculateUserDiskUsage(userId);

    // 새 파일을 추가했을 때 총 용량 계산
    const projectedUsage = currentUsage + file.size;

    // 전체 용량 초과 여부 확인
    if (projectedUsage > MAX_USER_STORAGE) {
      return new Response(
        JSON.stringify({
          error: "디스크 용량 초과: 파일을 업로드하기 위한 공간이 부족합니다",
          diskUsage: {
            used: currentUsage,
            total: MAX_USER_STORAGE,
            percentage: (currentUsage / MAX_USER_STORAGE) * 100,
            required: file.size,
          },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 파일 경로 결정
    let targetPath = file.name;
    if (pathInput) {
      // 디렉토리 경로가 제공된 경우
      targetPath = pathInput.endsWith("/")
        ? `${pathInput}${file.name}`
        : `${pathInput}/${file.name}`;
    }

    // 사용자 디렉토리 내 경로 확인
    const fullPath = await resolvePath(userId, targetPath);

    // 파일 데이터 읽기
    const buffer = await file.arrayBuffer();

    // 파일 저장
    const success = await writeFileByPath(fullPath, new Uint8Array(buffer));

    if (!success) {
      return new Response(JSON.stringify({ error: "파일 업로드 실패" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 파일 확장자에 따른 MIME 타입 결정
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    let mimeType = file.type || "application/octet-stream";

    return new Response(
      JSON.stringify({
        success: true,
        file: {
          path: targetPath,
          name: file.name,
          size: file.size,
          mimeType: mimeType,
          uploadedAt: new Date().toISOString(),
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * 텍스트 파일 생성 API 핸들러
 */
export async function handleFileCreate(req: Request) {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const userId = pathParts[3]; // /api/users/:userId/files/create

  const authResult = await requireAuth(req);
  if (authResult.response) {
    return authResult.response;
  }

  // 현재 사용자가 접근하려는 유저와 동일한지 확인
  if (authResult.user.id !== userId) {
    return new Response(
      JSON.stringify({ error: "다른 사용자의 파일에 접근할 권한이 없습니다" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const json = await req.json();
    const { path, content, mimeType } = json;

    if (!path || !content) {
      return new Response(
        JSON.stringify({ error: "파일 경로와 내용이 필요합니다" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 파일 크기 계산
    const fileSize = Buffer.byteLength(content);

    // 현재 디스크 사용량 확인
    const currentUsage = await calculateUserDiskUsage(userId);

    // 새 파일을 추가했을 때 총 용량 계산
    const projectedUsage = currentUsage + fileSize;

    // 전체 용량 초과 여부 확인
    if (projectedUsage > MAX_USER_STORAGE) {
      return new Response(
        JSON.stringify({
          error: "디스크 용량 초과: 파일을 생성하기 위한 공간이 부족합니다",
          diskUsage: {
            used: currentUsage,
            total: MAX_USER_STORAGE,
            percentage: (currentUsage / MAX_USER_STORAGE) * 100,
            required: fileSize,
          },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // mimeType 결정
    let fileType = mimeType || "text/plain";

    // 사용자 디렉토리 내 파일 경로 확인
    const fullPath = await resolvePath(userId, path);

    // 파일 저장
    const success = await writeFileByPath(fullPath, content);

    if (!success) {
      return new Response(
        JSON.stringify({ error: "파일 생성에 실패했습니다" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        path: path,
        mimeType: fileType,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * 사용자 파일 목록 API 핸들러
 */
export async function handleFileList(req: Request) {
  const authResult = await requireAuth(req);
  if (authResult.response) {
    return authResult.response;
  }

  const files = getUserFiles(authResult.user.id);
  return new Response(
    JSON.stringify({
      files: files.map((file: any) => ({
        id: file.id,
        filename: file.filename,
        size: file.size,
        mimeType: file.mimeType,
        uploadedAt: file.uploadedAt,
      })),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

/**
 * 파일 내용 조회 API 핸들러
 */
export async function handleFileContent({
  params,
}: {
  params: { id: string };
}) {
  const fileId = params.id;
  if (!fileId) {
    return new Response(JSON.stringify({ error: "파일 ID가 필요합니다" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const content = await readTextFile(fileId);

    if (content === null) {
      return new Response(
        JSON.stringify({
          error: "파일을 찾을 수 없거나 텍스트 파일이 아닙니다",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * 파일 내용 업데이트 API 핸들러
 */
export async function handleFileContentUpdate(req: Request) {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const fileIdIndex = pathParts.indexOf("files") + 1;
  const fileId = pathParts[fileIdIndex];

  if (!fileId) {
    return new Response(JSON.stringify({ error: "파일 ID가 필요합니다" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const content = await req.text();
    const success = await updateTextFile(fileId, content);

    if (!success) {
      return new Response(JSON.stringify({ error: "파일 업데이트 실패" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * 파일 서빙 API 핸들러
 */
export async function handleFileGet({ params }: { params: { id: string } }) {
  const fileId = params.id;
  if (!fileId) {
    return new Response("파일 ID가 필요합니다", { status: 400 });
  }

  const result = await serveFile(fileId);
  if (!result) {
    return new Response("파일을 찾을 수 없습니다", { status: 404 });
  }

  return new Response(result.data, {
    status: 200,
    headers: {
      "Content-Type": result.file.mimeType,
      "Content-Disposition": `inline; filename="${result.file.filename}"`,
      "Content-Length": result.file.size.toString(),
    },
  });
}

/**
 * 정적 파일 서빙 API 핸들러
 */
export async function handleServeFile({
  params,
}: {
  params: { fileId: string };
}) {
  const fileId = params.fileId;
  if (!fileId) {
    return new Response("파일 ID가 필요합니다", { status: 400 });
  }

  const result = await serveFile(fileId);
  if (!result) {
    return new Response("파일을 찾을 수 없습니다", { status: 404 });
  }

  // HTML 파일인 경우 content-type을 text/html로 설정하여 브라우저에서 렌더링
  const contentType =
    result.file.mimeType === "text/html" ||
    result.file.filename.endsWith(".html")
      ? "text/html"
      : result.file.mimeType;

  return new Response(result.data, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${result.file.filename}"`,
      "Content-Length": result.file.size.toString(),
    },
  });
}

/**
 * 현재 사용자 정보 확인 API 핸들러
 */
export async function handleGetMe(req: Request) {
  const user = await authenticate(req);

  if (!user) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

/**
 * 테스트용 인사말 API 핸들러
 */
export async function handleHello(req: Request) {
  return Response.json({
    message: "안녕하세요! API 서버가 실행 중입니다.",
    method: "GET",
  });
}

/**
 * 테스트용 PUT 인사말 API 핸들러
 */
export async function handleHelloPut(req: Request) {
  return Response.json({
    message: "Hello, world!",
    method: "PUT",
  });
}

/**
 * 이름이 있는 인사말 API 핸들러
 */
export async function handleNamedHello({
  params,
}: {
  params: { name: string };
}) {
  const name = params.name;
  return Response.json({
    message: `안녕하세요, ${name}님!`,
  });
}

/**
 * 특정 유저의 파일 목록 API 핸들러
 */
export async function handleUserFilesList(
  req: Request,
  { params }: { params: { userId: string } }
) {
  const authResult = await requireAuth(req);

  // 인증 확인
  if (authResult.response) {
    return authResult.response;
  }

  // 현재 사용자가 접근하려는 유저와 동일한지 확인 (관리자라면 다른 사용자 파일도 볼 수 있게 할 수 있음)
  if (authResult.user.id !== params.userId) {
    return new Response(
      JSON.stringify({ error: "다른 사용자의 파일에 접근할 권한이 없습니다" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const files = getUserFiles(params.userId);

    // 민감한 정보 제외
    const sanitizedFiles = files.map(({ path, ...file }) => ({
      ...file,
      url: `/static/users/${params.userId}/${file.filename}`,
    }));

    return new Response(JSON.stringify({ files: sanitizedFiles }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * 유저의 특정 파일 내용 조회 API 핸들러
 */
export async function handleUserFileContent(
  req: Request,
  { params }: { params: { userId: string; filename: string } }
) {
  const authResult = await requireAuth(req);

  // 인증 확인
  if (authResult.response) {
    return authResult.response;
  }

  // 현재 사용자가 접근하려는 유저와 동일한지 확인
  if (authResult.user.id !== params.userId) {
    return new Response(
      JSON.stringify({ error: "다른 사용자의 파일에 접근할 권한이 없습니다" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    // 사용자의 파일 목록 가져오기
    const files = getUserFiles(params.userId);

    // 파일명이 일치하는 파일 찾기
    const file = files.find((file) => file.filename === params.filename);

    if (!file) {
      return new Response(
        JSON.stringify({ error: "파일을 찾을 수 없습니다" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 파일 내용 읽기
    const content = await readTextFile(file.id);

    if (content === null) {
      return new Response(
        JSON.stringify({ error: "파일 내용을 읽을 수 없습니다" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(content, {
      status: 200,
      headers: { "Content-Type": file.mimeType || "text/plain" },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * 유저의 특정 파일 서빙 API 핸들러
 */
export async function handleUserFileServe(
  req: Request,
  { params }: { params: { userId: string; filename: string } }
) {
  try {
    // 사용자의 파일 목록 가져오기
    const files = getUserFiles(params.userId);

    // 파일명이 일치하는 파일 찾기
    const file = files.find((file) => file.filename === params.filename);

    if (!file) {
      return new Response(
        JSON.stringify({ error: "파일을 찾을 수 없습니다" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 파일 서빙
    const result = await serveFile(file.id);

    if (!result) {
      return new Response(
        JSON.stringify({ error: "파일을 서빙할 수 없습니다" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(result.data, {
      status: 200,
      headers: {
        "Content-Type": result.file.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(
          result.file.filename
        )}"`,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * 유저별 파일 탐색 API 핸들러
 */
export async function handleUserFilesDirectory(req: Request) {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const userId = pathParts[3]; // /api/users/:userId/files

  if (!userId) {
    return new Response(JSON.stringify({ error: "사용자 ID가 필요합니다" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authResult = await requireAuth(req);

  // 인증 확인
  if (authResult.response) {
    return authResult.response;
  }

  // 현재 사용자가 접근하려는 유저와 동일한지 확인
  if (authResult.user.id !== userId) {
    return new Response(
      JSON.stringify({ error: "다른 사용자의 파일에 접근할 권한이 없습니다" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    // 사용자 루트 디렉토리 경로 조회
    const userPath = await resolvePath(userId);

    // 디렉토리 내용 확인
    if (await isDirectory(userPath)) {
      const entries = await listDirectory(userPath);

      return new Response(
        JSON.stringify({
          path: "/",
          entries: entries.map((entry) => ({
            name: entry.name,
            isDirectory: entry.isDirectory,
            size: entry.size,
            mtime: entry.mtime.toISOString(),
            url: entry.isDirectory
              ? `/api/users/${userId}/files/${entry.name}`
              : `/static/users/${userId}/${entry.name}`,
            contentUrl: !entry.isDirectory
              ? `/api/users/${userId}/content/${entry.name}`
              : null,
          })),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else {
      return new Response(
        JSON.stringify({ error: "사용자 디렉토리를 찾을 수 없습니다" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * 유저별 하위 경로 API 핸들러
 */
export async function handleUserFilesSubPath(req: Request) {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const userId = pathParts[3]; // /api/users/:userId/files/...

  // /api/users/:userId/files/ 다음 경로 추출
  const subPath = pathParts.slice(5).join("/");

  if (!userId) {
    return new Response(JSON.stringify({ error: "사용자 ID가 필요합니다" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authResult = await requireAuth(req);

  // 인증 확인
  if (authResult.response) {
    return authResult.response;
  }

  // 현재 사용자가 접근하려는 유저와 동일한지 확인
  if (authResult.user.id !== userId) {
    return new Response(
      JSON.stringify({ error: "다른 사용자의 파일에 접근할 권한이 없습니다" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    // 사용자 경로 조회
    const fullPath = await resolvePath(userId, subPath);

    // 디렉토리 내용 확인
    if (await isDirectory(fullPath)) {
      const entries = await listDirectory(fullPath);

      // 현재 경로 계산 (API 응답용)
      const currentPath = subPath ? `/${subPath}` : "/";

      // 상위 디렉토리 경로 계산
      let parentPath = "/";
      if (subPath) {
        const parts = subPath.split("/");
        if (parts.length > 1) {
          parentPath = `/${parts.slice(0, -1).join("/")}`;
        }
      }

      return new Response(
        JSON.stringify({
          path: currentPath,
          parentPath,
          entries: entries.map((entry) => {
            // 현재 경로가 루트가 아니면 경로를 포함하여 다음 URL 구성
            const entryPath = subPath ? `${subPath}/${entry.name}` : entry.name;

            return {
              name: entry.name,
              isDirectory: entry.isDirectory,
              size: entry.size,
              mtime: entry.mtime.toISOString(),
              // 디렉토리면 files API, 아니면 static으로 접근
              url: entry.isDirectory
                ? `/api/users/${userId}/files/${entryPath}`
                : `/static/users/${userId}/${entryPath}`,
              // 파일이면 content URL 제공
              contentUrl: !entry.isDirectory
                ? `/api/users/${userId}/content/${entryPath}`
                : null,
            };
          }),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else {
      return new Response(
        JSON.stringify({ error: "디렉토리를 찾을 수 없습니다" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * 유저별 파일 내용 API 핸들러
 */
export async function handleUserFileContentPath(req: Request) {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const userId = pathParts[3]; // /api/users/:userId/content/...

  // /api/users/:userId/content/ 다음 경로 추출
  const filePath = pathParts.slice(5).join("/");

  if (!userId || !filePath) {
    return new Response(
      JSON.stringify({ error: "사용자 ID와 파일 경로가 필요합니다" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const authResult = await requireAuth(req);

  // 인증 확인
  if (authResult.response) {
    return authResult.response;
  }

  // 현재 사용자가 접근하려는 유저와 동일한지 확인
  if (authResult.user.id !== userId) {
    return new Response(
      JSON.stringify({ error: "다른 사용자의 파일에 접근할 권한이 없습니다" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    // 파일 경로 조회
    const fullPath = await resolvePath(userId, filePath);

    // 디렉토리인지 확인
    if (await isDirectory(fullPath)) {
      return new Response(
        JSON.stringify({ error: "디렉토리 내용은 읽을 수 없습니다" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 파일 내용 읽기
    const result = await readFileByPath(fullPath);

    if (!result) {
      return new Response(
        JSON.stringify({ error: "파일을 읽을 수 없습니다" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(result.content, {
      status: 200,
      headers: { "Content-Type": result.mimeType },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * 정적 유저 파일 서빙 API 핸들러
 */
export async function handleStaticUserFilePath(req: Request) {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const userId = pathParts[3]; // /static/users/:userId/...

  // /static/users/:userId/ 다음 경로 추출
  const filePath = pathParts.slice(4).join("/");

  if (!userId || !filePath) {
    return new Response("잘못된 파일 경로입니다", { status: 400 });
  }

  try {
    // 파일 경로 조회
    const fullPath = await resolvePath(userId, filePath);

    // 디렉토리인지 확인
    if (await isDirectory(fullPath)) {
      return new Response("디렉토리는 직접 서빙할 수 없습니다", {
        status: 400,
      });
    }

    // 파일 내용 읽기
    const result = await readBinaryFileByPath(fullPath);

    if (!result) {
      return new Response("파일을 찾을 수 없습니다", { status: 404 });
    }

    return new Response(result.data, {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(
          filePath.split("/").pop() || ""
        )}"`,
        "Content-Length": result.size.toString(),
      },
    });
  } catch (error) {
    console.error(`파일 서빙 오류: ${error}`);
    return new Response("파일을 서빙할 수 없습니다", { status: 500 });
  }
}

/**
 * 폴더 생성 API 핸들러
 */
export async function handleCreateDirectory(req: Request) {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const userId = pathParts[3]; // /api/users/:userId/directory/create

  const authResult = await requireAuth(req);
  if (authResult.response) {
    return authResult.response;
  }

  // 현재 사용자가 접근하려는 유저와 동일한지 확인
  if (authResult.user.id !== userId) {
    return new Response(
      JSON.stringify({ error: "다른 사용자의 파일에 접근할 권한이 없습니다" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const json = await req.json();
    const { path } = json;

    if (!path) {
      return new Response(JSON.stringify({ error: "폴더 경로가 필요합니다" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 사용자 디렉토리 내 경로 확인
    const fullPath = await resolvePath(userId, path);

    // 디렉토리 생성
    const success = await createDirectory(fullPath);

    if (!success) {
      return new Response(
        JSON.stringify({ error: "폴더 생성에 실패했습니다" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        path: path,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * 유저별 파일 내용 업데이트 API 핸들러
 */
export async function handleUserFileContentPathUpdate(req: Request) {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const userId = pathParts[3]; // /api/users/:userId/content/...

  // /api/users/:userId/content/ 다음 경로 추출
  const filePath = pathParts.slice(5).join("/");

  if (!userId || !filePath) {
    return new Response(
      JSON.stringify({ error: "사용자 ID와 파일 경로가 필요합니다" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const authResult = await requireAuth(req);

  // 인증 확인
  if (authResult.response) {
    return authResult.response;
  }

  // 현재 사용자가 접근하려는 유저와 동일한지 확인
  if (authResult.user.id !== userId) {
    return new Response(
      JSON.stringify({ error: "다른 사용자의 파일에 접근할 권한이 없습니다" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    // 요청 본문 확인
    const content = await req.text();

    if (!content) {
      return new Response(
        JSON.stringify({ error: "업데이트할 내용이 필요합니다" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 파일 경로 조회
    const fullPath = await resolvePath(userId, filePath);

    // 디렉토리인지 확인
    if (await isDirectory(fullPath)) {
      return new Response(
        JSON.stringify({ error: "디렉토리 내용은 업데이트할 수 없습니다" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 기존 파일의 크기 확인
    let originalSize = 0;
    try {
      const fileInfo = await stat(fullPath);
      originalSize = fileInfo.size;
    } catch (error) {
      // 파일이 존재하지 않는 경우 (새 파일 생성)
      originalSize = 0;
    }

    // 새 콘텐츠의 크기
    const newSize = Buffer.byteLength(content);

    // 변경된 크기 계산 (크기 차이)
    const sizeDifference = newSize - originalSize;

    // 변경 후 크기가 증가하는 경우에만 용량 체크
    if (sizeDifference > 0) {
      // 현재 디스크 사용량 확인
      const currentUsage = await calculateUserDiskUsage(userId);

      // 변경 후 예상 사용량
      const projectedUsage = currentUsage + sizeDifference;

      // 전체 용량 초과 여부 확인
      if (projectedUsage > MAX_USER_STORAGE) {
        return new Response(
          JSON.stringify({
            error:
              "디스크 용량 초과: 파일을 업데이트하기 위한 공간이 부족합니다",
            diskUsage: {
              used: currentUsage,
              total: MAX_USER_STORAGE,
              percentage: (currentUsage / MAX_USER_STORAGE) * 100,
              required: sizeDifference,
            },
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // 파일 내용 업데이트
    const success = await writeFileByPath(fullPath, content);

    if (!success) {
      return new Response(
        JSON.stringify({ error: "파일 업데이트에 실패했습니다" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        path: filePath,
        message: "파일이 성공적으로 업데이트되었습니다",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * 파일/폴더 삭제 API 핸들러
 */
export async function handleDeleteFileOrDirectory(req: Request) {
  const authResult = await requireAuth(req);
  if (authResult.response) {
    return authResult.response;
  }

  try {
    const json = await req.json();
    const { path } = json;

    if (!path) {
      return new Response(
        JSON.stringify({ error: "삭제할 경로가 필요합니다" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 사용자 디렉토리 내 경로 확인
    const fullPath = await resolvePath(authResult.user.id, path);

    // 경로가 존재하는지 확인
    try {
      await access(fullPath);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: "파일이나 폴더를 찾을 수 없습니다" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 파일/폴더 삭제
    const success = await deleteFileOrDirectoryByPath(fullPath);

    if (!success) {
      return new Response(JSON.stringify({ error: "삭제에 실패했습니다" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        path: path,
        message: "파일/폴더가 성공적으로 삭제되었습니다",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * 유저 파일 직접 접근 API 핸들러
 * /static/users/:userId/* 형식으로 직접 접근
 */
export async function handleUserDirectAccess(req: Request) {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");

  // /static/users/:userId/* 경로에서 userId는 3번째 위치
  const userId = pathParts[3];

  // /static/users/:userId/ 다음 경로 추출
  const filePath = pathParts.slice(4).join("/");

  if (!userId) {
    return new Response("잘못된 경로입니다", { status: 400 });
  }

  try {
    // 사용자 ID 유효성 검증
    const userExists = findUserById(userId);
    if (!userExists) {
      return new Response("존재하지 않는 사용자입니다", { status: 404 });
    }

    // 파일 경로 조회
    const fullPath = await resolvePath(userId, filePath);

    console.log(
      `접근 요청: userId=${userId}, filePath=${filePath}, fullPath=${fullPath}`
    );

    // 디렉토리인 경우 디렉토리 목록 표시 (선택적)
    if (await isDirectory(fullPath)) {
      // 기본 index.html 파일이 있는지 확인
      const indexPath = join(fullPath, "index.html");
      try {
        await access(indexPath);
        // index.html 파일이 있으면 해당 파일 서빙
        const result = await readBinaryFileByPath(indexPath);
        if (result) {
          return new Response(result.data, {
            status: 200,
            headers: {
              "Content-Type": "text/html",
              // 경로에 맞게 베이스 설정
              "X-Content-Type-Options": "nosniff",
            },
          });
        }
      } catch (error) {
        // index.html이 없으면 디렉토리 내용을 간단한 HTML로 표시
        const entries = await listDirectory(fullPath);

        // 상위 디렉토리 경로 계산
        let parentPath = `/static/users/${userId}`;
        if (filePath) {
          const parts = filePath.split("/");
          if (parts.length > 1) {
            parentPath = `/static/users/${userId}/${parts
              .slice(0, -1)
              .join("/")}`;
          }
        }

        const currentPath = filePath
          ? `/static/users/${userId}/${filePath}`
          : `/static/users/${userId}`;

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>디렉토리: ${currentPath}</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { border-bottom: 1px solid #eee; padding-bottom: 10px; }
            ul { list-style-type: none; padding: 0; }
            li { margin: 8px 0; }
            a { text-decoration: none; color: #0366d6; }
            a:hover { text-decoration: underline; }
            .folder { color: #6a737d; font-weight: bold; }
            .back { margin-bottom: 15px; }
          </style>
        </head>
        <body>
          <h1>${currentPath}</h1>
          <div class="back"><a href="${parentPath}">상위 디렉토리로</a></div>
          <ul>
            ${entries
              .map((entry) => {
                // 파일 경로 생성
                const entryFullPath = filePath
                  ? `${filePath}/${entry.name}`
                  : entry.name;
                const entryUrl = `/static/users/${userId}/${entryFullPath}${
                  entry.isDirectory ? "/" : ""
                }`;

                return `
                <li>
                  <a href="${entryUrl}" class="${
                  entry.isDirectory ? "folder" : ""
                }">
                    ${entry.isDirectory ? "📁" : "📄"} ${entry.name}
                    ${
                      entry.isDirectory
                        ? ""
                        : `<span style="color:#999">(${formatSize(
                            entry.size
                          )})</span>`
                    }
                  </a>
                </li>
              `;
              })
              .join("")}
          </ul>
        </body>
        </html>
        `;

        return new Response(html, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }
    }

    // 파일 내용 읽기
    const result = await readBinaryFileByPath(fullPath);

    if (!result) {
      return new Response("파일을 찾을 수 없습니다", { status: 404 });
    }

    return new Response(result.data, {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Length": result.size.toString(),
      },
    });
  } catch (error) {
    console.error(`파일 접근 오류: ${error}`);
    return new Response("파일 접근에 실패했습니다", { status: 500 });
  }
}

// 파일 크기를 사람이 읽기 쉬운 형태로 변환하는 함수
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024)
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
}

// 사용자의 디스크 사용량 정보 API 핸들러
export async function handleGetDiskUsage(req: Request): Promise<Response> {
  try {
    // 사용자 인증 확인
    const authResult = await authenticate(req);
    if (!authResult || !authResult.id) {
      return new Response(JSON.stringify({ error: "인증이 필요합니다" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 사용자의 디스크 사용량 계산
    const diskUsage = await calculateUserDiskUsage(authResult.id);

    return new Response(
      JSON.stringify({
        used: diskUsage,
        total: MAX_USER_STORAGE,
        percentage: (diskUsage / MAX_USER_STORAGE) * 100,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("디스크 사용량 조회 오류:", error);
    return new Response(
      JSON.stringify({ error: "디스크 사용량 조회 중 오류가 발생했습니다" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * 파일/폴더 이름 변경 API 핸들러
 */
export async function handleRenameFileOrDirectory(req: Request) {
  const authResult = await requireAuth(req);
  if (authResult.response) {
    return authResult.response;
  }

  const user = authResult.user;
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const userId = pathParts[pathParts.indexOf("users") + 1];

  // 현재 사용자가 요청된 사용자와 일치하는지 확인
  if (userId !== user.id) {
    return new Response(
      JSON.stringify({ error: "다른 사용자의 파일에 접근할 권한이 없습니다" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const json = await req.json();
    const { oldPath, newPath } = json;

    if (!oldPath || !newPath) {
      return new Response(
        JSON.stringify({ error: "원본 경로와 새 경로가 필요합니다" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 사용자 디렉토리 내 파일 경로 확인
    const oldFullPath = await resolvePath(userId, oldPath);
    const newFullPath = await resolvePath(userId, newPath);

    // 파일/폴더 이름 변경 시도
    const success = await renameFileOrDirectory(oldFullPath, newFullPath);

    if (!success) {
      return new Response(
        JSON.stringify({ error: "파일/폴더 이름 변경에 실패했습니다" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        oldPath,
        newPath,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
