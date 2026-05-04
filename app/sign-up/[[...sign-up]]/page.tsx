import { SignUp } from "@clerk/nextjs";

export default function Page() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <main className="auth-page">
        <section className="profile-panel">
          <h1>가입 설정 필요</h1>
          <p>Clerk 환경변수를 연결하면 가입 페이지가 활성화됩니다.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <SignUp />
    </main>
  );
}
