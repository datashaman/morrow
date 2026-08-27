import "./styles.css";
import { DEFAULT_LATENT_FIRM_NAMES, PHASES, PRODUCTS } from "./config.js";
import { activityItems } from "./activity.js";
import { describeContract, describePerishableInventory, describePipeline, describeProcessing } from "./firm-presentation.js";
import { firmSelectorOptions, resolveSelectedFirmId, staffingEvidence } from "./firm-detail-presentation.js";
import { describeFirmOpportunity, firmInstanceLabel } from "./firm-opportunity-presentation.js";
import {
  applicantFirmId,
  applicantOrbitTarget,
  COMMON_PARK,
  deceasedMarkerSegments,
  employeeOrbitTarget,
  firmLandmarkLayout,
  parkVisitorTarget,
  personMapTarget,
  resolveCanvasColor,
} from "./map-presentation.js";
import { TownSimulation } from "./simulation.js";
import { playbackPresentation } from "./playback-presentation.js";
import { formatTemporalRecord } from "./civil-time.js";

const app = document.querySelector("#app");
app.innerHTML = `
  <section class="town-shell">
    <header class="town-header">
      <div>
        <p class="eyebrow">Individual lives in a closed economy</p>
        <h1>Morrow</h1>
      </div>
      <div class="clock" id="clock"></div>
    </header>

    <section class="metrics" aria-label="Town statistics">
      <article><span>Money accounted for</span><strong id="money"></strong><small id="money-detail"></small></article>
      <article><span>Employment</span><strong id="employment"></strong><small id="employment-detail"></small></article>
      <article><span>Immediate hardship</span><strong id="hardship"></strong><small id="hardship-detail"></small></article>
      <article><span>Citizens</span><strong id="population"></strong><small id="population-detail"></small></article>
    </section>

    <div class="stage-wrap">
      <canvas id="town" aria-label="Animated map of people, firms, the Common Park, and cemetery in the town"></canvas>
      <div class="legend" aria-hidden="true"><span><i class="person-dot"></i>Person</span><span><i class="deceased-dot"></i>Deceased</span><span><i class="firm-dot"></i>Firm</span><span><i class="park-swatch"></i>Common Park</span><span><i class="cash-line"></i>Cash transfer</span></div>
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
      <section class="motivation-panel" aria-labelledby="knowledge-title">
        <div class="motivation-heading">
          <h2 id="knowledge-title">Knowledge</h2>
          <div class="motivation-profile" id="knowledge-profile"></div>
        </div>
        <ol class="decision-stream" id="learning-stream" tabindex="0" aria-label="Citizen learning history, newest first"></ol>
      </section>
      <section class="motivation-panel" aria-labelledby="motivation-title">
        <div class="motivation-heading">
          <h2 id="motivation-title">Motivation</h2>
          <div class="motivation-profile" id="motivation-profile"></div>
        </div>
        <ol class="decision-stream" id="decision-stream" tabindex="0" aria-label="Citizen decisions, newest first"></ol>
      </section>
      <div class="activity-heading">
        <h2>Activity</h2>
        <label>Show
          <select id="activity-filter">
            <option value="all" selected>All</option>
            <option value="transactions">Transactions</option>
            <option value="events">Life events</option>
          </select>
        </label>
      </div>
      <ol class="activity-stream" id="activity-stream" tabindex="0" aria-label="Citizen activity, newest first"></ol>
    </section>

    <section class="firm-panel" aria-labelledby="firm-pipelines-title">
      <div class="firm-panel-heading">
        <div>
          <p class="eyebrow">Production and trade</p>
          <h2 id="firm-pipelines-title">Firm pipelines</h2>
        </div>
        <p>Select a firm to inspect its complete economic history.</p>
      </div>
      <div class="town-stage" id="town-stage" aria-live="polite"></div>
      <div class="firm-selector-row">
        <label>Inspect firm
          <select id="firm-select" aria-label="Inspect firm"></select>
        </label>
        <span id="firm-selection-state"></span>
      </div>
      <p class="firm-empty" id="firm-empty" hidden>No firms have been founded.</p>
      <article class="firm-detail" id="firm-detail" aria-live="polite"></article>
      <details class="firm-opportunities">
        <summary>Potential firms</summary>
        <div id="firm-opportunities"></div>
      </details>
      <div class="activity-heading">
        <h2 id="firm-decision-title">Owner decisions</h2>
      </div>
      <ol class="decision-stream" id="firm-decision-stream" tabindex="0" aria-label="Selected firm's owner decisions, newest first"></ol>
      <div class="activity-heading">
        <h2 id="firm-activity-title">Firm activity</h2>
        <label>Show
          <select id="firm-activity-filter">
            <option value="all" selected>All</option>
            <option value="transactions">Transactions</option>
            <option value="events">Life events</option>
          </select>
        </label>
      </div>
      <ol class="activity-stream" id="firm-activity-stream" tabindex="0" aria-label="Firm activity, newest first"></ol>
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
      <div class="neural-control">
        <label><input id="neural-control" type="checkbox"> Neural control for personal time</label>
        <small id="policy-status"></small>
      </div>
      <details>
        <summary>Town policy</summary>
        <div class="policy-grid" id="policy-grid"></div>
      </details>
      <details>
        <summary>Run history</summary>
        <ol class="control-history" id="control-history" tabindex="0" aria-label="Policy and neural-control changes, newest first"></ol>
      </details>
    </section>
  </section>
`;

