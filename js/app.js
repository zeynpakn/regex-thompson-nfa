let stateCounter = 0;
let steps = [];
let currentStepIndex = 0;
let currentNFA = null;
let simulationSteps = [];
let currentSimulationStepIndex = 0;

class NFA {
  constructor(start, accept, transitions, expression) {
    this.start = start;
    this.accept = accept;
    this.transitions = transitions;
    this.expression = expression;
  }
}

function newState() {
  return "q" + stateCounter++;
}

function isSymbol(ch) {
  return /[a-zA-Z0-9]/.test(ch);
}

function cloneTransitions(transitions) {
  return transitions.map(t => ({
    from: t.from,
    to: t.to,
    symbol: t.symbol
  }));
}

function saveStep(title, description, nfa, operation) {
  steps.push({
    title,
    description,
    operation,
    nfa: new NFA(
      nfa.start,
      nfa.accept,
      cloneTransitions(nfa.transitions),
      nfa.expression
    )
  });
}

function setExample(regex) {
  document.getElementById("regexInput").value = regex;
  convertRegex();
}

function addConcat(regex) {
  let result = "";

  for (let i = 0; i < regex.length; i++) {
    let current = regex[i];
    let next = regex[i + 1];

    result += current;

    if (!next) continue;

    if (
      (isSymbol(current) || current === ")" || current === "*") &&
      (isSymbol(next) || next === "(")
    ) {
      result += ".";
    }
  }

  return result;
}

function precedence(op) {
  if (op === "*") return 3;
  if (op === ".") return 2;
  if (op === "|") return 1;
  return 0;
}

function toPostfix(regex) {
  let output = "";
  let stack = [];

  for (let ch of regex) {
    if (isSymbol(ch)) {
      output += ch;
    }

    else if (ch === "(") {
      stack.push(ch);
    }

    else if (ch === ")") {
      while (stack.length && stack[stack.length - 1] !== "(") {
        output += stack.pop();
      }

      if (!stack.length) {
        throw new Error("Parantez hatası var.");
      }

      stack.pop();
    }

    else if (ch === "*" || ch === "." || ch === "|") {
      while (
        stack.length &&
        stack[stack.length - 1] !== "(" &&
        precedence(stack[stack.length - 1]) >= precedence(ch)
      ) {
        output += stack.pop();
      }

      stack.push(ch);
    }

    else {
      throw new Error("Geçersiz karakter: " + ch);
    }
  }

  while (stack.length) {
    let op = stack.pop();

    if (op === "(" || op === ")") {
      throw new Error("Parantez hatası var.");
    }

    output += op;
  }

  return output;
}

function symbolNFA(symbol) {
  let start = newState();
  let accept = newState();

  let nfa = new NFA(start, accept, [
    {
      from: start,
      to: accept,
      symbol: symbol
    }
  ], symbol);

  saveStep(
    "Sembol NFA oluşturuldu",
    `"${symbol}" sembolü için iki durumlu küçük bir NFA oluşturuldu.`,
    nfa,
    "symbol"
  );

  return nfa;
}

function concatNFA(nfa1, nfa2) {
  let expression = nfa1.expression + nfa2.expression;

  let transitions = [
    ...nfa1.transitions,
    ...nfa2.transitions,
    {
      from: nfa1.accept,
      to: nfa2.start,
      symbol: "ε"
    }
  ];

  let nfa = new NFA(nfa1.start, nfa2.accept, transitions, expression);

  saveStep(
    "Concatenation uygulandı",
    `"${nfa1.expression}" ve "${nfa2.expression}" NFA'ları ε geçişi ile ardışık bağlandı.`,
    nfa,
    "concat"
  );

  return nfa;
}

