import React, { useState, FormEvent } from "react";

interface RegisterFormProps {
  onRegisterSuccess: () => void;
  onBackToLogin: () => void;
}

export function RegisterForm({
  onRegisterSuccess,
  onBackToLogin,
}: RegisterFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // 기본 유효성 검사
    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("username", username);
      formData.append("password", password);
      formData.append("passwordConfirm", passwordConfirm);

      const response = await fetch("/api/auth/register", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "회원가입에 실패했습니다.");
        return;
      }

      if (data.success) {
        setSuccess(true);
        // 3초 후 회원가입 성공 처리
        setTimeout(() => {
          onRegisterSuccess();
        }, 3000);
      } else {
        setError("알 수 없는 오류가 발생했습니다.");
      }
    } catch (err) {
      setError("서버 연결에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">회원가입</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>
      )}

      {success ? (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded text-center">
          <p className="font-bold mb-2">회원가입이 완료되었습니다!</p>
          <p>로그인 페이지로 이동합니다...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              사용자명
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="passwordConfirm"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              비밀번호 확인
            </label>
            <input
              id="passwordConfirm"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? "처리 중..." : "회원가입"}
            </button>
          </div>

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={onBackToLogin}
              className="text-blue-500 hover:underline"
            >
              이미 계정이 있으신가요? 로그인
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
