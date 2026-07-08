const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 8765);
const PUBLIC_DIR = path.join(__dirname, "public");
const PICTURE_DIR = path.join(__dirname, "picture");
const START_HP = 15;
const MAX_COST = 35;

const roles = {
  swordsman: {
    name: "剣士",
    normalAttrs: ["physical"],
    passive: "常にDEF+1。通常カードは物理属性。"
  },
  mage: {
    name: "魔法使い",
    normalAttrs: ["magic"],
    passive: "常にATK+1、DEF-1。通常カードは魔法属性。"
  },
  martial: {
    name: "武道家",
    normalAttrs: ["physical"],
    passive: "遠距離ダメージを1軽減。通常カードは物理属性。"
  },
  curser: {
    name: "呪術師",
    normalAttrs: ["magic"],
    passive: "相手がスキルを使ったターンATK+1。通常カードは魔法属性。"
  },
  cleric: {
    name: "聖職者",
    normalAttrs: ["magic"],
    passive: "近接ダメージを1軽減。通常カードは魔法属性。"
  }
};

const normalDefs = {
  shield: { id: "shield", name: "盾", cost: 3, atk: 0, def: 5, shield: true },
  luxury_shield: { id: "luxury_shield", name: "高級盾", cost: 5, atk: 0, def: 10, shield: true },
  steel_shield: {
    id: "steel_shield",
    name: "鋼の盾",
    cost: 5,
    atk: 0,
    def: 5,
    shield: true,
    immune: "physical"
  },
  mystic_shield: {
    id: "mystic_shield",
    name: "不思議な盾",
    cost: 5,
    atk: 0,
    def: 5,
    shield: true,
    immune: "magic"
  },
  battle_shield: {
    id: "battle_shield",
    name: "バトルシールド",
    cost: 7,
    atk: 3,
    def: 10,
    shield: true
  }
};

const skills = {
  slash_break: {
    id: "slash_break",
    name: "切り崩し",
    role: "剣士",
    cost: 3,
    attrs: ["physical", "melee"],
    text: "2ターンの間、相手のDEFを-1する。"
  },
  double_slash: {
    id: "double_slash",
    name: "二段斬り",
    role: "剣士",
    cost: 6,
    attrs: ["physical", "melee"],
    text: "このターン通常攻撃に近接タグを追加し、攻撃判定を2回行う。"
  },
  magic_sword: {
    id: "magic_sword",
    name: "マジックソード",
    role: "剣士",
    cost: 5,
    attrs: ["magic", "melee"],
    text: "このターン通常攻撃を魔法・近接属性にし、与えたダメージを最大3回復する。"
  },
  fireball: {
    id: "fireball",
    name: "火の玉",
    role: "魔法使い",
    cost: 2,
    attrs: ["magic", "ranged"],
    text: "相手に魔法属性の固定1ダメージを与える。"
  },
  downgrade: {
    id: "downgrade",
    name: "ダウングレード",
    role: "魔法使い",
    cost: 4,
    attrs: ["magic", "ranged"],
    text: "使用したターン、相手のATKを2下げる。"
  },
  ice_crystal: {
    id: "ice_crystal",
    name: "アイスクリスタル",
    role: "魔法使い",
    cost: 7,
    attrs: ["magic", "ranged"],
    text: "3ターンの間、相手のATKとDEFを1下げ、魔法固定1ダメージを与えつづける。"
  },
  focus: {
    id: "focus",
    name: "集中",
    role: "武道家",
    cost: 3,
    attrs: ["neutral", "boost"],
    text: "1ターン後のATKを+3する。"
  },
  wave_blast: {
    id: "wave_blast",
    name: "波動弾",
    role: "武道家",
    cost: 4,
    attrs: ["magic", "ranged"],
    reusable: true,
    text: "魔法固定1ダメージ。通常攻撃で1以上与えていた場合、使用済みにならない。最大5回。"
  },
  wind_thrust: {
    id: "wind_thrust",
    name: "風神突き",
    role: "武道家",
    cost: 6,
    attrs: ["physical", "melee"],
    text: "通常攻撃に近接属性を追加し、相手ATK値を自身ATKに上乗せする。"
  },
  curse_nail: {
    id: "curse_nail",
    name: "呪いの釘",
    role: "呪術師",
    cost: 4,
    attrs: ["magic", "ranged"],
    text: "使用ターンに受けたダメージを魔法ダメージとして相手に与える。"
  },
  reverse: {
    id: "reverse",
    name: "リバース",
    role: "呪術師",
    cost: 3,
    attrs: ["magic", "ranged"],
    text: "相手が最後に使った魔法属性スキルの効果をコピーする。"
  },
  straw_doll: {
    id: "straw_doll",
    name: "藁人形",
    role: "呪術師",
    cost: 5,
    attrs: ["magic", "ranged"],
    text: "全員のHPを現在HPの25%分減らす。魔法系ダメージ扱い。"
  },
  holy_shield: {
    id: "holy_shield",
    name: "ホーリーシールド",
    role: "聖職者",
    cost: 5,
    attrs: ["magic", "boost"],
    text: "3ターンの間、次に受けるダメージを最大2軽減するシールドを得る。"
  },
  mystic_guard: {
    id: "mystic_guard",
    name: "神秘の護り",
    role: "聖職者",
    cost: 5,
    attrs: ["magic", "boost"],
    text: "HPを2支払い、2ターンの間DEF+3。"
  },
  holy_thunder: {
    id: "holy_thunder",
    name: "聖雷",
    role: "聖職者",
    cost: 5,
    attrs: ["magic", "ranged"],
    text: "魔法固定2ダメージを与え、2ターンの間全員のDEF-2。"
  },
  rest: {
    id: "rest",
    name: "休憩",
    role: "全ロール",
    cost: 3,
    attrs: ["neutral", "boost"],
    text: "HP1回復。このターン自身のATK-2。"
  },
  power_attack: {
    id: "power_attack",
    name: "強攻撃",
    role: "全ロール",
    cost: 2,
    attrs: ["neutral", "boost"],
    text: "このターンATK+1。"
  },
  guard: {
    id: "guard",
    name: "防御",
    role: "全ロール",
    cost: 2,
    attrs: ["neutral", "boost"],
    text: "このターンATK-1、DEF+2。"
  },
  initiative: {
    id: "initiative",
    name: "先制",
    role: "全ロール",
    cost: 4,
    attrs: ["neutral"],
    text: "無属性固定1ダメージを与える。"
  }
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png"
};