function unionNFA(nfa1, nfa2) {
  let start = newState();
  let accept = newState();

  let expression = "(" + nfa1.expression + "|" + nfa2.expression + ")";

  let transitions = [
    {
      from: start,
      to: nfa1.start,
      symbol: "ε"
    },
    {
      from: start,
      to: nfa2.start,
      symbol: "ε"
    },
    ...nfa1.transitions,
    ...nfa2.transitions,
    {
      from: nfa1.accept,
      to: accept,
      symbol: "ε"
    },
    {
      from: nfa2.accept,
      to: accept,
      symbol: "ε"
    }
  ];

  let nfa = new NFA(start, accept, transitions, expression);

  saveStep(
    "Union işlemi uygulandı",
    `"${nfa1.expression}" veya "${nfa2.expression}" seçilebilsin diye yeni başlangıç ve yeni kabul durumu eklendi.`,
    nfa,
    "union"
  );

  return nfa;
}

function starNFA(nfaOld) {
  let start = newState();
  let accept = newState();

  let expression = "(" + nfaOld.expression + ")*";

  let transitions = [
    {
      from: start,
      to: nfaOld.start,
      symbol: "ε"
    },
    {
      from: start,
      to: accept,
      symbol: "ε"
    },
    ...nfaOld.transitions,
    {
      from: nfaOld.accept,
      to: nfaOld.start,
      symbol: "ε"
    },
    {
      from: nfaOld.accept,
      to: accept,
      symbol: "ε"
    }
  ];

  let nfa = new NFA(start, accept, transitions, expression);

  saveStep(
    "Kleene Star işlemi uygulandı",
    `"${nfaOld.expression}" ifadesi 0 veya daha fazla tekrar edebilsin diye ε döngüleri eklendi.`,
    nfa,
    "star"
  );

  return nfa;
}

function postfixToNFA(postfix) {
  let stack = [];

  for (let ch of postfix) {
    if (isSymbol(ch)) {
      stack.push(symbolNFA(ch));
    }

    else if (ch === "*") {
      if (stack.length < 1) {
        throw new Error("Kleene star için operand eksik.");
      }

      let nfa = stack.pop();
      stack.push(starNFA(nfa));
    }

    else if (ch === ".") {
      if (stack.length < 2) {
        throw new Error("Concatenation için operand eksik.");
      }

      let nfa2 = stack.pop();
      let nfa1 = stack.pop();

      stack.push(concatNFA(nfa1, nfa2));
    }

    else if (ch === "|") {
      if (stack.length < 2) {
        throw new Error("Union için operand eksik.");
      }

      let nfa2 = stack.pop();
      let nfa1 = stack.pop();

      stack.push(unionNFA(nfa1, nfa2));
    }
  }

  if (stack.length !== 1) {
    throw new Error("Regex yapısı hatalı.");
  }

  return stack.pop();
}

function getAllStates(nfa) {
  let states = new Set();

  states.add(nfa.start);
  states.add(nfa.accept);

  for (let t of nfa.transitions) {
    states.add(t.from);
    states.add(t.to);
  }

  return Array.from(states).sort((a, b) => {
    return Number(a.slice(1)) - Number(b.slice(1));
  });
}

function createDot(nfa, activeStates = [], highlightedTransitions = []) {
  let states = getAllStates(nfa);

  let activeSet = new Set(activeStates);

  function isHighlightedTransition(t) {
    return highlightedTransitions.some(h =>
      h.from === t.from &&
      h.to === t.to &&
      h.symbol === t.symbol
    );
  }

  let dot = `
    digraph NFA {
      rankdir=LR;

      graph [
        bgcolor="transparent",
        pad="0.35",
        nodesep="0.65",
        ranksep="0.85"
      ];

      node [
        shape=circle,
        fontsize=14,
        fontname="Arial",
        color="#d95e98",
        penwidth=2,
        fontcolor="#4a2d43",
        style=filled,
        fillcolor="#fff7fb"
      ];

      edge [
        fontsize=13,
        fontname="Arial",
        color="#b83373",
        fontcolor="#8a285d",
        penwidth=1.6
      ];

      fakeStart [shape=point, color="#c94f87"];
      fakeStart -> ${nfa.start};

      ${nfa.accept} [
        shape=doublecircle,
        fillcolor="${activeSet.has(nfa.accept) ? "#f9a8d4" : "#ffe4ef"}",
        color="${activeSet.has(nfa.accept) ? "#9d174d" : "#c94f87"}",
        penwidth="${activeSet.has(nfa.accept) ? "4" : "2.5"}"
      ];
  `;

  for (let state of states) {
    if (state !== nfa.accept) {
      if (activeSet.has(state)) {
        dot += `
          ${state} [
            shape=circle,
            fillcolor="#f9a8d4",
            color="#9d174d",
            penwidth=4,
            fontcolor="#4a044e"
          ];
        `;
      } else {
        dot += `${state} [shape=circle];\n`;
      }
    }
  }

  for (let t of nfa.transitions) {
    if (isHighlightedTransition(t)) {
      dot += `
        ${t.from} -> ${t.to} [
          label="${t.symbol}",
          color="#9d174d",
          fontcolor="#9d174d",
          penwidth=4
        ];
      `;
    } else {
      dot += `${t.from} -> ${t.to} [label="${t.symbol}"];\n`;
    }
  }

  dot += "}";

  return dot;
}

