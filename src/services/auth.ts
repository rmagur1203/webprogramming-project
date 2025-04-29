import {
  createSession,
  findSessionById,
  findUserById,
  findUserByUsername,
  deleteSession,
  type User,
} from "./database";

// 쿠키에서 세션 ID 추출
export function getSessionIdFromCookie(
  cookieHeader: string | null
): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim().split("="))
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

  return cookies["session_id"] || null;
}

// 세션 쿠키 생성
export function createSessionCookie(
  sessionId: string,
  expiresAt: Date
): string {
  return `session_id=${sessionId}; HttpOnly; Path=/; Expires=${expiresAt.toUTCString()}; SameSite=Strict`;
}

// 사용자 인증 미들웨어
export async function authenticate(req: Request): Promise<User | null> {
  // 쿠키에서 세션 ID 추출
  const sessionId = getSessionIdFromCookie(req.headers.get("cookie"));
  if (!sessionId) return null;

  // 세션 조회
  const session = findSessionById(sessionId);
  if (!session) return null;

  // 세션 만료 확인
  const now = new Date();
  const expiresAt = new Date(session.expiresAt);

  if (expiresAt < now) {
    // 만료된 세션이면 삭제
    deleteSession(sessionId);
    return null;
  }

  // 세션에 연결된 사용자 가져오기
  return findUserById(session.userId);
}

// 로그인 처리
export async function login(
  username: string,
  password: string
): Promise<{ user: User; sessionId: string } | null> {
  const user = findUserByUsername(username);

  // 사용자가 존재하고 비밀번호가 일치하는지 확인
  if (!user || user.password !== password) {
    return null;
  }

  // 세션 만료 시간 설정 (24시간)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // 세션 생성
  const session = createSession(user.id, expiresAt);

  if (!session) {
    return null;
  }

  return {
    user,
    sessionId: session.id,
  };
}

// 로그인 필요 여부 확인 미들웨어
export async function requireAuth(
  req: Request
): Promise<
  { user: User; response: null } | { user: null; response: Response }
> {
  const user = await authenticate(req);

  if (!user) {
    return {
      user: null,
      response: new Response(JSON.stringify({ error: "인증이 필요합니다" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    };
  }

  return { user, response: null };
}
