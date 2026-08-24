import {
  DEFAULT_POLICY,
  FIRMS,
  FIRM_DISTRESS_DAYS,
  FIRM_INSOLVENCY_DAYS,
  FRIENDSHIP_CONTACT_GAIN,
  FRIENDSHIP_DAILY_DECAY,
  FRIENDSHIP_DECAY_GRACE_DAYS,
  FRIENDSHIP_END_THRESHOLD,
  FOOD_HEALTH_RECOVERY,
  FOOD_QUALITY_DECAY_PER_DAY,
  HOUSING_DISPLACEMENT_RATE,
  HOUSING_RECEIVERSHIP_GRACE_DAYS,
  HOUSING_REPLACEMENT_STAFF,
  HOUSING_RESTART_COST,
  INITIAL_FRIENDSHIP_STRENGTH,
  MAINTENANCE_INTERVAL_DAYS,
  MIN_FOOD_QUALITY,
  MISSED_MAINTENANCE_CAPACITY,
  NAMES,
  PHASES,
  PRICE_ADJUSTMENT_RATE,
  PRICE_CEILING_MULTIPLIER,
  PRICE_FLOOR_MULTIPLIER,
  PRICE_REVIEW_DAYS,
  PRODUCTS,
  RENT_INTERVAL_DAYS,
  STAFFING_REVENUE_BUFFER,
  SUPPLY_CONTRACTS,
  VITAL_RESCUE_CAP,
  VITAL_RESCUE_RUNWAY_DAYS,
} from "./config.js";
import {
  ATTENDANCE_ACTIONS,
  createMotivationProfile,
  JOB_OFFER_ACTIONS,
  MotivationCitizenPolicy,
  SKIP_JOB_SEARCH,
} from "./citizen-policy.ts";
import { createRandom } from "./random.js";

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const roundMoney = (value) => Math.round(value * 100) / 100;

export class TownSimulation {
  constructor({ seed = 20260823, policy = {}, citizenPolicy = new MotivationCitizenPolicy() } = {}) {
    this.seed = seed;
    this.policy = { ...DEFAULT_POLICY, ...policy };
    this.citizenPolicy = citizenPolicy;
    this.reset();
  }

  reset(seed = this.seed) {
    this.seed = seed;
    this.random = createRandom(seed);
    this.day = 1;
    this.phase = 0;
    this.flows = [];
    this.government = { kind: "government", id: 0, name: "Town treasury", cash: 120, x: 0.88, y: 0.55, activitySequence: 0, ledger: [], events: [] };
    this.firms = FIRMS.map((firm, id) => ({
      ...firm,
      kind: "firm",
      id,
      cash: 150,
      basePrice: firm.price,
      minimumPrice: roundMoney(firm.price * PRICE_FLOOR_MULTIPLIER),
      maximumPrice: roundMoney(firm.price * PRICE_CEILING_MULTIPLIER),
      owner: id,
      employees: [],
      sales: 0,
      inputCosts: 0,
      operatingSupplies: 0,
      operationalReadiness: 1,
      lastMaintenanceDay: 0,
      receivershipDay: null,
      receivershipCount: 0,
      lastDisplacementDay: null,
      publiclyOperated: false,
      unitsSold: 0,
      transactionsToday: 0,
      attemptedTransactions: 0,
      turnedAwayTransactions: 0,
      priceRejectionsToday: 0,
      pricingWindow: { unitsSold: 0, revenue: 0, inputCosts: 0, priceRejections: 0, turnedAway: 0 },
      active: true,
      status: "operating",
      distressDays: 0,
      rescueCount: 0,
      lastRescueDay: null,
      trouble: 0,
      revenueEMA: firm.initialStaff * firm.wage * STAFFING_REVENUE_BUFFER,
      targetStaff: firm.initialStaff,
      vacancyAge: 0,
      overstaffedDays: 0,
      ownerDecision: {
        wageDay: null,
        wage: "not assessed",
        wageReason: "payroll has not run",
        dividendDay: null,
        dividend: 0,
        dividendType: "none",
        dividendReason: "settlement has not run",
        capitalDay: null,
        capitalContribution: 0,
        capitalReason: "financing has not been assessed",
        continuationDay: null,
        continuation: "not assessed",
        continuationReason: "financing has not been assessed",
        priceDay: null,
        price: firm.price,
        previousPrice: firm.price,
        priceDecision: "not reviewed",
        priceReason: "the first pricing window is still open",
      },
      activitySequence: 0,
      decisionSequence: 0,
      decisions: [],
      ledger: [],
      events: [],
    }));
    this.contracts = SUPPLY_CONTRACTS.map((contract, id) => ({
      ...contract,
      id,
      baseUnitPrice: contract.unitPrice,
      supplierId: this.firms.findIndex((firm) => firm.name === contract.supplier),
      buyerId: this.firms.findIndex((firm) => firm.name === contract.buyer),
      active: true,
      requestedToday: 0,
      deliveredToday: 0,
      shortfallToday: 0,
    }));
    this.contracts.filter((contract) => contract.use === "operations").forEach((contract) => {
      this.firms[contract.buyerId].operatingSupplies = contract.targetStock;
    });
    this.validateProductGraph();
    this.people = NAMES.map((name, id) => {
      const homeX = 0.68 + this.random() * 0.22;
      const homeY = 0.43 + this.random() * 0.18;
      return {
        kind: "person",
        id,
        name,
        alive: true,
        deathDay: null,
        estateTransferred: 0,
        criticalHealthDays: 0,
        cash: roundMoney(18 + this.random() * 62),
        skill: 0.25 + this.random() * 0.65,
        reliability: 0.55 + this.random() * 0.43,
        employer: -1,
        jobApplicationFirm: -1,
        relationships: {},
        socialCapacity: 3 + Math.floor(this.random() * 4),
        lastSocialDay: 0,
        hungryDays: 0,
        rentArrears: 0,
        housed: true,
        health: 0.58 + this.random() * 0.36,
        stress: 0.12 + this.random() * 0.25,
        esteemBaseline: 0.05 + this.random() * 0.12,
        motivationProfile: createMotivationProfile(this.seed, id),
        dividendPreference: 0.15 + (id % 5) * 0.04,
        ownerRecoveryThreshold: 0.6 + (id % 4) * 0.08,
        growth: 0.04 + this.random() * 0.15,
        attended: true,
        scarcityError: false,
        missedWork: 0,
        foodSeller: -1,
        foodReserveTarget: 1 + (id % 3),
        foodStock: [],
        lastFoodQuality: null,
        lastFoodAge: null,
        personalSeller: -1,
        rentSeller: -1,
        homeX,
        homeY,
        x: homeX,
        y: homeY,
        activitySequence: 1,
        decisionSequence: 0,
        decisions: [],
        ledger: [],
        events: [{ day: 1, sequence: 1, text: "entered the town economy", kind: "neutral" }],
      };
    });

    for (let i = 0; i < 52; i += 1) {
      const a = this.random.pick(this.people);
      const b = this.random.pick(this.people);
      if (a !== b && !a.relationships[b.id] && this.friendIds(a).length < a.socialCapacity && this.friendIds(b).length < b.socialCapacity) {
        this.formFriendship(a, b, INITIAL_FRIENDSHIP_STRENGTH, 0);
      }
    }
    this.firms.forEach((firm) => this.hire(firm, this.people[firm.owner], true));
    this.firms.forEach((firm) => {
      this.people
        .filter((person) => person.employer < 0)
        .sort((a, b) => b.skill - a.skill)
        .slice(0, Math.max(0, firm.initialStaff - firm.employees.length))
        .forEach((person) => this.hire(firm, person, true));
    });
    this.people.forEach((person) => {
      this.updateStress(person);
      this.assessNeeds(person);
    });
    this.initialMoney = this.totalMoney();
    return this;
  }

  setPolicy(name, value) {
    if (!(name in this.policy)) throw new Error(`Unknown policy: ${name}`);
    this.policy[name] = Number(value);
  }

  totalMoney() {
    return roundMoney(
      this.people.reduce((sum, person) => sum + person.cash, 0)
      + this.firms.reduce((sum, firm) => sum + firm.cash, 0)
      + this.government.cash,
    );
  }

  validateProductGraph() {
    this.firms.forEach((firm) => {
      if (!PRODUCTS[firm.sells]) throw new Error(`${firm.name} sells an unknown product`);
      if (firm.input && !PRODUCTS[firm.input]) throw new Error(`${firm.name} uses an unknown input`);
      if (firm.source && !this.firms.some((supplier) => supplier.name === firm.source && supplier.sells === firm.input)) {
        throw new Error(`${firm.name} has no valid source for ${firm.input}`);
      }
    });
    this.contracts.forEach((contract) => {
      const supplier = this.firms[contract.supplierId];
      const buyer = this.firms[contract.buyerId];
      const validOperatingInput = contract.use === "operations" && buyer.sells === contract.output;
      const validResaleInput = contract.use !== "operations" && buyer.input === contract.product && buyer.sells === contract.output;
      if (!supplier || !buyer || supplier.sells !== contract.product || (!validOperatingInput && !validResaleInput)) {
        throw new Error(`Invalid supply contract ${contract.id}`);
      }
    });
  }