const players = new Map();
const games = new Map();
let waitingPlayerId = null;

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (data.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function send(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function serveStatic(req, res) {
  const rawUrl = decodeURIComponent(req.url.split("?")[0]);
  if (rawUrl.startsWith("/picture/")) {
    const picturePath = path.normalize(path.join(PICTURE_DIR, rawUrl.replace(/^\/picture\//, "")));
    if (!picturePath.startsWith(PICTURE_DIR)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }
    fs.readFile(picturePath, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, {
        "content-type": mimeTypes[path.extname(picturePath)] || "application/octet-stream",
        "cache-control": "public, max-age=3600"
      });
      res.end(data);
    });
    return;
  }
  const safePath = rawUrl === "/" ? "/index.html" : rawUrl;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "content-type": mimeTypes[path.extname(filePath)] || "application/octet-stream"
    });
    res.end(data);
  });
}

function normalFromId(cardId, instanceId) {
  if (/^num_\d+$/.test(cardId)) {
    const value = Number(cardId.slice(4));
    if (value < 1 || value > 10) return null;
    return {
      instanceId,
      id: cardId,
      name: `${value}`,
      type: "number",
      value,
      cost: value,
      atk: value,
      def: value - 1,
      shield: false
    };
  }
  const base = normalDefs[cardId];
  return base ? { ...base, instanceId, type: "shield" } : null;
}

function validateDeck(deck) {
  const errors = [];
  const role = roles[deck?.role] ? deck.role : null;
  const normalIds = Array.isArray(deck?.normalCards) ? deck.normalCards : [];
  const skillIds = Array.isArray(deck?.skills) ? deck.skills : [];

  if (!role) errors.push("ロールを選んでください。");
  if (normalIds.length !== 7) errors.push("通常カードは7枚ちょうど選んでください。");
  if (skillIds.length < 1) errors.push("スキルは1枚以上選んでください。");
  if (new Set(skillIds).size !== skillIds.length) errors.push("同じスキルは複数採用できません。");

  const normalCards = normalIds.map((cardId, index) => normalFromId(cardId, `n${index}_${cardId}`));
  if (normalCards.some(card => !card)) errors.push("存在しない通常カードが含まれています。");
  const shieldCount = normalCards.filter(card => card?.shield).length;
  if (shieldCount > 2) errors.push("盾カードは最大2枚までです。");

  const skillCards = skillIds.map(skillId => skills[skillId]).filter(Boolean);
  if (skillCards.length !== skillIds.length) errors.push("存在しないスキルが含まれています。");
  const illegalRoleSkill = skillCards.find(skill => role && !skillAllowedForRole(skill, role));
  if (illegalRoleSkill) errors.push(`${illegalRoleSkill.name}は${roles[role]?.name || "選択ロール"}では使えません。`);

  const cost = normalCards.reduce((sum, card) => sum + (card?.cost || 0), 0) +
    skillCards.reduce((sum, skill) => sum + skill.cost, 0);
  if (cost > MAX_COST) errors.push(`総コストは${MAX_COST}までです。現在${cost}です。`);

  return {
    ok: errors.length === 0,
    errors,
    role,
    normalCards,
    skillIds,
    cost
  };
}

