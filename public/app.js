const state = {
  catalog: null,
  playerId: localStorage.getItem("hpDuelPlayerId") || null,
  selectedRole: "swordsman",
  normalCards: [],
  skills: new Set(),
  selectedNormal: null,
  selectedSkill: null,
  activeBattleTab: "normal",
  pollTimer: null,
  lastGameId: null,
  currentBattle: null,
  resultModalGameId: null,
  lastBreakAnimationKey: null
};

const $ = selector => document.querySelector(selector);

const roleImages = {
  swordsman: "/picture/sword.png",
  mage: "/picture/mage.png",
  martial: "/picture/martial.png",
  curser: "/picture/curse.png",
  cleric: "/picture/cleric.png"
};

const breakImages = {
  BREAK: "/picture/break.png",
  "SUPER BREAK": "/picture/super_break.png",
  "HYPER BREAK": "/picture/hyper_break.png",
  "OVER BREAK": "/picture/over_break.png",
  CHAIN: "/picture/chain_break.png"
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data.errors?.join("\n") || data.error || "エラーが発生しました。";
    throw new Error(message);
  }
  return data;
}

function normalDef(cardId) {
  if (/^num_\d+$/.test(cardId)) {
    const value = Number(cardId.slice(4));
    return { id: cardId, name: String(value), cost: value, atk: value, def: value - 1, shield: false };
  }
  return state.catalog.normalDefs[cardId];
}

function normalSortKey(cardOrId) {
  const id = typeof cardOrId === "string" ? cardOrId : cardOrId.id;
  if (/^num_\d+$/.test(id)) return Number(id.slice(4));
  const shieldOrder = {
    shield: 101,
    luxury_shield: 102,
    steel_shield: 103,
    mystic_shield: 104,
    battle_shield: 105
  };
  return shieldOrder[id] || 999;
}

function sortNormalIds(ids) {
  return [...ids].sort((a, b) => normalSortKey(a) - normalSortKey(b));
}

function sortNormalCards(cards) {
  return [...cards].sort((a, b) => normalSortKey(a) - normalSortKey(b));
}

function sortDeckNormals() {
  state.normalCards = sortNormalIds(state.normalCards);
}

function attrsLabel(attrs) {
  const map = {
    physical: "物",
    magic: "魔",
    ranged: "遠",
    melee: "近",
    boost: "強",
    neutral: "無"
  };
  return attrs.map(attr => map[attr] || attr);
}

function effectLabel(effect) {
  if (effect.type === "atk") return `ATK ${effect.amount > 0 ? "+" : ""}${effect.amount}`;
  if (effect.type === "def") return `DEF ${effect.amount > 0 ? "+" : ""}${effect.amount}`;
  if (effect.type === "ice") return "氷結 ATK/DEF-1 + 魔法1";
  return effect.type;
}

function renderEffects(target, effects = [], shields = []) {
  const shieldItems = shields.map(shield => ({
    text: `シールド ${shield.amount}軽減`,
    remaining: shield.remaining
  }));
  const effectItems = effects.map(effect => ({
    text: effectLabel(effect),
    remaining: effect.delay && effect.delay > 0 ? effect.delay + effect.remaining : effect.remaining
  }));
  const items = [...effectItems, ...shieldItems].filter(item => item.remaining > 0);
  target.innerHTML = items.length
    ? items.map(item => `<span class="effect-chip">${item.text}<small>残り${item.remaining}</small></span>`).join("")
    : `<span class="effect-empty">なし</span>`;
}

function skillAllowedForRole(skill) {
  const roleName = state.catalog.roles[state.selectedRole].name;
  return skill.role === "全ロール" || skill.role === roleName;
}

function totalCost() {
  const normalCost = state.normalCards.reduce((sum, cardId) => sum + normalDef(cardId).cost, 0);
  const skillCost = [...state.skills].reduce((sum, skillId) => sum + state.catalog.skills[skillId].cost, 0);
  return normalCost + skillCost;
}