  note(person, text, kind = "neutral") {
    person.activitySequence += 1;
    person.events.unshift({ day: this.day, sequence: person.activitySequence, text, kind });
  }

  ledger(person, { direction, amount, text, before }) {
    person.activitySequence += 1;
    person.ledger.unshift({
      day: this.day,
      sequence: person.activitySequence,
      direction,
      amount: roundMoney(amount),
      text,
      before: roundMoney(before),
      after: roundMoney(person.cash),
    });
  }

  transfer(from, to, requested, { exact = false } = {}) {
    if (!Number.isFinite(requested) || requested < 0) throw new Error("Transfers must be finite and non-negative");
    if (exact && from.cash + 1e-9 < requested) return 0;
    const amount = roundMoney(Math.min(requested, from.cash));
    from.cash = roundMoney(from.cash - amount);
    to.cash = roundMoney(to.cash + amount);
    if (from.cash < -1e-9) throw new Error(`${from.name} was overdrawn`);
    if (amount > 0) this.flows.push({ from: { kind: from.kind, id: from.id }, to: { kind: to.kind, id: to.id }, amount, phase: this.phase });
    this.flows = this.flows.slice(-40);
    return amount;
  }

  essentialCost() {
    const food = this.firms.filter((firm) => firm.active && firm.sector === "food").sort((a, b) => a.price - b.price)[0];
    const housing = this.firms.find((firm) => firm.active && firm.sector === "housing");
    return (food?.price ?? 3) + (housing?.price ?? 5) / RENT_INTERVAL_DAYS;
  }

  rentDueToday() {
    return (this.day - 1) % RENT_INTERVAL_DAYS === 0;
  }

  daysUntilRent() {
    return (RENT_INTERVAL_DAYS - ((this.day - 1) % RENT_INTERVAL_DAYS)) % RENT_INTERVAL_DAYS;
  }

  runwayDays(person) {
    return person.cash / this.essentialCost();
  }

  friendIds(person) {
    return Object.keys(person.relationships).map(Number);
  }

  relationshipStats(person) {
    const relationships = Object.values(person.relationships);
    return {
      count: relationships.length,
      totalStrength: relationships.reduce((sum, relationship) => sum + relationship.strength, 0),
      strongest: relationships.reduce((strongest, relationship) => Math.max(strongest, relationship.strength), 0),
    };
  }

  formFriendship(a, b, strength = INITIAL_FRIENDSHIP_STRENGTH, contactDay = this.day) {
    if (a === b || !a.alive || !b.alive || a.relationships[b.id] || this.friendIds(a).length >= a.socialCapacity || this.friendIds(b).length >= b.socialCapacity) return false;
    const relationship = { strength: clamp(strength), lastContactDay: contactDay, lastDecayDay: contactDay };
    a.relationships[b.id] = { ...relationship };
    b.relationships[a.id] = { ...relationship };
    return true;
  }

  recordSocialContact(a, b) {
    a.lastSocialDay = b.lastSocialDay = this.day;
    const relationship = a.relationships[b.id];
    if (!relationship) return this.formFriendship(a, b);
    const strength = clamp(relationship.strength + FRIENDSHIP_CONTACT_GAIN);
    a.relationships[b.id] = { strength, lastContactDay: this.day, lastDecayDay: this.day };
    b.relationships[a.id] = { strength, lastContactDay: this.day, lastDecayDay: this.day };
    return true;
  }

  decayRelationships() {
    this.people.forEach((person) => {
      this.friendIds(person).filter((friendId) => friendId > person.id).forEach((friendId) => {
        const friend = this.people[friendId];
        const relationship = person.relationships[friendId];
        const decayStart = Math.max(relationship.lastDecayDay, relationship.lastContactDay + FRIENDSHIP_DECAY_GRACE_DAYS);
        const elapsed = Math.max(0, this.day - decayStart);
        if (!elapsed) return;
        const strength = clamp(relationship.strength - elapsed * FRIENDSHIP_DAILY_DECAY);
        if (strength < FRIENDSHIP_END_THRESHOLD) {
          delete person.relationships[friendId];
          delete friend.relationships[person.id];
          this.note(person, `friendship with ${friend.name} faded after prolonged distance`, "bad");
          this.note(friend, `friendship with ${person.name} faded after prolonged distance`, "bad");
          return;
        }
        person.relationships[friendId] = { ...relationship, strength, lastDecayDay: this.day };
        friend.relationships[person.id] = { ...relationship, strength, lastDecayDay: this.day };
      });
    });
  }

  stressPressure(person) {
    const runwayPressure = 1 - clamp(this.runwayDays(person) / 12);
    const firmRisk = person.employer >= 0 ? clamp((this.firms[person.employer].trouble || 0) / 4) : 1;
    const relationships = this.relationshipStats(person);
    const contactStaleness = clamp((this.day - person.lastSocialDay - 3) / 10);
    const isolation = relationships.count ? clamp((1 - relationships.strongest) * 0.35 + contactStaleness * 0.65) : 1;
    return clamp(
      runwayPressure * 0.42
      + firmRisk * 0.16
      + (person.hungryDays ? 0.18 : 0)
      + (!person.housed ? 0.17 : 0)
      + isolation * 0.07,
    );
  }

  updateStress(person) {
    const pressure = this.stressPressure(person);
    person.stress = clamp(person.stress * 0.7 + pressure * 0.3 + (this.random() - 0.5) * 0.025);
  }

  assessNeeds(person) {
    const ownsFirm = this.firms.some((firm) => firm.active && firm.owner === person.id);
    const fed = clamp(1 - person.hungryDays / 3);
    const physiological = clamp(person.health * 0.52 + fed * 0.48);
    const jobSecurity = person.employer >= 0 ? 1 - clamp((this.firms[person.employer].trouble || 0) / 4) : 0;
    const safety = clamp((person.housed ? 0.23 : 0) + (person.employer >= 0 ? 0.18 : 0) + jobSecurity * 0.15 + clamp(this.runwayDays(person) / 12) * 0.44);
    const relationships = this.relationshipStats(person);
    const recentContact = this.day - person.lastSocialDay <= 3 ? 0.2 : 0;
    const belonging = clamp(0.12 + Math.min(1, relationships.totalStrength / Math.max(3, person.socialCapacity)) * 0.68 + recentContact);
    const esteem = clamp(0.1 + person.skill * 0.32 + (person.employer >= 0 ? 0.18 : 0) + (ownsFirm ? 0.18 : 0) + person.esteemBaseline);
    const growth = clamp(person.growth);
    person.needs = { physiological, safety, belonging, esteem, growth };
    person.focus = ["physiological", "safety", "belonging", "esteem"].find((need) => person.needs[need] < 0.75)
      || (person.stress < 0.45 ? "growth" : "safety");
    return person.needs;
  }

  hire(firm, person, silent = false) {
    if (!firm.active || !person.alive || person.employer >= 0) return false;
    person.employer = firm.id;
    person.jobApplicationFirm = -1;
    firm.employees.push(person.id);
    if (!silent) this.note(person, `hired by ${firm.name}`, "good");
    return true;
  }

  fire(firm, person, reason) {
    firm.employees = firm.employees.filter((id) => id !== person.id);
    person.employer = -1;
    this.note(person, `${reason} at ${firm.name}`, "bad");
  }

  considerJobOffer(firm, candidate, offeredWage) {
    if (!firm.active || !candidate.alive || candidate.employer >= 0) return false;
    const needs = this.assessNeeds(candidate);
    const observation = Object.freeze({
      kind: "job-offer",
      citizenId: candidate.id,
      citizenName: candidate.name,
      firmId: firm.id,
      firmName: firm.name,
      offeredWage,
      reservationWage: 3.2 + candidate.skill * 4.5,
      skill: candidate.skill,
      reliability: candidate.reliability,
      acceptanceProbability: 0.5 + candidate.reliability * 0.35,
      acceptanceDraw: this.random(),
      stress: candidate.stress,
      runwayDays: this.runwayDays(candidate),
      safetyNeed: needs.safety,
      profile: candidate.motivationProfile,
    });
    const legalActions = Object.freeze([...JOB_OFFER_ACTIONS]);
    const decision = this.citizenPolicy.decide({ observation, legalActions, random: this.random });
    if (!decision || !legalActions.includes(decision.action)) {
      throw new Error(`Citizen policy ${this.citizenPolicy.id ?? "unknown"} chose an illegal job-offer action`);
    }
    this.recordDecision(candidate, observation, legalActions, decision, "Settlement");
    if (decision.action !== "accept-job-offer") return false;
    return this.hire(firm, candidate);
  }

