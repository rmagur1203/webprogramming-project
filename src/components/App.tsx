import "../styles/index.css";
import { useEffect, useState } from "react";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { FileList } from "./FileList";

interface User {
  id: string;
  username: string;
}

export function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showRegisterForm, setShowRegisterForm] = useState<boolean>(false);

  // 사용자 인증 상태 확인
  useEffect(() => {
    async function checkAuthStatus() {
      try {
        const response = await fetch("/api/me");
        const data = await response.json();

        if (data.authenticated && data.user) {
          setIsLoggedIn(true);
          setUser(data.user);
        } else {
          setIsLoggedIn(false);
          setUser(null);
        }
      } catch (error) {
        console.error("인증 상태 확인 중 오류 발생:", error);
        setIsLoggedIn(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    checkAuthStatus();
  }, []);

  // 로그인 성공 처리
  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    // 로그인 성공 후 사용자 정보 다시 가져오기
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setUser(data.user);
        }
      });
  };

  // 로그아웃 처리
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
      setIsLoggedIn(false);
      setUser(null);
    } catch (error) {
      console.error("로그아웃 중 오류 발생:", error);
    }
  };

  // 회원가입 폼으로 전환
  const handleGoToRegister = () => {
    setShowRegisterForm(true);
  };

  // 로그인 폼으로 전환
  const handleGoToLogin = () => {
    setShowRegisterForm(false);
  };

  // 회원가입 성공 처리
  const handleRegisterSuccess = () => {
    setShowRegisterForm(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen dark:bg-gray-900">
        <div>로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-md">
        <div className="max-w-full w-full mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
              정적 웹사이트 호스팅
            </h1>
          </div>

          {isLoggedIn && user && (
            <div className="flex items-center gap-4">
              <span className="text-gray-600 dark:text-gray-300">
                안녕하세요, {user.username}님!
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white py-1 px-3 rounded-md hover:bg-red-700 focus:outline-none dark:bg-red-700 dark:hover:bg-red-800"
              >
                로그아웃
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-grow max-w-full w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isLoggedIn ? (
          <div className="max-w-md mx-auto">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-8">
              <h2 className="text-2xl font-bold mb-4 text-center dark:text-white">
                웹프로그래밍 호스팅 프로젝트
              </h2>
              <p className="mb-2 dark:text-gray-300">
                이 서비스를 사용하면 다음과 같은 작업을 할 수 있습니다:
              </p>
              <ul className="list-disc pl-5 mb-4 space-y-1 dark:text-gray-300">
                <li>HTML, CSS, JavaScript 파일 업로드</li>
                <li>웹 에디터로 파일 내용 직접 수정</li>
                <li>정적 웹사이트 배포 및 호스팅</li>
                <li>파일 관리 및 정리</li>
              </ul>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ※{" "}
                {showRegisterForm
                  ? "회원가입하여 시작하세요!"
                  : "로그인하여 시작하세요!"}
              </p>
            </div>

            {showRegisterForm ? (
              <RegisterForm
                onRegisterSuccess={handleRegisterSuccess}
                onBackToLogin={handleGoToLogin}
              />
            ) : (
              <div>
                <LoginForm onLoginSuccess={handleLoginSuccess} />
                <div className="mt-4 text-center">
                  <button
                    onClick={handleGoToRegister}
                    className="text-blue-500 hover:underline dark:text-blue-400"
                  >
                    계정이 없으신가요? 회원가입
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <FileList />
        )}
      </main>

      <footer className="bg-white dark:bg-gray-800 shadow-inner py-8 mt-auto">
        <div className="max-w-full w-full mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 dark:text-gray-400 text-sm">
          <p>© 2025 정적 웹사이트 호스팅 서비스. 모든 권리 보유.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