function deckErrors() {
  const errors = [];
  const shieldCount = state.normalCards.filter(cardId => normalDef(cardId).shield).length;
  const illegalSkill = [...state.skills].find(skillId => !skillAllowedForRole(state.catalog.skills[skillId]));
  if (state.normalCards.length !== 7) errors.push("通常カードは7枚ちょうど選びます。");
  if (shieldCount > 2) errors.push("盾カードは最大2枚です。");
  if (state.skills.size < 1) errors.push("スキルを1枚以上選びます。");
  if (illegalSkill) errors.push("現在のロールでは使えないスキルがあります。");
  if (totalCost() > state.catalog.maxCost) errors.push("総コストが35を超えています。");
  return errors;
}

function cardStats(card) {
  return `
    <div class="stats">
      <span class="stat">ATK ${card.atk}</span>
      <span class="stat">DEF ${card.def}</span>
      <span class="stat">C ${card.cost}</span>
    </div>
  `;
}

function normalEffectTag(card) {
  if (card.immune === "physical") return `<span class="tag">物理無効</span>`;
  if (card.immune === "magic") return `<span class="tag">魔法無効</span>`;
  return "";
}

function renderBuilder() {
  const catalog = state.catalog;
  sortDeckNormals();
  $("#roleGrid").innerHTML = Object.entries(catalog.roles).map(([id, role]) => `
    <button class="role-card ${state.selectedRole === id ? "selected" : ""}" data-role="${id}">
      <img class="role-art" src="${roleImages[id]}" alt="">
      <strong>${role.name}</strong>
      <span>${role.passive}</span>
    </button>
  `).join("");

  const normalChoices = [
    ...Array.from({ length: 10 }, (_, index) => `num_${index + 1}`),
    ...Object.keys(catalog.normalDefs)
  ];
  $("#normalGrid").innerHTML = normalChoices.map(cardId => {
    const card = normalDef(cardId);
    const count = state.normalCards.filter(id => id === cardId).length;
    return `
      <button class="normal-card" data-normal="${cardId}">
        <strong>${card.name}</strong>
        ${cardStats(card)}
        ${normalEffectTag(card)}
        ${count ? `<span class="tag">採用 ${count}</span>` : ""}
      </button>
    `;
  }).join("");

  $("#normalDeck").innerHTML = state.normalCards.map((cardId, index) => {
    const card = normalDef(cardId);
    return `
      <button class="deck-chip" data-remove-normal="${index}">
        <b>${card.name}</b>
        <span>C${card.cost}</span>
      </button>
    `;
  }).join("");

  $("#skillGrid").innerHTML = Object.values(catalog.skills).filter(skillAllowedForRole).map(skill => {
    const selected = state.skills.has(skill.id);
    return `
      <button class="skill-card ${selected ? "selected" : ""}" data-skill="${skill.id}">
        <div class="skill-top">
          <strong>${skill.name}</strong>
          <span class="pill">C ${skill.cost}</span>
        </div>
        <p>${skill.role} / ${skill.text}</p>
        <div class="tag-row">${attrsLabel(skill.attrs).map(tag => `<span class="tag">${tag}</span>`).join("")}</div>
      </button>
    `;
  }).join("");

  const cost = totalCost();
  const errors = deckErrors();
  $("#costText").textContent = `${cost} / ${catalog.maxCost}`;
  $("#costFill").style.width = `${Math.min(100, (cost / catalog.maxCost) * 100)}%`;
  $("#normalCount").textContent = `${state.normalCards.length} / 7`;
  $("#skillCount").textContent = `${state.skills.size}枚`;
  $("#builderError").textContent = errors[0] || "";
  $("#queueButton").disabled = errors.length > 0;
}

function showView(name) {
  $("#builderView").classList.toggle("hidden", name !== "builder");
  $("#waitingView").classList.toggle("hidden", name !== "waiting");
  $("#battleView").classList.toggle("hidden", name !== "battle");
}

function setStatus(text) {
  $("#statusLine").textContent = text;
}

function hpWidth(hp) {
  return `${Math.max(0, Math.min(100, (hp / 15) * 100))}%`;
}

function breakClass(label) {
  return label.toLowerCase().replace(/\s+/g, "-");
}

function selectedNormalName(cards) {
  const card = cards.find(item => item.instanceId === state.selectedNormal);
  return card ? card.name : "未選択";
}

function selectedSkillName(skills) {
  if (!state.selectedSkill) return "なし";
  const skill = skills.find(item => item.id === state.selectedSkill);
  return skill ? skill.name : "なし";
}