  eligibleJobFirms(firms = this.firms) {
    return firms.filter((firm) => firm.active
      && firm.vacancyAge >= 2
      && firm.targetStaff > firm.employees.length);
  }

  considerJobSearch(person, firms = this.firms) {
    if (!person.alive || person.employer >= 0) return null;
    person.jobApplicationFirm = -1;
    const eligibleFirms = this.eligibleJobFirms(firms);
    if (!eligibleFirms.length) return null;
    const needs = this.assessNeeds(person);
    const reservationWage = 3.2 + person.skill * 4.5;
    const options = eligibleFirms.map((firm) => Object.freeze({
      action: `apply-job:${firm.id}`,
      firmId: firm.id,
      firmName: firm.name,
      offeredWage: Math.max(this.policy.minimumWage, firm.wage),
      reservationWage,
      firmTrouble: firm.trouble,
      vacancyAge: firm.vacancyAge,
    }));
    const observation = Object.freeze({
      kind: "job-search",
      citizenId: person.id,
      citizenName: person.name,
      skill: person.skill,
      reliability: person.reliability,
      stress: person.stress,
      runwayDays: this.runwayDays(person),
      safetyNeed: needs.safety,
      profile: person.motivationProfile,
      options: Object.freeze(options),
    });
    const legalActions = Object.freeze([SKIP_JOB_SEARCH, ...options.map((option) => option.action)]);
    const decision = this.citizenPolicy.decide({ observation, legalActions, random: this.random });
    if (!decision || !legalActions.includes(decision.action)) {
      throw new Error(`Citizen policy ${this.citizenPolicy.id ?? "unknown"} chose an illegal job-search action`);
    }
    this.recordDecision(person, observation, legalActions, decision, "Settlement");
    const application = options.find((option) => option.action === decision.action);
    person.jobApplicationFirm = application?.firmId ?? -1;
    return application?.firmId ?? null;
  }

  runJobMarket(firms = this.firms) {
    this.people.forEach((person) => { person.jobApplicationFirm = -1; });
    const eligibleFirms = this.eligibleJobFirms(firms);
    if (!eligibleFirms.length) return 0;
    this.people
      .filter((person) => person.alive && person.employer < 0)
      .forEach((person) => this.considerJobSearch(person, eligibleFirms));
    let hires = 0;
    eligibleFirms.forEach((firm) => {
      const candidate = this.people
        .filter((person) => person.alive && person.employer < 0 && person.jobApplicationFirm === firm.id)
        .sort((a, b) => b.skill + b.reliability * 0.25 - (a.skill + a.reliability * 0.25))[0];
      const wage = Math.max(this.policy.minimumWage, firm.wage);
      if (candidate && this.considerJobOffer(firm, candidate, wage)) {
        firm.vacancyAge = 0;
        hires += 1;
      }
    });
    return hires;
  }

  considerAttendance(person, firm) {
    if (!person.alive || person.employer !== firm.id || !firm.active) return false;
    const baselineMissChance = 0.015 + person.stress * 0.1 + (1 - person.health) * 0.22 + (person.hungryDays ? 0.1 : 0);
    const observation = Object.freeze({
      kind: "attendance",
      citizenId: person.id,
      citizenName: person.name,
      firmId: firm.id,
      firmName: firm.name,
      health: person.health,
      stress: person.stress,
      hungryDays: person.hungryDays,
      runwayDays: this.runwayDays(person),
      reliability: person.reliability,
      missedWork: person.missedWork,
      baselineMissChance,
      attendanceDraw: this.random(),
      profile: person.motivationProfile,
    });
    const legalActions = Object.freeze([...ATTENDANCE_ACTIONS]);
    const decision = this.citizenPolicy.decide({ observation, legalActions, random: this.random });
    if (!decision || !legalActions.includes(decision.action)) {
      throw new Error(`Citizen policy ${this.citizenPolicy.id ?? "unknown"} chose an illegal attendance action`);
    }
    this.recordDecision(person, observation, legalActions, decision, "Production");
    person.attended = decision.action === "attend-shift";
    if (!person.attended) {
      person.missedWork += 1;
      person.reliability = clamp(person.reliability - 0.018);
      this.note(person, "missed a shift and earned no wage", "bad");
    } else person.missedWork = Math.max(0, person.missedWork - 1);
    return person.attended;
  }

  recordDecision(person, observation, legalActions, decision, phase) {
    person.decisionSequence += 1;
    person.decisions.unshift({
      day: this.day,
      phase,
      sequence: person.decisionSequence,
      policy: this.citizenPolicy.id ?? "unknown",
      kind: observation.kind,
      observation: structuredClone(observation),
      legalActions: [...legalActions],
      chosenAction: decision.action,
      reasons: Array.isArray(decision.reasons) ? [...decision.reasons] : [],
      scores: decision.scores ? { ...decision.scores } : {},
    });
  }

  considerOwnerAction(owner, firm, domain, options, phase) {
    if (!owner.alive || !firm.active || !options.length) return null;
    const frozenOptions = Object.freeze(options.map((option) => Object.freeze({ ...option })));
    const observation = Object.freeze({
      kind: "owner",
      domain,
      citizenId: owner.id,
      citizenName: owner.name,
      firmId: firm.id,
      firmName: firm.name,
      ownerRunwayDays: this.runwayDays(owner),
      firmRunwayDays: firm.cash / Math.max(1, this.nextOperatingNeed(firm)),
      firmTrouble: firm.trouble,
      employeeCount: firm.employees.length,
      extractionPreference: owner.dividendPreference,
      profile: owner.motivationProfile,
      options: frozenOptions,
    });
    const legalActions = Object.freeze(frozenOptions.map((option) => option.action));
    const decision = this.citizenPolicy.decide({ observation, legalActions, random: this.random });
    if (!decision || !legalActions.includes(decision.action)) {
      throw new Error(`Citizen policy ${this.citizenPolicy.id ?? "unknown"} chose an illegal owner-${domain} action`);
    }
    this.recordDecision(owner, observation, legalActions, decision, phase);
    this.recordDecision(firm, observation, legalActions, decision, phase);
    return { option: frozenOptions.find((option) => option.action === decision.action), decision };
  }

  die(person, reason = "died after health reached a critical level") {
    if (!person.alive) return false;
    if (person.employer >= 0) {
      const firm = this.firms[person.employer];
      firm.employees = firm.employees.filter((id) => id !== person.id);
      person.employer = -1;
    }
    this.friendIds(person).forEach((friendId) => {
      const friend = this.people[friendId];
      delete friend.relationships[person.id];
    });
    person.relationships = {};
    person.jobApplicationFirm = -1;
    person.alive = false;
    person.deathDay = this.day;
    person.attended = false;
    person.socialToday = false;
    person.rentArrears = 0;
    const estateBefore = person.cash;
    person.estateTransferred = this.transfer(person, this.government, estateBefore, { exact: true });
    if (person.estateTransferred > 0) {
      this.ledger(person, {
        direction: "out",
        amount: person.estateTransferred,
        text: "intestate estate transferred to treasury",
        before: estateBefore,
      });
    }
    this.note(person, reason, "bad");
    return true;
  }

  transactionCapacity(firm) {
    const attending = firm.employees.reduce((total, id) => total + (this.people[id].attended ? 1 : 0), 0);
    return Math.floor(attending * firm.transactionsPerWorker * firm.operationalReadiness);
  }

  maintainFirm(firm) {
    if (!firm.active) return;
    const maintenanceContract = this.contracts.find((contract) => contract.use === "operations" && contract.buyerId === firm.id);
    if (!maintenanceContract) return;
    const maintenanceDue = this.day - firm.lastMaintenanceDay >= MAINTENANCE_INTERVAL_DAYS;
    if (!maintenanceDue && firm.operationalReadiness >= 1) return;
    if (firm.operatingSupplies >= 1) {
      const wasConstrained = firm.operationalReadiness < 1;
      firm.operatingSupplies -= 1;
      firm.operationalReadiness = 1;
      firm.lastMaintenanceDay = this.day;
      if (wasConstrained) this.note(firm, "maintenance supplies restored full operating capacity", "good");
      return;
    }
    if (firm.operationalReadiness >= 1) this.note(firm, "missing a maintenance kit reduced operating capacity", "bad");
    firm.operationalReadiness = MISSED_MAINTENANCE_CAPACITY;
  }

  requestTransaction(firm, person, purpose) {
    firm.attemptedTransactions += 1;
    if (firm.transactionsToday >= this.transactionCapacity(firm)) {
      firm.turnedAwayTransactions += 1;
      this.note(person, `${firm.name} could not serve the ${purpose} transaction`, "bad");
      return false;
    }
    firm.transactionsToday += 1;
    return true;
  }

