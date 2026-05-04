const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const waveEl = document.querySelector("#wave");
const healthEl = document.querySelector("#health");
const panel = document.querySelector("#panel");
const startButton = document.querySelector("#startButton");
const pauseButton = document.querySelector("#pauseButton");
const levelPanel = document.querySelector("#levelPanel");
const upgradeGrid = document.querySelector("#upgradeGrid");
const statsPanel = document.querySelector("#statsPanel");
const statsGrid = document.querySelector("#statsGrid");
const resumeButton = document.querySelector("#resumeButton");
const goldAmountEl = document.querySelector("#goldAmount");
const metaStore = document.querySelector("#metaStore");

const TAU = Math.PI * 2;
const WORLD_W = 1280;
const WORLD_H = 720;
const keys = new Set();
const pointer = { x: 0, y: 0, down: false };
const pointerButtons = new Set();
const mouse = { left: false, right: false };
const view = { scale: 1, x: 0, y: 0 };
const SAVE_KEY = "signalfall-save-v1";

// 게임 전체에서 공유하는 런타임 상태입니다.
// 배열들은 매 프레임 업데이트되고, player는 출격할 때 새로 만들어집니다.
const state = {
  running: false,
  paused: false,
  choosingUpgrade: false,
  last: 0,
  shake: 0,
  score: 0,
  wave: 1,
  spawnTimer: 0,
  enemiesLeft: 0,
  pickups: [],
  bullets: [],
  enemyBullets: [],
  enemies: [],
  particles: [],
  floaters: [],
  stars: [],
  player: null,
};

// 런이 끝난 뒤에도 유지되는 메타 성장 상태입니다.
// localStorage에 저장해서 새로고침 후에도 골드와 업그레이드 레벨이 남습니다.
const meta = loadMeta();

const META_UPGRADES = [
  {
    id: "speed",
    name: "추진 훈련",
    max: 10,
    desc: (level) => `시작 이동속도 +${level * 16}`,
    cost: (level) => 45 + level * 35,
    apply: (p, level) => {
      p.speed += level * 16;
    },
  },
  {
    id: "armor",
    name: "예비 장갑",
    max: 10,
    desc: (level) => `시작 최대 내구도 +${level * 10}`,
    cost: (level) => 50 + level * 40,
    apply: (p, level) => {
      p.maxHealth += level * 10;
      p.health = p.maxHealth;
    },
  },
  {
    id: "power",
    name: "기초 화력",
    max: 10,
    desc: (level) => `시작 공격력 +${level * 2}`,
    cost: (level) => 55 + level * 45,
    apply: (p, level) => {
      p.damage += level * 2;
    },
  },
  {
    id: "magnet",
    name: "회수 장치",
    max: 10,
    desc: (level) => `시작 흡수 범위 +${level * 14}`,
    cost: (level) => 40 + level * 32,
    apply: (p, level) => {
      p.magnet += level * 14;
    },
  },
];

// 레벨업 선택지는 성격별로 분리합니다.
// 저점은 안전한 방어/회복, 평균은 무난한 전투력, 고점은 큰 보상과 큰 피격 리스크입니다.
const LOW_UPGRADES = [
  {
    name: "방호 장갑",
    desc: "최대 내구도와 회복량이 증가하고 받는 피해가 조금 줄어듭니다.",
    stats: ["최대 내구도 +14", "즉시 회복 +26", "받는 피해 -3%"],
    apply: (p) => {
      p.maxHealth += 14;
      p.health = Math.min(p.maxHealth, p.health + 26);
      p.damageTaken *= 0.97;
    },
  },
  {
    name: "안정 조준",
    desc: "공격력, 연사, 흡수 범위가 고르게 오릅니다.",
    stats: ["공격력 +4", "발사 간격 -4ms", "흡수 범위 +12"],
    apply: (p) => {
      p.damage += 4;
      p.fireRate = Math.max(0.06, p.fireRate - 0.004);
      p.magnet += 12;
    },
  },
  {
    name: "회수 루프",
    desc: "신호 조각을 더 멀리서 끌어오고 조각 회수 시 내구도를 회복합니다.",
    stats: ["흡수 범위 +32", "조각 회복 +0.8"],
    apply: (p) => {
      p.magnet += 32;
      p.healOnShard += 0.8;
    },
  },
];

const MID_UPGRADES = [
  {
    name: "압축 탄환",
    desc: "공격력과 연사가 확실하게 증가합니다.",
    stats: ["공격력 +7", "발사 간격 -7ms"],
    apply: (p) => {
      p.damage += 7;
      p.fireRate = Math.max(0.055, p.fireRate - 0.007);
    },
  },
  {
    name: "기동 보정",
    desc: "이동 속도가 증가하고 최대 내구도가 조금 오릅니다.",
    stats: ["이동 속도 +30", "최대 내구도 +6", "즉시 회복 +12"],
    apply: (p) => {
      p.speed += 30;
      p.maxHealth += 6;
      p.health = Math.min(p.maxHealth, p.health + 12);
    },
  },
  {
    name: "분산 사격",
    desc: "탄 퍼짐 단계가 빨리 열리고 기본 화력이 조금 오릅니다.",
    stats: ["탄 퍼짐 단계 +1", "공격력 +3"],
    apply: (p) => {
      p.spreadBonus += 1;
      p.damage += 3;
    },
  },
];