const simulation = new TownSimulation({ latentFirmNames: DEFAULT_LATENT_FIRM_NAMES, housingCapacityEnabled: true, transportEnabled: true });
let selected = simulation.people.findIndex((person) => person.name === "Sizwe");
let selectedFirm = 0;
let paused = false;
let lastStep = performance.now();
const canvas = document.querySelector("#town");
const context = canvas.getContext("2d");
const cemetery = { x: 0.88, y: 0.82, columns: 5 };
const commonPark = COMMON_PARK;
let firmLandmarks = new Map();

const elements = Object.fromEntries([
  "clock", "money", "money-detail", "employment", "employment-detail", "hardship", "hardship-detail",
  "population", "population-detail", "neural-control", "policy-status", "town-stage",
  "person-select", "focus", "person-summary", "needs", "knowledge-profile", "learning-stream", "motivation-profile", "decision-stream", "activity-filter", "activity-stream", "firm-select", "firm-selection-state", "firm-empty", "firm-detail", "firm-opportunities", "firm-decision-title", "firm-decision-stream", "firm-activity-title", "firm-activity-filter", "firm-activity-stream", "pause", "step", "reset", "speed", "policy-grid", "control-history",
].map((id) => [id, document.querySelector(`#${id}`)]));

const policyControls = [
  ["minimumWage", "Minimum wage", 3, 10, 0.2, (value) => value.toFixed(1)],
  ["taxRate", "Employer tax", 0, 35, 1, (value) => `${value}%`],
  ["supportRate", "Support budget", 0, 100, 1, (value) => `${value}%`],
  ["discretionaryDemand", "Discretionary demand", 0, 100, 1, (value) => `${value}%`],
  ["shockRisk", "Economic shocks", 0, 100, 1, (value) => `${value}%`],
];
const policyLabels = Object.fromEntries(policyControls.map(([name, label]) => [name, label]));

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
    input.addEventListener("input", () => { output.textContent = format(Number(input.value)); });
    input.addEventListener("change", () => { simulation.setPolicy(name, input.value); updateInterface(); });
    wrapper.append(heading, input);
    return wrapper;
  }));
}

function renderControlHistory(history) {
  elements["control-history"].replaceChildren(...history.map((entry) => {
    const item = document.createElement("li");
    const label = entry.type === "policy" ? policyLabels[entry.setting] : "Neural personal-time control";
    const before = entry.type === "policy" ? entry.before : entry.before ? "on" : "off";
    const after = entry.type === "policy" ? entry.after : entry.after ? "on" : "off";
    const time = document.createElement("time");
    const change = document.createElement("span");
    time.textContent = formatTemporalRecord(entry);
    change.textContent = `${label}: ${before} → ${after}`;
    item.append(time, change);
    return item;
  }));
  if (!history.length) {
    const item = document.createElement("li");
    item.className = "control-history-empty";
    item.textContent = "No mid-run control changes.";
    elements["control-history"].append(item);
  }
}

const money = (value) => value.toFixed(1);
const price = (value) => value.toFixed(2);
const percent = (value) => `${Math.round(value * 100)}%`;
const needNames = { physiological: "Physiological", safety: "Safety", belonging: "Belonging", esteem: "Esteem", growth: "Self-actualization" };
const motivationNames = { comfort: "Comfort", connection: "Connection", mastery: "Mastery", security: "Security", foodQuality: "Food quality", planning: "Planning", avoidance: "Avoidance" };
const staticActionNames = {
  "accept-job-offer": "Accepted job offer",
  "decline-job-offer": "Declined job offer",
  "attend-shift": "Attended shift",
  "miss-shift": "Missed shift",
  "skip-job-search": "Did not apply for work",
  "buy-comfort": "Bought short-term comfort",
  "social-visit": "Made a social visit",
  "buy-learning-tools": "Bought learning tools",
  "skip-food": "Skipped food",
  "defer-housing": "Deferred housing payment",
  "remain-unhoused": "Remained unhoused",
};

function actionName(decision, action) {
  if (action === "do-nothing") {
    if (decision.observation.freeActivity === "park-social") return "Spent free time in the park";
    if (decision.observation.freeActivity === "self-study") return "Practiced independently";
    return "Rested";
  }
  if (staticActionNames[action]) return staticActionNames[action];
  const option = decision.observation.options?.find((candidate) => candidate.action === action);
  if (option?.label) return option.label;
  const capacity = option?.capacityAvailable ? "capacity available" : "seller full";
  if (action.startsWith("eat-stored-food:")) return `Chose stored food from ${option?.sellerName ?? "a previous seller"} (${percent(option?.effectiveQuality ?? 0)} quality, ${option?.age ?? 0}d old, ${option?.remainingShelfLife ?? 0}d life left)`;
  if (action.startsWith("buy-food:")) return `Tried ${option?.units ?? ""} food portion${option?.units === 1 ? "" : "s"} from ${option?.sellerName ?? "a seller"} (${money(option?.totalPrice ?? 0)}, ${percent(option?.effectiveQuality ?? 0)} quality, ${option?.remainingShelfLife ?? 0}d life left, ${capacity})`;
  if (action.startsWith("pay-housing:")) return `Tried housing payment to ${option?.firmName ?? "the provider"} (${money(option?.totalPrice ?? 0)}, ${capacity})`;
  if (action.startsWith("secure-housing:")) return `Tried to secure housing through ${option?.firmName ?? "the provider"} (${money(option?.totalPrice ?? 0)}, ${capacity})`;
  if (action.startsWith("apply-job:")) return `Applied to ${option?.firmName ?? "an employer"} (${money(option?.offeredWage ?? 0)} wage)`;
  return action;
}