  buy(person, firm, units, purpose) {
    if (!person.alive || !firm?.active || firm.inventory < units) return 0;
    const cost = roundMoney(firm.price * units);
    if (person.cash + 1e-9 < cost) {
      firm.priceRejectionsToday += 1;
      return 0;
    }
    if (!this.requestTransaction(firm, person, purpose)) return 0;
    const before = person.cash;
    const paid = this.transfer(person, firm, cost, { exact: true });
    if (paid !== cost) return 0;
    firm.inventory -= units;
    firm.sales += paid;
    firm.unitsSold += units;
    if (purpose === "food") {
      person.foodSeller = firm.id;
      for (let unit = 0; unit < units; unit += 1) {
        person.foodStock.push({ purchasedDay: this.day, quality: firm.quality, seller: firm.id });
      }
    } else person.personalSeller = firm.id;
    const description = purpose === "food"
      ? `bought ${units} food portion${units === 1 ? "" : "s"} from ${firm.name}`
      : `${purpose} to ${firm.name}`;
    this.ledger(person, { direction: "out", amount: paid, text: description, before });
    return paid;
  }

  consumeFood(person, food) {
    const age = Math.max(0, this.day - food.purchasedDay);
    const quality = this.effectiveFoodQuality(food);
    person.lastFoodQuality = quality;
    person.lastFoodAge = age;
    person.foodSeller = food.seller;
    person.hungryDays = Math.max(0, person.hungryDays - 1);
    person.health = clamp(person.health + quality * FOOD_HEALTH_RECOVERY);
    return quality;
  }

  effectiveFoodQuality(food) {
    const age = Math.max(0, this.day - food.purchasedDay);
    return clamp(food.quality - age * FOOD_QUALITY_DECAY_PER_DAY, MIN_FOOD_QUALITY, 1);
  }

  productionPhase() {
    this.firms.forEach((firm) => this.maintainFirm(firm));
    this.people.forEach((person) => {
      if (!person.alive) {
        person.attended = false;
        person.scarcityError = false;
        return;
      }
      person.scarcityError = this.random() < person.stress ** 2 * 0.24;
      if (person.employer < 0) return void (person.attended = false);
      this.considerAttendance(person, this.firms[person.employer]);
    });
    this.firms.forEach((firm) => {
      if (!firm.active || firm.production !== "direct") return;
      firm.inventory += firm.employees.reduce((sum, id) => {
        const person = this.people[id];
        return sum + (person.attended ? (0.42 + person.skill * 0.75) * firm.productivity * person.health * (1 - person.stress * 0.32) * firm.operationalReadiness : 0);
      }, 0);
    });
  }

  procurementPhase() {
    this.contracts.forEach((contract) => {
      contract.deliveredToday = 0;
      contract.shortfallToday = 0;
      contract.requestedToday = 0;
      const supplier = this.firms[contract.supplierId];
      const buyer = this.firms[contract.buyerId];
      if (!contract.active || !supplier.active || !buyer.active) return;
      const buyerStock = contract.use === "operations" ? buyer.operatingSupplies : buyer.inventory;
      const targetStock = contract.targetStock ?? contract.dailyQuantity * 2;
      contract.requestedToday = Math.min(contract.dailyQuantity, Math.max(0, Math.ceil(targetStock - buyerStock)));
      const available = Math.floor(supplier.inventory);
      const affordable = Math.floor((buyer.cash + 1e-9) / contract.unitPrice);
      const units = Math.min(contract.requestedToday, available, affordable);
      supplier.priceRejectionsToday += Math.max(0, Math.min(contract.requestedToday, available) - affordable);
      const cost = roundMoney(units * contract.unitPrice);
      if (units > 0) {
        const buyerBefore = buyer.cash;
        const supplierBefore = supplier.cash;
        const paid = this.transfer(buyer, supplier, cost, { exact: true });
        if (paid === cost) {
          supplier.inventory -= units;
          if (contract.use === "operations") buyer.operatingSupplies += units;
          else buyer.inventory += units;
          supplier.sales += paid;
          supplier.unitsSold += units;
          buyer.inputCosts += paid;
          contract.deliveredToday = units;
          const unit = PRODUCTS[contract.product].unit;
          const quantity = `${units} ${unit}${units === 1 ? "" : "s"}`;
          this.ledger(buyer, { direction: "out", amount: paid, text: `${quantity} from ${supplier.name}`, before: buyerBefore });
          this.ledger(supplier, { direction: "in", amount: paid, text: `${quantity} to ${buyer.name}`, before: supplierBefore });
        }
      }
      contract.shortfallToday = contract.requestedToday - contract.deliveredToday;
      if (contract.shortfallToday > 0) {
        this.note(buyer, `${supplier.name} delivered ${contract.deliveredToday} of ${contract.requestedToday} requested ${PRODUCTS[contract.product].unit}s`, "bad");
      }
    });
  }

  payrollPhase() {
    const taxRate = this.policy.taxRate / 100;
    this.firms.forEach((firm) => {
      const attendees = firm.employees.map((id) => this.people[id]).filter((person) => person.alive && person.attended);
      const wage = Math.max(this.policy.minimumWage, firm.wage);
      const compensation = attendees.map((person) => ({
        person,
        decision: person.id === firm.owner ? this.ownerWageDecision(firm, person) : { draw: true, reason: "employee wage for attended work" },
      }));
      const payable = compensation.filter(({ decision }) => decision.draw);
      const ratio = payable.length ? Math.min(1, firm.cash / (wage * payable.length)) : 1;
      compensation.forEach(({ person, decision }) => {
        if (person.id === firm.owner) {
          const previousWage = firm.ownerDecision.wage;
          firm.ownerDecision.wageDay = this.day;
          firm.ownerDecision.wage = decision.draw ? "drawn" : "waived";
          firm.ownerDecision.wageReason = decision.reason;
          if (!decision.draw) {
            if (previousWage !== "waived") {
              this.note(person, `waived owner wage from ${firm.name} to preserve operating cash`, "neutral");
              this.note(firm, `${person.name} waived the owner wage to preserve operating cash`, "good");
            }
            return;
          }
          if (previousWage === "waived") this.note(firm, `${person.name} resumed drawing an owner wage`, "neutral");
        }
        const gross = wage * ratio * (0.75 + person.reliability * 0.25);
        const before = person.cash;
        const paid = this.transfer(firm, person, gross * (1 - taxRate));
        const tax = this.transfer(firm, this.government, Math.min(firm.cash, gross * taxRate));
        this.ledger(person, { direction: "in", amount: paid, text: `wage from ${firm.name}; ${tax.toFixed(1)} employer tax`, before });
        if (ratio < 0.65) {
          firm.trouble += 1;
          this.note(person, `${firm.name} could not meet payroll`, "bad");
        }
      });
    });
  }

  ownerWageDecision(firm, owner) {
    const firmNeedsCash = firm.cash + 1e-9 < this.nextOperatingNeed(firm);
    const ownerIsSecure = this.runwayDays(owner) >= 10;
    const choice = this.considerOwnerAction(owner, firm, "wage", [
      {
        action: "draw-owner-wage",
        label: "Draw the attended owner wage",
        personalSafety: ownerIsSecure ? 0.2 : 1,
        firmContinuity: firmNeedsCash ? 0 : 0.75,
        workerProtection: firmNeedsCash ? 0 : 0.5,
        growth: 0.1,
        extraction: 0.65,
        exitRelief: 0,
      },
      {
        action: "waive-owner-wage",
        label: "Waive the owner wage for this shift",
        personalSafety: ownerIsSecure ? 0.75 : 0,
        firmContinuity: firmNeedsCash ? 1 : 0.5,
        workerProtection: firmNeedsCash ? 1 : 0.35,
        growth: 0.25,
        extraction: 0,
        exitRelief: 0.1,
      },
    ], "Payroll");
    const draw = choice.option.action === "draw-owner-wage";
    if (!draw) return { draw, reason: firmNeedsCash ? "secure owner chose to preserve operating cash" : "owner chose to retain the attended wage in the firm" };
    if (firmNeedsCash) return { draw, reason: "owner runway is thin despite firm cash pressure" };
    return { draw, reason: "firm can cover its next operating need" };
  }

  foodPhase() {
    const foodFirms = this.firms.filter((firm) => firm.active && firm.sector === "food" && firm.inventory >= 1).sort((a, b) => a.price - b.price);
    this.people.forEach((person) => {
      if (!person.alive) return;
      person.socialToday = false;
      this.considerFood(person, foodFirms);
    });
  }

