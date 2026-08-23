import "./styles.css";
import { PHASES } from "./config.js";
import { TownSimulation } from "./simulation.js";

const app = document.querySelector("#app");
app.innerHTML = `
  <section class="town-shell">
    <header class="town-header">
      <div>
        <p class="eyebrow">Individual lives in a closed economy</p>
        <h1>Closed Loop Town</h1>
      </div>
      <div class="clock" id="clock"></div>
    </header>

    <section class="metrics" aria-label="Town statistics">
      <article><span>Money accounted for</span><strong id="money"></strong><small id="money-detail"></small></article>
      <article><span>Employment</span><strong id="employment"></strong><small id="employment-detail"></small></article>
      <article><span>Immediate hardship</span><strong id="hardship"></strong><small id="hardship-detail"></small></article>
    </section>

    <div class="stage-wrap">
      <canvas id="town" aria-label="Animated map of people and firms in the town"></canvas>
      <div class="legend" aria-hidden="true"><span><i class="person-dot"></i>Person</span><span><i class="firm-dot"></i>Firm</span><span><i class="cash-line"></i>Cash transfer</span></div>
    </div>

    <section class="person-card" aria-live="polite">
      <div class="person-heading">
        <label>Follow
          <select id="person-select"></select>
        </label>
        <span class="focus" id="focus"></span>
      </div>
      <p class="person-summary" id="person-summary"></p>
      <div class="needs" id="needs"></div>
      <ol class="ledger" id="ledger"></ol>
      <p class="events" id="events"></p>
    </section>

    <section class="control-panel">
      <div class="playback">
        <button id="pause" type="button">Pause</button>
        <button id="step" type="button">Step one phase</button>
        <button id="reset" type="button">Reset</button>
        <label>Speed
          <select id="speed"><option value="1800">Slow</option><option value="850" selected>Normal</option><option value="300">Fast</option></select>
        </label>
      </div>
      <details>
        <summary>Town policy</summary>
        <div class="policy-grid" id="policy-grid"></div>
      </details>
    </section>
  </section>
`;

const simulation = new TownSimulation();
let selected = simulation.people.findIndex((person) => person.name === "Sizwe");
let paused = false;
let lastStep = performance.now();
const canvas = document.querySelector("#town");
const context = canvas.getContext("2d");

const elements = Object.fromEntries([
  "clock", "money", "money-detail", "employment", "employment-detail", "hardship", "hardship-detail",
  "person-select", "focus", "person-summary", "needs", "ledger", "events", "pause", "step", "reset", "speed", "policy-grid",
].map((id) => [id, document.querySelector(`#${id}`)]));

const policyControls = [
  ["minimumWage", "Minimum wage", 3, 10, 0.2, (value) => value.toFixed(1)],
  ["taxRate", "Employer tax", 0, 35, 1, (value) => `${value}%`],
  ["supportRate", "Support budget", 0, 100, 1, (value) => `${value}%`],
  ["discretionaryDemand", "Discretionary demand", 0, 100, 1, (value) => `${value}%`],
  ["shockRisk", "Economic shocks", 0, 100, 1, (value) => `${value}%`],
];

function buildControls() {
  elements["person-select"].replaceChildren(...simulation.people.map((person) => {
    const option = document.createElement("option");
    option.value = person.id;
    option.textContent = person.name;
    return option;
  }));
  elements["person-select"].value = String(selected);

  elements["policy-grid"].replaceChildren(...policyControls.map(([name, label, min, max, step, format]) => {
    const wrapper = document.createElement("label");
    const heading = document.createElement("span");
    const output = document.createElement("output");
    const input = document.createElement("input");
    output.textContent = format(simulation.policy[name]);
    heading.textContent = label;
    heading.append(output);
    input.type = "range";
    Object.assign(input, { min, max, step, value: simulation.policy[name] });
    input.addEventListener("input", () => {
      simulation.setPolicy(name, input.value);
      output.textContent = format(Number(input.value));
    });
    wrapper.append(heading, input);
    return wrapper;
  }));
}