function renderBattleTabs() {
  document.querySelectorAll("[data-battle-tab]").forEach(button => {
    button.classList.toggle("active", button.dataset.battleTab === state.activeBattleTab);
  });
  $("#normalTabPanel").classList.toggle("hidden", state.activeBattleTab !== "normal");
  $("#skillTabPanel").classList.toggle("hidden", state.activeBattleTab !== "skill");
}

function renderTurnResult(data) {
  const panel = $("#turnResultPanel");
  if (!data.lastTurn) {
    panel.classList.add("hidden");
    return;
  }

  const youPlay = data.lastTurn.plays[data.you.id];
  const opponentPlay = data.lastTurn.plays[data.opponent.id];
  $("#turnResultTitle").textContent = `Turn ${data.lastTurn.turn} Result`;
  $("#playedCards").innerHTML = [youPlay, opponentPlay].map(play => `
    <div class="played-card ${play.playerId === data.you.id ? "mine" : "theirs"}">
      <span>${play.playerId === data.you.id ? "自分" : "相手"} / ${play.playerName}</span>
      <strong>${play.normalName}</strong>
      <small>基本 ATK ${play.normalAtk} / DEF ${play.normalDef}</small>
      <small>最終 ATK ${play.effectiveAtk} / DEF ${play.effectiveDef}${play.attackCount > 1 ? ` / ${play.attackCount}回` : ""}</small>
      <small>${attrsLabel(play.attrs || []).join("・") || "無属性"}</small>
      <em>${play.skillName}</em>
    </div>
  `).join("");

  const damages = data.lastTurn.damages;
  const totalToYou = damages.filter(item => item.targetId === data.you.id).reduce((sum, item) => sum + item.amount, 0);
  const totalToOpponent = damages.filter(item => item.targetId === data.opponent.id).reduce((sum, item) => sum + item.amount, 0);
  const totalHtml = `
    <div class="damage-total">
      <span>合計</span>
      <strong>自分 ${totalToYou} / 相手 ${totalToOpponent}</strong>
    </div>
  `;
  $("#damageSummary").innerHTML = damages.length ? totalHtml + damages.map(item => {
    const side = item.targetId === data.you.id ? "to-me" : "to-them";
    const target = item.targetId === data.you.id ? "自分" : "相手";
    const attrs = attrsLabel(item.attrs || []).join("・") || "無";
    const reduced = item.reductions?.length
      ? item.reductions.map(part => `${part.label}で-${part.amount}`).join(" / ")
      : "軽減なし";
    const raw = Number.isFinite(item.rawAmount) ? item.rawAmount : item.amount;
    return `
      <div class="damage-row ${side}">
        <span>${item.label}</span>
        <strong>${target}に${item.amount}ダメージ</strong>
        <small>元${raw} / ${attrs} / ${reduced}</small>
      </div>
    `;
  }).join("") : `<div class="damage-row"><span>ダメージなし</span><strong>0</strong><small>両者防ぎ切った</small></div>`;
  const breaks = data.lastTurn.breaks || [];
  const chains = data.lastTurn.chainBreaks || [];
  const overs = data.lastTurn.overBreak || [];
  $("#breakSummary").innerHTML = [...chains.map(chain => `
    <div class="break-line chain">CHAIN BREAK x${chain.count}<small>${chain.playerName}</small></div>
  `), ...breaks.map(item => `
    <div class="break-line ${breakClass(item.label)}">${item.label}<small>${item.playerName} / ${item.reason}</small></div>
  `), ...overs.map(item => `
    <div class="break-line over-break">OVER BREAK<small>${item.playerName}</small></div>
  `)].join("");
  panel.classList.remove("hidden");
}

function showResultModal(data) {
  if (data.status !== "finished" || state.resultModalGameId === data.gameId) return;
  state.resultModalGameId = data.gameId;
  const isDraw = !data.winnerId;
  const isWin = data.winnerId === data.you.id;
  const isOverBreak = data.lastTurn?.overBreak?.some(item => item.playerId === data.winnerId);
  $("#resultImage").src = isOverBreak ? breakImages["OVER BREAK"] : "/picture/title.png";
  $("#resultImage").classList.remove("hidden");
  $("#resultKicker").textContent = isDraw ? "Draw" : isWin ? "Victory" : "Defeat";
  $("#resultTitle").textContent = isDraw ? "引き分け" : isWin ? "勝利" : "敗北";
  $("#resultText").textContent = data.resultText;
  $("#resultModal").classList.remove("hidden");
}