  considerFood(person, foodFirms) {
    if (!person.alive) return false;
    const options = person.foodStock.length
      ? person.foodStock.map((food, index) => ({
        action: `eat-stored-food:${index}`,
        source: "stored",
        sellerId: food.seller,
        sellerName: this.firms[food.seller]?.name ?? "unknown seller",
        units: 1,
        unitPrice: 0,
        totalPrice: 0,
        effectiveQuality: this.effectiveFoodQuality(food),
        age: Math.max(0, this.day - food.purchasedDay),
        capacityAvailable: true,
      }))
      : foodFirms.flatMap((firm) => {
        const maxUnits = Math.min(person.foodReserveTarget, Math.floor(firm.inventory), Math.floor((person.cash + 1e-9) / firm.price));
        return Array.from({ length: maxUnits }, (_, index) => {
          const units = index + 1;
          return {
            action: `buy-food:${firm.id}:${units}`,
            source: "seller",
            sellerId: firm.id,
            sellerName: firm.name,
            units,
            unitPrice: firm.price,
            totalPrice: roundMoney(firm.price * units),
            effectiveQuality: firm.quality,
            age: 0,
            capacityAvailable: firm.transactionsToday < this.transactionCapacity(firm),
          };
        });
      });
    if (!person.foodStock.length && !options.length && foodFirms.length) foodFirms[0].priceRejectionsToday += 1;
    const legalActions = Object.freeze(["skip-food", ...options.map((option) => option.action)]);
    const observation = Object.freeze({
      kind: "food",
      citizenId: person.id,
      citizenName: person.name,
      stress: person.stress,
      health: person.health,
      hungryDays: person.hungryDays,
      runwayDays: this.runwayDays(person),
      reserveTarget: person.foodReserveTarget,
      scarcityError: person.scarcityError,
      profile: { ...person.motivationProfile },
      options: options.map((option) => ({ ...option })),
    });
    const decision = this.citizenPolicy.decide({ observation, legalActions, random: this.random });
    if (!decision || !legalActions.includes(decision.action)) {
      throw new Error(`Citizen policy ${this.citizenPolicy.id ?? "unknown"} chose an illegal food action`);
    }
    this.recordDecision(person, observation, legalActions, decision, "Food shopping");

    let ate = false;
    if (decision.action.startsWith("eat-stored-food:")) {
      const index = Number(decision.action.split(":")[1]);
      const [meal] = person.foodStock.splice(index, 1);
      if (meal) {
        this.consumeFood(person, meal);
        ate = true;
      }
    } else if (decision.action.startsWith("buy-food:")) {
      const option = options.find((candidate) => candidate.action === decision.action);
      if (option && this.buy(person, this.firms[option.sellerId], option.units, "food")) {
        const meal = person.foodStock.shift();
        if (meal) {
          this.consumeFood(person, meal);
          ate = true;
        }
      }
    }
    if (ate) return true;

    person.hungryDays += 1;
    person.health = clamp(person.health - 0.045);
    if (decision.action === "skip-food" && options.length) this.note(person, "motivation-driven avoidance deferred available food", "bad");
    else if (person.hungryDays === 2) this.note(person, "missed food for two days", "bad");
    return false;
  }

  housingPhase() {
    const housing = this.firms.find((firm) => firm.active && firm.sector === "housing");
    if (!housing) return;
    this.people.forEach((person) => {
      if (!person.alive) return;
      if (!person.housed) person.rentArrears = 0;
      if (person.housed && !this.rentDueToday()) return;
      this.considerHousing(person, housing);
    });
  }

  considerHousing(person, housing) {
    if (!person.alive || !housing?.active) return false;
    const wasHoused = person.housed;
    const due = roundMoney(wasHoused ? housing.price : housing.price * 3);
    const canPay = person.cash + 1e-9 >= due;
    if (!canPay) housing.priceRejectionsToday += 1;
    const option = canPay ? {
      action: `${wasHoused ? "pay-housing" : "secure-housing"}:${housing.id}`,
      firmId: housing.id,
      firmName: housing.name,
      totalPrice: due,
      capacityAvailable: housing.transactionsToday < this.transactionCapacity(housing),
    } : null;
    const inactiveAction = wasHoused ? "defer-housing" : "remain-unhoused";
    const legalActions = Object.freeze([inactiveAction, ...(option ? [option.action] : [])]);
    const observation = Object.freeze({
      kind: "housing",
      citizenId: person.id,
      citizenName: person.name,
      housed: wasHoused,
      rentArrears: person.rentArrears,
      stress: person.stress,
      runwayDays: this.runwayDays(person),
      scarcityError: person.scarcityError,
      profile: { ...person.motivationProfile },
      options: option ? [{ ...option }] : [],
    });
    const decision = this.citizenPolicy.decide({ observation, legalActions, random: this.random });
    if (!decision || !legalActions.includes(decision.action)) {
      throw new Error(`Citizen policy ${this.citizenPolicy.id ?? "unknown"} chose an illegal housing action`);
    }
    this.recordDecision(person, observation, legalActions, decision, "Housing and bills");

    if (option && decision.action === option.action) {
      const before = person.cash;
      const paid = this.requestTransaction(housing, person, "housing payment")
        ? this.transfer(person, housing, due, { exact: true })
        : 0;
      if (paid === due) {
        housing.sales += paid;
        housing.unitsSold += 1;
        person.rentSeller = housing.id;
        person.rentArrears = 0;
        person.housed = true;
        this.ledger(person, { direction: "out", amount: paid, text: `${due > housing.price ? "deposit and rent" : "rent"} to ${housing.name}`, before });
        if (due > housing.price) this.note(person, "secured housing again", "good");
        return true;
      }
    }

    if (wasHoused) {
      person.rentArrears += 1;
      if (decision.action === "defer-housing" && option) this.note(person, `motivation-driven avoidance deferred rent to ${housing.name}`, "bad");
      if (person.rentArrears >= 3) {
        person.housed = false;
        person.rentArrears = 0;
        this.note(person, "three missed rents caused eviction", "bad");
      }
    }
    return false;
  }

  personalPhase() {
    const café = this.firms.find((firm) => firm.active && firm.sector === "service" && firm.inventory >= 1);
    const makers = this.firms.find((firm) => firm.active && firm.sector === "goods" && firm.inventory >= 1);
    this.people.forEach((person) => {
      if (!person.alive) return;
      this.considerPersonalTime(person, café, makers);
    });
    const social = this.people.filter((person) => person.alive && person.socialToday).sort(() => this.random() - 0.5);
    for (let index = 0; index + 1 < social.length; index += 2) {
      const a = social[index];
      const b = social[index + 1];
      const existingFriendship = Boolean(a.relationships[b.id]);
      if (this.recordSocialContact(a, b) && !existingFriendship) {
        this.note(a, `a café encounter became friendship with ${b.name}`, "good");
        this.note(b, `a café encounter became friendship with ${a.name}`, "good");
      }
    }
  }

  considerPersonalTime(person, café, makers) {
    if (!person.alive) return false;
    this.assessNeeds(person);
    const pursuesDiscretionaryPurchase = this.random() < this.policy.discretionaryDemand / 100;
    const canBuy = (firm, reserve = 0) => firm
      && firm.active
      && firm.inventory >= 1
      && person.cash > firm.price + reserve
      && firm.transactionsToday < this.transactionCapacity(firm);
    const legalActions = ["do-nothing"];
    if (pursuesDiscretionaryPurchase) {
      if (person.scarcityError && person.stress > 0.65 && canBuy(café, -1e-9)) legalActions.push("buy-comfort");
      if (person.focus === "belonging" && canBuy(café, 7)) legalActions.push("social-visit");
      if (["esteem", "growth"].includes(person.focus) && canBuy(makers, 10)) legalActions.push("buy-learning-tools");
    }
    const relationships = this.relationshipStats(person);
    const observation = Object.freeze({
      kind: "personal-time",
      citizenId: person.id,
      citizenName: person.name,
      stress: person.stress,
      runwayDays: this.runwayDays(person),
      focus: person.focus,
      needs: { ...person.needs },
      relationshipCount: relationships.count,
      strongestRelationship: relationships.strongest,
      profile: { ...person.motivationProfile },
    });
    const frozenLegalActions = Object.freeze([...legalActions]);
    const decision = this.citizenPolicy.decide({ observation, legalActions: frozenLegalActions, random: this.random });
    if (!decision || !frozenLegalActions.includes(decision.action)) {
      throw new Error(`Citizen policy ${this.citizenPolicy.id ?? "unknown"} chose an illegal personal-time action`);
    }
    this.recordDecision(person, observation, frozenLegalActions, decision, "Personal time");

    if (decision.action === "buy-comfort" && this.buy(person, café, 1, "short-term comfort")) {
      person.stress = clamp(person.stress - 0.035);
      const insecureCircumstances = [person.employer < 0 ? "unemployed" : "", !person.housed ? "unhoused" : ""].filter(Boolean).join(" and ");
      this.note(person, insecureCircumstances
        ? `short-term comfort spending while ${insecureCircumstances} reduced thin reserves`
        : "stress relief spending reduced thin reserves", "bad");
      return true;
    }
    if (decision.action === "social-visit" && this.buy(person, café, 1, "social visit")) {
      person.socialToday = true;
      return true;
    }
    if (decision.action === "buy-learning-tools" && this.buy(person, makers, 1, "learning tools")) {
      person.skill = clamp(person.skill + 0.02);
      person.growth = clamp(person.growth + 0.04);
      return true;
    }
    return false;
  }