const money = (value) => value.toFixed(1);
const percent = (value) => `${Math.round(value * 100)}%`;
const needNames = { physiological: "Physiological", safety: "Safety", belonging: "Belonging", esteem: "Esteem", growth: "Self-actualization" };

function updateInterface() {
  const state = simulation.snapshot();
  const person = simulation.people[selected];
  const employer = person.employer >= 0 ? simulation.firms[person.employer].name : "no employer";
  const owned = simulation.firms.find((firm) => firm.active && firm.owner === person.id);
  const foodSeller = person.foodSeller >= 0 ? simulation.firms[person.foodSeller].name : "not yet chosen";
  const provider = person.housed
    ? (person.rentSeller >= 0 ? `housed through ${simulation.firms[person.rentSeller].name}` : "housed; no payment yet")
    : (person.rentSeller >= 0 ? `unhoused; last provider ${simulation.firms[person.rentSeller].name}` : "unhoused");

  elements.clock.textContent = `Day ${state.day} · ${state.phaseName}`;
  elements.money.textContent = `${(state.totalMoney / state.initialMoney * 100).toFixed(2)}%`;
  elements["money-detail"].textContent = `${money(state.totalMoney)} of ${money(state.initialMoney)} remains on ledgers`;
  elements.employment.textContent = `${Math.round(state.employed / simulation.people.length * 100)}%`;
  elements["employment-detail"].textContent = `${state.employed} employed · ${simulation.people.length - state.employed} seeking`;
  elements.hardship.textContent = state.hungry + state.unhoused;
  elements["hardship-detail"].textContent = `${state.hungry} without food · ${state.unhoused} without housing`;
  elements.focus.textContent = `${needNames[person.focus]} focus`;
  elements["person-summary"].textContent = `Works for: ${employer}${owned ? ` · owns: ${owned.name}` : ""} · current cash ${money(person.cash)} · runway ${simulation.runwayDays(person).toFixed(1)} days · stress ${percent(person.stress)} · health ${percent(person.health)} · food: ${foodSeller} · housing: ${provider}`;

  elements.needs.replaceChildren(...Object.entries(person.needs).map(([name, value]) => {
    const item = document.createElement("div");
    item.innerHTML = `<span>${needNames[name]} <b>${percent(value)}</b></span><div class="need-track" role="progressbar" aria-label="${needNames[name]}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(value * 100)}"><i style="width:${percent(value)}"></i></div>`;
    return item;
  }));

  elements.ledger.replaceChildren(...(person.ledger.slice(0, 5).map((entry) => {
    const item = document.createElement("li");
    item.className = entry.direction;
    item.innerHTML = `<time>D${entry.day}</time><span>${entry.direction === "in" ? "+" : "−"}${money(entry.amount)} ${entry.text}</span><b>${money(entry.before)} → ${money(entry.after)}</b>`;
    return item;
  })));
  if (!person.ledger.length) {
    const item = document.createElement("li");
    item.textContent = "No transactions yet";
    elements.ledger.append(item);
  }
  elements.events.textContent = `Life events: ${person.events.slice(0, 3).map((event) => `day ${event.day} — ${event.text}`).join("  ←  ")}`;
}

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  const scale = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(bounds.width * scale);
  canvas.height = Math.round(bounds.height * scale);
  context.setTransform(scale, 0, 0, scale, 0, 0);
  drawTown();
}

