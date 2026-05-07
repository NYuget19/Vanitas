import Script from "next/script";
import { AuthPanel } from "@/components/auth-panel";
import { NicknamePanel } from "@/components/nickname-panel";

const authEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const databaseEnabled = Boolean(process.env.DATABASE_URL);
const adsenseClient = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT;

export default function Home() {
  return (
    <>
      <div className="app-shell">
        <aside className="sidebar" aria-label="Vanitas Arcade 메뉴">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              V
            </span>
            <div>
              <strong>Vanitas Arcade</strong>
              <span>Mini Game Portal</span>
            </div>
          </div>

          <nav className="game-tabs" aria-label="게임 목록">
            <button className="tab-button active" type="button">
              <span>01</span>
              <strong>Vanitashoot</strong>
            </button>
          </nav>

          <AuthPanel authEnabled={authEnabled} databaseEnabled={databaseEnabled} />
          <NicknamePanel authEnabled={authEnabled} databaseEnabled={databaseEnabled} />

          <section className="profile-panel" aria-label="게임 정보">
            <div className="section-head">
              <span>Featured</span>
              <strong>바니타슛</strong>
            </div>
            <h2>신호를 부수고, 조각을 모으고, 공세를 버티는 슈팅 로그라이트.</h2>
            <div className="info-grid">
              <div>
                <span>Genre</span>
                <strong>Shooter</strong>
              </div>
              <div>
                <span>Save</span>
                <strong>{databaseEnabled ? "Cloud" : "Local"}</strong>
              </div>
            </div>
          </section>

          <section className="ad-slot" aria-label="광고 영역">
            <span>AD</span>
            <strong>{adsenseClient ? "광고 영역" : "광고 준비 중"}</strong>
            {adsenseClient ? (
              <ins
                className="adsbygoogle"
                data-ad-client={adsenseClient}
                data-ad-format="auto"
                data-full-width-responsive="true"
              />
            ) : (
              <small>AdSense 승인 후 광고 클라이언트 키를 연결하면 표시됩니다.</small>
            )}
          </section>
        </aside>

        <main className="arcade-main">
          <header className="topbar">
            <div>
              <span className="kicker">Vanitas Game 01</span>
              <h1>Vanitashoot</h1>
            </div>
            <div className="top-meta">
              <span>WASD 이동</span>
              <span>마우스 발사</span>
              <span>우클릭 회피</span>
            </div>
          </header>

          <section className="game-frame" aria-label="Vanitashoot 게임">
            <main className="shell">
              <section className="hud" aria-label="게임 상태">
                <div>
                  <span className="label">점수</span>
                  <strong id="score">0</strong>
                </div>
                <div>
                  <span className="label">공세</span>
                  <strong id="wave">1</strong>
                </div>
                <div>
                  <span className="label">내구도</span>
                  <strong id="health">100%</strong>
                </div>
                <button id="pauseButton" type="button" title="일시정지">
                  일시정지
                </button>
              </section>

              <canvas id="game" width="1280" height="720" aria-label="Vanitashoot 게임 화면" />

              <section className="panel" id="panel">
                <h1>Vanitashoot</h1>
                <p>드론을 부수고 신호 조각을 모아 붕괴를 버티세요.</p>
                <div className="wallet">
                  보유 골드 <strong id="goldAmount">0</strong>
                </div>
                <div className="meta-store" id="metaStore" aria-label="메인 업그레이드" />
                <button id="startButton" type="button">
                  출격
                </button>
              </section>

              <section className="level-panel" id="levelPanel" hidden>
                <div className="level-copy">
                  <span className="label">레벨 상승</span>
                  <h2>강화 선택</h2>
                </div>
                <div className="upgrade-grid" id="upgradeGrid" aria-label="강화 선택지" />
              </section>

              <section className="stats-panel" id="statsPanel" hidden>
                <div className="level-copy">
                  <span className="label">일시정지</span>
                  <h2>현재 능력치</h2>
                </div>
                <div className="stats-grid" id="statsGrid" aria-label="현재 능력치" />
                <div className="pause-actions">
                  <button id="resumeButton" type="button">
                    계속하기
                  </button>
                  <button id="restartButton" type="button">
                    다시하기
                  </button>
                  <button id="mainMenuButton" type="button">
                    메인화면
                  </button>
                </div>
              </section>
            </main>
          </section>
        </main>
      </div>
      {adsenseClient ? (
        <>
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
          <Script id="vanitas-adsense-init" strategy="afterInteractive">
            {`try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (error) {}`}
          </Script>
        </>
      ) : null}
      <Script src="/vanishoot/game.js" strategy="afterInteractive" />
    </>
  );
}