  settlementPhase() {
    this.resolveHousingReceivership();
    const budget = this.government.cash * (this.policy.supportRate / 100) * 0.18;
    let spent = 0;
    const vulnerable = this.people.filter((person) => person.alive).sort((a, b) => (b.hungryDays + (!b.housed ? 3 : 0)) - (a.hungryDays + (!a.housed ? 3 : 0)) || a.cash - b.cash);
    vulnerable.forEach((person) => {
      if (spent >= budget || this.government.cash <= 0 || (person.cash >= 12 && !person.hungryDays && person.housed)) return;
      const before = person.cash;
      const paid = this.transfer(this.government, person, Math.min(5, budget - spent));
      spent += paid;
      if (paid) this.ledger(person, { direction: "in", amount: paid, text: "support from treasury", before });
    });

    this.firms.forEach((firm) => this.prepareFirmSettlement(firm));
    this.runJobMarket();
    this.firms.forEach((firm) => this.finishFirmSettlement(firm));
    this.decayRelationships();
    this.people.forEach((person) => {
      if (!person.alive) return;
      this.updateStress(person);
      if (person.stress > 0.55) {
        person.health = clamp(person.health - (0.002 + (person.stress - 0.55) * 0.018), 0.08, 1);
        person.reliability = clamp(person.reliability - 0.002);
      } else if (person.housed && !person.hungryDays && person.health < 0.92) person.health = clamp(person.health + 0.0035, 0.08, 1);
      if (this.random() < 0.006 + person.stress * 0.018 + (1 - person.health) * 0.008) {
        person.health = clamp(person.health - (0.04 + this.random() * 0.09), 0.08, 1);
        this.note(person, "a health setback reduced capacity to work", "bad");
      }
      person.criticalHealthDays = person.health <= 0.08 ? person.criticalHealthDays + 1 : 0;
      if (person.criticalHealthDays >= 3) {
        this.die(person);
        return;
      }
      this.updateStress(person);
      this.assessNeeds(person);
    });
    this.day += 1;
  }

  nextOperatingNeed(firm) {
    const wage = Math.max(this.policy.minimumWage, firm.wage);
    const payroll = wage * Math.max(1, firm.employees.length);
    const inputs = this.contracts
      .filter((contract) => contract.active && contract.buyerId === firm.id)
      .reduce((total, contract) => total + contract.dailyQuantity * contract.unitPrice / (contract.use === "operations" ? MAINTENANCE_INTERVAL_DAYS : 1), 0);
    return roundMoney(payroll + inputs);
  }

  closeFirm(firm, reason = "sustained insolvency ended operations") {
    if (!firm.active) return false;
    [...firm.employees].forEach((id) => this.fire(firm, this.people[id], "business insolvency ended employment"));
    firm.active = false;
    const entersReceivership = firm.sector === "housing";
    firm.status = entersReceivership ? "receivership" : "insolvent";
    firm.targetStaff = 0;
    if (entersReceivership) {
      firm.receivershipDay = this.day;
      firm.lastDisplacementDay = null;
    }
    this.contracts.filter((contract) => contract.supplierId === firm.id || contract.buyerId === firm.id).forEach((contract) => {
      contract.active = false;
    });
    this.note(firm, entersReceivership ? `${reason}; housing operations entered receivership` : reason, "bad");
    return true;
  }

  resolveHousingReceivership() {
    const housing = this.firms.find((firm) => firm.sector === "housing" && firm.status === "receivership");
    if (!housing) return false;
    const elapsed = this.day - housing.receivershipDay;
    if (elapsed < HOUSING_RECEIVERSHIP_GRACE_DAYS) return false;

    if (housing.receivershipCount === 0 && this.government.cash + 1e-9 >= HOUSING_RESTART_COST) {
      const treasuryBefore = this.government.cash;
      const housingBefore = housing.cash;
      const paid = this.transfer(this.government, housing, HOUSING_RESTART_COST, { exact: true });
      if (paid === HOUSING_RESTART_COST) {
        housing.active = true;
        housing.status = "operating";
        housing.receivershipDay = null;
        housing.receivershipCount += 1;
        housing.distressDays = 0;
        housing.trouble = 0;
        housing.targetStaff = HOUSING_REPLACEMENT_STAFF;
        housing.publiclyOperated = true;
        this.contracts.filter((contract) => contract.supplierId === housing.id || contract.buyerId === housing.id).forEach((contract) => {
          const counterpartyId = contract.supplierId === housing.id ? contract.buyerId : contract.supplierId;
          contract.active = this.firms[counterpartyId].active;
        });
        this.people
          .filter((person) => person.alive && person.employer < 0)
          .sort((a, b) => b.skill + b.reliability * 0.25 - (a.skill + a.reliability * 0.25))
          .slice(0, HOUSING_REPLACEMENT_STAFF)
          .forEach((person) => this.hire(housing, person));
        housing.targetStaff = Math.max(housing.employees.length, HOUSING_REPLACEMENT_STAFF);
        this.ledger(this.government, { direction: "out", amount: paid, text: `housing receivership restart to ${housing.name}`, before: treasuryBefore });
        this.ledger(housing, { direction: "in", amount: paid, text: "housing receivership restart from treasury", before: housingBefore });
        this.note(housing, "treasury appointed and funded a replacement housing operator", "good");
        return true;
      }
    }

    if (housing.lastDisplacementDay === this.day) return false;
    const housed = this.people.filter((person) => person.alive && person.housed).sort((a, b) => a.id - b.id);
    const displaced = housed.slice(0, Math.max(1, Math.ceil(housed.length * HOUSING_DISPLACEMENT_RATE)));
    displaced.forEach((person) => {
      person.housed = false;
      person.rentArrears = 0;
      this.note(person, "lost housing after HomeWorks receivership failed to secure an operator", "bad");
    });
    housing.lastDisplacementDay = this.day;
    if (displaced.length) this.note(housing, `${displaced.length} unmanaged tenancies failed during receivership`, "bad");
    return displaced.length > 0;
  }

  assessFirmSolvency(firm) {
    if (!firm.active) return;
    const need = this.nextOperatingNeed(firm);
    if (firm.cash + 1e-9 >= need) {
      if (firm.status === "distressed") this.note(firm, "cash recovered above the next-day operating need", "good");
      firm.distressDays = 0;
      firm.status = "operating";
      return;
    }

    const enteringDistress = firm.status === "operating" || firm.status === "rescued";
    firm.distressDays += 1;
    firm.status = "distressed";
    if (enteringDistress) this.note(firm, `cash fell below the ${need.toFixed(1)} next-day operating need`, "bad");

    if (firm.vital && firm.rescueCount === 0 && firm.distressDays >= FIRM_DISTRESS_DAYS) {
      const target = roundMoney(need * VITAL_RESCUE_RUNWAY_DAYS);
      const requested = Math.min(VITAL_RESCUE_CAP, Math.max(0, roundMoney(target - firm.cash)));
      const treasuryBefore = this.government.cash;
      const firmBefore = firm.cash;
      const paid = this.transfer(this.government, firm, requested);
      if (paid > 0) {
        firm.rescueCount += 1;
        firm.lastRescueDay = this.day;
        this.ledger(this.government, { direction: "out", amount: paid, text: `vital-business rescue to ${firm.name}`, before: treasuryBefore });
        this.ledger(firm, { direction: "in", amount: paid, text: "one-time vital-business rescue from treasury", before: firmBefore });
        this.note(firm, `treasury rescue supplied ${paid.toFixed(1)} cash`, "good");
        if (firm.cash + 1e-9 >= need) {
          firm.distressDays = 0;
          firm.status = "rescued";
          return;
        }
      }
    }

    if (firm.distressDays >= FIRM_INSOLVENCY_DAYS) this.closeFirm(firm);
  }