function drawTown() {
  const { width, height } = canvas.getBoundingClientRect();
  const style = getComputedStyle(document.documentElement);
  const colors = {
    background: style.getPropertyValue("--stage").trim(),
    grid: style.getPropertyValue("--border").trim(),
    text: style.getPropertyValue("--text").trim(),
    muted: style.getPropertyValue("--muted").trim(),
    accent: style.getPropertyValue("--accent").trim(),
    cash: style.getPropertyValue("--cash").trim(),
    danger: style.getPropertyValue("--danger").trim(),
  };
  context.clearRect(0, 0, width, height);
  context.fillStyle = colors.background;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = colors.grid;
  context.globalAlpha = 0.45;
  for (let x = 28; x < width; x += 56) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
  for (let y = 28; y < height; y += 56) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
  context.globalAlpha = 1;

  simulation.flows.forEach((flow) => {
    const from = flow.from.kind === "person" ? simulation.people[flow.from.id] : flow.from.kind === "firm" ? simulation.firms[flow.from.id] : simulation.government;
    const to = flow.to.kind === "person" ? simulation.people[flow.to.id] : flow.to.kind === "firm" ? simulation.firms[flow.to.id] : simulation.government;
    context.strokeStyle = colors.cash;
    context.globalAlpha = flow.from.kind === "person" && flow.from.id === selected || flow.to.kind === "person" && flow.to.id === selected ? 0.9 : 0.2;
    context.lineWidth = context.globalAlpha > 0.5 ? 2 : 1;
    context.beginPath(); context.moveTo(from.x * width, from.y * height); context.lineTo(to.x * width, to.y * height); context.stroke();
  });
  context.globalAlpha = 1;

  simulation.firms.forEach((firm) => {
    const x = firm.x * width;
    const y = firm.y * height;
    context.fillStyle = firm.active ? colors.text : colors.muted;
    context.fillRect(x - 25, y - 19, 50, 38);
    context.fillStyle = colors.background;
    context.font = "700 10px system-ui";
    context.textAlign = "center";
    context.fillText(firm.name.split(" ")[0], x, y + 3);
    context.fillStyle = colors.text;
    context.font = "11px system-ui";
    context.fillText(`${money(firm.cash)} · ${firm.employees.length} workers`, x, y + 36);
  });

  simulation.people.forEach((person) => {
    const employer = person.employer >= 0 ? simulation.firms[person.employer] : null;
    const targetX = employer ? employer.x : person.homeX;
    const targetY = employer ? employer.y : person.homeY;
    person.x += (targetX - person.x) * 0.02;
    person.y += (targetY - person.y) * 0.02;
    const x = person.x * width + Math.sin(person.id * 7) * 18;
    const y = person.y * height + Math.cos(person.id * 11) * 16;
    context.beginPath(); context.arc(x, y, person.id === selected ? 7 : 4.5, 0, Math.PI * 2);
    context.fillStyle = !person.housed || person.hungryDays ? colors.danger : colors.accent;
    context.fill();
    if (person.id === selected) {
      context.strokeStyle = colors.text; context.lineWidth = 2; context.stroke();
      context.fillStyle = colors.text; context.textAlign = "center"; context.font = "600 12px system-ui"; context.fillText(person.name, x, y - 13);
    }
  });

  const treasuryX = simulation.government.x * width;
  const treasuryY = simulation.government.y * height;
  context.fillStyle = colors.cash; context.fillRect(treasuryX - 19, treasuryY - 15, 38, 30);
  context.fillStyle = colors.text; context.textAlign = "center"; context.font = "11px system-ui"; context.fillText(`Treasury ${money(simulation.government.cash)}`, treasuryX, treasuryY + 29);
}

function step() {
  simulation.step();
  updateInterface();
  drawTown();
}

elements["person-select"].addEventListener("change", (event) => { selected = Number(event.target.value); updateInterface(); drawTown(); });
elements.pause.addEventListener("click", () => { paused = !paused; elements.pause.textContent = paused ? "Resume" : "Pause"; });
elements.step.addEventListener("click", () => { paused = true; elements.pause.textContent = "Resume"; step(); });
elements.reset.addEventListener("click", () => { simulation.reset(); selected = simulation.people.findIndex((person) => person.name === "Sizwe"); elements["person-select"].value = String(selected); updateInterface(); drawTown(); });

function animate(now) {
  if (!paused && now - lastStep >= Number(elements.speed.value)) { step(); lastStep = now; }
  drawTown();
  requestAnimationFrame(animate);
}

buildControls();
updateInterface();
new ResizeObserver(resizeCanvas).observe(canvas);
requestAnimationFrame(animate);