function skillAllowedForRole(skill, role) {
  return Boolean(skill && roles[role] && (skill.role === "全ロール" || skill.role === roles[role].name));
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    role: player.role,
    roleName: roles[player.role].name,
    hp: player.hp,
    cost: player.cost,
    breakCount: player.breakCount || 0,
    breakLabel: breakLabel(player.breakCount || 0),
    normalHitStreak: player.normalHitStreak || 0,
    normalCards: player.normalCards.map(card => ({
      instanceId: card.instanceId,
      id: card.id,
      name: card.name,
      cost: card.cost,
      atk: card.atk,
      def: card.def,
      used: player.usedNormal.has(card.instanceId),
      shield: card.shield,
      immune: card.immune || null
    })),
    effects: player.effects.map(effect => ({ ...effect })),
    holyShields: player.holyShields.map(shield => ({ ...shield }))
  };
}

function privatePlayer(player) {
  return {
    ...publicPlayer(player),
    skills: player.skillIds.map(skillId => ({
      ...skills[skillId],
      used: player.usedSkills.has(skillId),
      uses: player.skillUseCounts[skillId] || 0
    })),
    shields: player.holyShields.length
  };
}

function makePlayer(body) {
  const validation = validateDeck(body.deck);
  if (!validation.ok) return { errors: validation.errors };
  const playerId = body.playerId || id("player");
  return {
    id: playerId,
    name: String(body.name || "Player").slice(0, 16),
    role: validation.role,
    normalCards: validation.normalCards,
    skillIds: validation.skillIds,
    cost: validation.cost,
    hp: START_HP,
    usedNormal: new Set(),
    usedSkills: new Set(),
    skillUseCounts: {},
    effects: [],
    holyShields: [],
    breakCount: 0,
    normalHitStreak: 0,
    lastMagicSkillUsed: null,
    action: null,
    queuedAt: Date.now(),
    gameId: null,
    status: "waiting"
  };
}

function makeGame(a, b) {
  const gameId = id("game");
  a.hp = START_HP;
  b.hp = START_HP;
  for (const player of [a, b]) {
    player.gameId = gameId;
    player.status = "active";
    player.usedNormal = new Set();
    player.usedSkills = new Set();
    player.skillUseCounts = {};
    player.effects = [];
    player.holyShields = [];
    player.breakCount = 0;
    player.normalHitStreak = 0;
    player.lastMagicSkillUsed = null;
    player.action = null;
  }
  const game = {
    id: gameId,
    turn: 1,
    players: [a, b],
    status: "active",
    winnerId: null,
    resultText: "",
    lastTurn: null,
    log: [`マッチング成立。${roles[a.role].name} vs ${roles[b.role].name}`],
    createdAt: Date.now()
  };
  games.set(gameId, game);
  return game;
}

function gameForPlayer(playerId) {
  const player = players.get(playerId);
  if (!player?.gameId) return null;
  return games.get(player.gameId) || null;
}

function stateFor(playerId) {
  const player = players.get(playerId);
  if (!player) return { status: "new" };
  if (player.status === "waiting") {
    return { status: "waiting", playerId };
  }
  const game = gameForPlayer(playerId);
  if (!game) return { status: "new" };
  const you = game.players.find(p => p.id === playerId);
  const opponent = game.players.find(p => p.id !== playerId);
  return {
    status: game.status,
    gameId: game.id,
    turn: game.turn,
    resultText: game.resultText,
    winnerId: game.winnerId,
    you: privatePlayer(you),
    opponent: publicPlayer(opponent),
    youReady: Boolean(you.action),
    waitingForOpponent: Boolean(you.action && !opponent.action),
    opponentReady: Boolean(opponent.action),
    yourAction: you.action,
    lastTurn: game.lastTurn,
    log: game.log.slice(-24)
  };
}

function getCard(player, instanceId) {
  return player.normalCards.find(card => card.instanceId === instanceId);
}

function canUseSkill(player, opponent, skillId) {
  if (!skillId) return true;
  if (!player.skillIds.includes(skillId)) return false;
  if (!skillAllowedForRole(skills[skillId], player.role)) return false;
  if (skillId === "reverse" && (!opponent.lastMagicSkillUsed || opponent.lastMagicSkillUsed === "reverse")) return false;
  if (skillId === "wave_blast") {
    return (player.skillUseCounts.wave_blast || 0) < 5 && !player.usedSkills.has(skillId);
  }
  return !player.usedSkills.has(skillId);
}

function uniqAttrs(attrs) {
  return [...new Set(attrs.filter(Boolean).filter(attr => attr !== "neutral"))];
}

