"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

type NicknamePanelProps = {
  authEnabled: boolean;
  databaseEnabled: boolean;
};

export function NicknamePanel({ authEnabled, databaseEnabled }: NicknamePanelProps) {
  const { isLoaded, isSignedIn } = useUser();
  const [nickname, setNickname] = useState("");
  const [status, setStatus] = useState("닉네임을 설정해 주세요.");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authEnabled || !databaseEnabled) return;

    let active = true;
    fetch("/api/profile", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!active || !data?.profile) return;
        setNickname(data.profile.nickname || "");
        setStatus(data.profile.nickname ? "닉네임이 저장되어 있습니다." : "닉네임을 설정해 주세요.");
      })
      .catch(() => {
        if (active) setStatus("프로필을 불러오지 못했습니다.");
      });

    return () => {
      active = false;
    };
  }, [authEnabled, databaseEnabled]);

  if (!authEnabled || !databaseEnabled || !isLoaded || !isSignedIn) return null;

  async function saveNickname() {
    setSaving(true);
    setStatus("저장 중입니다.");

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });

      if (!response.ok) throw new Error("save failed");
      setStatus("닉네임을 저장했습니다.");
    } catch {
      setStatus("저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="profile-panel nickname-panel" aria-label="닉네임 설정">
      <div className="section-head">
        <span>Profile</span>
        <strong>Nickname</strong>
      </div>
      <label className="nickname-field">
        <span>닉네임</span>
        <input
          maxLength={18}
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="바니타스 플레이어"
        />
      </label>
      <button type="button" onClick={saveNickname} disabled={saving}>
        {saving ? "저장 중" : "저장"}
      </button>
      <p className="panel-note">{status}</p>
    </section>
  );
}