async function renderNFA(
  nfa,
  targetElement,
  activeStates = [],
  highlightedTransitions = []
) {
  const viz = new Viz();

  const dot = createDot(nfa, activeStates, highlightedTransitions);
  const svg = await viz.renderSVGElement(dot);

  targetElement.innerHTML = "";
  targetElement.appendChild(svg);
}

async function renderSteps() {
  const stepsDiv = document.getElementById("steps");
  stepsDiv.innerHTML = "";

  if (steps.length === 0) {
    document.getElementById("stepCounter").textContent = "Adım 0 / 0";
    return;
  }

  const step = steps[currentStepIndex];

  const card = document.createElement("div");
  card.className = "step-card";

  const header = document.createElement("div");
  header.className = "step-header";

  const title = document.createElement("div");
  title.className = "step-title";
  title.textContent =
    "Adım " + (currentStepIndex + 1) + ": " + step.title;

  const badge = document.createElement("div");
  badge.className = "badge";
  badge.textContent = "İfade: " + step.nfa.expression;

  const desc = document.createElement("div");
  desc.className = "step-desc";
  desc.textContent = step.description;

  const graph = document.createElement("div");
  graph.className = "step-graph";

  header.appendChild(title);
  header.appendChild(badge);

  card.appendChild(header);
  card.appendChild(desc);
  card.appendChild(graph);

  stepsDiv.appendChild(card);

  document.getElementById("stepCounter").textContent =
    "Adım " + (currentStepIndex + 1) + " / " + steps.length;

  await renderNFA(step.nfa, graph);
}

function nextStep() {
  if (currentStepIndex < steps.length - 1) {
    currentStepIndex++;
    renderSteps();
  }
}

function previousStep() {
  if (currentStepIndex > 0) {
    currentStepIndex--;
    renderSteps();
  }
}

function renderNFAStats(nfa, regexInput, regexWithConcat, postfix) {
  const statsDiv = document.getElementById("nfaStats");
  const states = getAllStates(nfa);

  statsDiv.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Başlangıç Durumu</div>
      <div class="stat-value">${nfa.start}</div>
    </div>

    <div class="stat-card">
      <div class="stat-label">Kabul Durumu</div>
      <div class="stat-value">${nfa.accept}</div>
    </div>

    <div class="stat-card">
      <div class="stat-label">Toplam State</div>
      <div class="stat-value">${states.length}</div>
    </div>

    <div class="stat-card">
      <div class="stat-label">Toplam Geçiş</div>
      <div class="stat-value">${nfa.transitions.length}</div>
    </div>

    <div class="stat-card">
      <div class="stat-label">Postfix Regex</div>
      <div class="stat-value" style="font-size: 18px;">${postfix}</div>
    </div>
  `;
}

function renderTransitionTable(nfa) {
  const tableBody = document.getElementById("transitionTableBody");
  tableBody.innerHTML = "";

  for (let transition of nfa.transitions) {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td><span class="state-pill">${transition.from}</span></td>
      <td><span class="symbol-pill">${transition.symbol}</span></td>
      <td><span class="state-pill">${transition.to}</span></td>
    `;

    tableBody.appendChild(row);
  }
}