function renderActivity(entity, filter, stream) {
  const previousScrollHeight = stream.scrollHeight;
  const previousScrollTop = stream.scrollTop;
  const followingNewest = previousScrollTop < 2;
  const activity = activityItems(entity, filter);
  stream.replaceChildren(...activity.map((entry) => {
    const item = document.createElement("li");
    item.className = entry.type === "transaction" ? entry.direction : `event ${entry.kind}`;
    item.innerHTML = entry.type === "transaction"
      ? `<time>${formatTemporalRecord(entry)}</time><span>${entry.direction === "in" ? "+" : "−"}${money(entry.amount)} ${entry.text}</span><b>${money(entry.before)} → ${money(entry.after)}</b>`
      : `<time>${formatTemporalRecord(entry)}</time><span>${entry.text}</span><b>Life event</b>`;
    return item;
  }));
  if (!activity.length) {
    const item = document.createElement("li");
    item.className = "activity-empty";
    item.textContent = filter === "transactions" ? "No transactions yet" : filter === "events" ? "No life events yet" : "No activity yet";
    stream.append(item);
  }
  if (!followingNewest) stream.scrollTop = previousScrollTop + stream.scrollHeight - previousScrollHeight;
}

function renderDecisions(entity, stream) {
  const previousScrollHeight = stream.scrollHeight;
  const previousScrollTop = stream.scrollTop;
  const followingNewest = previousScrollTop < 2;
  stream.replaceChildren(...entity.decisions.map((decision) => {
    const item = document.createElement("li");
    const alternatives = decision.legalActions
      .map((action) => `${actionName(decision, action)}${decision.scores[action] === undefined ? "" : ` score ${decision.scores[action].toFixed(2)}`}${decision.control?.probabilities?.[action] === undefined ? "" : ` · ${(decision.control.probabilities[action] * 100).toFixed(1)}%`}`)
      .join(" · ");
    const evidence = Object.entries(decision.scores)
      .filter(([name]) => !decision.legalActions.includes(name))
      .map(([name, value]) => `${name} ${value.toFixed(2)}`)
      .join(" · ");
    const neuralLabel = decision.control?.mode === "neural" ? "Neural control" : "Neural shadow";
    const shadow = decision.shadow
      ? ` · ${neuralLabel}: ${actionName(decision, decision.shadow.action)}${decision.shadow.diverged ? " (diverged from motivation fallback)" : " (agreed with motivation fallback)"} · unmasked ${decision.shadow.unmaskedPreference}${decision.shadow.invalidPreferenceBeforeMask ? " (illegal before masking)" : ""}`
      : "";
    item.innerHTML = `<time>${formatTemporalRecord(decision)}</time><b>${actionName(decision, decision.chosenAction)}</b><span>${decision.reasons.join(" ")}</span><small>Alternatives: ${alternatives}${evidence ? ` · Evidence: ${evidence}` : ""}${shadow} · ${decision.policy}</small>`;
    return item;
  }));
  if (!entity.decisions.length) {
    const item = document.createElement("li");
    item.className = "decision-empty";
    item.textContent = "No policy decision has been recorded yet.";
    stream.append(item);
  }
  if (!followingNewest) stream.scrollTop = previousScrollTop + stream.scrollHeight - previousScrollHeight;
}

function renderMotivations(person) {
  elements["motivation-profile"].replaceChildren(...Object.entries(person.motivationProfile).map(([name, value]) => {
    const item = document.createElement("span");
    item.innerHTML = `${motivationNames[name]} <b>${value.toFixed(2)}</b>`;
    return item;
  }));
  renderDecisions(person, elements["decision-stream"]);
}

function renderKnowledge(person) {
  elements["knowledge-profile"].replaceChildren(...["general", "retail", "inventory"].map((domain) => {
    const item = document.createElement("span");
    item.innerHTML = `${domain[0].toUpperCase()}${domain.slice(1)} <b>${percent(person.knowledgeProfile[domain])}</b>`;
    return item;
  }));
  const stream = elements["learning-stream"];
  const followingNewest = stream.scrollTop <= 8;
  const previousScrollHeight = stream.scrollHeight;
  const previousScrollTop = stream.scrollTop;
  stream.replaceChildren(...person.learningHistory.map((record) => {
    const item = document.createElement("li");
    item.innerHTML = `<time>${formatTemporalRecord(record)}</time><b>${record.domain[0].toUpperCase()}${record.domain.slice(1)} knowledge</b><span>${record.sourceName}: ${percent(record.before)} → ${percent(record.after)}</span><small>${record.rule}</small>`;
    return item;
  }));
  if (!person.learningHistory.length) {
    const item = document.createElement("li");
    item.className = "decision-empty";
    item.textContent = "No learning has been recorded yet.";
    stream.append(item);
  }
  if (!followingNewest) stream.scrollTop = previousScrollTop + stream.scrollHeight - previousScrollHeight;
}