  resolveOwnerFinancing(firm) {
    const owner = this.people[firm.owner];
    firm.ownerDecision.capitalDay = this.day;
    firm.ownerDecision.capitalContribution = 0;
    firm.ownerDecision.continuationDay = this.day;
    if (!firm.active || !owner.alive) {
      firm.ownerDecision.capitalReason = "no living owner of an active firm";
      firm.ownerDecision.continuation = firm.active ? "continue without owner financing" : firm.status;
      firm.ownerDecision.continuationReason = firm.ownerDecision.capitalReason;
      return 0;
    }

    const need = this.nextOperatingNeed(firm);
    if (firm.cash + 1e-9 >= need) {
      firm.ownerDecision.capitalReason = "firm already covers its next operating need";
      firm.ownerDecision.continuation = "continue";
      firm.ownerDecision.continuationReason = "company cash covers near-term operations";
      return 0;
    }

    const protectedPersonalCash = roundMoney(this.essentialCost() * 10);
    const availablePersonalCash = Math.max(0, roundMoney(owner.cash - protectedPersonalCash));
    const immediateGap = roundMoney(need - firm.cash);
    const recoveryRatio = need ? firm.revenueEMA / need : 0;
    const recoveryThreshold = Math.max(0.35, owner.ownerRecoveryThreshold - (firm.vital ? 0.15 : 0));
    const recoveryIsCredible = recoveryRatio >= recoveryThreshold;
    const target = roundMoney(need * 2);
    const requested = Math.min(availablePersonalCash, roundMoney(target - firm.cash));
    const canContribute = availablePersonalCash + 1e-9 >= immediateGap && recoveryIsCredible && requested > 0;
    const options = [];
    if (canContribute) options.push({
      action: "contribute-owner-capital",
      label: `Contribute ${requested.toFixed(2)} owner cash`,
      amount: requested,
      personalSafety: 0.65,
      firmContinuity: 1,
      workerProtection: 1,
      growth: clamp(recoveryRatio),
      extraction: 0,
      exitRelief: 0,
    });
    options.push({
      action: "wait-on-owner-financing",
      label: "Wait without contributing personal cash",
      amount: 0,
      personalSafety: 1,
      firmContinuity: 0.15,
      workerProtection: 0.1,
      growth: 0,
      extraction: 0,
      exitRelief: 0.2,
    });
    if (firm.distressDays >= 2) options.push({
      action: "choose-voluntary-insolvency",
      label: "Choose voluntary insolvency",
      amount: 0,
      personalSafety: 1,
      firmContinuity: 0,
      workerProtection: 0,
      growth: 0,
      extraction: 0,
      exitRelief: 1,
    });
    const choice = this.considerOwnerAction(owner, firm, "financing", options, "Settlement");
    if (choice.option.action === "contribute-owner-capital") {
      const ownerBefore = owner.cash;
      const firmBefore = firm.cash;
      const paid = this.transfer(owner, firm, choice.option.amount, { exact: true });
      if (paid > 0) {
        firm.ownerDecision.capitalContribution = paid;
        firm.ownerDecision.capitalReason = `owner funded credible recovery while retaining ${protectedPersonalCash.toFixed(1)} personal cash`;
        firm.ownerDecision.continuation = "continue";
        firm.ownerDecision.continuationReason = "equity restored company operating runway";
        this.ledger(owner, { direction: "out", amount: paid, text: `equity contribution to ${firm.name}`, before: ownerBefore });
        this.ledger(firm, { direction: "in", amount: paid, text: `equity contribution from ${owner.name}`, before: firmBefore });
        this.note(firm, `${owner.name} contributed equity to continue operations`, "good");
        return paid;
      }
    }

    firm.ownerDecision.capitalReason = recoveryIsCredible
      ? `owner protected a ${protectedPersonalCash.toFixed(1)} personal reserve`
      : `recovery ratio ${recoveryRatio.toFixed(2)} was below the owner's ${recoveryThreshold.toFixed(2)} threshold`;
    if (choice.option.action === "choose-voluntary-insolvency") {
      firm.ownerDecision.continuation = "voluntary insolvency";
      firm.ownerDecision.continuationReason = recoveryIsCredible
        ? "owner chose to protect personal reserves"
        : "owner chose insolvency because further funding was unattractive";
      this.closeFirm(firm, `${owner.name} chose voluntary insolvency rather than further personal funding`);
      return 0;
    }
    firm.ownerDecision.continuation = "wait";
    firm.ownerDecision.continuationReason = "owner deferred funding while distress develops";
    return 0;
  }

  reviewOwnerPrice(firm) {
    if (this.day % PRICE_REVIEW_DAYS !== 0) return false;
    const owner = this.people[firm.owner];
    const window = firm.pricingWindow;
    const previousPrice = firm.price;
    let decision = "held";
    let reason = "observed demand and margin did not justify a change";
    let proposedPrice = previousPrice;
    if (owner?.alive) {
      const affordabilitySignal = window.priceRejections >= 2 && firm.production !== "fixed-service" && firm.inventory >= 1;
      const idleInventorySignal = window.unitsSold === 0 && firm.production !== "fixed-service" && firm.inventory >= 1;
      const capacitySignal = window.turnedAway >= 2;
      const lossSignal = window.revenue - window.inputCosts < 0 && window.unitsSold > 0;
      const lowerPrice = roundMoney(clamp(previousPrice * (1 - PRICE_ADJUSTMENT_RATE), firm.minimumPrice, firm.maximumPrice));
      const higherPrice = roundMoney(clamp(previousPrice * (1 + PRICE_ADJUSTMENT_RATE), firm.minimumPrice, firm.maximumPrice));
      const options = [{
        action: "hold-owner-price",
        label: `Hold price at ${previousPrice.toFixed(2)}`,
        resultingPrice: previousPrice,
        personalSafety: 0.5,
        firmContinuity: affordabilitySignal || idleInventorySignal || capacitySignal || lossSignal ? 0.2 : 1,
        workerProtection: 0.5,
        growth: 0.3,
        extraction: 0.2,
        exitRelief: 0.2,
      }];
      if (lowerPrice < previousPrice) options.push({
        action: "lower-owner-price",
        label: `Lower price to ${lowerPrice.toFixed(2)}`,
        resultingPrice: lowerPrice,
        personalSafety: 0.25,
        firmContinuity: affordabilitySignal || idleInventorySignal ? 1 : 0.1,
        workerProtection: affordabilitySignal ? 0.8 : 0.35,
        growth: affordabilitySignal || idleInventorySignal ? 1 : 0.2,
        extraction: 0,
        exitRelief: 0,
      });
      if (higherPrice > previousPrice) options.push({
        action: "raise-owner-price",
        label: `Raise price to ${higherPrice.toFixed(2)}`,
        resultingPrice: higherPrice,
        personalSafety: 0.45,
        firmContinuity: capacitySignal || lossSignal ? 1 : 0.1,
        workerProtection: lossSignal ? 0.65 : 0.25,
        growth: capacitySignal || lossSignal ? 0.8 : 0.2,
        extraction: 1,
        exitRelief: 0,
      });
      const choice = this.considerOwnerAction(owner, firm, "pricing", options, "Settlement");
      proposedPrice = choice.option.resultingPrice;
      decision = choice.option.action === "lower-owner-price" ? "lowered" : choice.option.action === "raise-owner-price" ? "raised" : "held";
      if (decision === "lowered") reason = affordabilitySignal
        ? `${window.priceRejections} affordability failures signaled price-sensitive demand`
        : "inventory remained available without a sale";
      if (decision === "raised") reason = capacitySignal
        ? `${window.turnedAway} customers were turned away at available capacity`
        : lossSignal ? "realized sales did not cover input costs" : "owner preferred a higher return within the price bound";
    } else reason = "no living owner was available to change the price";

    firm.price = roundMoney(clamp(proposedPrice, firm.minimumPrice, firm.maximumPrice));
    if (firm.price === previousPrice) decision = "held";
    firm.ownerDecision.priceDay = this.day;
    firm.ownerDecision.previousPrice = previousPrice;
    firm.ownerDecision.price = firm.price;
    firm.ownerDecision.priceDecision = decision;
    firm.ownerDecision.priceReason = reason;
    const priceMultiplier = firm.price / firm.basePrice;
    this.contracts.filter((contract) => contract.supplierId === firm.id).forEach((contract) => {
      contract.unitPrice = roundMoney(contract.baseUnitPrice * priceMultiplier);
    });
    if (firm.price !== previousPrice) this.note(firm, `${owner.name} ${decision} the price from ${previousPrice.toFixed(2)} to ${firm.price.toFixed(2)} because ${reason}`, "neutral");
    firm.pricingWindow = { unitsSold: 0, revenue: 0, inputCosts: 0, priceRejections: 0, turnedAway: 0 };
    return firm.price !== previousPrice;
  }