function showBreakOverlay(imageSrc, text, subText) {
  const overlay = $("#breakOverlay");
  $("#breakOverlayImage").src = imageSrc;
  $("#breakOverlayText").textContent = text;
  $("#breakOverlaySub").textContent = subText || "";
  overlay.classList.remove("hidden");
  overlay.classList.remove("burst");
  void overlay.offsetWidth;
  overlay.classList.add("burst");
  window.setTimeout(() => overlay.classList.add("hidden"), 1500);
}

function maybeShowBreakAnimation(data) {
  if (!data.lastTurn) return;
  const breaks = data.lastTurn.breaks || [];
  const chains = data.lastTurn.chainBreaks || [];
  const overs = data.lastTurn.overBreak || [];
  if (!breaks.length && !chains.length && !overs.length) return;
  const key = `${data.gameId}:${data.lastTurn.turn}:${breaks.length}:${chains.map(c => c.count).join(",")}:${overs.length}`;
  if (state.lastBreakAnimationKey === key) return;
  state.lastBreakAnimationKey = key;

  if (overs.length) {
    const mine = overs.find(item => item.playerId === data.you.id) || overs[0];
    showBreakOverlay(breakImages["OVER BREAK"], "OVER BREAK", mine.playerName);
    return;
  }
  if (chains.length) {
    const chain = chains[0];
    showBreakOverlay(breakImages.CHAIN, `CHAIN BREAK x${chain.count}`, chain.playerName);
    return;
  }
  const strongest = breaks.reduce((best, item) => (item.count > best.count ? item : best), breaks[0]);
  showBreakOverlay(breakImages[strongest.label] || breakImages.BREAK, strongest.label, `${strongest.playerName} / ${strongest.reason}`);
}