function roleBaseMods(player) {
  const mods = { atk: 0, def: 0 };
  if (player.role === "swordsman") mods.def += 1;
  if (player.role === "mage") {
    mods.atk += 1;
    mods.def -= 1;
  }
  return mods;
}

function breakLabel(count) {
  if (count >= 4) return "OVER BREAK";
  if (count === 3) return "HYPER BREAK";
  if (count === 2) return "SUPER BREAK";
  if (count === 1) return "BREAK";
  return "なし";
}

function addBreak(ctx, reason) {
  ctx.player.breakCount = (ctx.player.breakCount || 0) + 1;
  const event = {
    playerId: ctx.player.id,
    playerName: ctx.player.name,
    count: ctx.player.breakCount,
    label: breakLabel(ctx.player.breakCount),
    reason
  };
  ctx.game.lastTurn.breaks.push(event);
  ctx.logs.push(`${ctx.player.name}: ${event.label} (${reason})`);
}

function makeCtx(game, player, opponent, action) {
  const card = getCard(player, action.normalId);
  const base = roleBaseMods(player);
  return {
    game,
    player,
    opponent,
    action,
    card,
    skillId: action.skillId || null,
    effectiveSkillId: action.skillId || null,
    atk: card.atk + base.atk,
    def: card.def + base.def,
    attackCount: 1,
    normalAttrs: uniqAttrs([...(roles[player.role].normalAttrs || [])]),
    fixedQueue: [],
    reaction: null,
    healAfterNormal: false,
    hpLossFromEnemy: 0,
    normalDamageDealt: 0,
    selfHpPayment: 0,
    logs: []
  };
}

function activeExistingEffects(ctx) {
  const nextEffects = [];
  for (const effect of ctx.player.effects) {
    if (effect.delay && effect.delay > 0) {
      nextEffects.push({ ...effect, delay: effect.delay - 1 });
      continue;
    }
    if (effect.type === "atk") ctx.atk += effect.amount;
    if (effect.type === "def") ctx.def += effect.amount;
    if (effect.type === "ice") {
      ctx.atk -= 1;
      ctx.def -= 1;
      ctx.fixedQueue.push({ to: ctx.player.id, amount: 1, attrs: ["magic", "ranged"], label: "アイスクリスタル" });
    }
    if (effect.remaining > 1) nextEffects.push({ ...effect, remaining: effect.remaining - 1 });
  }
  ctx.player.effects = nextEffects;
  ctx.player.holyShields = ctx.player.holyShields
    .map(shield => ({ ...shield, remaining: shield.remaining - 1 }))
    .filter(shield => shield.remaining > 0 && shield.amount > 0);
}

function addTimedStat(target, type, amount, remaining) {
  if (remaining > 0) target.effects.push({ type, amount, remaining });
}