const HIGH_UPGRADES = [
  {
    name: "찰나 가속",
    desc: "적 탄을 아슬하게 피하면 잠깐 빨라지고 화력이 오릅니다. 대신 피격 피해가 크게 증가합니다.",
    stats: ["회피 가속 단계 +1", "가속 중 화력 +18%", "받는 피해 +42%"],
    apply: (p) => {
      p.grazePower += 1;
      p.damageTaken += 0.42;
    },
  },
  {
    name: "근접 처형",
    desc: "눈앞에서 적을 격파하면 폭발과 회복, 가속을 얻습니다. 대신 피격 피해가 증가합니다.",
    stats: ["근접 처형 단계 +1", "근접 처치 회복 +7", "받는 피해 +38%"],
    apply: (p) => {
      p.closeKillPower += 1;
      p.damageTaken += 0.38;
    },
  },
  {
    name: "과열 방아쇠",
    desc: "화력과 연사가 크게 증가합니다. 대신 피격 피해가 크게 증가합니다.",
    stats: ["공격력 +12", "발사 간격 -12ms", "받는 피해 +48%"],
    apply: (p) => {
      p.damage += 12;
      p.fireRate = Math.max(0.052, p.fireRate - 0.012);
      p.damageTaken += 0.48;
    },
  },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// 저장 데이터를 읽습니다. 저장값이 깨졌거나 없으면 기본값으로 시작합니다.
function loadMeta() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    return {
      gold: Number(saved?.gold || 0),
      upgrades: saved?.upgrades || {},
    };
  } catch {
    return { gold: 0, upgrades: {} };
  }
}

function saveMeta() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(meta));
}

function metaLevel(id) {
  return Number(meta.upgrades[id] || 0);
}

function spendGold(amount) {
  if (meta.gold < amount) return false;
  meta.gold -= amount;
  saveMeta();
  return true;
}

function spentGoldTotal() {
  return META_UPGRADES.reduce((total, upgrade) => {
    let spent = 0;
    for (let level = 0; level < metaLevel(upgrade.id); level += 1) {
      spent += upgrade.cost(level);
    }
    return total + spent;
  }, 0);
}

function resetMetaUpgrades() {
  const refund = spentGoldTotal();
  meta.gold += refund;
  meta.upgrades = {};
  saveMeta();
  renderMetaStore();
}

// 메인 화면의 영구 업그레이드 목록을 새로 그립니다.
function renderMetaStore() {
  goldAmountEl.textContent = String(meta.gold);
  metaStore.replaceChildren();

  const refund = spentGoldTotal();
  const resetRow = document.createElement("div");
  resetRow.className = "meta-card meta-reset";
  resetRow.innerHTML = `
    <div>
      <strong>강화 초기화</strong>
      <span>사용한 골드 ${refund}G 전부 환급</span>
    </div>
    <button type="button" ${refund <= 0 ? "disabled" : ""}>초기화</button>
  `;
  resetRow.querySelector("button").addEventListener("click", resetMetaUpgrades);
  metaStore.append(resetRow);

  for (const upgrade of META_UPGRADES) {
    const level = metaLevel(upgrade.id);
    const maxed = level >= upgrade.max;
    const cost = maxed ? 0 : upgrade.cost(level);
    const row = document.createElement("div");
    row.className = "meta-card";
    row.innerHTML = `
      <div>
        <strong>${upgrade.name} ${level}/${upgrade.max}</strong>
        <span>${upgrade.desc(level)}</span>
      </div>
      <button type="button" ${maxed || meta.gold < cost ? "disabled" : ""}>
        ${maxed ? "완료" : `${cost}G`}
      </button>
    `;
    row.querySelector("button").addEventListener("click", () => {
      if (maxed || !spendGold(cost)) return;
      meta.upgrades[upgrade.id] = level + 1;
      saveMeta();
      renderMetaStore();
    });
    metaStore.append(row);
  }
}

function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(320, bounds.width || window.innerWidth);
  const height = Math.max(320, bounds.height || window.innerHeight);
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  view.scale = Math.min(width / WORLD_W, height / WORLD_H);
  view.x = (width - WORLD_W * view.scale) / 2;
  view.y = (height - WORLD_H * view.scale) / 2;
  makeStars();
}

function makeStars() {
  state.stars = Array.from({ length: Math.floor((WORLD_W * WORLD_H) / 9000) }, () => ({
    x: Math.random() * WORLD_W,
    y: Math.random() * WORLD_H,
    r: Math.random() * 1.8 + 0.3,
    a: Math.random() * 0.45 + 0.18,
  }));
}

function resetGame() {
  // 새 출격을 시작할 때 이전 런의 탄, 적, 이펙트를 모두 비웁니다.
  state.running = true;
  state.paused = false;
  state.choosingUpgrade = false;
  state.last = performance.now();
  state.shake = 0;
  state.score = 0;
  state.wave = 1;
  state.spawnTimer = 0;
  state.pickups = [];
  state.bullets = [];
  state.enemyBullets = [];
  state.enemies = [];
  state.particles = [];
  state.floaters = [];
  state.player = {
    x: WORLD_W / 2,
    y: WORLD_H / 2,
    vx: 0,
    vy: 0,
    r: 18,
    health: 100,
    maxHealth: 100,
    fireCooldown: 0,
    fireRate: 0.14,
    speed: 465,
    damage: 20,
    damageTaken: 1,
    magnet: 110,
    shards: 0,
    level: 1,
    spreadBonus: 0,
    healOnShard: 0,
    grazePower: 0,
    closeKillPower: 0,
    boostTimer: 0,
    dashCooldown: 0,
    dashTimer: 0,
    dashAngle: 0,
  };
  for (const upgrade of META_UPGRADES) {
    upgrade.apply(state.player, metaLevel(upgrade.id));
  }
  panel.hidden = true;
  levelPanel.hidden = true;
  statsPanel.hidden = true;
  pauseButton.textContent = "일시정지";
  startWave();
  updateHud();
}

function startWave() {
  // 5의 배수 공세는 일반 스폰 대신 보스만 먼저 등장합니다.
  state.enemies = [];
  state.enemyBullets = [];
  state.spawnTimer = 0.45;
  if (state.wave % 5 === 0) {
    state.enemiesLeft = 0;
    spawnBoss();
    showFloater(WORLD_W / 2, 122, "보스 출현");
    return;
  }
  state.enemiesLeft = Math.round(9 + state.wave * 4.7 + Math.min(state.wave, 10) * 1.1);
}