function renderBattle(data) {
  state.currentBattle = data;
  showView("battle");
  const you = data.you;
  const opponent = data.opponent;
  if (data.youReady && data.yourAction) {
    state.selectedNormal = data.yourAction.normalId;
    state.selectedSkill = data.yourAction.skillId || null;
  }
  $("#turnText").textContent = data.turn;
  $("#youName").textContent = you.name;
  $("#opponentName").textContent = opponent.name;
  $("#youHp").textContent = you.hp;
  $("#opponentHp").textContent = opponent.hp;
  $("#youHpBar").style.width = hpWidth(you.hp);
  $("#opponentHpBar").style.width = hpWidth(opponent.hp);
  $("#youBreak").textContent = you.breakLabel;
  $("#opponentBreak").textContent = opponent.breakLabel;
  $("#youBreak").className = `break-badge ${breakClass(you.breakLabel)}`;
  $("#opponentBreak").className = `break-badge ${breakClass(opponent.breakLabel)}`;
  $("#youStreak").textContent = `連続 ${you.normalHitStreak}`;
  $("#opponentStreak").textContent = `連続 ${opponent.normalHitStreak}`;
  $("#youRole").textContent = you.roleName;
  $("#opponentRole").textContent = `${opponent.roleName} / ${sortNormalCards(opponent.normalCards).map(card => card.name).join("・")}`;
  renderEffects($("#youEffects"), you.effects, you.holyShields);
  renderEffects($("#opponentEffects"), opponent.effects, opponent.holyShields);
  $("#readyState").textContent = data.youReady
    ? "自分: 決定済み"
    : data.opponentReady
      ? "相手: 決定済み"
      : "選択中";
  $("#readyState").classList.toggle("ready", data.youReady || data.opponentReady);

  const sortedYouNormals = sortNormalCards(you.normalCards);
  const sortedOpponentNormals = sortNormalCards(opponent.normalCards);
  const availableNormals = sortedYouNormals.filter(card => !card.used);
  if (!availableNormals.some(card => card.instanceId === state.selectedNormal)) state.selectedNormal = null;
  if (state.selectedSkill && !you.skills.some(skill => skill.id === state.selectedSkill && !skill.used)) {
    state.selectedSkill = null;
  }

  if (data.status === "finished") {
    setStatus(data.resultText);
    $("#submitActionButton").disabled = true;
    $("#submitActionButton").textContent = "対戦終了";
  } else if (data.waitingForOpponent) {
    setStatus("相手の行動待ちです");
    $("#submitActionButton").disabled = false;
    $("#submitActionButton").textContent = "選択を変更する";
  } else {
    setStatus(data.opponentReady ? `Turn ${data.turn} 相手は決定済み` : `Turn ${data.turn} 行動選択`);
    $("#submitActionButton").disabled = !state.selectedNormal;
    $("#submitActionButton").textContent = "行動を決定";
  }
  $("#selectedNormalText").textContent = selectedNormalName(sortedYouNormals);
  $("#selectedSkillText").textContent = selectedSkillName(you.skills);
  $("#battleNormalGrid").innerHTML = sortedYouNormals.map(card => `
    <button class="battle-card ${state.selectedNormal === card.instanceId ? "selected" : ""}" data-pick-normal="${card.instanceId}" ${card.used || data.waitingForOpponent || data.status === "finished" ? "disabled" : ""}>
      <strong>${card.name}</strong>
      ${cardStats(card)}
      ${normalEffectTag(card)}
    </button>
  `).join("");

  const skillsHtml = [
    `<button class="battle-skill ${state.selectedSkill === null ? "selected" : ""}" data-pick-skill="" ${data.waitingForOpponent || data.status === "finished" ? "disabled" : ""}>
      <div class="skill-top"><strong>スキルなし</strong><span class="pill">C 0</span></div>
      <p>通常カードだけで行動します。</p>
    </button>`,
    ...you.skills.map(skill => `
      <button class="battle-skill ${state.selectedSkill === skill.id ? "selected" : ""}" data-pick-skill="${skill.id}" ${skill.used || data.waitingForOpponent || data.status === "finished" ? "disabled" : ""}>
        <div class="skill-top">
          <strong>${skill.name}</strong>
          <span class="pill">${skill.used ? "使用済み" : `C ${skill.cost}`}</span>
        </div>
        <p>${skill.text}</p>
        <div class="tag-row">${attrsLabel(skill.attrs).map(tag => `<span class="tag">${tag}</span>`).join("")}</div>
      </button>
    `)
  ].join("");
  $("#battleSkillGrid").innerHTML = skillsHtml;
  renderBattleTabs();

  $("#opponentNormalGrid").innerHTML = sortedOpponentNormals.map(card => `
    <div class="mini-card ${card.used ? "used" : ""}">
      <b>${card.name}</b>
      <span>A${card.atk} D${card.def}</span>
      <span>C${card.cost}</span>
    </div>
  `).join("");

  $("#logList").innerHTML = data.log.slice().reverse().map(line => `<div class="log-line">${line}</div>`).join("");
  renderTurnResult(data);
  maybeShowBreakAnimation(data);
  showResultModal(data);
}

async function ensureSession() {
  if (state.playerId) return state.playerId;
  const data = await api("/api/session", { method: "POST", body: "{}" });
  state.playerId = data.playerId;
  localStorage.setItem("hpDuelPlayerId", state.playerId);
  return state.playerId;
}

async function queue() {
  $("#builderError").textContent = "";
  await ensureSession();
  const payload = {
    playerId: state.playerId,
    name: $("#playerName").value || "Player",
    deck: {
      role: state.selectedRole,
      normalCards: state.normalCards,
      skills: [...state.skills]
    }
  };
  const data = await api("/api/queue", { method: "POST", body: JSON.stringify(payload) });
  setStatus(data.status === "matched" ? "マッチング成立" : "待機中");
  showView(data.status === "matched" ? "battle" : "waiting");
  startPolling();
}

function startPolling() {
  clearInterval(state.pollTimer);
  pollState();
  state.pollTimer = setInterval(pollState, 1100);
}

async function pollState() {
  if (!state.playerId) return;
  try {
    const data = await api(`/api/state?playerId=${encodeURIComponent(state.playerId)}`);
    if (data.status === "waiting") {
      showView("waiting");
      setStatus("待機中");
      return;
    }
    if (data.status === "active" || data.status === "finished") {
      if (state.lastGameId !== data.gameId) {
        state.selectedNormal = null;
        state.selectedSkill = null;
        state.lastGameId = data.gameId;
        state.lastBreakAnimationKey = null;
      }
      renderBattle(data);
      return;
    }
    showView("builder");
  } catch (error) {
    $("#battleError").textContent = error.message;
  }
}