async function convertRegex() {
  const regexInput = document.getElementById("regexInput").value.trim();
  const activeRegexValue = document.getElementById("activeRegexValue");

  if (activeRegexValue) {
    activeRegexValue.textContent = regexInput || "-";
  }

  const errorDiv = document.getElementById("error");
  const stepsDiv = document.getElementById("steps");

  errorDiv.textContent = "";
  stepsDiv.innerHTML = "";

  document.getElementById("nfaStats").innerHTML = "";
  document.getElementById("transitionTableBody").innerHTML = "";
  document.getElementById("simulationGraph").innerHTML = "";

  try {
    if (!regexInput) {
      throw new Error("Regex boş olamaz.");
    }

    stateCounter = 0;
    steps = [];
    currentStepIndex = 0;

    const regexWithConcat = addConcat(regexInput);
    const postfix = toPostfix(regexWithConcat);
    const nfa = postfixToNFA(postfix);

    currentNFA = nfa;

    document.getElementById("simulationResult").textContent = "";
    document.getElementById("simulationResult").className = "simulation-result";
    document.getElementById("simulationSteps").innerHTML = "";
    document.getElementById("simulationStepCounter").textContent = "Adım 0 / 0";
    simulationSteps = [];
    currentSimulationStepIndex = 0;

    await renderSteps();

    renderNFAStats(nfa, regexInput, regexWithConcat, postfix);
    renderTransitionTable(nfa);

  } catch (err) {
    errorDiv.textContent = err.message;
  }
}

function epsilonClosure(states, nfa) {
  let closure = new Set(states);
  let stack = [...states];

  while (stack.length > 0) {
    let currentState = stack.pop();

    let epsilonTransitions = nfa.transitions.filter(t =>
      t.from === currentState && t.symbol === "ε"
    );

    for (let transition of epsilonTransitions) {
      if (!closure.has(transition.to)) {
        closure.add(transition.to);
        stack.push(transition.to);
      }
    }
  }

  return closure;
}

function epsilonClosureWithTransitions(states, nfa) {
  let closure = new Set(states);
  let stack = [...states];
  let usedTransitions = [];

  while (stack.length > 0) {
    let currentState = stack.pop();

    let epsilonTransitions = nfa.transitions.filter(t =>
      t.from === currentState && t.symbol === "ε"
    );

    for (let transition of epsilonTransitions) {
      usedTransitions.push(transition);

      if (!closure.has(transition.to)) {
        closure.add(transition.to);
        stack.push(transition.to);
      }
    }
  }

  return {
    closure,
    usedTransitions
  };
}

function move(states, symbol, nfa) {
  let result = new Set();

  for (let state of states) {
    let validTransitions = nfa.transitions.filter(t =>
      t.from === state && t.symbol === symbol
    );

    for (let transition of validTransitions) {
      result.add(transition.to);
    }
  }

  return result;
}

function getTransitionsFromStates(states, symbol, nfa) {
  let usedTransitions = [];

  for (let state of states) {
    let validTransitions = nfa.transitions.filter(t =>
      t.from === state && t.symbol === symbol
    );

    for (let transition of validTransitions) {
      usedTransitions.push(transition);
    }
  }

  return usedTransitions;
}

function setToSortedArray(setValue) {
  return Array.from(setValue).sort((a, b) => {
    return Number(a.slice(1)) - Number(b.slice(1));
  });
}