function prepareSkill(ctx) {
  const { player, opponent } = ctx;
  let skillId = ctx.skillId;
  if (!skillId) return;
  const skill = skills[skillId];
  if (skillId === "reverse") {
    skillId = opponent.lastMagicSkillUsed;
    ctx.effectiveSkillId = skillId;
    ctx.logs.push(`${player.name}のリバースが${skills[skillId].name}をコピー。`);
  }
  if (skill.attrs.includes("magic") && ctx.skillId !== "reverse") {
    player.lastMagicSkillUsed = ctx.skillId;
  }

  switch (skillId) {
    case "slash_break":
      ctx.opponent.pendingDefMod = (ctx.opponent.pendingDefMod || 0) - 1;
      addTimedStat(opponent, "def", -1, 1);
      ctx.logs.push(`${player.name}は切り崩しで相手DEFを下げた。`);
      break;
    case "double_slash":
      ctx.attackCount = 2;
      ctx.normalAttrs.push("melee");
      ctx.logs.push(`${player.name}は二段斬りの構え。`);
      break;
    case "magic_sword":
      ctx.normalAttrs = ["magic", "melee"];
      ctx.healAfterNormal = true;
      ctx.logs.push(`${player.name}の通常攻撃が魔法・近接になった。`);
      break;
    case "fireball":
      ctx.fixedQueue.push({ to: opponent.id, amount: 1, attrs: ["magic", "ranged"], label: "火の玉" });
      break;
    case "downgrade":
      ctx.opponent.pendingAtkMod = (ctx.opponent.pendingAtkMod || 0) - 2;
      ctx.logs.push(`${player.name}は相手ATKを下げた。`);
      break;
    case "ice_crystal":
      ctx.opponent.pendingAtkMod = (ctx.opponent.pendingAtkMod || 0) - 1;
      ctx.opponent.pendingDefMod = (ctx.opponent.pendingDefMod || 0) - 1;
      opponent.effects.push({ type: "ice", remaining: 2 });
      ctx.fixedQueue.push({ to: opponent.id, amount: 1, attrs: ["magic", "ranged"], label: "アイスクリスタル" });
      ctx.logs.push(`${player.name}はアイスクリスタルを展開。`);
      break;
    case "focus":
      player.effects.push({ type: "atk", amount: 3, remaining: 1 });
      ctx.logs.push(`${player.name}は次のターンに備えて集中。`);
      break;
    case "wave_blast":
      ctx.fixedQueue.push({ to: opponent.id, amount: 1, attrs: ["magic", "ranged"], label: "波動弾" });
      break;
    case "wind_thrust":
      ctx.normalAttrs.push("melee");
      ctx.windThrust = true;
      break;
    case "curse_nail":
      ctx.reaction = "curse_nail";
      break;
    case "straw_doll":
      ctx.strawDoll = true;
      break;
    case "holy_shield":
      player.holyShields.push({ amount: 2, remaining: 3 });
      ctx.logs.push(`${player.name}はホーリーシールドを得た。`);
      break;
    case "mystic_guard":
      ctx.selfHpPayment += 2;
      ctx.def += 3;
      addTimedStat(player, "def", 3, 1);
      ctx.logs.push(`${player.name}はHP2を支払いDEFを高めた。`);
      break;
    case "holy_thunder":
      ctx.fixedQueue.push({ to: opponent.id, amount: 2, attrs: ["magic", "ranged"], label: "聖雷" });
      ctx.player.pendingDefMod = (ctx.player.pendingDefMod || 0) - 2;
      ctx.opponent.pendingDefMod = (ctx.opponent.pendingDefMod || 0) - 2;
      addTimedStat(player, "def", -2, 1);
      addTimedStat(opponent, "def", -2, 1);
      ctx.logs.push(`${player.name}の聖雷で全員のDEFが下がる。`);
      break;
    case "rest":
      player.hp = Math.min(START_HP, player.hp + 1);
      ctx.atk -= 2;
      ctx.logs.push(`${player.name}は休憩してHP1回復。`);
      break;
    case "power_attack":
      ctx.atk += 1;
      break;
    case "guard":
      ctx.atk -= 1;
      ctx.def += 2;
      break;
    case "initiative":
      ctx.fixedQueue.push({ to: opponent.id, amount: 1, attrs: [], label: "先制" });
      break;
  }
}

function finishMods(a, b) {
  for (const ctx of [a, b]) {
    ctx.atk += ctx.player.pendingAtkMod || 0;
    ctx.def += ctx.player.pendingDefMod || 0;
    delete ctx.player.pendingAtkMod;
    delete ctx.player.pendingDefMod;
  }
  if (a.windThrust) a.atk += Math.max(0, b.atk);
  if (b.windThrust) b.atk += Math.max(0, a.atk);
  if (a.opponent.role === "curser" && a.skillId) b.atk += 1;
  if (b.opponent.role === "curser" && b.skillId) a.atk += 1;
}

function damageTo(targetCtx, amount, attrs, label, sourceCtx, options = {}) {
  const raw = Math.max(0, Math.floor(amount));
  let final = Math.max(0, Math.floor(amount));
  const targetCard = targetCtx.card;
  const has = attr => attrs.includes(attr);
  const reductions = [];

  if (!options.ignoreSelfPrevention) {
    if (targetCard?.immune && has(targetCard.immune)) {
      if (final > 0) reductions.push({ label: targetCard.name, amount: final, reason: `${targetCard.immune === "physical" ? "物理" : "魔法"}無効` });
      final = 0;
    }
    if (targetCtx.player.role === "martial" && has("ranged")) {
      const before = final;
      final = Math.max(0, final - 1);
      if (before !== final) reductions.push({ label: "武道家パッシブ", amount: before - final, reason: "遠距離軽減" });
    }
    if (targetCtx.player.role === "cleric" && has("melee")) {
      const before = final;
      final = Math.max(0, final - 1);
      if (before !== final) reductions.push({ label: "聖職者パッシブ", amount: before - final, reason: "近接軽減" });
    }
    if (final > 0 && targetCtx.player.holyShields.length) {
      const shield = targetCtx.player.holyShields[0];
      const reduced = Math.min(shield.amount, final);
      final -= reduced;
      if (reduced > 0) reductions.push({ label: "ホーリーシールド", amount: reduced, reason: "シールド軽減" });
      shield.amount = 0;
      targetCtx.player.holyShields = targetCtx.player.holyShields.filter(s => s.amount > 0);
    }
  }

  if (final > 0) {
    targetCtx.player.hp = Math.max(0, targetCtx.player.hp - final);
    if (sourceCtx && sourceCtx.player.id !== targetCtx.player.id) {
      targetCtx.hpLossFromEnemy += final;
      sourceCtx.normalDamageDealt += options.normal ? final : 0;
    }
  }
  if (final > 0 && sourceCtx && sourceCtx.player.id !== targetCtx.player.id && targetCard?.shield) {
    addBreak(sourceCtx, "盾突破");
  }
  const attrText = attrs.length ? `/${attrs.join(",")}` : "/無";
  sourceCtx?.logs.push(`${label}: ${targetCtx.player.name}に${final}ダメージ${attrText}`);
  if (targetCtx.game.lastTurn) {
    targetCtx.game.lastTurn.damages.push({
      label,
      sourceId: sourceCtx?.player.id || null,
      sourceName: sourceCtx?.player.name || "",
      targetId: targetCtx.player.id,
      targetName: targetCtx.player.name,
      rawAmount: raw,
      amount: final,
      attrs,
      reductions,
      kind: options.kind || (options.normal ? "normal" : "damage")
    });
  }
  return final;
}

