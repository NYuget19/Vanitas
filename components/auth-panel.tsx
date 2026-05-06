"use client";

import { useEffect, useState } from "react";
import {
  ClerkFailed,
  ClerkLoaded,
  ClerkLoading,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";

type AuthPanelProps = {
  authEnabled: boolean;
  databaseEnabled: boolean;
};

export function AuthPanel({ authEnabled, databaseEnabled }: AuthPanelProps) {
  if (!authEnabled) {
    return (
      <section className="profile-panel auth-panel" aria-label="계정 상태">
        <div className="section-head">
          <span>Account</span>
          <strong>Setup</strong>
        </div>
        <h2>Clerk 환경변수를 연결하면 이메일과 비밀번호로 가입할 수 있습니다.</h2>
      </section>
    );
  }

  return <ClerkAuthPanel databaseEnabled={databaseEnabled} />;
}

function ClerkAuthPanel({ databaseEnabled }: { databaseEnabled: boolean }) {
  return (
    <section className="profile-panel auth-panel" aria-label="계정 상태">
      <div className="section-head">
        <span>Account</span>
        <strong>{databaseEnabled ? "Cloud Save" : "Auth Ready"}</strong>
      </div>

      <ClerkLoading>
        <AuthLoadingFallback />
      </ClerkLoading>

      <ClerkFailed>
        <h2>로그인 서버 연결에 실패했습니다. Clerk 도메인 설정과 공개키를 확인해 주세요.</h2>
      </ClerkFailed>

      <ClerkLoaded>
        <ClerkAuthBody />
      </ClerkLoaded>
    </section>
  );
}

function AuthLoadingFallback() {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setIsSlow(true), 6000);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <h2>
      {isSlow
        ? "로그인 연결이 지연되고 있습니다. Clerk의 허용 도메인과 브라우저 콘솔 오류를 확인해 주세요."
        : "계정 상태를 확인하는 중입니다."}
    </h2>
  );
}

function ClerkAuthBody() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return <h2>계정 상태를 확인하는 중입니다.</h2>;
  }

  if (!isSignedIn) {
    return (
      <>
        <h2>로그인하면 바니슛 데이터를 계정에 연결할 수 있습니다.</h2>
        <div className="auth-actions">
          <SignInButton mode="modal">
            <button type="button">로그인</button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button type="button">가입</button>
          </SignUpButton>
        </div>
      </>
    );
  }

  return (
    <div className="user-row">
      <span>로그인됨</span>
      <UserButton />
    </div>
  );
}