function simulateInputString() {
  const inputString = document.getElementById("testStringInput").value.trim();
  const resultDiv = document.getElementById("simulationResult");

  if (!currentNFA) {
    resultDiv.textContent = "Önce regex'i NFA'ya çevirmen gerekiyor.";
    resultDiv.className = "simulation-result rejected";
    return;
  }

  simulationSteps = [];
  currentSimulationStepIndex = 0;

  let startClosureResult = epsilonClosureWithTransitions(
    new Set([currentNFA.start]),
    currentNFA
  );

  let currentStates = startClosureResult.closure;

  simulationSteps.push({
    title: "Başlangıç ε-closure hesaplandı",
    readSymbol: "Henüz sembol okunmadı",
    beforeStates: [currentNFA.start],
    afterMoveStates: [],
    afterClosureStates: setToSortedArray(currentStates),
    highlightedTransitions: startClosureResult.usedTransitions,
    description: `Başlangıç state'i ${currentNFA.start}. Input okumadan önce ε geçişleriyle ulaşılabilen tüm state'ler hesaplandı.`
  });

  for (let i = 0; i < inputString.length; i++) {
    let symbol = inputString[i];

    let beforeStates = setToSortedArray(currentStates);

    let symbolTransitions = getTransitionsFromStates(
      currentStates,
      symbol,
      currentNFA
    );

    let movedStates = move(currentStates, symbol, currentNFA);
    let afterMoveStates = setToSortedArray(movedStates);

    let closureResult = epsilonClosureWithTransitions(movedStates, currentNFA);

    currentStates = closureResult.closure;

    let afterClosureStates = setToSortedArray(currentStates);

    simulationSteps.push({
      title: `"${symbol}" sembolü okundu`,
      readSymbol: symbol,
      beforeStates,
      afterMoveStates,
      afterClosureStates,
      highlightedTransitions: [
        ...symbolTransitions,
        ...closureResult.usedTransitions
      ],
      description: `Aktif state'lerden "${symbol}" sembolü ile gidilebilen state'ler bulundu. Sonra bu state'lerden ε-closure hesaplandı.`
    });
  }

  let finalStates = setToSortedArray(currentStates);
  let accepted = currentStates.has(currentNFA.accept);

  simulationSteps.push({
    title: "Son kabul kontrolü",
    readSymbol: "Input bitti",
    beforeStates: finalStates,
    afterMoveStates: [],
    afterClosureStates: finalStates,
    highlightedTransitions: [],
    description: accepted
      ? `Son aktif state kümesi kabul durumu olan ${currentNFA.accept} state'ini içeriyor. Bu yüzden string kabul edildi.`
      : `Son aktif state kümesi kabul durumu olan ${currentNFA.accept} state'ini içermiyor. Bu yüzden string reddedildi.`
  });

  if (accepted) {
    resultDiv.textContent = `"${inputString}" string'i NFA tarafından KABUL EDİLDİ.`;
    resultDiv.className = "simulation-result accepted";
  } else {
    resultDiv.textContent = `"${inputString}" string'i NFA tarafından REDDEDİLDİ.`;
    resultDiv.className = "simulation-result rejected";
  }

  renderSimulationStep();
}

function renderSimulationStep() {
  const simulationDiv = document.getElementById("simulationSteps");
  const counter = document.getElementById("simulationStepCounter");

  simulationDiv.innerHTML = "";

  if (simulationSteps.length === 0) {
    counter.textContent = "Adım 0 / 0";
    return;
  }

  const step = simulationSteps[currentSimulationStepIndex];

  counter.textContent =
    "Adım " + (currentSimulationStepIndex + 1) + " / " + simulationSteps.length;

  const card = document.createElement("div");
  card.className = "simulation-card";

  card.innerHTML = `
    <div class="step-header">
      <div class="step-title">
        Simülasyon Adımı ${currentSimulationStepIndex + 1}: ${step.title}
      </div>
      <div class="badge">Okunan: ${step.readSymbol}</div>
    </div>

    <div class="simulation-row">
      <span class="simulation-label">Açıklama:</span>
      ${step.description}
    </div>

    <div class="simulation-row">
      <span class="simulation-label">Sembol okunmadan önce aktif state'ler:</span>
      ${renderStatePills(step.beforeStates)}
    </div>

    <div class="simulation-row">
      <span class="simulation-label">Sembol ile gidilen state'ler:</span>
      ${step.afterMoveStates.length > 0 ? renderStatePills(step.afterMoveStates) : "∅"}
    </div>

    <div class="simulation-row">
      <span class="simulation-label">ε-closure sonrası aktif state'ler:</span>
      ${renderStatePills(step.afterClosureStates)}
    </div>
  `;

  simulationDiv.appendChild(card);

  const simulationGraph = document.getElementById("simulationGraph");

  renderNFA(
    currentNFA,
    simulationGraph,
    step.afterClosureStates,
    step.highlightedTransitions
  );
}