function chooseEnemyType(forcedType) {
  // 공세가 올라갈수록 특수 적 비율을 늘립니다.
  if (forcedType) return forcedType;
  const roll = Math.random();
  const wave = state.wave;
  const shooterChance = clamp((wave - 1) * 0.035, 0, 0.22);
  const chargerChance = clamp((wave - 2) * 0.026, 0, 0.18);
  const dodgerChance = clamp((wave - 4) * 0.024, 0, 0.15);
  if (roll < shooterChance) return "shooter";
  if (roll < shooterChance + chargerChance) return "charger";
  if (roll < shooterChance + chargerChance + dodgerChance) return "dodger";
  return "grunt";
}

function spawnEnemy(x, y, forcedType = null) {
  // 적은 화면 네 모서리 바깥에서 등장합니다. 보스가 소환할 때는 좌표를 직접 넘깁니다.
  let pos = { x, y };
  if (x === undefined || y === undefined) {
    const edge = Math.floor(Math.random() * 4);
    const margin = 70;
    pos = [
      { x: -margin, y: Math.random() * WORLD_H },
      { x: WORLD_W + margin, y: Math.random() * WORLD_H },
      { x: Math.random() * WORLD_W, y: -margin },
      { x: Math.random() * WORLD_W, y: WORLD_H + margin },
    ][edge];
  }
  const waveScale = Math.pow(state.wave, 1.08);
  const type = chooseEnemyType(forcedType);
  const heavy = type === "heavy" || Math.random() < Math.min(0.06 + state.wave * 0.014, 0.26);
  const typeStats = {
    grunt: { r: 16, hp: 42 + waveScale * 9, speed: 135 + state.wave * 8.5, damage: 15 + state.wave * 0.42 },
    heavy: { r: 25, hp: 105 + waveScale * 18, speed: 76 + state.wave * 6.5, damage: 26 + state.wave * 0.62 },
    shooter: { r: 18, hp: 70 + waveScale * 13, speed: 92 + state.wave * 5.5, damage: 15 + state.wave * 0.48 },
    charger: { r: 19, hp: 64 + waveScale * 11, speed: 112 + state.wave * 6, damage: 18 + state.wave * 0.52 },
    dodger: { r: 17, hp: 58 + waveScale * 10, speed: 150 + state.wave * 7.2, damage: 14 + state.wave * 0.4 },
  }[heavy && type === "grunt" ? "heavy" : type];
  state.enemies.push({
    ...pos,
    r: typeStats.r,
    hp: typeStats.hp,
    maxHp: typeStats.hp,
    speed: typeStats.speed,
    damage: typeStats.damage,
    hit: 0,
    heavy: heavy || type === "charger",
    type: heavy && type === "grunt" ? "heavy" : type,
    cooldown: Math.random() * 1.2 + 0.5,
    chargeTimer: Math.random() * 1.8 + 1,
    charging: false,
    dodgeTimer: 0,
    boss: false,
  });
}

function spawnBoss() {
  // 첫 보스입니다. 이후 10, 15공세 보스도 같은 구조로 확장할 수 있습니다.
  const hp = 4200 + state.wave * 420;
  state.enemies.push({
    x: WORLD_W / 2,
    y: 120,
    r: 46,
    hp,
    maxHp: hp,
    speed: 64,
    damage: 26 + state.wave * 0.8,
    hit: 0,
    heavy: true,
    boss: true,
    name: "분열 핵",
    timer: 0,
    patternTimer: 1.2,
    summonTimer: 5.2,
  });
}

function shoot(targetX, targetY) {
  // 플레이어 탄은 마우스 방향으로 발사되고, 레벨/업그레이드에 따라 탄 수가 늘어납니다.
  const p = state.player;
  if (p.fireCooldown > 0) return;
  const angle = Math.atan2(targetY - p.y, targetX - p.x);
  const spreadLevel = p.level + p.spreadBonus;
  const spread = spreadLevel >= 7 ? [-0.18, -0.06, 0.06, 0.18] : spreadLevel >= 4 ? [-0.12, 0, 0.12] : spreadLevel >= 2 ? [-0.08, 0.08] : [0];
  const boostDamage = p.boostTimer > 0 ? 1 + p.grazePower * 0.18 : 1;
  for (const offset of spread) {
    const a = angle + offset;
    state.bullets.push({
      x: p.x + Math.cos(a) * (p.r + 4),
      y: p.y + Math.sin(a) * (p.r + 4),
      vx: Math.cos(a) * 720,
      vy: Math.sin(a) * 720,
      r: 5,
      life: 0.82,
      damage: p.damage * boostDamage,
    });
  }
  p.fireCooldown = p.fireRate;
}

function fireEnemyBullet(x, y, angle, speed, radius = 6, damage = 14) {
  // 적 탄은 플레이어의 회피 가속 판정에도 사용하므로 grazed 값을 함께 들고 갑니다.
  state.enemyBullets.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: radius,
    damage,
    life: 5,
    grazed: false,
  });
}

function fireEnemyFan(enemy, count, spread, speed, damage) {
  // 탄막형 일반 적이 쓰는 부채꼴 조준탄입니다.
  const aimed = Math.atan2(state.player.y - enemy.y, state.player.x - enemy.x);
  const start = aimed - spread / 2;
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    fireEnemyBullet(enemy.x, enemy.y, start + spread * t, speed, 5.5, damage);
  }
}