function resolveNormalAttack(sourceCtx, targetCtx) {
  const raw = Math.max(sourceCtx.atk - targetCtx.def, 0);
  const dealt = damageTo(targetCtx, raw, sourceCtx.normalAttrs, `${sourceCtx.player.name}の通常攻撃`, sourceCtx, {
    normal: true,
    kind: "normal"
  });

  if (sourceCtx.atk >= 6 && dealt === 0) {
    addBreak(targetCtx, "高ATK防御");
  }
  if (dealt >= 5) {
    addBreak(sourceCtx, "大打撃");
  }
  if (dealt > 0) {
    sourceCtx.player.normalHitStreak = (sourceCtx.player.normalHitStreak || 0) + 1;
    if (sourceCtx.player.normalHitStreak >= 3) {
      addBreak(sourceCtx, "連続成功");
      sourceCtx.player.normalHitStreak = 0;
    }
  } else {
    sourceCtx.player.normalHitStreak = 0;
  }
  return dealt;
}

function applyTurnSevenBreakDamage(game, a, b) {
  if (game.turn !== 7) return;
  for (const [sourceCtx, targetCtx] of [[a, b], [b, a]]) {
    const count = sourceCtx.player.breakCount || 0;
    const amount = Math.min(3, count);
    if (amount > 0) {
      damageTo(targetCtx, amount, [], "BREAK追加ダメージ", sourceCtx, { kind: "breakBonus" });
      sourceCtx.logs.push(`${sourceCtx.player.name}の${breakLabel(count)}: 7ターン終了時に${amount}ダメージ。`);
    }
  }
}

function finishByOverBreak(game) {
  const winners = game.players.filter(player => (player.breakCount || 0) >= 4);
  if (!winners.length) return false;
  game.status = "finished";
  if (winners.length > 1) {
    game.resultText = "両者OVER BREAK。引き分け。";
    game.winnerId = null;
  } else {
    game.winnerId = winners[0].id;
    game.resultText = `${winners[0].name}のOVER BREAK勝利。`;
  }
  game.lastTurn.overBreak = winners.map(player => ({
    playerId: player.id,
    playerName: player.name,
    label: breakLabel(player.breakCount || 0)
  }));
  return true;
}