function renderStatePills(states) {
  if (!states || states.length === 0) {
    return "∅";
  }

  return `
    <div class="active-state-list">
      ${states.map(state => `
        <span class="active-state-pill">${state}</span>
      `).join("")}
    </div>
  `;
}

function nextSimulationStep() {
  if (currentSimulationStepIndex < simulationSteps.length - 1) {
    currentSimulationStepIndex++;
    renderSimulationStep();
  }
}

function previousSimulationStep() {
  if (currentSimulationStepIndex > 0) {
    currentSimulationStepIndex--;
    renderSimulationStep();
  }
}

window.onload = convertRegex;

function openMainTab(tabName) {
  const editorTab = document.getElementById("editorTab");
  const simulationTab = document.getElementById("simulationTab");
  const transitionsTab = document.getElementById("transitionsTab");

  const editorTabBtn = document.getElementById("editorTabBtn");
  const simulationTabBtn = document.getElementById("simulationTabBtn");
  const transitionsTabBtn = document.getElementById("transitionsTabBtn");

  editorTab.classList.remove("active");
  simulationTab.classList.remove("active");
  transitionsTab.classList.remove("active");

  editorTabBtn.classList.remove("active");
  simulationTabBtn.classList.remove("active");
  transitionsTabBtn.classList.remove("active");

  if (tabName === "editorTab") {
    editorTab.classList.add("active");
    editorTabBtn.classList.add("active");
  }

  if (tabName === "simulationTab") {
    simulationTab.classList.add("active");
    simulationTabBtn.classList.add("active");
  }

  if (tabName === "transitionsTab") {
    transitionsTab.classList.add("active");
    transitionsTabBtn.classList.add("active");
  }
}

function loadRegexFromFile(event) {
  const file = event.target.files[0];
  const regexInput = document.getElementById("regexInput");
  const fileInfo = document.getElementById("fileInfo");

  fileInfo.textContent = "";
  fileInfo.className = "file-info";

  if (!file) {
    return;
  }

  const fileName = file.name.toLowerCase();

  if (!fileName.endsWith(".txt") && !fileName.endsWith(".json")) {
    fileInfo.textContent = "Sadece .txt veya .json dosyası yüklenebilir.";
    fileInfo.className = "file-info error";
    return;
  }

  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const content = e.target.result.trim();

      if (!content) {
        throw new Error("Dosya boş görünüyor.");
      }

      let regex = "";

      if (fileName.endsWith(".txt")) {
        regex = content.split(/\r?\n/)[0].trim();
      }

      if (fileName.endsWith(".json")) {
        const jsonData = JSON.parse(content);

        if (typeof jsonData === "string") {
          regex = jsonData.trim();
        } else if (jsonData.regex) {
          regex = String(jsonData.regex).trim();
        } else if (jsonData.expression) {
          regex = String(jsonData.expression).trim();
        } else if (jsonData.regularExpression) {
          regex = String(jsonData.regularExpression).trim();
        } else {
          throw new Error(
            'JSON içinde "regex", "expression" veya "regularExpression" alanı bulunamadı.'
          );
        }
      }

      if (!regex) {
        throw new Error("Regex değeri okunamadı.");
      }

      regexInput.value = regex;

      fileInfo.textContent = `Dosyadan regex yüklendi: ${regex}`;
      fileInfo.className = "file-info success";

      convertRegex();

    } catch (err) {
      fileInfo.textContent = "Dosya okunamadı: " + err.message;
      fileInfo.className = "file-info error";
    }
  };

  reader.onerror = function() {
    fileInfo.textContent = "Dosya okunurken bir hata oluştu.";
    fileInfo.className = "file-info error";
  };

  reader.readAsText(file);
}