function bossPattern(boss) {
  // 보스 패턴은 시간대별로 바뀝니다. mode를 늘리면 패턴을 계속 추가할 수 있습니다.
  const p = state.player;
  const aimed = Math.atan2(p.y - boss.y, p.x - boss.x);
  const difficulty = Math.floor(state.wave / 5);
  const mode = Math.floor(boss.timer / 2.15) % 5;
  if (mode === 0) {
    const count = 22 + difficulty * 4;
    for (let i = 0; i < count; i += 1) {
      fireEnemyBullet(boss.x, boss.y, (TAU / count) * i + boss.timer * 0.85, 185 + difficulty * 22, 5, 15 + difficulty * 2);
    }
    return;
  }
  if (mode === 1) {
    for (const offset of [-0.34, -0.17, 0, 0.17, 0.34]) {
      fireEnemyBullet(boss.x, boss.y, aimed + offset, 275 + difficulty * 26, 6.5, 18 + difficulty * 2);
    }
    return;
  }
  if (mode === 2) {
    for (let i = -5; i <= 5; i += 1) {
      fireEnemyBullet(boss.x + i * 18, boss.y, Math.PI / 2 + Math.sin(boss.timer + i) * 0.16, 205 + difficulty * 20, 5, 14 + difficulty * 2);
    }
    return;
  }
  if (mode === 3) {
    for (let ring = 0; ring < 2; ring += 1) {
      const count = 14 + difficulty * 3;
      for (let i = 0; i < count; i += 1) {
        fireEnemyBullet(boss.x, boss.y, (TAU / count) * i - boss.timer * (ring ? 0.7 : -0.7), 145 + ring * 72 + difficulty * 15, 4.8, 13 + difficulty * 2);
      }
    }
    return;
  }
  for (let i = 0; i < 7; i += 1) {
    fireEnemyBullet(boss.x, boss.y, aimed + (Math.random() - 0.5) * 0.55, 310 + Math.random() * 70 + difficulty * 20, 5.5, 17 + difficulty * 2);
  }
}

function burst(x, y, color, amount, power = 1) {
  // 폭발, 피격, 레벨업 같은 순간 효과를 작은 파티클로 표현합니다.
  for (let i = 0; i < amount; i += 1) {
    const a = Math.random() * TAU;
    const s = (80 + Math.random() * 260) * power;
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      r: Math.random() * 4 + 1.4,
      life: Math.random() * 0.45 + 0.25,
      max: 0.7,
      color,
    });
  }
}

function showFloater(x, y, text, color = "#f3f0e8", stroke = "rgba(0,0,0,0.62)") {
  // 화면 위로 떠오르는 짧은 전투 알림입니다.
  state.floaters.push({ x, y, text, color, stroke, life: 1.2, max: 1.2 });
}

function addShard(x, y, amount = 1) {
  // 경험치 역할을 하는 신호 조각을 떨어뜨립니다.
  for (let i = 0; i < amount; i += 1) {
    state.pickups.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 120,
      vy: (Math.random() - 0.5) * 120,
      r: 7,
    });
  }
}

function levelUp() {
  // 조각이 충분히 모이면 게임을 멈추고 강화 선택지를 보여줍니다.
  const p = state.player;
  p.level += 1;
  p.shards = 0;
  p.health = Math.min(p.maxHealth, p.health + 14);
  state.shake = 10;
  burst(p.x, p.y, "#e8c45d", 58, 1.4);
  openUpgradeChoice();
}