function resolveTurn(game) {
  const [p1, p2] = game.players;
  const a = makeCtx(game, p1, p2, p1.action);
  const b = makeCtx(game, p2, p1, p2.action);

  game.lastTurn = {
    turn: game.turn,
    plays: {
      [p1.id]: {
        playerId: p1.id,
        playerName: p1.name,
        normalName: a.card.name,
        normalAtk: a.card.atk,
        normalDef: a.card.def,
        skillName: a.skillId ? skills[a.skillId].name : "スキルなし"
      },
      [p2.id]: {
        playerId: p2.id,
        playerName: p2.name,
        normalName: b.card.name,
        normalAtk: b.card.atk,
        normalDef: b.card.def,
        skillName: b.skillId ? skills[b.skillId].name : "スキルなし"
      }
    },
    damages: [],
    breaks: [],
    chainBreaks: [],
    overBreak: [],
    hpAfter: {}
  };

  activeExistingEffects(a);
  activeExistingEffects(b);
  prepareSkill(a);
  prepareSkill(b);
  finishMods(a, b);

  a.atk = Math.max(0, a.atk);
  b.atk = Math.max(0, b.atk);
  a.def = Math.max(0, a.def);
  b.def = Math.max(0, b.def);
  a.normalAttrs = uniqAttrs(a.normalAttrs);
  b.normalAttrs = uniqAttrs(b.normalAttrs);
  Object.assign(game.lastTurn.plays[p1.id], {
    effectiveAtk: a.atk,
    effectiveDef: a.def,
    attrs: a.normalAttrs,
    attackCount: a.attackCount
  });
  Object.assign(game.lastTurn.plays[p2.id], {
    effectiveAtk: b.atk,
    effectiveDef: b.def,
    attrs: b.normalAttrs,
    attackCount: b.attackCount
  });

  for (let i = 0; i < a.attackCount; i += 1) {
    resolveNormalAttack(a, b);
  }
  for (let i = 0; i < b.attackCount; i += 1) {
    resolveNormalAttack(b, a);
  }

  if (a.healAfterNormal && a.normalDamageDealt > 0) a.player.hp = Math.min(START_HP, a.player.hp + Math.min(3, a.normalDamageDealt));
  if (b.healAfterNormal && b.normalDamageDealt > 0) b.player.hp = Math.min(START_HP, b.player.hp + Math.min(3, b.normalDamageDealt));

  const strawHp = new Map([[a.player.id, a.player.hp], [b.player.id, b.player.hp]]);
  for (const ctx of [a, b]) {
    if (ctx.selfHpPayment > 0) {
      ctx.player.hp = Math.max(0, ctx.player.hp - ctx.selfHpPayment);
      ctx.logs.push(`${ctx.player.name}はHPを${ctx.selfHpPayment}支払った。`);
      game.lastTurn.damages.push({
        label: "HP支払い",
        sourceId: ctx.player.id,
        sourceName: ctx.player.name,
        targetId: ctx.player.id,
        targetName: ctx.player.name,
        amount: ctx.selfHpPayment,
        attrs: [],
        kind: "payment"
      });
    }
    if (ctx.strawDoll) {
      const selfAmount = Math.ceil((strawHp.get(ctx.player.id) || ctx.player.hp) * 0.25);
      const enemyAmount = Math.ceil((strawHp.get(ctx.opponent.id) || ctx.opponent.hp) * 0.25);
      ctx.player.hp = Math.max(0, ctx.player.hp - selfAmount);
      damageTo(ctx === a ? b : a, enemyAmount, ["magic", "ranged"], "藁人形", ctx);
      ctx.logs.push(`${ctx.player.name}は藁人形で自身のHPも${selfAmount}減少。`);
      game.lastTurn.damages.push({
        label: "藁人形",
        sourceId: ctx.player.id,
        sourceName: ctx.player.name,
        targetId: ctx.player.id,
        targetName: ctx.player.name,
        amount: selfAmount,
        attrs: ["magic", "ranged"],
        kind: "self"
      });
    }
  }

  for (const item of [...a.fixedQueue, ...b.fixedQueue]) {
    const sourceCtx = item.to === a.player.id ? b : a;
    const targetCtx = item.to === a.player.id ? a : b;
    damageTo(targetCtx, item.amount, item.attrs, item.label, sourceCtx);
  }

  if (a.reaction === "curse_nail" && a.hpLossFromEnemy > 0) damageTo(b, a.hpLossFromEnemy, ["magic", "ranged"], "呪いの釘", a);
  if (b.reaction === "curse_nail" && b.hpLossFromEnemy > 0) damageTo(a, b.hpLossFromEnemy, ["magic", "ranged"], "呪いの釘", b);

  applyTurnSevenBreakDamage(game, a, b);

  const breakCountsByPlayer = new Map();
  for (const event of game.lastTurn.breaks) {
    breakCountsByPlayer.set(event.playerId, (breakCountsByPlayer.get(event.playerId) || 0) + 1);
  }
  for (const [playerId, count] of breakCountsByPlayer) {
    if (count > 1) {
      const player = game.players.find(p => p.id === playerId);
      const chain = { playerId, playerName: player?.name || "", count };
      game.lastTurn.chainBreaks.push(chain);
      game.log.push(`${chain.playerName}: CHAIN BREAK x${count}`);
    }
  }

  for (const ctx of [a, b]) {
    ctx.player.usedNormal.add(ctx.card.instanceId);
    if (ctx.skillId) {
      ctx.player.skillUseCounts[ctx.skillId] = (ctx.player.skillUseCounts[ctx.skillId] || 0) + 1;
      const keepWave = ctx.skillId === "wave_blast" && ctx.normalDamageDealt > 0 && ctx.player.skillUseCounts[ctx.skillId] < 5;
      if (!keepWave) ctx.player.usedSkills.add(ctx.skillId);
    }
    ctx.player.action = null;
  }

  game.log.push(`Turn ${game.turn}: ${p1.name} ${a.card.name}${a.skillId ? ` + ${skills[a.skillId].name}` : ""} / ${p2.name} ${b.card.name}${b.skillId ? ` + ${skills[b.skillId].name}` : ""}`);
  for (const line of [...a.logs, ...b.logs]) game.log.push(line);
  game.log.push(`HP: ${p1.name} ${p1.hp} / ${p2.name} ${p2.hp}`);
  game.lastTurn.hpAfter = {
    [p1.id]: p1.hp,
    [p2.id]: p2.hp
  };

  const allNormalUsed = game.players.every(player => player.usedNormal.size >= 7);
  for (const event of game.lastTurn.breaks) game.log.push(`${event.playerName}: ${event.label} - ${event.reason}`);
  if (finishByOverBreak(game)) {
    // OVER BREAK wins immediately after the turn's BREAK checks are known.
  } else if (p1.hp <= 0 && p2.hp <= 0) {
    game.status = "finished";
    game.resultText = "同時死亡。引き分け。";
  } else if (p1.hp <= 0 || p2.hp <= 0) {
    const winner = p1.hp > 0 ? p1 : p2;
    game.status = "finished";
    game.winnerId = winner.id;
    game.resultText = `${winner.name}の勝利。`;
  } else if (allNormalUsed) {
    game.status = "finished";
    if (p1.hp === p2.hp) {
      game.resultText = "通常カードを使い切り、残りHP同点。引き分け。";
    } else {
      const winner = p1.hp > p2.hp ? p1 : p2;
      game.winnerId = winner.id;
      game.resultText = `通常カードを使い切り、${winner.name}の勝利。`;
    }
  } else {
    game.turn += 1;
  }
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === "GET" && url.pathname === "/api/catalog") {
      return send(res, 200, { roles, normalDefs, skills, startHp: START_HP, maxCost: MAX_COST });
    }
    if (req.method === "POST" && url.pathname === "/api/session") {
      const playerId = id("player");
      return send(res, 200, { playerId });
    }
    if (req.method === "POST" && url.pathname === "/api/queue") {
      const body = await readJson(req);
      const player = makePlayer(body);
      if (player.errors) return send(res, 400, { errors: player.errors });
      players.set(player.id, player);
      if (waitingPlayerId && waitingPlayerId !== player.id && players.get(waitingPlayerId)?.status === "waiting") {
        const opponent = players.get(waitingPlayerId);
        waitingPlayerId = null;
        const game = makeGame(opponent, player);
        return send(res, 200, { status: "matched", gameId: game.id, playerId: player.id });
      }
      waitingPlayerId = player.id;
      return send(res, 200, { status: "waiting", playerId: player.id });
    }
    if (req.method === "GET" && url.pathname === "/api/state") {
      return send(res, 200, stateFor(url.searchParams.get("playerId")));
    }
    if (req.method === "POST" && url.pathname === "/api/action") {
      const body = await readJson(req);
      const game = gameForPlayer(body.playerId);
      if (!game || game.status !== "active") return send(res, 400, { error: "進行中の対戦がありません。" });
      const player = game.players.find(p => p.id === body.playerId);
      const opponent = game.players.find(p => p.id !== body.playerId);
      if (body.cancel) {
        if (player.action && !opponent.action) {
          player.action = null;
          return send(res, 200, stateFor(body.playerId));
        }
        return send(res, 400, { error: "解除できる決定がありません。" });
      }
      const card = getCard(player, body.normalId);
      if (!card || player.usedNormal.has(card.instanceId)) return send(res, 400, { error: "使用できない通常カードです。" });
      if (!canUseSkill(player, opponent, body.skillId || null)) return send(res, 400, { error: "使用できないスキルです。" });
      if (player.action) return send(res, 400, { error: "このターンの行動は送信済みです。" });
      player.action = {
        normalId: body.normalId,
        skillId: body.skillId || null,
        normalName: card.name,
        skillName: body.skillId ? skills[body.skillId].name : "スキルなし"
      };
      if (game.players.every(p => p.action)) resolveTurn(game);
      return send(res, 200, stateFor(body.playerId));
    }
    if (req.method === "POST" && url.pathname === "/api/leave") {
      const body = await readJson(req);
      const player = players.get(body.playerId);
      if (player?.status === "waiting" && waitingPlayerId === player.id) waitingPlayerId = null;
      if (player?.gameId) {
        const game = games.get(player.gameId);
        if (game?.status === "active") {
          const opponent = game.players.find(p => p.id !== player.id);
          game.status = "finished";
          game.winnerId = opponent?.id || null;
          game.resultText = `${player.name}が退出しました。`;
        }
      }
      players.delete(body.playerId);
      return send(res, 200, { ok: true });
    }
  } catch (error) {
    return send(res, 500, { error: error.message });
  }
  return send(res, 404, { error: "Not found" });
}

const server = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    send(res, 200, { ok: true, service: "over-break" });
    return;
  }
  if (req.url.startsWith("/api/")) {
    handleApi(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`HP Card Duel running at http://127.0.0.1:${PORT}`);
});