function updateInterface() {
  const state = simulation.snapshot();
  const playback = playbackPresentation(state.alive, paused);
  paused = playback.paused;
  elements.pause.disabled = playback.pauseDisabled;
  elements.step.disabled = playback.stepDisabled;
  elements.reset.disabled = playback.resetDisabled;
  elements.pause.textContent = playback.pauseLabel;
  const person = simulation.people[selected];
  const employer = person.employer >= 0 ? simulation.firms[person.employer].name : "no employer";
  const owned = simulation.firms.find((firm) => firm.active && firm.owner === person.id);
  const foodSeller = person.foodSeller >= 0 ? simulation.firms[person.foodSeller].name : "not yet chosen";
  const healthCare = person.healthSeller >= 0
    ? `last self-care from ${simulation.firms[person.healthSeller].name} on day ${person.lastTreatmentDay}`
    : "no self-care purchase yet";
  const clinicalCare = person.clinicalSeller >= 0
    ? `last clinical care from ${simulation.firms[person.clinicalSeller].name} on day ${person.lastClinicalDay}`
    : "no clinical care yet";
  const education = person.educationSeller >= 0
    ? `last lesson from ${simulation.firms[person.educationSeller].name} on day ${person.lastEducationDay}`
    : "no paid lesson yet";
  const foodAge = person.lastFoodAge === 0 ? "fresh" : `${person.lastFoodAge} day${person.lastFoodAge === 1 ? "" : "s"} stored`;
  const foodQuality = person.lastFoodQuality === null ? "no meal yet" : `last meal ${percent(person.lastFoodQuality)} quality; ${foodAge}`;
  const pantry = `${person.foodStock.length} meal${person.foodStock.length === 1 ? "" : "s"} stored`;
  const relationships = simulation.relationshipStats(person);
  const relationshipSummary = relationships.count ? `${relationships.count} friendship${relationships.count === 1 ? "" : "s"}; strongest ${percent(relationships.strongest)}` : "no active friendships";
  const housingFirm = simulation.firms.find((firm) => firm.sector === "housing");
  const rentTiming = simulation.daysUntilRent();
  const rentSchedule = housingFirm?.status === "receivership"
    ? "rent suspended during HomeWorks receivership"
    : rentTiming === 0 ? "rent due today" : `rent due in ${rentTiming} day${rentTiming === 1 ? "" : "s"}`;
  const provider = person.housed
    ? `${person.rentSeller >= 0 ? `housed through ${simulation.firms[person.rentSeller].name}` : "housed; no payment yet"}; ${rentSchedule}`
    : (person.rentSeller >= 0 ? `unhoused; last provider ${simulation.firms[person.rentSeller].name}` : "unhoused");
  const finalHousing = person.housed
    ? (person.rentSeller >= 0 ? `last housing: housed through ${simulation.firms[person.rentSeller].name}` : "last housing: housed")
    : (person.rentSeller >= 0 ? `last housing: unhoused; previous provider ${simulation.firms[person.rentSeller].name}` : "last housing: unhoused");

  elements.clock.textContent = `W${state.calendar.week} ${state.calendar.weekday} · ${state.block} · ${state.phaseName}${playback.clockSuffix}`;
  elements["neural-control"].checked = state.citizenPolicy.mode === "neural";
  elements["policy-status"].textContent = `${state.citizenPolicy.mode === "neural" ? "Neural controls personal time" : "Motivation policy controls all choices"} · ${state.citizenPolicy.weightsVersion} · gate v${state.citizenPolicy.gateVersion} passed`;
  renderControlHistory(state.controlHistory);
  elements.money.textContent = `${(state.totalMoney / state.initialMoney * 100).toFixed(2)}%`;
  elements["money-detail"].textContent = `${money(state.totalMoney)} of ${money(state.initialMoney)} remains on ledgers`;
  elements.employment.textContent = `${state.alive ? Math.round(state.employed / state.alive * 100) : 0}%`;
  elements["employment-detail"].textContent = `${state.employed} employed · ${state.alive - state.employed} seeking · ${state.positionsAvailable} position${state.positionsAvailable === 1 ? "" : "s"} available`;
  elements.hardship.textContent = state.hungry + state.unhoused;
  elements["hardship-detail"].textContent = `${state.hungry} living without food · ${state.unhoused} living without housing`;
  elements.population.textContent = `${state.alive}/${state.totalCitizens}`;
  elements["population-detail"].textContent = `${state.alive} alive · ${state.dead} dead · ${state.totalCitizens} total`;
  elements["town-stage"].innerHTML = `<span><small>Current town stage</small><strong>${state.townStage.label}</strong></span><p>${state.townStage.description} Essential reliability ${percent(state.townStage.evidence.essentialReliability)} · employment ${percent(state.townStage.evidence.employmentRate)} · ten-day reserves ${percent(state.townStage.evidence.reserveShare)} · discretionary demand ${percent(state.townStage.evidence.discretionaryDemand)} · persistent optional sectors ${state.townStage.evidence.persistentOptionalSectors}/${state.townStage.evidence.activeOptionalSectors}.</p>`;
  elements.focus.textContent = person.alive ? `${needNames[person.focus]} focus` : `Died · day ${person.deathDay}`;
  elements["person-summary"].textContent = person.alive
    ? `Alive · Works for: ${employer}${owned ? ` · owns: ${owned.name}` : ""} · current cash ${money(person.cash)} · runway ${simulation.runwayDays(person).toFixed(1)} days · stress ${percent(person.stress)} · health ${percent(person.health)}; ${clinicalCare}; ${healthCare} · skill ${percent(person.skill)}; ${education} · food: ${foodSeller}; ${foodQuality}; ${pantry} · housing: ${provider} · relationships: ${relationshipSummary}`
    : `Died on day ${person.deathDay}${owned ? ` · owned: ${owned.name}` : ""} · estate ${money(person.estateTransferred)} transferred to treasury · remaining cash ${money(person.cash)} · health at death ${percent(person.health)} · last food seller: ${foodSeller}; ${foodQuality}; ${pantry} · ${finalHousing}`;
  elements.needs.hidden = !person.alive;

  elements.needs.replaceChildren(...Object.entries(person.needs).map(([name, value]) => {
    const item = document.createElement("div");
    item.innerHTML = `<span>${needNames[name]} <b>${percent(value)}</b></span><div class="need-track" role="progressbar" aria-label="${needNames[name]}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(value * 100)}"><i style="width:${percent(value)}"></i></div>`;
    return item;
  }));

  renderKnowledge(person);
  renderMotivations(person);
  renderActivity(person, elements["activity-filter"].value, elements["activity-stream"]);

  selectedFirm = resolveSelectedFirmId(simulation.firms, selectedFirm);
  const selectorOptions = firmSelectorOptions(simulation.firms).map((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    option.disabled = item.disabled;
    return option;
  });
  elements["firm-select"].replaceChildren(...selectorOptions);
  elements["firm-select"].disabled = selectedFirm === null;
  elements["firm-empty"].hidden = selectedFirm !== null;
  elements["firm-detail"].hidden = selectedFirm === null;

  const opportunityRows = simulation.firmOpportunities().map((opportunity) => {
    const description = describeFirmOpportunity(opportunity);
    const archetype = simulation.firmArchetype(opportunity.archetypeId);
    const inputDescription = archetype.input && archetype.source
      ? `; would use ${PRODUCTS[archetype.input].name} from ${archetype.source}`
      : "";
    const row = document.createElement("article");
    row.className = `opportunity-row ${opportunity.status}`;
    row.innerHTML = `
      <span><b>${opportunity.name}</b><i class="status ${opportunity.ready ? "ready" : "potential"}">${opportunity.ready ? "ready" : "not ready"}</i></span>
      <p>Could sell ${PRODUCTS[archetype.sells].name}${inputDescription}. ${description.evidence}. ${description.resources}.</p>
      <small>${description.explanation}</small>
    `;
    return row;
  });
  elements["firm-opportunities"].replaceChildren(...opportunityRows);
  if (selectedFirm === null) {
    elements["firm-selection-state"].textContent = "No firm selected";
    elements["firm-detail"].replaceChildren();
    elements["firm-decision-title"].textContent = "Owner decisions";
    elements["firm-decision-stream"].replaceChildren();
    elements["firm-activity-title"].textContent = "Firm activity";
    elements["firm-activity-stream"].replaceChildren();
    return;
  }

  elements["firm-select"].value = String(selectedFirm);
  const firm = simulation.firms.find((candidate) => candidate.id === selectedFirm);
  const contracts = simulation.contracts.filter((contract) => contract.buyerId === firm.id || contract.supplierId === firm.id);
  const hasOperatingSupply = simulation.contracts.some((contract) => contract.use === "operations" && contract.buyerId === firm.id);
  const product = PRODUCTS[firm.sells];
  const staffing = staffingEvidence(firm);
  const knowledgeCapacity = firm.archetypeId === "everyday-grocer"
    ? ` · knowledge +${firm.knowledgeCapacitySlotsToday} slot${firm.knowledgeCapacitySlotsToday === 1 ? "" : "s"} today, ${percent(firm.knowledgeCapacityCarry)} carry`
    : "";
  const lifecycle = `${firm.vital ? "Vital · " : ""}${firm.active ? `Founded D${firm.foundingDay}` : `Closed D${firm.closedDay}`}${firm.rescueCount ? ` · rescued ${firm.rescueCount}× on D${firm.lastRescueDay}` : ""}${firm.receivershipDay !== null ? ` · receivership since D${firm.receivershipDay}` : ""}${firm.publiclyOperated ? " · treasury-appointed operator" : ""}`;
  const operatingState = `${money(firm.cash)} cash · ${price(firm.price)} current price · ${firm.sector === "housing" ? `${simulation.housingOccupancy()}/${firm.dwellingCapacity} dwellings occupied` : firm.sector === "transport" ? `${firm.transportLoadToday}/${firm.transportCapacityToday} freight load used today` : firm.production === "fixed-service" ? "service stock not modeled" : `${Math.floor(firm.inventory)} ${product.unit}s in stock`}${hasOperatingSupply ? ` · ${firm.operatingSupplies} maintenance kit${firm.operatingSupplies === 1 ? "" : "s"} · ${percent(firm.operationalReadiness)} capacity` : ""}${knowledgeCapacity} · ${money(firm.revenueEMA)} smoothed net income`;
  const ownerChoice = `Price ${firm.ownerDecision.priceDecision}${firm.ownerDecision.priceDay ? ` on D${firm.ownerDecision.priceDay}` : ""} at ${price(firm.ownerDecision.price)}: ${firm.ownerDecision.priceReason}. Wage ${firm.ownerDecision.wage}${firm.ownerDecision.wageDay ? ` on D${firm.ownerDecision.wageDay}` : ""}: ${firm.ownerDecision.wageReason}. Capital ${money(firm.ownerDecision.capitalContribution)}${firm.ownerDecision.capitalDay ? ` on D${firm.ownerDecision.capitalDay}` : ""}: ${firm.ownerDecision.capitalReason}. ${firm.ownerDecision.continuation}: ${firm.ownerDecision.continuationReason}. ${firm.ownerDecision.dividendType} ${money(firm.ownerDecision.dividend)}${firm.ownerDecision.dividendDay ? ` on D${firm.ownerDecision.dividendDay}` : ""}: ${firm.ownerDecision.dividendReason}.`;
  const perishableState = describePerishableInventory(firm, PRODUCTS, simulation.day);
  elements["firm-selection-state"].innerHTML = `<i class="status ${firm.status}">${firm.status}</i>`;
  elements["firm-detail"].innerHTML = `
    <header class="firm-detail-heading"><div><p class="eyebrow">Selected economic actor</p><h3>${firmInstanceLabel(firm, simulation.firms)}</h3></div><span>${lifecycle}</span></header>
    <div class="firm-detail-grid">
      <section><h4>Identity and lifecycle</h4><p>${operatingState}</p>${perishableState ? `<p>${perishableState}</p>` : ""}</section>
      <section><h4>Product pipeline and contracts</h4><p>${describePipeline(firm, PRODUCTS)}</p>${firm.processingPerWorker ? `<p class="${firm.processingShortfallToday ? "shortfall" : ""}">${describeProcessing(firm, PRODUCTS)}</p>` : ""}<ul class="contract-list">${contracts.length ? contracts.map((contract) => `<li class="${contract.shortfallToday ? "shortfall" : ""}">${describeContract(contract, PRODUCTS)}</li>`).join("") : "<li>No supply contracts.</li>"}</ul></section>
      <section><h4>Staffing evidence</h4><dl><div><dt>Headcount</dt><dd>${staffing.headcount}</dd></div><div><dt>Latest 2-of-3 gate</dt><dd>${staffing.demand}</dd></div><div><dt>Funded slot</dt><dd>${staffing.slot}</dd></div><div><dt>Latest reason</dt><dd>${staffing.reason}</dd></div></dl></section>
      <section><h4>Owner choices</h4><p class="owner-choice">${ownerChoice}</p></section>
    </div>
  `;
  elements["firm-decision-title"].textContent = `${firmInstanceLabel(firm, simulation.firms)} owner decisions`;
  renderDecisions(firm, elements["firm-decision-stream"]);
  elements["firm-activity-title"].textContent = `${firmInstanceLabel(firm, simulation.firms)} activity`;
  renderActivity(firm, elements["firm-activity-filter"].value, elements["firm-activity-stream"]);
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
  const darkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const colors = {
    background: resolveCanvasColor(style.getPropertyValue("--stage"), darkMode),
    grid: resolveCanvasColor(style.getPropertyValue("--border"), darkMode),
    text: resolveCanvasColor(style.getPropertyValue("--text"), darkMode),
    muted: resolveCanvasColor(style.getPropertyValue("--muted"), darkMode),
    accent: resolveCanvasColor(style.getPropertyValue("--accent"), darkMode),
    accentSoft: resolveCanvasColor(style.getPropertyValue("--accent-soft"), darkMode),
    cash: resolveCanvasColor(style.getPropertyValue("--cash"), darkMode),
    danger: resolveCanvasColor(style.getPropertyValue("--danger"), darkMode),
  };
  context.clearRect(0, 0, width, height);
  context.fillStyle = colors.background;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = colors.grid;
  context.globalAlpha = 0.45;
  for (let x = 28; x < width; x += 56) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
  for (let y = 28; y < height; y += 56) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
  context.globalAlpha = 1;

  const landmarkMeta = (firm) => `${money(firm.cash)} cash · ${firm.employees.length} staff`;
  context.font = "700 14px system-ui";
  const mapFirms = simulation.firms.filter((firm) => firm.active || !simulation.firms.some((candidate) => candidate.active && candidate.archetypeId === firm.archetypeId));
  const landmarks = new Map(mapFirms.map((firm) => {
    const nameWidth = context.measureText(firm.name).width;
    context.font = "500 11px system-ui";
    const metaWidth = context.measureText(landmarkMeta(firm)).width;
    context.font = "700 14px system-ui";
    return [firm.id, firmLandmarkLayout(firm, { width, height, nameWidth, metaWidth })];
  }));
  firmLandmarks = landmarks;

  const parkX = commonPark.x * width;
  const parkY = commonPark.y * height;
  const parkRadiusX = commonPark.radiusX * width;
  const parkRadiusY = commonPark.radiusY * height;
  context.save();
  context.beginPath();
  context.ellipse(parkX, parkY, parkRadiusX, parkRadiusY, 0, 0, Math.PI * 2);
  context.fillStyle = colors.accentSoft;
  context.fill();
  context.clip();
  context.strokeStyle = colors.background;
  context.lineWidth = 8;
  context.globalAlpha = 0.8;
  context.beginPath();
  context.moveTo(parkX - parkRadiusX, parkY + parkRadiusY * 0.35);
  context.quadraticCurveTo(parkX, parkY - parkRadiusY * 0.2, parkX + parkRadiusX, parkY - parkRadiusY * 0.35);
  context.stroke();
  context.beginPath();
  context.moveTo(parkX - parkRadiusX * 0.15, parkY - parkRadiusY);
  context.quadraticCurveTo(parkX + parkRadiusX * 0.25, parkY, parkX + parkRadiusX * 0.1, parkY + parkRadiusY);
  context.stroke();
  context.restore();
  context.strokeStyle = colors.accent;
  context.globalAlpha = 0.55;
  context.lineWidth = 1;
  context.beginPath();
  context.ellipse(parkX, parkY, parkRadiusX, parkRadiusY, 0, 0, Math.PI * 2);
  context.stroke();
  context.globalAlpha = 1;
  context.fillStyle = colors.accent;
  context.textAlign = "center";
  context.font = "700 10px system-ui";
  context.fillText("COMMON PARK", parkX, parkY - parkRadiusY - 8);

  const applicationFirmIds = new Map(simulation.people
    .filter((person) => person.alive && person.employer < 0)
    .map((person) => [person.id, applicantFirmId(person, simulation.firms)]));
  const applicantsByFirm = new Map(simulation.firms.map((firm) => [
    firm.id,
    [...applicationFirmIds].filter(([, firmId]) => firmId === firm.id).map(([personId]) => personId),
  ]));

  simulation.flows.forEach((flow) => {
    const from = flow.from.kind === "person" ? simulation.people[flow.from.id] : flow.from.kind === "firm" ? simulation.firms[flow.from.id] : simulation.government;
    const to = flow.to.kind === "person" ? simulation.people[flow.to.id] : flow.to.kind === "firm" ? simulation.firms[flow.to.id] : simulation.government;
    context.strokeStyle = colors.cash;
    context.globalAlpha = flow.from.kind === "person" && flow.from.id === selected || flow.to.kind === "person" && flow.to.id === selected ? 0.9 : 0.2;
    context.lineWidth = context.globalAlpha > 0.5 ? 2 : 1;
    const fromLandmark = from.kind === "firm" ? landmarks.get(from.id) : null;
    const toLandmark = to.kind === "firm" ? landmarks.get(to.id) : null;
    context.beginPath();
    context.moveTo(fromLandmark?.centerX ?? from.x * width, fromLandmark?.centerY ?? from.y * height);
    context.lineTo(toLandmark?.centerX ?? to.x * width, toLandmark?.centerY ?? to.y * height);
    context.stroke();
  });
  context.globalAlpha = 1;

  const cemeteryX = cemetery.x * width;
  const cemeteryY = cemetery.y * height;
  const cemeteryWidth = Math.min(120, width * 0.16);
  const cemeteryHeight = 90;
  context.strokeStyle = colors.muted;
  context.lineWidth = 1;
  context.globalAlpha = 0.7;
  context.strokeRect(cemeteryX - cemeteryWidth / 2, cemeteryY - cemeteryHeight / 2, cemeteryWidth, cemeteryHeight);
  context.fillStyle = colors.muted;
  context.textAlign = "center";
  context.font = "700 10px system-ui";
  context.fillText("CEMETERY", cemeteryX, cemeteryY - cemeteryHeight / 2 - 8);
  context.font = "11px system-ui";
  context.fillText(`${simulation.people.filter((person) => !person.alive).length} interred`, cemeteryX, cemeteryY + cemeteryHeight / 2 + 16);
  context.globalAlpha = 1;

  simulation.people.forEach((person) => {
    const employer = person.employer >= 0 ? simulation.firms[person.employer] : null;
    const landmark = employer ? landmarks.get(employer.id) : null;
    const graveColumn = person.id % cemetery.columns;
    const graveRow = Math.floor(person.id / cemetery.columns);
    const employeeTarget = employer ? employeeOrbitTarget(employer.employees.indexOf(person.id), employer.employees.length, landmark, { width, height }) : null;
    const applicationFirmId = applicationFirmIds.get(person.id);
    const applicationLandmark = applicationFirmId === null || applicationFirmId === undefined ? null : landmarks.get(applicationFirmId);
    const applicantIds = applicationLandmark ? applicantsByFirm.get(applicationFirmId) : [];
    const applicationTarget = applicationLandmark
      ? applicantOrbitTarget(applicantIds.indexOf(person.id), applicantIds.length, applicationLandmark, { width, height })
      : null;
    const target = personMapTarget(person, {
      graveTarget: { x: cemetery.x + (graveColumn - 2) * 0.018, y: cemetery.y + (graveRow - 3.5) * 0.012 },
      employeeTarget,
      applicationTarget,
      parkTarget: parkVisitorTarget(person.id, commonPark, performance.now()),
    });
    person.x += (target.x - person.x) * 0.02;
    person.y += (target.y - person.y) * 0.02;
    const x = person.x * width;
    const y = person.y * height;
    if (person.alive) {
      context.beginPath(); context.arc(x, y, person.id === selected ? 7 : 5, 0, Math.PI * 2);
      context.fillStyle = !person.housed || person.hungryDays ? colors.danger : colors.accent;
      context.fill();
    } else {
      context.strokeStyle = colors.muted;
      context.lineWidth = 2.5;
      deceasedMarkerSegments(x, y).forEach(([fromX, fromY, toX, toY]) => {
        context.beginPath(); context.moveTo(fromX, fromY); context.lineTo(toX, toY); context.stroke();
      });
    }
    if (person.id === selected) {
      context.beginPath(); context.arc(x, y, 9, 0, Math.PI * 2); context.strokeStyle = colors.text; context.lineWidth = 1.5; context.stroke();
      context.fillStyle = colors.text; context.textAlign = "center"; context.font = "600 12px system-ui"; context.fillText(person.name, x, y - 13);
    }
  });

  mapFirms.forEach((firm) => {
    const landmark = landmarks.get(firm.id);
    if (firm.id === selectedFirm) {
      context.fillStyle = colors.accent;
      context.fillRect(landmark.centerX - landmark.width / 2 - 3, landmark.centerY - landmark.height / 2 - 3, landmark.width + 6, landmark.height + 6);
    }
    context.fillStyle = firm.active ? colors.text : colors.muted;
    context.fillRect(landmark.centerX - landmark.width / 2, landmark.centerY - landmark.height / 2, landmark.width, landmark.height);
    context.fillStyle = colors.background;
    context.textAlign = "center";
    context.font = "700 14px system-ui";
    context.fillText(landmark.label, landmark.centerX, landmark.centerY - 5);
    context.font = "500 11px system-ui";
    context.fillText(landmarkMeta(firm), landmark.centerX, landmark.centerY + 15);
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

elements["person-select"].addEventListener("change", (event) => { selected = Number(event.target.value); updateInterface(); elements["activity-stream"].scrollTop = 0; drawTown(); });
elements["neural-control"].addEventListener("change", (event) => { simulation.setNeuralControl(event.target.checked); updateInterface(); });
elements["activity-filter"].addEventListener("change", () => { updateInterface(); elements["activity-stream"].scrollTop = 0; });
elements["firm-activity-filter"].addEventListener("change", () => { updateInterface(); elements["firm-activity-stream"].scrollTop = 0; });
elements["firm-select"].addEventListener("change", (event) => {
  selectedFirm = Number(event.target.value);
  updateInterface();
  elements["firm-activity-stream"].scrollTop = 0;
  drawTown();
});
canvas.addEventListener("click", (event) => {
  const selectedLandmark = [...firmLandmarks].reverse().find(([, landmark]) => (
    Math.abs(event.offsetX - landmark.centerX) <= landmark.width / 2
    && Math.abs(event.offsetY - landmark.centerY) <= landmark.height / 2
  ));
  if (!selectedLandmark) return;
  selectedFirm = selectedLandmark[0];
  updateInterface();
  elements["firm-activity-stream"].scrollTop = 0;
  drawTown();
});
elements.pause.addEventListener("click", () => { paused = !paused; elements.pause.textContent = paused ? "Resume" : "Pause"; });
elements.step.addEventListener("click", () => { paused = true; elements.pause.textContent = "Resume"; step(); });
elements.reset.addEventListener("click", () => { simulation.reset(); paused = false; lastStep = performance.now(); selected = simulation.people.findIndex((person) => person.name === "Sizwe"); selectedFirm = 0; elements["person-select"].value = String(selected); elements["activity-filter"].value = "all"; elements["firm-activity-filter"].value = "all"; updateInterface(); elements["activity-stream"].scrollTop = 0; elements["firm-activity-stream"].scrollTop = 0; drawTown(); });

function animate(now) {
  if (!paused && now - lastStep >= Number(elements.speed.value)) { step(); lastStep = now; }
  drawTown();
  requestAnimationFrame(animate);
}

buildControls();
updateInterface();
new ResizeObserver(resizeCanvas).observe(canvas);
requestAnimationFrame(animate);