function pickRandom(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

function sampleUpgrades() {
  // 매 레벨업마다 저점/평균/고점에서 하나씩 뽑습니다.
  return [
    { tier: "저점", title: "안전 성장", option: pickRandom(LOW_UPGRADES) },
    { tier: "평균", title: "균형 강화", option: pickRandom(MID_UPGRADES) },
    { tier: "고점", title: "피지컬 고점", option: pickRandom(HIGH_UPGRADES) },
  ];
}

function openUpgradeChoice() {
  // 선택지에는 설명뿐 아니라 정확한 수치 변화도 같이 표시합니다.
  state.choosingUpgrade = true;
  state.paused = true;
  statsPanel.hidden = true;
  pauseButton.textContent = "선택 중";
  upgradeGrid.replaceChildren();

  for (const upgrade of sampleUpgrades()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `upgrade-card ${upgrade.tier === "고점" ? "upgrade-card-risk" : ""}`;
    button.innerHTML = `
      <span class="upgrade-type">${upgrade.title} · ${upgrade.tier}</span>
      <strong>${upgrade.option.name}</strong>
      <p>${upgrade.option.desc}<br><br>${upgrade.option.stats.join("<br>")}</p>
    `;
    button.addEventListener("click", () => chooseUpgrade(upgrade.option));
    upgradeGrid.append(button);
  }

  levelPanel.hidden = false;
}

function chooseUpgrade(option) {
  // 클릭한 강화 하나만 적용하고 즉시 게임을 재개합니다.
  option.apply(state.player);
  levelPanel.hidden = true;
  state.choosingUpgrade = false;
  state.paused = false;
  pauseButton.textContent = "일시정지";
  updateHud();
}

function damagePlayer(amount) {
  // 고점 강화의 리스크는 damageTaken 배율로 반영됩니다.
  const p = state.player;
  if (p.dashTimer > 0) return;
  p.health -= amount * p.damageTaken;
  state.shake = Math.max(state.shake, 7);
}

function dashPlayer() {
  if (!state.running || state.paused || state.choosingUpgrade || !state.player) return;
  const p = state.player;
  if (p.dashCooldown > 0) return;
  const inputX = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
  const inputY = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
  p.dashAngle = Math.hypot(inputX, inputY) > 0 ? Math.atan2(inputY, inputX) : Math.atan2(pointer.y - p.y, pointer.x - p.x);
  p.dashTimer = 0.2;
  p.dashCooldown = 5;
  state.shake = Math.max(state.shake, 4);
  burst(p.x, p.y, "#f3f0e8", 18, 0.55);
  showFloater(p.x, p.y - 34, "회피", "#f3f0e8", "rgba(0,0,0,0.72)");
}

function onEnemyKilled(enemy) {
  // 적 처치 보상, 돌진형 폭발, 근접 처형 효과를 한곳에서 처리합니다.
  const p = state.player;
  state.score += enemy.boss ? 1600 : enemy.heavy ? 105 : 46;
  burst(enemy.x, enemy.y, enemy.boss ? "#e8c45d" : enemy.heavy ? "#ff5d73" : "#41d6c3", enemy.boss ? 90 : enemy.heavy ? 28 : 18, enemy.boss ? 1.6 : enemy.heavy ? 1.1 : 0.8);
  addShard(enemy.x, enemy.y, enemy.boss ? 10 : enemy.type === "shooter" || enemy.type === "dodger" ? 2 : enemy.heavy ? 2 : 1);

  if (enemy.type === "charger") {
    const blastRadius = 92;
    burst(enemy.x, enemy.y, "#ff5d73", 42, 1.15);
    if (dist(enemy, p) < blastRadius) {
      damagePlayer(22 + state.wave * 1.8);
      showFloater(p.x, p.y - 26, "폭발 피해");
    }
    for (const other of state.enemies) {
      if (other !== enemy && dist(other, enemy) < blastRadius) {
        other.hp -= 34;
        other.hit = 1;
      }
    }
  }

  if (p.closeKillPower > 0 && dist(enemy, p) < 96 + p.closeKillPower * 18) {
    const radius = 70 + p.closeKillPower * 18;
    for (const other of state.enemies) {
      if (other !== enemy && dist(other, enemy) < radius) {
        other.hp -= other.boss ? 10 * p.closeKillPower : 24 * p.closeKillPower;
        other.hit = 1;
      }
    }
    p.health = Math.min(p.maxHealth, p.health + 4 + p.closeKillPower * 3);
    p.boostTimer = Math.max(p.boostTimer, 0.85 + p.closeKillPower * 0.2);
    showFloater(enemy.x, enemy.y - 22, "근접 처형");
    burst(enemy.x, enemy.y, "#f3f0e8", 22, 0.75);
  }

  if (enemy.boss) {
    showFloater(WORLD_W / 2, 122, "보스 격파");
  }
}

function updatePlayer(dt) {
  // 키보드 입력으로 가속도를 만들고, 마찰을 곱해서 미끄러지는 느낌을 냅니다.
  const p = state.player;
  const ax = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
  const ay = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
  const mag = Math.hypot(ax, ay) || 1;
  const boost = p.boostTimer > 0 ? 1.28 + p.grazePower * 0.08 : 1;
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  p.dashTimer = Math.max(0, p.dashTimer - dt);
  if (p.dashTimer > 0) {
    p.vx = Math.cos(p.dashAngle) * 980;
    p.vy = Math.sin(p.dashAngle) * 980;
  } else {
    p.vx += (ax / mag) * p.speed * boost * dt * 7;
    p.vy += (ay / mag) * p.speed * boost * dt * 7;
  }
  p.vx *= 0.82;
  p.vy *= 0.82;
  p.x = clamp(p.x + p.vx * dt, 28, WORLD_W - 28);
  p.y = clamp(p.y + p.vy * dt, 92, WORLD_H - 28);
  p.fireCooldown -= dt;
  p.boostTimer = Math.max(0, p.boostTimer - dt);

  if (pointer.down || keys.has(" ")) shoot(pointer.x, pointer.y);
}

function updateSpawning(dt) {
  // 일반 공세에서는 남은 적 수가 0이 될 때까지 일정 간격으로 적을 생성합니다.
  state.spawnTimer -= dt;
  if (state.enemiesLeft > 0 && state.spawnTimer <= 0) {
    spawnEnemy();
    state.enemiesLeft -= 1;
    state.spawnTimer = Math.max(0.11, 0.55 - state.wave * 0.032);
  }
}

function nearestPlayerBullet(enemy) {
  // 회피형 적이 가장 가까운 플레이어 탄을 찾을 때 사용합니다.
  let best = null;
  let bestDistance = Infinity;
  for (const bullet of state.bullets) {
    const d = dist(enemy, bullet);
    if (d < bestDistance) {
      best = bullet;
      bestDistance = d;
    }
  }
  return bestDistance < 130 ? best : null;
}

function updateEnemies(dt) {
  // 적 종류별 이동/공격 AI와 플레이어와의 몸통 충돌을 처리합니다.
  const p = state.player;
  for (const e of state.enemies) {
    e.hit = Math.max(0, e.hit - dt * 5);
    if (e.boss) {
      e.timer += dt;
      e.patternTimer -= dt;
      e.summonTimer -= dt;
      const homeX = WORLD_W / 2 + Math.sin(e.timer * 0.9) * Math.min(260, WORLD_W * 0.28);
      const homeY = 130 + Math.sin(e.timer * 1.4) * 24;
      e.x += (homeX - e.x) * dt * 1.3;
      e.y += (homeY - e.y) * dt * 1.3;
      if (e.patternTimer <= 0) {
        bossPattern(e);
        e.patternTimer = Math.max(0.34, 0.82 - state.wave * 0.018);
      }
      if (e.summonTimer <= 0) {
        spawnEnemy(e.x - 54, e.y + 26, Math.random() < 0.5 ? "shooter" : "charger");
        spawnEnemy(e.x + 54, e.y + 26, Math.random() < 0.5 ? "dodger" : "grunt");
        e.summonTimer = 4.4;
      }
    } else {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      let moveAngle = a;
      let moveSpeed = e.speed;

      if (e.type === "shooter") {
        e.cooldown -= dt;
        const preferred = 260;
        const d = dist(e, p);
        moveAngle = d < preferred ? a + Math.PI : a;
        moveSpeed = e.speed * (d < preferred ? 0.72 : 0.52);
        if (e.cooldown <= 0) {
          const fanCount = state.wave >= 7 ? 3 : state.wave >= 4 ? 2 : 1;
          const fanSpread = fanCount === 3 ? 0.3 : fanCount === 2 ? 0.18 : 0;
          fireEnemyFan(e, fanCount, fanSpread, 210 + state.wave * 9, 12 + state.wave * 0.95);
          e.cooldown = Math.max(1.05, 2.05 - state.wave * 0.055);
        }
      }

      if (e.type === "charger") {
        e.chargeTimer -= dt;
        if (e.chargeTimer <= 0 && !e.charging) {
          e.charging = true;
          e.chargeTimer = 0.62;
          e.chargeAngle = a;
          showFloater(e.x, e.y - 20, "돌진");
        }
        if (e.charging) {
          moveAngle = e.chargeAngle;
          moveSpeed = e.speed * 2.85;
          if (e.chargeTimer <= 0) {
            e.charging = false;
            e.chargeTimer = 2.2 + Math.random() * 0.8;
          }
        }
      }

      if (e.type === "dodger") {
        const bullet = nearestPlayerBullet(e);
        const distance = dist(e, p);
        if (bullet) {
          const bulletAngle = Math.atan2(bullet.vy, bullet.vx);
          moveAngle = bulletAngle + Math.PI / 2 * (Math.random() < 0.5 ? -1 : 1);
          moveSpeed = e.speed * 1.24;
        } else if (distance < 170) {
          moveAngle = a + Math.PI * 0.72;
          moveSpeed = e.speed * 0.9;
        } else {
          moveAngle = a + Math.sin(performance.now() / 260 + e.x) * 0.55;
        }
      }

      e.x += Math.cos(moveAngle) * moveSpeed * dt;
      e.y += Math.sin(moveAngle) * moveSpeed * dt;
    }

    const d = Math.max(1, dist(e, p));
    const minDistance = e.r + p.r;
    if (d < minDistance) {
      const nx = (p.x - e.x) / d;
      const ny = (p.y - e.y) / d;
      const overlap = minDistance - d;
      if (!e.boss) {
        e.x -= nx * overlap * 0.62;
        e.y -= ny * overlap * 0.62;
      }
      p.x += nx * overlap * 0.22;
      p.y += ny * overlap * 0.22;
      p.vx += nx * 520 * dt;
      p.vy += ny * 520 * dt;
      damagePlayer(e.damage * dt);
    }
  }
}

function updateBullets(dt) {
  // 플레이어 탄과 적 탄의 이동, 수명, 피격, 회피 가속 판정을 처리합니다.
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  }
  state.bullets = state.bullets.filter((b) => b.life > 0 && b.x > -80 && b.x < WORLD_W + 80 && b.y > -80 && b.y < WORLD_H + 80);

  for (const b of state.enemyBullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    const d = dist(b, state.player);
    if (!b.grazed && state.player.grazePower > 0 && d < state.player.r + b.r + 24 && d > state.player.r + b.r) {
      b.grazed = true;
      state.player.boostTimer = Math.max(state.player.boostTimer, 1.1 + state.player.grazePower * 0.18);
      state.score += 5;
      showFloater(state.player.x, state.player.y - 28, "회피 가속");
    }
    if (d < state.player.r + b.r) {
      b.life = 0;
      damagePlayer(b.damage);
      burst(b.x, b.y, "#ff5d73", 8, 0.45);
    }
  }
  state.enemyBullets = state.enemyBullets.filter((b) => b.life > 0 && b.x > -100 && b.x < WORLD_W + 100 && b.y > -100 && b.y < WORLD_H + 100);
}