  ownerDividendDecision(firm, owner) {
    if (!firm.active || !owner.alive) return { amount: 0, type: "none", reason: "no living owner of an active firm" };
    const constraintReason = firm.status !== "operating"
      ? `${firm.status} firms retain cash`
      : firm.lastRescueDay !== null && this.day - firm.lastRescueDay < 14
        ? "recent treasury rescue requires cash retention"
        : firm.targetStaff > firm.employees.length
          ? "approved expansion requires cash retention"
          : null;
    const operatingNeed = this.nextOperatingNeed(firm);
    const ownerRunway = this.runwayDays(owner);
    let amount = 0;
    let type = "none";
    let distributionReason = "no legal distribution above the retained operating buffer";
    if (!constraintReason && ownerRunway < 3) {
      const available = Math.max(0, roundMoney(firm.cash - operatingNeed));
      const personalGap = Math.max(0, roundMoney(this.essentialCost() * 5 - owner.cash));
      amount = Math.min(available, personalGap);
      if (amount > 0) {
        type = "emergency distribution";
        distributionReason = "acute personal need selected cash while preserving one company operating day";
      }
    }
    const retainedCash = Math.max(210, roundMoney(operatingNeed * 4));
    const surplus = roundMoney(firm.cash - retainedCash);
    if (!constraintReason && !amount && surplus > 0) {
      const share = ownerRunway < 5 ? 0.55 : ownerRunway < 15 ? 0.35 : owner.dividendPreference;
      amount = roundMoney(surplus * share);
      type = "dividend";
      distributionReason = ownerRunway < 5
        ? "thin owner runway selected 55% of surplus"
        : ownerRunway < 15
          ? "moderate owner runway selected 35% of surplus"
          : `secure owner preference selected ${Math.round(owner.dividendPreference * 100)}% of surplus`;
    }
    const options = [{
      action: "retain-owner-cash",
      label: `Retain company cash above the ${retainedCash.toFixed(1)} buffer`,
      amount: 0,
      personalSafety: amount ? 0.15 : 0.75,
      firmContinuity: 1,
      workerProtection: 1,
      growth: 0.65,
      extraction: 0,
      exitRelief: 0.1,
    }];
    if (amount > 0) options.push({
      action: "take-owner-distribution",
      label: `Take ${amount.toFixed(2)} as ${type}`,
      amount,
      personalSafety: ownerRunway < 5 ? 1 : 0.55,
      firmContinuity: type === "emergency distribution" ? 0.2 : 0.65,
      workerProtection: type === "emergency distribution" ? 0.15 : 0.5,
      growth: 0.1,
      extraction: 1,
      exitRelief: 0.2,
    });
    const choice = this.considerOwnerAction(owner, firm, "distribution", options, "Settlement");
    if (choice.option.action === "retain-owner-cash") return {
      amount: 0,
      type: "none",
      reason: constraintReason ?? (surplus <= 0 && type === "none" ? `no surplus above the ${retainedCash.toFixed(1)} retained operating buffer` : "owner chose to retain available cash in the company"),
    };
    return { amount: choice.option.amount, type, reason: distributionReason };
  }

  payOwnerDividend(firm) {
    const owner = this.people[firm.owner];
    const decision = this.ownerDividendDecision(firm, owner);
    firm.ownerDecision.dividendDay = this.day;
    firm.ownerDecision.dividend = decision.amount;
    firm.ownerDecision.dividendType = decision.type;
    firm.ownerDecision.dividendReason = decision.reason;
    if (!decision.amount) return 0;
    const firmBefore = firm.cash;
    const ownerBefore = owner.cash;
    const paid = this.transfer(firm, owner, decision.amount, { exact: true });
    if (!paid) return 0;
    firm.ownerDecision.dividend = paid;
    const purpose = decision.type === "emergency distribution" ? "emergency owner distribution" : "owner dividend";
    this.ledger(firm, { direction: "out", amount: paid, text: `${purpose} to ${owner.name}`, before: firmBefore });
    this.ledger(owner, { direction: "in", amount: paid, text: `${purpose} from ${firm.name}`, before: ownerBefore });
    return paid;
  }

  prepareFirmSettlement(firm) {
    if (!firm.active) return;
    firm.pricingWindow.unitsSold += firm.unitsSold;
    firm.pricingWindow.revenue += firm.sales;
    firm.pricingWindow.inputCosts += firm.inputCosts;
    firm.pricingWindow.priceRejections += firm.priceRejectionsToday;
    firm.pricingWindow.turnedAway += firm.turnedAwayTransactions;
    this.reviewOwnerPrice(firm);
    const wage = Math.max(this.policy.minimumWage, firm.wage);
    const netSales = Math.max(0, firm.sales - firm.inputCosts);
    const revenueSample = firm.sector === "housing" ? (firm.sales > 0 ? netSales / RENT_INTERVAL_DAYS : null) : netSales;
    if (revenueSample !== null) firm.revenueEMA = firm.revenueEMA * 0.72 + revenueSample * 0.28;
    const minimumStaff = firm.sector === "housing" ? 2 : 1;
    const incomeSupportedStaff = clamp(Math.floor(firm.revenueEMA / (wage * STAFFING_REVENUE_BUFFER) + 1e-9), minimumStaff, firm.maxStaff);
    const fundedExpansion = incomeSupportedStaff > firm.employees.length && firm.cash >= wage * 6 && firm.employees.length < firm.maxStaff;
    firm.targetStaff = fundedExpansion ? Math.min(incomeSupportedStaff, firm.employees.length + 1) : Math.min(incomeSupportedStaff, firm.employees.length);
    firm.trouble = firm.cash < wage * Math.max(1, firm.employees.length) * 0.7 ? firm.trouble + 1 : Math.max(0, firm.trouble - 1);
    firm.overstaffedDays = firm.employees.length > incomeSupportedStaff || firm.trouble >= 3 ? firm.overstaffedDays + 1 : 0;
    if (firm.overstaffedDays >= 3 && firm.employees.length > 1) {
      const worker = this.people[[...firm.employees].sort((a, b) => this.people[a].reliability - this.people[b].reliability)[0]];
      this.fire(firm, worker, "lower demand eliminated a position");
      firm.overstaffedDays = 0;
    }
    const vacancies = Math.max(0, firm.targetStaff - firm.employees.length);
    firm.vacancyAge = vacancies ? firm.vacancyAge + 1 : 0;
  }

  finishFirmSettlement(firm) {
    if (!firm.active) return;
    if (this.random() < (this.policy.shockRisk / 100) * 0.025) {
      this.transfer(firm, this.government, Math.min(firm.cash, 12 + this.random() * 22));
      firm.trouble += 1;
    }
    this.resolveOwnerFinancing(firm);
    if (firm.active) {
      this.assessFirmSolvency(firm);
      this.payOwnerDividend(firm);
    }
    firm.sales = 0;
    firm.inputCosts = 0;
    firm.unitsSold = 0;
    firm.transactionsToday = 0;
    firm.attemptedTransactions = 0;
    firm.turnedAwayTransactions = 0;
    firm.priceRejectionsToday = 0;
  }

  settleFirm(firm) {
    this.prepareFirmSettlement(firm);
    this.runJobMarket([firm]);
    this.finishFirmSettlement(firm);
  }

  isExtinct() {
    return !this.people.some((person) => person.alive);
  }

  step() {
    if (this.isExtinct()) return this.snapshot();
    this.flows = [];
    [
      () => this.productionPhase(),
      () => this.procurementPhase(),
      () => this.payrollPhase(),
      () => this.foodPhase(),
      () => this.housingPhase(),
      () => this.personalPhase(),
      () => this.settlementPhase(),
    ][this.phase]();
    this.phase = (this.phase + 1) % PHASES.length;
    this.assertInvariants();
    return this.snapshot();
  }

  assertInvariants() {
    const entities = [...this.people, ...this.firms, this.government];
    if (entities.some((entity) => entity.cash < -1e-9 || !Number.isFinite(entity.cash))) throw new Error("Invalid cash balance");
    if (this.people.some((person) => !person.alive && person.employer >= 0)) throw new Error("A dead person cannot remain employed");
    if (this.people.some((person) => person.employer >= 0 && person.jobApplicationFirm >= 0)) throw new Error("An employed person cannot remain a job applicant");
    if (this.firms.some((firm) => !firm.active && !["insolvent", "receivership"].includes(firm.status))) throw new Error("An inactive firm must be insolvent or in receivership");
    this.people.forEach((person) => {
      this.friendIds(person).forEach((friendId) => {
        const reciprocal = this.people[friendId].relationships[person.id];
        const relationship = person.relationships[friendId];
        if (!reciprocal || reciprocal.strength !== relationship.strength || reciprocal.lastContactDay !== relationship.lastContactDay) throw new Error("Relationships must remain reciprocal");
      });
    });
    if (Math.abs(this.totalMoney() - this.initialMoney) > 0.1) throw new Error("Money escaped the closed economy");
  }

  snapshot() {
    const alive = this.people.filter((person) => person.alive).length;
    const dead = this.people.length - alive;
    return {
      day: this.day,
      phase: this.phase,
      phaseName: PHASES[this.phase],
      totalMoney: this.totalMoney(),
      initialMoney: this.initialMoney,
      employed: this.people.filter((person) => person.alive && person.employer >= 0).length,
      alive,
      dead,
      totalCitizens: this.people.length,
      positionsAvailable: this.firms
        .filter((firm) => firm.active)
        .reduce((total, firm) => total + Math.max(0, firm.targetStaff - firm.employees.length), 0),
      hungry: this.people.filter((person) => person.alive && person.hungryDays > 0).length,
      unhoused: this.people.filter((person) => person.alive && !person.housed).length,
    };
  }
}