async function submitAction() {
  $("#battleError").textContent = "";
  if (state.currentBattle?.waitingForOpponent) {
    try {
      const data = await api("/api/action", {
        method: "POST",
        body: JSON.stringify({
          playerId: state.playerId,
          cancel: true
        })
      });
      if (data.yourAction) {
        state.selectedNormal = data.yourAction.normalId;
        state.selectedSkill = data.yourAction.skillId || null;
      }
      renderBattle(data);
    } catch (error) {
      $("#battleError").textContent = error.message;
    }
    return;
  }
  if (!state.selectedNormal) {
    $("#battleError").textContent = "通常カードを選んでください。";
    return;
  }
  try {
    const data = await api("/api/action", {
      method: "POST",
      body: JSON.stringify({
        playerId: state.playerId,
        normalId: state.selectedNormal,
        skillId: state.selectedSkill
      })
    });
    if (data.waitingForOpponent && data.yourAction) {
      state.selectedNormal = data.yourAction.normalId;
      state.selectedSkill = data.yourAction.skillId || null;
    } else {
      state.selectedNormal = null;
      state.selectedSkill = null;
    }
    renderBattle(data);
  } catch (error) {
    $("#battleError").textContent = error.message;
  }
}

async function leaveQueue() {
  $("#resultModal").classList.add("hidden");
  if (state.playerId) {
    await api("/api/leave", { method: "POST", body: JSON.stringify({ playerId: state.playerId }) });
    localStorage.removeItem("hpDuelPlayerId");
    state.playerId = null;
  }
  clearInterval(state.pollTimer);
  state.currentBattle = null;
  state.lastGameId = null;
  state.selectedNormal = null;
  state.selectedSkill = null;
  setStatus("デッキを編成してください");
  showView("builder");
}

document.addEventListener("click", event => {
  const roleButton = event.target.closest("[data-role]");
  if (roleButton) {
    state.selectedRole = roleButton.dataset.role;
    for (const skillId of [...state.skills]) {
      if (!skillAllowedForRole(state.catalog.skills[skillId])) state.skills.delete(skillId);
    }
    renderBuilder();
    return;
  }

  const normalButton = event.target.closest("[data-normal]");
  if (normalButton) {
    if (state.normalCards.length < 7) state.normalCards.push(normalButton.dataset.normal);
    sortDeckNormals();
    renderBuilder();
    return;
  }

  const removeNormal = event.target.closest("[data-remove-normal]");
  if (removeNormal) {
    state.normalCards.splice(Number(removeNormal.dataset.removeNormal), 1);
    renderBuilder();
    return;
  }

  const skillButton = event.target.closest("[data-skill]");
  if (skillButton && !skillButton.disabled) {
    const skillId = skillButton.dataset.skill;
    if (state.skills.has(skillId)) state.skills.delete(skillId);
    else state.skills.add(skillId);
    renderBuilder();
    return;
  }

  const pickNormal = event.target.closest("[data-pick-normal]");
  if (pickNormal && !pickNormal.disabled) {
    state.selectedNormal = pickNormal.dataset.pickNormal;
    pollState();
    return;
  }

  const pickSkill = event.target.closest("[data-pick-skill]");
  if (pickSkill && !pickSkill.disabled) {
    state.selectedSkill = pickSkill.dataset.pickSkill || null;
    pollState();
    return;
  }

  const battleTab = event.target.closest("[data-battle-tab]");
  if (battleTab) {
    state.activeBattleTab = battleTab.dataset.battleTab;
    renderBattleTabs();
  }
});

$("#queueButton").addEventListener("click", () => queue().catch(error => {
  $("#builderError").textContent = error.message;
}));
$("#resetNormalButton").addEventListener("click", () => {
  state.normalCards = [];
  renderBuilder();
});
$("#resetSkillButton").addEventListener("click", () => {
  state.skills.clear();
  renderBuilder();
});
$("#cancelQueueButton").addEventListener("click", () => leaveQueue().catch(() => {}));
$("#submitActionButton").addEventListener("click", submitAction);
$("#returnBuilderButton").addEventListener("click", () => leaveQueue().catch(() => {}));

(async function init() {
  state.catalog = await api("/api/catalog");
  renderBuilder();
  if (state.playerId) startPolling();
})();