function updateHits() {
  // 플레이어 탄이 적에게 닿았는지 검사합니다. 보스는 탄 피해를 일부 감쇠합니다.
  for (const b of state.bullets) {
    for (const e of state.enemies) {
      if (dist(b, e) < b.r + e.r) {
        const bossReduction = e.boss ? 0.62 : 1;
        e.hp -= b.damage * bossReduction;
        e.hit = 1;
        b.life = 0;
        burst(b.x, b.y, "#41d6c3", 7, 0.55);
        break;
      }
    }
  }

  for (const e of state.enemies.filter((enemy) => enemy.hp <= 0)) {
    onEnemyKilled(e);
  }
  state.enemies = state.enemies.filter((e) => e.hp > 0);
}

function updatePickups(dt) {
  // 신호 조각은 자력 범위 안에 들어오면 플레이어에게 빨려옵니다.
  const p = state.player;
  for (const s of state.pickups) {
    const d = Math.max(1, dist(s, p));
    if (d < p.magnet) {
      const pull = d < p.magnet * 0.45 ? 1800 : 1320;
      s.vx += ((p.x - s.x) / d) * pull * dt;
      s.vy += ((p.y - s.y) / d) * pull * dt;
    }
    s.vx *= 0.96;
    s.vy *= 0.96;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
  }

  for (const s of state.pickups) {
    if (dist(s, p) < p.r + s.r) {
      s.collected = true;
      p.shards += 1;
      const beforeHealth = p.health;
      p.health = Math.min(p.maxHealth, p.health + p.healOnShard);
      const healed = p.health - beforeHealth;
      if (healed > 0.05) {
        showFloater(p.x + 16, p.y - 32, `+${healed.toFixed(1)}`, "#9ff5b1", "#ffffff");
      }
      state.score += 10;
      if (p.shards >= 13 + p.level * 5) levelUp();
    }
  }
  state.pickups = state.pickups.filter((s) => !s.collected);
}

function updateEffects(dt) {
  // 파티클과 떠오르는 글자의 위치/수명을 갱신합니다.
  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.9;
    particle.vy *= 0.9;
    particle.life -= dt;
  }
  state.particles = state.particles.filter((p0) => p0.life > 0);

  for (const floater of state.floaters) {
    floater.y -= 24 * dt;
    floater.life -= dt;
  }
  state.floaters = state.floaters.filter((f) => f.life > 0);
  state.shake = Math.max(0, state.shake - dt * 24);
}

function updateWaveClear() {
  // 적이 모두 사라지면 다음 공세로 넘어갑니다.
  if (state.enemiesLeft <= 0 && state.enemies.length === 0) {
    state.wave += 1;
    state.player.health = Math.min(state.player.maxHealth, state.player.health + 14);
    burst(WORLD_W / 2, WORLD_H / 2, "#e8c45d", 36, 1);
    startWave();
  }
}

function update(dt) {
  // 한 프레임의 게임 로직 순서입니다. paused면 그리기만 유지하고 로직은 멈춥니다.
  if (!state.running || state.paused) return;
  updatePlayer(dt);
  updateSpawning(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updateHits();
  updatePickups(dt);
  updateEffects(dt);
  updateWaveClear();

  if (state.player.health <= 0) gameOver();
  updateHud();
}

function drawGrid() {
  // 배경 별과 격자선을 그립니다.
  ctx.fillStyle = "#111315";
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  for (const star of state.stars) {
    ctx.globalAlpha = star.a;
    ctx.fillStyle = "#f3f0e8";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.055)";
  ctx.lineWidth = 1;
  const spacing = 56;
  for (let x = 0; x < WORLD_W; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD_H);
    ctx.stroke();
  }
  for (let y = 0; y < WORLD_H; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_W, y);
    ctx.stroke();
  }
}

function drawActor(x, y, r, color, angle = 0, hit = 0) {
  // 플레이어와 일반 적은 같은 삼각형 실루엣을 색만 바꿔서 사용합니다.
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = hit > 0 ? "#f3f0e8" : color;
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(-r * 0.64, r * 0.72);
  ctx.lineTo(-r * 0.32, 0);
  ctx.lineTo(-r * 0.64, -r * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function enemyColor(enemy) {
  // 적 종류를 색으로 구분합니다.
  if (enemy.type === "shooter") return "#ff9f43";
  if (enemy.type === "charger") return enemy.charging ? "#f3f0e8" : "#ff5d73";
  if (enemy.type === "dodger") return "#8ee35f";
  if (enemy.type === "heavy") return "#ff5d73";
  return "#d66bff";
}

function drawBoss(boss) {
  // 보스는 별 모양 실루엣과 체력바를 따로 그립니다.
  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.rotate(boss.timer * 0.8);
  ctx.fillStyle = boss.hit > 0 ? "#f3f0e8" : "#e8c45d";
  ctx.strokeStyle = "#ff5d73";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const a = (TAU / 8) * i;
    const r = i % 2 === 0 ? boss.r : boss.r * 0.58;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  const width = 180;
  const pct = clamp(boss.hp / boss.maxHp, 0, 1);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(boss.x - width / 2, boss.y - boss.r - 22, width, 8);
  ctx.fillStyle = "#ff5d73";
  ctx.fillRect(boss.x - width / 2, boss.y - boss.r - 22, width * pct, 8);
}

function drawText(text, x, y, size = 16, align = "center", alpha = 1) {
  // 캔버스 위 한글 텍스트도 갈무리11로 맞춥니다.
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${size}px Galmuri11, sans-serif`;
  ctx.textAlign = align;
  ctx.fillStyle = "#f3f0e8";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawOutlinedText(text, x, y, size, fill, stroke, align = "center", alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${size}px Galmuri11, sans-serif`;
  ctx.textAlign = align;
  ctx.lineWidth = 4;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawPlayerStatus(p) {
  const x = p.x;
  const y = p.y + p.r + 24;
  const ready = p.dashCooldown <= 0;
  const pct = ready ? 1 : 1 - p.dashCooldown / 5;

  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 12, -Math.PI / 2, -Math.PI / 2 + TAU * pct);
  ctx.stroke();
  ctx.strokeStyle = ready ? "#9ff5b1" : "#e8c45d";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 8, -Math.PI / 2, -Math.PI / 2 + TAU * pct);
  ctx.stroke();
  ctx.restore();

  const dashText = ready ? "회피 가능" : `회피 ${p.dashCooldown.toFixed(1)}`;
  drawOutlinedText(dashText, x, y + 28, 13, ready ? "#9ff5b1" : "#e8c45d", "#ffffff");
  if (p.boostTimer > 0) {
    drawOutlinedText("회피 가속", x, p.y - p.r - 14, 13, "#e8c45d", "#ffffff");
  }
}

function draw() {
  // 화면을 매 프레임 새로 그립니다. 실제 로직이 멈춰도 draw는 계속 호출됩니다.
  const sx = state.shake ? (Math.random() - 0.5) * state.shake : 0;
  const sy = state.shake ? (Math.random() - 0.5) * state.shake : 0;
  const bounds = canvas.getBoundingClientRect();
  ctx.fillStyle = "#050607";
  ctx.fillRect(0, 0, bounds.width || canvas.width, bounds.height || canvas.height);
  ctx.save();
  ctx.translate(view.x + sx, view.y + sy);
  ctx.scale(view.scale, view.scale);
  drawGrid();

  for (const s of state.pickups) {
    ctx.fillStyle = "#e8c45d";
    ctx.shadowBlur = 14;
    ctx.shadowColor = "#e8c45d";
    ctx.beginPath();
    ctx.roundRect(s.x - 5, s.y - 5, 10, 10, 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  for (const b of state.bullets) {
    ctx.fillStyle = "#41d6c3";
    ctx.shadowBlur = 16;
    ctx.shadowColor = "#41d6c3";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  for (const b of state.enemyBullets) {
    ctx.fillStyle = "#ff5d73";
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#ff5d73";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  for (const e of state.enemies) {
    if (e.boss) {
      drawBoss(e);
    } else {
      const angle = Math.atan2(state.player.y - e.y, state.player.x - e.x);
      drawActor(e.x, e.y, e.r, enemyColor(e), angle, e.hit);
      if (e.type === "shooter") {
        ctx.strokeStyle = "rgba(255,159,67,0.42)";
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 8, 0, TAU);
        ctx.stroke();
      }
      if (e.type === "charger") {
        ctx.strokeStyle = e.charging ? "rgba(255,255,255,0.72)" : "rgba(255,93,115,0.45)";
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 12, 0, TAU);
        ctx.stroke();
      }
      if (e.type === "dodger") {
        ctx.strokeStyle = "rgba(142,227,95,0.42)";
        ctx.beginPath();
        ctx.moveTo(e.x - e.r - 6, e.y);
        ctx.lineTo(e.x + e.r + 6, e.y);
        ctx.stroke();
      }
    }
  }

  for (const particle of state.particles) {
    ctx.globalAlpha = clamp(particle.life / particle.max, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (state.player) {
    const p = state.player;
    const angle = Math.atan2(pointer.y - p.y, pointer.x - p.x);
    ctx.strokeStyle = p.boostTimer > 0 ? "rgba(232,196,93,0.34)" : "rgba(65,214,195,0.2)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.magnet, 0, TAU);
    ctx.stroke();
    drawActor(p.x, p.y, p.r, p.boostTimer > 0 ? "#e8c45d" : "#41d6c3", angle);
    drawPlayerStatus(p);
  }

  for (const floater of state.floaters) {
    drawOutlinedText(
      floater.text,
      floater.x,
      floater.y,
      15,
      floater.color || "#f3f0e8",
      floater.stroke || "rgba(0,0,0,0.62)",
      "center",
      clamp(floater.life / floater.max, 0, 1),
    );
  }

  ctx.restore();
}

function updateHud() {
  // 상단 HUD의 점수, 공세, 내구도를 갱신합니다.
  if (!state.player) return;
  scoreEl.textContent = String(state.score);
  waveEl.textContent = String(state.wave);
  healthEl.textContent = `${Math.max(0, Math.ceil((state.player.health / state.player.maxHealth) * 100))}%`;
}

function playerStats() {
  const p = state.player;
  const nextLevel = 13 + p.level * 5;
  return [
    ["레벨", `${p.level}`],
    ["경험치", `${p.shards}/${nextLevel}`],
    ["내구도", `${Math.ceil(p.health)}/${p.maxHealth}`],
    ["공격력", `${p.damage.toFixed(1)}`],
    ["발사 간격", `${Math.round(p.fireRate * 1000)}ms`],
    ["이동 속도", `${Math.round(p.speed)}`],
    ["흡수 범위", `${Math.round(p.magnet)}`],
    ["받는 피해", `${Math.round(p.damageTaken * 100)}%`],
    ["회피 쿨타임", p.dashCooldown > 0 ? `${p.dashCooldown.toFixed(1)}초` : "사용 가능"],
    ["탄 퍼짐 단계", `${p.spreadBonus}`],
    ["조각 회복", `${p.healOnShard.toFixed(1)}`],
    ["회피 가속", `${p.grazePower}`],
    ["근접 처형", `${p.closeKillPower}`],
  ];
}

// 일시정지 화면에서 현재 능력치를 표처럼 확인할 수 있게 그립니다.
function renderStatsPanel() {
  statsGrid.replaceChildren();
  for (const [label, value] of playerStats()) {
    const row = document.createElement("div");
    row.className = "stat-row";
    row.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    statsGrid.append(row);
  }
}

function calculateGoldReward() {
  return Math.max(10, Math.floor(state.score / 520) + state.wave * 9);
}

function gameOver() {
  // 게임오버 보상 골드를 지급하고 메인 업그레이드 상점을 다시 보여줍니다.
  const earnedGold = calculateGoldReward();
  meta.gold += earnedGold;
  saveMeta();
  state.running = false;
  panel.hidden = false;
  levelPanel.hidden = true;
  statsPanel.hidden = true;
  state.choosingUpgrade = false;
  panel.querySelector("h1").textContent = "작전 실패";
  panel.querySelector("p").textContent = `${state.wave}공세까지 버텼습니다. 신호 점수 ${state.score}점. 골드 ${earnedGold}G 획득.`;
  startButton.textContent = "다시 출격";
  renderMetaStore();
}

function loop(now) {
  // requestAnimationFrame이 넘겨주는 시간을 이용해 프레임 간격을 계산합니다.
  const dt = Math.min(0.033, (now - state.last) / 1000 || 0);
  state.last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function setPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const screenX = event.clientX - rect.left;
  const screenY = event.clientY - rect.top;
  pointer.x = clamp((screenX - view.x) / view.scale, 0, WORLD_W);
  pointer.y = clamp((screenY - view.y) / view.scale, 0, WORLD_H);
}

function syncPointerButtons(event) {
  const left = (event.buttons & 1) !== 0 || event.button === 0;
  const right = (event.buttons & 2) !== 0 || event.button === 2;
  const rightPressed = right && !mouse.right;
  mouse.left = left;
  mouse.right = right;
  pointer.down = mouse.left;
  if (rightPressed) dashPlayer();
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  keys.add(event.key.toLowerCase());
  if (event.key === "Escape" && state.running) togglePause();
});
window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
canvas.addEventListener("pointermove", (event) => {
  setPointer(event);
  if (event.buttons) syncPointerButtons(event);
});
canvas.addEventListener("pointerdown", (event) => {
  setPointer(event);
  pointerButtons.add(event.button);
  syncPointerButtons(event);
});
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
window.addEventListener("pointerup", (event) => {
  pointerButtons.delete(event.button);
  mouse.left = (event.buttons & 1) !== 0 || pointerButtons.has(0);
  mouse.right = (event.buttons & 2) !== 0 || pointerButtons.has(2);
  pointer.down = mouse.left;
});
startButton.addEventListener("click", resetGame);
pauseButton.addEventListener("click", togglePause);
resumeButton.addEventListener("click", togglePause);

function togglePause() {
  // 일시정지는 게임 로직만 멈추고 현재 능력치 패널을 보여줍니다.
  if (!state.running || state.choosingUpgrade) return;
  state.paused = !state.paused;
  statsPanel.hidden = !state.paused;
  if (state.paused) renderStatsPanel();
  pauseButton.textContent = state.paused ? "계속하기" : "일시정지";
}

resize();
draw();
renderMetaStore();
requestAnimationFrame(loop);
