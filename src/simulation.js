import {
  CLINIC_TREATMENT_RECOVERY,
  CLINIC_TREATMENT_RESERVE_DAYS,
  CLINIC_TREATMENT_THRESHOLD,
  DEFAULT_POLICY,
  EDUCATION_RESERVE_DAYS,
  EDUCATION_SKILL_GAIN,
  EDUCATION_SKILL_THRESHOLD,
  ESSENTIAL_FOOD_EMERGENCY_REENTRY_DAYS,
  ESSENTIAL_REENTRY_COOLDOWN_DAYS,
  ESSENTIAL_REENTRY_COST,
  ESSENTIAL_REENTRY_STAFF,
  FIRMS,
  FIRM_OPEN_WEEKDAYS,
  FIRM_SERVICE_WINDOWS,
  FIRM_DISTRESS_DAYS,
  FIRM_INSOLVENCY_DAYS,
  FRIENDSHIP_CONTACT_GAIN,
  FRIENDSHIP_DAILY_DECAY,
  FRIENDSHIP_DECAY_GRACE_DAYS,
  FRIENDSHIP_END_THRESHOLD,
  FOOD_HEALTH_RECOVERY,
  FOOD_QUALITY_DECAY_PER_DAY,
  HEALTH_TREATMENT_RECOVERY,
  HEALTH_TREATMENT_RESERVE_DAYS,
  HEALTH_TREATMENT_THRESHOLD,
  HOUSING_DISPLACEMENT_RATE,
  HOUSING_PROJECT_CAPACITY_GAIN,
  HOUSING_REPAIR_GRACE_DAYS,
  HOUSING_REPAIR_INTERVAL_DAYS,
  HOUSING_RECEIVERSHIP_GRACE_DAYS,
  HOUSING_REPLACEMENT_STAFF,
  HOUSING_RESTART_COST,
  INITIAL_FRIENDSHIP_STRENGTH,
  INITIAL_DWELLING_CAPACITY,
  INVESTMENT_DEMAND_CAPTURE_RATE,
  INVESTMENT_DEMAND_REQUIRED_DAYS,
  INVESTMENT_DEMAND_WINDOW_DAYS,
  INVESTMENT_EVALUATION_DAYS,
  INVESTMENT_RECRUITMENT_DAYS,
  INVESTMENT_WAGE_RESERVE_DAYS,
  LEGACY_OPPORTUNITY_OBSERVATION_DAYS,
  LEGACY_OPPORTUNITY_PROTECTED_RUNWAY_DAYS,
  MAINTENANCE_INTERVAL_DAYS,
  MIN_FOOD_QUALITY,
  MISSED_MAINTENANCE_CAPACITY,
  NAMES,
  OPPORTUNITY_DEMAND_CAPTURE_RATE,
  OPPORTUNITY_MARGIN_BUFFER,
  OPPORTUNITY_OBSERVATION_DAYS,
  OPPORTUNITY_PROTECTED_RUNWAY_DAYS,
  OPPORTUNITY_REQUIRED_VIABLE_DAYS,
  OPPORTUNITY_STARTUP_CAPITAL,
  PERISHABLE_SHELF_LIFE,
  PHASES,
  PRIVATE_FORMATION_ARCHETYPE_IDS,
  PRIVATE_REENTRY_COOLDOWN_DAYS,
  PRICE_ADJUSTMENT_RATE,
  PRICE_CEILING_MULTIPLIER,
  PRICE_FLOOR_MULTIPLIER,
  PRICE_REVIEW_DAYS,
  PRODUCTS,
  RENT_INTERVAL_DAYS,
  RETAIL_COURSE_INVENTORY_TRANSFER_RATE,
  RETAIL_COURSE_LEARNING_RATE,
  SCHEDULED_MAINTENANCE_UNIT_PRICE,
  SCHEDULED_TRANSPORT_CAPACITY_PER_WORKER,
  STAFFING_REVENUE_BUFFER,
  SUPPORT_RUNWAY_TARGET_DAYS,
  SUPPLY_CONTRACTS,
  TRANSPORT_CAPACITY_PER_WORKER,
  TRANSPORT_LOAD_BY_PRODUCT,
  VITAL_RESCUE_CAP,
  VITAL_RESCUE_RUNWAY_DAYS,
} from "./config.js";
import {
  ATTENDANCE_ACTIONS,
  createMotivationProfile,
  JOB_OFFER_ACTIONS,
  SKIP_JOB_SEARCH,
} from "./citizen-policy.ts";
import { createDefaultCitizenPolicy } from "./neural-runtime.ts";
import { createRandom } from "./random.js";
import { inferTownStage } from "./town-stage.js";
import { calendarForDay, PHASE_BLOCKS, temporalMetadata } from "./civil-time.js";
import { createKnowledgeProfile, validateFirmKnowledgeConfigs, weightedVocationalKnowledge } from "./knowledge.js";

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const roundMoney = (value) => Math.round(value * 100) / 100;

export class TownSimulation {
  constructor({ seed = 20260823, policy = {}, citizenPolicy = createDefaultCitizenPolicy(), latentFirmNames = [], formationArchetypeIds = PRIVATE_FORMATION_ARCHETYPE_IDS, housingCapacityEnabled = false, transportEnabled = false, knowledgeEnabled = true, employmentInterventionEnabled = true, schedulesEnabled = false, sleepEnabled = false } = {}) {
    validateFirmKnowledgeConfigs(FIRMS);
    this.seed = seed;
    this.policy = { ...DEFAULT_POLICY, ...policy };
    this.citizenPolicy = citizenPolicy;
    this.latentFirmNames = [...latentFirmNames];
    this.formationArchetypeIds = [...formationArchetypeIds];
    this.housingCapacityEnabled = housingCapacityEnabled;
    this.transportEnabled = transportEnabled;
    this.knowledgeEnabled = knowledgeEnabled;
    this.employmentInterventionEnabled = employmentInterventionEnabled;
    this.schedulesEnabled = schedulesEnabled;
    this.sleepEnabled = sleepEnabled;
    this.reset();
  }

  createFirmInstance(archetype, id, { owner = id, cash = 150, founderCapital = cash, inventory = archetype.inventory, revenueEMA = archetype.initialStaff * archetype.wage * STAFFING_REVENUE_BUFFER, targetStaff = archetype.initialStaff, instanceNumber = 1, foundingDay = 1 } = {}) {
    const shelfLife = PERISHABLE_SHELF_LIFE[archetype.sells] ?? null;
    return {
      ...archetype,
      kind: "firm",
      id,
      instanceNumber,
      instanceId: `${archetype.archetypeId}:${instanceNumber}`,
      foundingDay,
      openWeekdays: FIRM_OPEN_WEEKDAYS[archetype.archetypeId],
      serviceWindow: FIRM_SERVICE_WINDOWS[archetype.archetypeId],
      openDayCount: 0,
      lastOpenDay: null,
      founderCapital,
      cash,
      inventory,
      inventoryBatchSequence: inventory > 0 && shelfLife ? 1 : 0,
      inventoryBatches: inventory > 0 && shelfLife ? [{
        sequence: 1,
        product: archetype.sells,
        quantity: inventory,
        batchDay: foundingDay,
        qualityBasis: archetype.quality ?? null,
        shelfLife,
        ownerKind: "firm",
        ownerId: id,
        ownerName: archetype.name,
      }] : [],
      wasteSequence: 0,
      wasteHistory: [],
      perishableProcessedToday: 0,
      perishableSalesToday: 0,
      inputInventory: 0,
      processingCapacityToday: 0,
      processedToday: 0,
      processingShortfallToday: 0,
      basePrice: archetype.price,
      minimumPrice: roundMoney(archetype.price * PRICE_FLOOR_MULTIPLIER),
      maximumPrice: roundMoney(archetype.price * PRICE_CEILING_MULTIPLIER),
      owner,
      employees: [],
      sales: 0,
      inputCosts: 0,
      operatingSupplies: 0,
      dwellingCapacity: archetype.sector === "housing" ? INITIAL_DWELLING_CAPACITY : null,
      lastHousingProjectDay: archetype.sector === "housing" ? 1 : null,
      completedHousingProjects: 0,
      lastCapacityLossDay: null,
      transportCapacityToday: 0,
      transportLoadToday: 0,
      operationalReadiness: 1,
      lastMaintenanceDay: 0,
      maintenanceUseDays: 0,
      lastMaintenanceUseCount: 0,
      maintenanceUseMarkedDay: null,
      receivershipDay: null,
      receivershipCount: 0,
      reentryCount: 0,
      closedDay: null,
      lastDisplacementDay: null,
      publiclyOperated: false,
      unitsSold: 0,
      transactionsToday: 0,
      knowledgeCapacityCarry: 0,
      knowledgeCapacitySlotsToday: 0,
      lastKnowledgeCapacityDay: null,
      attemptedTransactions: 0,
      turnedAwayTransactions: 0,
      priceRejectionsToday: 0,
      staffingDemandToday: { consumerUnits: 0, contractUnits: 0, productionUnits: 0, evidence: [] },
      staffingDemandHistory: [],
      staffingDemandSequence: 0,
      staffingDemandArchivedDay: null,
      incomeSupportedTarget: targetStaff,
      latestStaffingReason: "initial staffing",
      investmentSlotSequence: 0,
      investmentSlots: [],
      pricingWindow: { unitsSold: 0, revenue: 0, inputCosts: 0, priceRejections: 0, turnedAway: 0 },
      active: true,
      status: "operating",
      distressDays: 0,
      rescueCount: 0,
      lastRescueDay: null,
      trouble: 0,
      revenueEMA,
      targetStaff,
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
        price: archetype.price,
        previousPrice: archetype.price,
        priceDecision: "not reviewed",
        priceReason: "the first pricing window is still open",
      },
      activitySequence: 0,
      decisionSequence: 0,
      decisions: [],
      ledger: [],
      events: [],
    };
  }

  reset(seed = this.seed) {
    this.seed = seed;
    this.random = createRandom(seed);
    this.day = 1;
    this.phase = 0;
    this.flows = [];
    this.controlSequence = 0;
    this.controlHistory = [];
    this.opportunitySequence = 0;
    this.opportunityHistory = [];
    this.pendingFormations = {};
    this.opportunityWindows = Object.fromEntries(FIRMS.map((archetype) => [archetype.archetypeId, []]));
    this.firmInstanceCounts = Object.fromEntries(FIRMS.map((archetype) => [archetype.archetypeId, 0]));
    this.government = { kind: "government", id: 0, name: "Town treasury", cash: 120, x: 0.88, y: 0.55, activitySequence: 0, ledger: [], events: [] };
    this.firms = FIRMS.filter((archetype) => (!archetype.defaultLatent || (this.transportEnabled && archetype.archetypeId === "haulage")) && !this.latentFirmNames.includes(archetype.name)).map((archetype, id) => {
      this.firmInstanceCounts[archetype.archetypeId] = 1;
      const targetStaff = this.schedulesEnabled ? archetype.scheduledInitialStaff ?? archetype.initialStaff : archetype.initialStaff;
      const openDays = FIRM_OPEN_WEEKDAYS[archetype.archetypeId].length;
      const averageOpenDayWage = this.schedulesEnabled
        ? Math.max(this.policy.minimumWage, archetype.wage) * 7 / openDays
        : archetype.wage;
      const revenueEMA = targetStaff * averageOpenDayWage * STAFFING_REVENUE_BUFFER;
      return this.createFirmInstance(archetype, id, { targetStaff, revenueEMA });
    });
    this.contracts = SUPPLY_CONTRACTS.map((contract) => {
      const unitPrice = this.contractUnitPrice(contract);
      return {
        ...contract,
        unitPrice,
        baseUnitPrice: unitPrice,
        supplierId: this.firms.findIndex((firm) => firm.name === contract.supplier),
        buyerId: this.firms.findIndex((firm) => firm.name === contract.buyer),
        active: true,
        requestedToday: 0,
        deliveredToday: 0,
        shortfallToday: 0,
        transportLoadToday: 0,
        transportFeeToday: 0,
        transportConstrainedToday: false,
        shortfallCauseToday: null,
        limitingFirmId: null,
      };
    }).filter((contract) => contract.supplierId >= 0 && contract.buyerId >= 0).map((contract, id) => ({ ...contract, id }));
    this.contracts.filter((contract) => contract.use === "operations").forEach((contract) => {
      this.firms[contract.buyerId].operatingSupplies = contract.targetStock;
    });
    this.validateProductGraph();
    this.people = NAMES.map((name, id) => {
      const homeX = 0.68 + this.random() * 0.22;
      const homeY = 0.43 + this.random() * 0.18;
      const cash = roundMoney(18 + this.random() * 62);
      const skill = 0.25 + this.random() * 0.65;
      return {
        kind: "person",
        id,
        name,
        alive: true,
        deathDay: null,
        estateTransferred: 0,
        criticalHealthDays: 0,
        cash,
        skill,
        knowledgeProfile: createKnowledgeProfile(skill),
        learningHistory: [],
        learningSequence: 0,
        reliability: 0.55 + this.random() * 0.43,
        employer: -1,
        employmentSpellSequence: 0,
        rota: null,
        scheduledShiftsWorked: 0,
        scheduledShiftsElapsed: 0,
        dailyPlan: null,
        currentPrimaryActivity: null,
        sleepDebt: 0,
        lastSleepQuality: null,
        sleepSequence: 0,
        sleepHistory: [],
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
        foodConsumedToday: 0,
        foodConsumedTotal: 0,
        wasteSequence: 0,
        wasteHistory: [],
        lastFoodQuality: null,
        lastFoodAge: null,
        personalSeller: -1,
        healthSeller: -1,
        lastTreatmentDay: null,
        educationSeller: -1,
        lastEducationDay: null,
        clinicalSeller: -1,
        lastClinicalDay: null,
        socialVenueToday: null,
        rentSeller: -1,
        homeX,
        homeY,
        x: homeX,
        y: homeY,
        activitySequence: 1,
        decisionSequence: 0,
        decisions: [],
        ledger: [],
        events: [{ day: 1, ...temporalMetadata(1, "Planning"), sequence: 1, text: "entered the town economy", kind: "neutral" }],
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
        .slice(0, Math.max(0, firm.targetStaff - firm.employees.length))
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
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) throw new Error(`Invalid policy value for ${name}`);
    const before = this.policy[name];
    if (before === numericValue) return numericValue;
    this.policy[name] = numericValue;
    this.recordControlChange("policy", name, before, numericValue);
    return numericValue;
  }

  setNeuralControl(enabled) {
    if (typeof this.citizenPolicy.setEnabled !== "function") throw new Error("The active citizen policy does not support neural control switching");
    const before = this.policyMetadata().mode === "neural";
    const after = Boolean(enabled);
    this.citizenPolicy.setEnabled(after);
    if (before !== after) this.recordControlChange("neural-control", "personalTime", before, after);
    return this.policyMetadata();
  }

  recordControlChange(type, setting, before, after) {
    this.controlSequence += 1;
    this.controlHistory.unshift(Object.freeze({
      day: this.day,
      phase: this.phase,
      phaseName: PHASES[this.phase],
      ...temporalMetadata(this.day, this.phase),
      sequence: this.controlSequence,
      type,
      setting,
      before,
      after,
    }));
  }

  policyMetadata() {
    return typeof this.citizenPolicy.metadata === "function"
      ? this.citizenPolicy.metadata()
      : { id: this.citizenPolicy.id ?? "unknown", mode: "deterministic", controlledDomain: null, weightsVersion: null };
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
      const validConstructionProject = contract.use === "construction-project" && buyer.sector === "housing" && contract.output === "housing";
      const validResaleInput = contract.use !== "operations" && buyer.input === contract.product && buyer.sells === contract.output;
      if (!supplier || !buyer || supplier.sells !== contract.product || (!validOperatingInput && !validConstructionProject && !validResaleInput)) {
        throw new Error(`Invalid supply contract ${contract.id}`);
      }
    });
  }

  firmArchetype(archetypeId) {
    return FIRMS.find((archetype) => archetype.archetypeId === archetypeId) ?? null;
  }

  contractUnitPrice(contract) {
    return this.schedulesEnabled && contract.use === "operations"
      ? SCHEDULED_MAINTENANCE_UNIT_PRICE
      : contract.unitPrice;
  }

  contractTemplatesFor(archetype) {
    return SUPPLY_CONTRACTS.filter((contract) => contract.supplier === archetype.name || contract.buyer === archetype.name);
  }

  cafeDemandCount(archetype) {
    return this.people.filter((person) => person.alive && (
      (person.focus === "belonging" && person.cash > archetype.price + 7)
      || (person.scarcityError && person.stress > 0.65 && person.cash + 1e-9 >= archetype.price)
    )).length;
  }

  premiumFoodDemandCount(archetype) {
    const reserve = this.essentialCost() * this.formationProtectedRunwayDays();
    return this.people.reduce((total, person) => {
      if (!person.alive || person.foodStock.length || person.cash + 1e-9 < archetype.price + reserve) return total;
      const affordableUnits = Math.floor((person.cash - reserve + 1e-9) / archetype.price);
      return total + Math.max(0, Math.min(person.foodReserveTarget, affordableUnits));
    }, 0);
  }

  apothecaryDemandCount(archetype) {
    const reserve = this.essentialCost() * HEALTH_TREATMENT_RESERVE_DAYS;
    return this.people.filter((person) => person.alive
      && person.health < HEALTH_TREATMENT_THRESHOLD
      && person.cash + 1e-9 >= archetype.price + reserve).length;
  }

  educationDemandCount(archetype) {
    const reserve = this.essentialCost() * EDUCATION_RESERVE_DAYS;
    return this.people.filter((person) => person.alive
      && person.skill < EDUCATION_SKILL_THRESHOLD
      && person.cash + 1e-9 >= archetype.price + reserve).length;
  }

  constructionMaterialDemandCount() {
    return this.firms.some((firm) => firm.active && firm.archetypeId === "housing-provider") ? 1 : 0;
  }

  clinicDemandCount(archetype) {
    const reserve = this.essentialCost() * CLINIC_TREATMENT_RESERVE_DAYS;
    return this.people.filter((person) => person.alive
      && person.health < CLINIC_TREATMENT_THRESHOLD
      && person.cash + 1e-9 >= archetype.price + reserve).length;
  }

  housingOccupancy() {
    return this.people.filter((person) => person.alive && person.housed).length;
  }

  housingProjectDemand(housing = this.firms.find((firm) => firm.active && firm.sector === "housing")) {
    if (!this.housingCapacityEnabled || !housing?.active) return null;
    const vacancies = Math.max(0, housing.dwellingCapacity - this.housingOccupancy());
    if (vacancies <= HOUSING_PROJECT_CAPACITY_GAIN) return "expansion";
    if (this.day - housing.lastHousingProjectDay >= HOUSING_REPAIR_INTERVAL_DAYS) return "repair";
    return null;
  }

  builderDemandCount() {
    return this.housingProjectDemand() ? 1 : 0;
  }

  opportunityDemandCount(archetype) {
    if (archetype.archetypeId === "cafe") return this.cafeDemandCount(archetype);
    if (archetype.archetypeId === "premium-grocer") return this.premiumFoodDemandCount(archetype);
    if (archetype.archetypeId === "apothecary") return this.apothecaryDemandCount(archetype);
    if (archetype.archetypeId === "school") return this.educationDemandCount(archetype);
    if (archetype.archetypeId === "materials-yard") return this.constructionMaterialDemandCount();
    if (archetype.archetypeId === "clinic") return this.clinicDemandCount(archetype);
    if (archetype.archetypeId === "builder") return this.builderDemandCount();
    return 0;
  }

  formationObservationDays() {
    return this.employmentInterventionEnabled
      ? OPPORTUNITY_OBSERVATION_DAYS
      : LEGACY_OPPORTUNITY_OBSERVATION_DAYS;
  }

  formationProtectedRunwayDays() {
    return this.employmentInterventionEnabled
      ? OPPORTUNITY_PROTECTED_RUNWAY_DAYS
      : LEGACY_OPPORTUNITY_PROTECTED_RUNWAY_DAYS;
  }

  founderCandidates(excludedOwnerIds = []) {
    const protectedCash = roundMoney(this.essentialCost() * this.formationProtectedRunwayDays());
    const excludedOwners = new Set(excludedOwnerIds);
    return this.people
      .filter((person) => person.alive
        && person.employer < 0
        && !excludedOwners.has(person.id)
        && !this.firms.some((firm) => firm.active && firm.owner === person.id)
        && person.cash + 1e-9 >= OPPORTUNITY_STARTUP_CAPITAL + protectedCash)
      .sort((a, b) => (
        b.ownerRecoveryThreshold - a.ownerRecoveryThreshold
        || b.cash - a.cash
        || a.id - b.id
      ));
  }

  opportunityFinancials(archetype, potentialCustomers, requiredWorkers, templates) {
    const produceTemplate = templates.find((contract) => contract.buyer === archetype.name && contract.use !== "operations");
    const demandScaledInputs = ["premium-grocer", "apothecary", "school", "materials-yard", "clinic", "builder"].includes(archetype.archetypeId);
    const outputCapacity = produceTemplate?.dailyQuantity ?? archetype.transactionsPerWorker * requiredWorkers;
    const demandCaptureRate = ["materials-yard", "builder"].includes(archetype.archetypeId) ? 1 : OPPORTUNITY_DEMAND_CAPTURE_RATE;
    const expectedOutputUnits = demandScaledInputs
      ? Math.min(potentialCustomers * demandCaptureRate, outputCapacity)
      : potentialCustomers * (this.policy.discretionaryDemand / 100) * OPPORTUNITY_DEMAND_CAPTURE_RATE;
    const expectedDailyRevenue = roundMoney(expectedOutputUnits * archetype.price);
    const variableDemandInputs = demandScaledInputs
      ? expectedOutputUnits * (produceTemplate?.unitPrice ?? 0)
      : null;
    const carrier = this.transportEnabled ? this.firms.find((firm) => firm.active && firm.archetypeId === "haulage") : null;
    const expectedDailyCost = roundMoney(
      this.averageOpenDayWage(archetype) * requiredWorkers
      + templates.filter((contract) => contract.buyer === archetype.name).reduce(
        (sum, contract) => {
          const inputCost = contract.use === "operations"
            ? contract.dailyQuantity * contract.unitPrice / MAINTENANCE_INTERVAL_DAYS
            : (variableDemandInputs ?? contract.dailyQuantity * contract.unitPrice);
          const units = variableDemandInputs === null ? contract.dailyQuantity : expectedOutputUnits;
          const freightDelta = carrier && contract.use !== "operations" && contract.use !== "construction-project"
            ? units * (carrier.price - carrier.basePrice)
            : 0;
          return sum + inputCost + freightDelta;
        },
        0,
      ),
    );
    return { expectedDailyRevenue, expectedDailyCost };
  }

  opportunityEvidence(archetype, observations = this.opportunityWindows[archetype.archetypeId] ?? []) {
    const instances = this.firms.filter((firm) => firm.archetypeId === archetype.archetypeId);
    const activeInstance = instances.find((firm) => firm.active);
    const previousInstances = instances.filter((firm) => !firm.active);
    const latestFailure = [...previousInstances].sort((a, b) => b.closedDay - a.closedDay)[0] ?? null;
    const cooldownRemaining = latestFailure ? Math.max(0, latestFailure.closedDay + PRIVATE_REENTRY_COOLDOWN_DAYS - this.day) : 0;
    const requiredWorkers = archetype.formationStaff ?? archetype.initialStaff;
    const founder = this.founderCandidates(previousInstances.map((firm) => firm.owner))[0] ?? null;
    const unemployedWorkers = this.replacementWorkers(this.people.length);
    const availableWorkers = founder
      ? [founder, ...unemployedWorkers.filter((person) => person.id !== founder.id)].slice(0, requiredWorkers)
      : unemployedWorkers.slice(0, requiredWorkers);
    const templates = this.contractTemplatesFor(archetype);
    const supplierStates = templates
      .filter((contract) => contract.buyer === archetype.name)
      .map((contract) => {
        const supplier = this.firms.find((firm) => firm.active && firm.name === contract.supplier);
        return { name: contract.supplier, product: contract.product, available: Boolean(supplier), firmId: supplier?.id ?? null };
      });
    const expectedDailyDemand = observations.length
      ? observations.reduce((sum, observation) => sum + observation.potentialCustomers, 0) / observations.length
      : 0;
    const { expectedDailyRevenue, expectedDailyCost } = this.opportunityFinancials(
      archetype,
      expectedDailyDemand,
      requiredWorkers,
      templates,
    );
    const requiredObservationDays = this.formationObservationDays();
    const protectedRunwayDays = this.formationProtectedRunwayDays();
    const viableObservationDays = observations.filter((observation) => {
      const financials = this.opportunityFinancials(archetype, observation.potentialCustomers, requiredWorkers, templates);
      return financials.expectedDailyRevenue + 1e-9 >= financials.expectedDailyCost * OPPORTUNITY_MARGIN_BUFFER;
    }).length;
    const reasons = [];
    if (activeInstance) reasons.push(`${activeInstance.name} is already operating`);
    if (cooldownRemaining) reasons.push(`${cooldownRemaining} day${cooldownRemaining === 1 ? "" : "s"} remain in the post-failure confidence cooldown`);
    if (observations.length < requiredObservationDays) reasons.push(`${requiredObservationDays - observations.length} observation day${requiredObservationDays - observations.length === 1 ? "" : "s"} still required`);
    if (this.employmentInterventionEnabled && viableObservationDays < OPPORTUNITY_REQUIRED_VIABLE_DAYS) reasons.push(`${OPPORTUNITY_REQUIRED_VIABLE_DAYS - viableObservationDays} more viable demand day${OPPORTUNITY_REQUIRED_VIABLE_DAYS - viableObservationDays === 1 ? " is" : "s are"} required`);
    if (expectedDailyRevenue + 1e-9 < expectedDailyCost * OPPORTUNITY_MARGIN_BUFFER) reasons.push("observed demand does not cover expected wages and inputs with a margin buffer");
    const missingSuppliers = supplierStates.filter((supplier) => !supplier.available).map((supplier) => supplier.name);
    if (missingSuppliers.length) reasons.push(`missing active supplier${missingSuppliers.length === 1 ? "" : "s"}: ${missingSuppliers.join(", ")}`);
    if (availableWorkers.length < requiredWorkers) reasons.push(`${requiredWorkers - availableWorkers.length} more unemployed worker${requiredWorkers - availableWorkers.length === 1 ? " is" : "s are"} required`);
    if (!founder) reasons.push(`no unemployed founder can invest ${OPPORTUNITY_STARTUP_CAPITAL.toFixed(1)} while protecting ${protectedRunwayDays} days of essentials`);
    return Object.freeze({
      archetypeId: archetype.archetypeId,
      name: archetype.name,
      status: reasons.length ? "not-ready" : "ready",
      ready: reasons.length === 0,
      observedDays: observations.length,
      requiredObservationDays,
      viableObservationDays,
      requiredViableDays: this.employmentInterventionEnabled ? OPPORTUNITY_REQUIRED_VIABLE_DAYS : null,
      latestPotentialCustomers: observations.at(-1)?.potentialCustomers ?? 0,
      demandUnit: archetype.archetypeId === "premium-grocer" ? "food portions" : archetype.archetypeId === "apothecary" ? "eligible patients" : archetype.archetypeId === "school" ? "eligible students" : archetype.archetypeId === "materials-yard" ? "housing material bundles" : archetype.archetypeId === "clinic" ? "severe-care patients" : archetype.archetypeId === "builder" ? "housing projects" : "potential customers",
      expectedDailyDemand,
      expectedDailyRevenue,
      expectedDailyCost,
      marginBuffer: OPPORTUNITY_MARGIN_BUFFER,
      startupCapital: OPPORTUNITY_STARTUP_CAPITAL,
      protectedRunwayDays,
      previousInstanceIds: previousInstances.map((firm) => firm.instanceId),
      latestFailureDay: latestFailure?.closedDay ?? null,
      cooldownDays: PRIVATE_REENTRY_COOLDOWN_DAYS,
      cooldownRemaining,
      requiredWorkers,
      availableWorkerIds: availableWorkers.map((person) => person.id),
      founderId: founder?.id ?? null,
      founderName: founder?.name ?? null,
      suppliers: supplierStates,
      reasons: Object.freeze(reasons),
    });
  }

  firmOpportunities() {
    return this.formationArchetypeIds.map((archetypeId) => this.firmArchetype(archetypeId))
      .filter((archetype) => archetype && !this.firms.some((firm) => firm.active && firm.archetypeId === archetype.archetypeId))
      .map((archetype) => this.opportunityEvidence(archetype));
  }

  addContractsForFirm(firm) {
    this.contractTemplatesFor(firm).forEach((template) => {
      const supplier = template.supplier === firm.name
        ? firm
        : this.firms.find((candidate) => candidate.active && candidate.name === template.supplier);
      const buyer = template.buyer === firm.name
        ? firm
        : this.firms.find((candidate) => candidate.active && candidate.name === template.buyer);
      if (!supplier || !buyer) return;
      const unitPrice = this.contractUnitPrice(template);
      this.contracts.push({
        ...template,
        unitPrice,
        id: this.contracts.length,
        baseUnitPrice: unitPrice,
        supplierId: supplier.id,
        buyerId: buyer.id,
        active: true,
        requestedToday: 0,
        deliveredToday: 0,
        shortfallToday: 0,
        transportLoadToday: 0,
        transportFeeToday: 0,
        transportConstrainedToday: false,
        shortfallCauseToday: null,
        limitingFirmId: null,
      });
    });
  }

  foundFirm(archetype, evidence) {
    if (!evidence.ready) return null;
    const founder = this.people[evidence.founderId];
    const workers = evidence.availableWorkerIds.map((id) => this.people[id]).filter((person) => person.alive && person.employer < 0).slice(0, evidence.requiredWorkers);
    if (!founder || workers.length < evidence.requiredWorkers || !workers.includes(founder)) return null;
    const instanceNumber = (this.firmInstanceCounts[archetype.archetypeId] ?? 0) + 1;
    const firm = this.createFirmInstance(archetype, this.firms.length, {
      owner: founder.id,
      cash: 0,
      founderCapital: OPPORTUNITY_STARTUP_CAPITAL,
      inventory: 0,
      revenueEMA: 0,
      targetStaff: evidence.requiredWorkers,
      instanceNumber,
      foundingDay: this.day,
    });
    firm.formationObservedDays = evidence.observedDays;
    firm.formationViableDays = evidence.viableObservationDays;
    firm.protectedRunwayDays = evidence.protectedRunwayDays;
    this.firms.push(firm);
    this.firmInstanceCounts[archetype.archetypeId] = instanceNumber;
    const founderBefore = founder.cash;
    const firmBefore = firm.cash;
    const paid = this.transfer(founder, firm, OPPORTUNITY_STARTUP_CAPITAL, { exact: true });
    if (paid !== OPPORTUNITY_STARTUP_CAPITAL) {
      this.firms.pop();
      this.firmInstanceCounts[archetype.archetypeId] = instanceNumber - 1;
      return null;
    }
    this.ledger(founder, { direction: "out", amount: paid, text: `founder capital to ${firm.name}`, before: founderBefore });
    this.ledger(firm, { direction: "in", amount: paid, text: `founder capital from ${founder.name}`, before: firmBefore });
    workers.forEach((person) => this.hire(firm, person));
    this.addContractsForFirm(firm);
    const observation = Object.freeze({ kind: "firm-formation", ...structuredClone(evidence), firmId: firm.id, instanceId: firm.instanceId });
    const legalActions = Object.freeze(["wait-to-found", `found-firm:${archetype.archetypeId}`]);
    const decision = {
      action: `found-firm:${archetype.archetypeId}`,
      policy: "entrepreneur-v1",
      reasons: ["observed demand, suppliers, staffing, and protected founder capital passed the formation gate"],
      scores: { "wait-to-found": 0, [`found-firm:${archetype.archetypeId}`]: roundMoney(evidence.expectedDailyRevenue - evidence.expectedDailyCost * evidence.marginBuffer) },
    };
    this.recordDecision(founder, observation, legalActions, decision, "Settlement");
    this.recordDecision(firm, observation, legalActions, decision, "Settlement");
    this.note(founder, `founded ${firm.name} with ${paid.toFixed(1)} of protected personal capital`, "good");
    this.note(firm, `${founder.name} founded ${firm.name} after ${evidence.observedDays} days of viable demand evidence`, "good");
    this.validateProductGraph();
    return firm;
  }

  observeFirmOpportunities() {
    const results = [];
    this.formationArchetypeIds.map((archetypeId) => this.firmArchetype(archetypeId)).filter(Boolean).forEach((archetype) => {
      if (this.firms.some((firm) => firm.active && firm.archetypeId === archetype.archetypeId)) return;
      if (this.pendingFormations[archetype.archetypeId]) return;
      if (!this.archetypeOpenOnDay(archetype)) return;
      const window = this.opportunityWindows[archetype.archetypeId];
      window.push(Object.freeze({
        day: this.day,
        ...temporalMetadata(this.day, "Settlement"),
        sequence: this.opportunitySequence + 1,
        potentialCustomers: this.opportunityDemandCount(archetype),
      }));
      if (window.length > this.formationObservationDays()) window.shift();
      const evidence = this.opportunityEvidence(archetype, window);
      this.opportunitySequence += 1;
      const history = {
        day: this.day,
        ...temporalMetadata(this.day, "Settlement"),
        sequence: this.opportunitySequence,
        ...structuredClone(evidence),
        foundedInstanceId: null,
      };
      this.opportunityHistory.unshift(history);
      let firm = null;
      if (this.schedulesEnabled && evidence.ready) {
        this.pendingFormations[archetype.archetypeId] = { evidence: structuredClone(evidence), historySequence: history.sequence };
      } else firm = this.foundFirm(archetype, evidence);
      if (firm) history.foundedInstanceId = firm.instanceId;
      results.push(firm ?? evidence);
    });
    return results.length === 1 ? results[0] : results;
  }

  note(person, text, kind = "neutral") {
    person.activitySequence += 1;
    person.events.unshift({ day: this.day, ...temporalMetadata(this.day, this.phase), sequence: person.activitySequence, text, kind });
  }

  isPerishable(product) {
    return Boolean(PERISHABLE_SHELF_LIFE[product]);
  }

  reconcileInventoryBatches(firm) {
    if (!this.isPerishable(firm.sells)) return;
    const batchTotal = firm.inventoryBatches.reduce((total, batch) => total + batch.quantity, 0);
    if (Math.abs(batchTotal - firm.inventory) <= 1e-9) return;
    const inventory = firm.inventory;
    firm.inventoryBatches = [];
    firm.inventoryBatchSequence = 0;
    firm.inventory = 0;
    if (inventory > 0) this.addFirmInventory(firm, inventory, { batchDay: this.day });
  }

  addFirmInventory(firm, quantity, { batchDay = this.day, qualityBasis = firm.quality ?? null } = {}) {
    if (!(quantity > 0)) return 0;
    if (!this.isPerishable(firm.sells)) {
      firm.inventory += quantity;
      return quantity;
    }
    this.reconcileInventoryBatches(firm);
    const shelfLife = PERISHABLE_SHELF_LIFE[firm.sells];
    const latest = firm.inventoryBatches.at(-1);
    if (latest && latest.batchDay === batchDay && latest.qualityBasis === qualityBasis && latest.shelfLife === shelfLife) latest.quantity += quantity;
    else {
      firm.inventoryBatchSequence += 1;
      firm.inventoryBatches.push({
        sequence: firm.inventoryBatchSequence,
        product: firm.sells,
        quantity,
        batchDay,
        qualityBasis,
        shelfLife,
        ownerKind: firm.kind,
        ownerId: firm.id,
        ownerName: firm.name,
      });
    }
    firm.inventory += quantity;
    return quantity;
  }

  takeFirmInventory(firm, quantity) {
    if (!(quantity > 0) || firm.inventory + 1e-9 < quantity) return [];
    if (!this.isPerishable(firm.sells)) {
      firm.inventory -= quantity;
      return [{ product: firm.sells, quantity, batchDay: this.day, qualityBasis: firm.quality ?? null, shelfLife: null }];
    }
    this.reconcileInventoryBatches(firm);
    let remaining = quantity;
    const taken = [];
    firm.inventoryBatches.sort((left, right) => left.batchDay - right.batchDay || left.sequence - right.sequence);
    for (const batch of firm.inventoryBatches) {
      if (remaining <= 1e-9) break;
      const removed = Math.min(batch.quantity, remaining);
      if (removed <= 0) continue;
      batch.quantity -= removed;
      remaining -= removed;
      taken.push({ ...batch, quantity: removed });
    }
    firm.inventoryBatches = firm.inventoryBatches.filter((batch) => batch.quantity > 1e-9);
    firm.inventory = Math.max(0, firm.inventory - (quantity - remaining));
    return remaining <= 1e-9 ? taken : [];
  }

  peekFirmInventory(firm, quantity) {
    if (!(quantity > 0) || firm.inventory + 1e-9 < quantity) return [];
    if (!this.isPerishable(firm.sells)) return [{
      product: firm.sells,
      quantity,
      batchDay: this.day,
      qualityBasis: firm.quality ?? null,
      shelfLife: null,
    }];
    this.reconcileInventoryBatches(firm);
    let remaining = quantity;
    const selected = [];
    [...firm.inventoryBatches]
      .sort((left, right) => left.batchDay - right.batchDay || left.sequence - right.sequence)
      .forEach((batch) => {
        if (remaining <= 1e-9) return;
        const taken = Math.min(batch.quantity, remaining);
        if (taken > 0) selected.push({ ...batch, quantity: taken });
        remaining -= taken;
      });
    return remaining <= 1e-9 ? selected : [];
  }

  recordWaste(actor, { product, quantity, batchDay, age, reason }) {
    actor.wasteSequence += 1;
    const record = Object.freeze({
      day: this.day,
      ...temporalMetadata(this.day, "Planning"),
      sequence: actor.wasteSequence,
      actorKind: actor.kind,
      actorId: actor.id,
      actorName: actor.name,
      product,
      quantity,
      batchDay,
      age,
      reason,
    });
    actor.wasteHistory.unshift(record);
    return record;
  }

  expirePerishableInventory() {
    this.firms.forEach((firm) => {
      firm.perishableProcessedToday = 0;
      firm.perishableSalesToday = 0;
      if (!this.isPerishable(firm.sells)) return;
      this.reconcileInventoryBatches(firm);
      const viable = [];
      firm.inventoryBatches.forEach((batch) => {
        const age = this.day - batch.batchDay;
        if (age < batch.shelfLife) return void viable.push(batch);
        firm.inventory -= batch.quantity;
        this.recordWaste(firm, { product: batch.product, quantity: batch.quantity, batchDay: batch.batchDay, age, reason: "expired at shelf-life boundary" });
        this.note(firm, `${batch.quantity.toFixed(1)} ${PRODUCTS[batch.product].unit}${batch.quantity === 1 ? "" : "s"} expired after ${age} days`, "bad");
      });
      firm.inventoryBatches = viable;
      if (firm.inventory < 1e-9) firm.inventory = 0;
    });
    this.people.forEach((person) => {
      person.foodConsumedToday = 0;
      if (!person.foodStock.length) return;
      const viable = [];
      person.foodStock.forEach((food) => {
        const batchDay = food.processedDay ?? food.purchasedDay;
        const shelfLife = food.shelfLife ?? PERISHABLE_SHELF_LIFE[this.firms[food.seller]?.sells] ?? 3;
        const age = this.day - batchDay;
        if (age < shelfLife) return void viable.push(food);
        const product = food.product ?? this.firms[food.seller]?.sells ?? "budgetFood";
        this.recordWaste(person, { product, quantity: 1, batchDay, age, reason: "expired in citizen pantry" });
        this.note(person, `a stored meal from ${this.firms[food.seller]?.name ?? "an unknown seller"} expired`, "bad");
      });
      person.foodStock = viable;
    });
  }

  ledger(person, { direction, amount, text, before }) {
    person.activitySequence += 1;
    person.ledger.unshift({
      day: this.day,
      ...temporalMetadata(this.day, this.phase),
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
    if (amount > 0) this.flows.push({ from: { kind: from.kind, id: from.id }, to: { kind: to.kind, id: to.id }, amount, phase: this.phase, ...temporalMetadata(this.day, this.phase) });
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

  supportShortfall(person) {
    if (!person.alive) return 0;
    return roundMoney(Math.max(0, this.essentialCost() * SUPPORT_RUNWAY_TARGET_DAYS - person.cash));
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
      + isolation * 0.07
      + (this.sleepEnabled ? person.sleepDebt * 0.14 : 0),
    );
  }

  updateStress(person) {
    const pressure = this.stressPressure(person);
    person.stress = clamp(person.stress * 0.7 + pressure * 0.3 + (this.random() - 0.5) * 0.025);
  }

  assessNeeds(person) {
    const ownsFirm = this.firms.some((firm) => firm.active && firm.owner === person.id);
    const fed = clamp(1 - person.hungryDays / 3);
    const physiological = clamp(person.health * 0.52 + fed * 0.48 - (this.sleepEnabled ? person.sleepDebt * 0.3 : 0));
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

  firmOpenOnDay(firm, day = this.day) {
    if (!firm?.active) return false;
    if (!this.schedulesEnabled) return true;
    return (firm.openWeekdays ?? FIRM_OPEN_WEEKDAYS[firm.archetypeId]).includes(calendarForDay(day).weekdayIndex);
  }

  archetypeOpenOnDay(archetype, day = this.day) {
    return !this.schedulesEnabled || FIRM_OPEN_WEEKDAYS[archetype.archetypeId].includes(calendarForDay(day).weekdayIndex);
  }

  firmServiceAvailable(firm, block, day = this.day) {
    return this.firmOpenOnDay(firm, day) && (!this.schedulesEnabled || firm.serviceWindow === block);
  }

  nextOpeningDay(firm, { fromDay = this.day, includeToday = false } = {}) {
    if (!firm?.active) return null;
    if (!this.schedulesEnabled) return includeToday ? fromDay : fromDay + 1;
    for (let offset = includeToday ? 0 : 1; offset <= 7; offset += 1) {
      const day = fromDay + offset;
      if (firm.openWeekdays.includes(calendarForDay(day).weekdayIndex)) return day;
    }
    return null;
  }

  nextShiftDay(person, { fromDay = this.day, includeToday = true } = {}) {
    if (!person?.alive || person.employer < 0) return null;
    const firm = this.firms[person.employer];
    for (let offset = includeToday ? 0 : 1; offset <= 14; offset += 1) {
      const day = fromDay + offset;
      if (this.scheduledForShift(person, firm, day)) return day;
    }
    return null;
  }

  nextContractOpening(contract, fromDay = this.day) {
    const supplier = this.firms[contract.supplierId];
    const buyer = this.firms[contract.buyerId];
    const carrier = this.requiresHaulage(contract) ? this.firms.find((firm) => firm.active && firm.archetypeId === "haulage") : null;
    for (let offset = 1; offset <= 14; offset += 1) {
      const day = fromDay + offset;
      if (this.firmOpenOnDay(supplier, day) && this.firmOpenOnDay(buyer, day) && (!carrier || this.firmOpenOnDay(carrier, day))) return day;
    }
    return null;
  }

  rotaCoverage(firm) {
    return Object.fromEntries((firm.openWeekdays ?? FIRM_OPEN_WEEKDAYS[firm.archetypeId]).map((weekday) => [weekday, firm.employees.reduce((total, id) => (
      total + Number(this.people[id]?.rota?.firmId === firm.id && this.people[id].rota.weekdayIndices.includes(weekday))
    ), 0)]));
  }

  assignRota(firm, person) {
    person.employmentSpellSequence += 1;
    const coverage = this.rotaCoverage(firm);
    const weekdayIndices = [...(firm.openWeekdays ?? FIRM_OPEN_WEEKDAYS[firm.archetypeId])]
      .sort((left, right) => coverage[left] - coverage[right]
        || ((left + person.id) % 7) - ((right + person.id) % 7)
        || left - right)
      .slice(0, 5)
      .sort((left, right) => left - right);
    person.rota = Object.freeze({
      sequence: person.employmentSpellSequence,
      firmId: firm.id,
      assignedDay: this.day,
      weekdayIndices: Object.freeze(weekdayIndices),
    });
    person.scheduledShiftsWorked = 0;
    person.scheduledShiftsElapsed = 0;
    return person.rota;
  }

  scheduledForShift(person, firm, day = this.day) {
    if (!this.schedulesEnabled) return person.alive && person.employer === firm.id && firm.active;
    return person.alive
      && person.employer === firm.id
      && firm.active
      && person.rota?.firmId === firm.id
      && person.rota.weekdayIndices.includes(calendarForDay(day).weekdayIndex);
  }

  scheduledShiftWage(firm) {
    const dailyEquivalent = Math.max(this.policy.minimumWage, firm.wage);
    return this.schedulesEnabled ? dailyEquivalent * 7 / 5 : dailyEquivalent;
  }

  averageOpenDayWage(firm) {
    if (!this.schedulesEnabled) return Math.max(this.policy.minimumWage, firm.wage);
    return this.scheduledShiftWage(firm) * 5 / (firm.openWeekdays ?? FIRM_OPEN_WEEKDAYS[firm.archetypeId]).length;
  }

  minimumCoverageStaff(firm) {
    const baseline = firm.sector === "housing" ? 2 : 1;
    if (!this.schedulesEnabled) return baseline;
    return Math.max(baseline, Math.ceil((firm.openWeekdays ?? FIRM_OPEN_WEEKDAYS[firm.archetypeId]).length / 5));
  }

  hire(firm, person, silent = false) {
    if (!firm.active || !person.alive || person.employer >= 0) return false;
    person.employer = firm.id;
    person.jobApplicationFirm = -1;
    firm.employees.push(person.id);
    this.assignRota(firm, person);
    if (!silent) this.note(person, `hired by ${firm.name}`, "good");
    return true;
  }

  fire(firm, person, reason) {
    firm.employees = firm.employees.filter((id) => id !== person.id);
    person.employer = -1;
    person.rota = null;
    const investmentSlot = this.activeInvestmentSlot(firm);
    if (investmentSlot?.status === "evaluating" && investmentSlot.hiredCitizenId === person.id) {
      this.endInvestmentSlot(firm, investmentSlot, "ended", `${reason} ended the evaluated position`);
    }
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
    return firms.filter((firm) => this.firmOpenOnDay(firm)
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
      offeredWage: this.scheduledShiftWage(firm),
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
      const wage = this.scheduledShiftWage(firm);
      if (candidate && this.considerJobOffer(firm, candidate, wage)) {
        const slot = this.activeInvestmentSlot(firm);
        if (slot?.status === "recruiting") {
          slot.status = "evaluating";
          slot.hiredCitizenId = candidate.id;
          slot.hiredDay = this.day;
          slot.evaluationDeadline = this.day + INVESTMENT_EVALUATION_DAYS;
          slot.evaluationStartScheduledShift = candidate.scheduledShiftsElapsed;
          firm.latestStaffingReason = this.schedulesEnabled
            ? `${candidate.name} filled investment slot ${slot.id}; evaluation lasts ${INVESTMENT_EVALUATION_DAYS} scheduled shifts`
            : `${candidate.name} filled investment slot ${slot.id}; evaluation ends on day ${slot.evaluationDeadline}`;
          this.note(firm, firm.latestStaffingReason, "good");
          this.note(candidate, `began a ${INVESTMENT_EVALUATION_DAYS}-day planned evaluation at ${firm.name}`, "neutral");
        }
        firm.vacancyAge = 0;
        hires += 1;
      }
    });
    return hires;
  }

  considerAttendance(person, firm) {
    if (!person.alive || person.employer !== firm.id || !this.firmOpenOnDay(firm) || !this.scheduledForShift(person, firm)) return false;
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
      sleepDebt: this.sleepEnabled ? person.sleepDebt : 0,
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

  planWorkday(person) {
    if (!person.alive) return null;
    this.assessNeeds(person);
    const employer = person.employer >= 0 ? this.firms[person.employer] : null;
    const scheduled = Boolean(employer && this.firmOpenOnDay(employer) && this.scheduledForShift(person, employer));
    const clinic = this.firms.find((firm) => firm.active && firm.archetypeId === "clinic");
    const school = this.firms.find((firm) => firm.active && firm.archetypeId === "school");
    const options = [];
    if (scheduled) options.push({ action: `work-shift:${employer.id}`, activity: "shift", firmId: employer.id, firmName: employer.name });
    if (person.health < CLINIC_TREATMENT_THRESHOLD && this.firmServiceAvailable(clinic, "Workday")) options.push({
      action: `attend-clinic:${clinic.id}`,
      activity: "clinic",
      firmId: clinic.id,
      firmName: clinic.name,
      price: clinic.price,
      expectedRecovery: CLINIC_TREATMENT_RECOVERY,
      capacityAvailable: clinic.inventory >= 1,
    });
    if (person.skill < EDUCATION_SKILL_THRESHOLD && this.firmServiceAvailable(school, "Workday")) options.push({
      action: `attend-school:${school.id}`,
      activity: "school",
      firmId: school.id,
      firmName: school.name,
      price: school.price,
      skillGain: EDUCATION_SKILL_GAIN,
      capacityAvailable: school.inventory >= 1,
    });
    options.push({ action: "daytime-rest", activity: "rest" }, { action: "self-study", activity: "self-study" });
    const legalActions = Object.freeze(options.map((option) => option.action));
    const observation = Object.freeze({
      kind: "workday-plan",
      citizenId: person.id,
      citizenName: person.name,
      scheduled,
      health: person.health,
      stress: person.stress,
      hungryDays: person.hungryDays,
      skill: person.skill,
      reliability: person.reliability,
      sleepDebt: this.sleepEnabled ? person.sleepDebt : 0,
      runwayDays: this.runwayDays(person),
      profile: { ...person.motivationProfile },
      options: options.map((option) => ({ ...option })),
    });
    const decision = this.citizenPolicy.decide({ observation, legalActions, random: this.random });
    if (!decision || !legalActions.includes(decision.action)) throw new Error(`Citizen policy ${this.citizenPolicy.id ?? "unknown"} chose an illegal workday action`);
    this.recordDecision(person, observation, legalActions, decision, "Planning");
    const option = options.find((candidate) => candidate.action === decision.action);
    person.dailyPlan = {
      day: this.day,
      workday: { ...option, status: "planned", failureReason: null },
    };
    person.currentPrimaryActivity = null;
    return person.dailyPlan;
  }

  plannedServiceFailure(person, firm, reserve = 0) {
    if (!firm?.active) return "provider is no longer operating";
    if (!this.firmServiceAvailable(firm, "Workday")) {
      const nextOpening = this.nextOpeningDay(firm);
      return `provider is closed${nextOpening ? ` until D${nextOpening}` : ""}`;
    }
    if (firm.inventory < 1) return "provider has no service stock";
    if (firm.transactionsToday >= this.transactionCapacity(firm)) return "provider has no staffed capacity";
    if (person.cash + 1e-9 < firm.price + reserve) return "citizen can no longer afford the service and reserve";
    return null;
  }

  executePlannedClinic(person, firm) {
    const failure = this.plannedServiceFailure(person, firm, this.essentialCost() * CLINIC_TREATMENT_RESERVE_DAYS);
    if (failure) return { completed: false, failure };
    const beforeHealth = person.health;
    if (!this.buy(person, firm, 1, "clinical care")) return { completed: false, failure: "the exact clinical transaction failed" };
    person.clinicalSeller = firm.id;
    person.lastClinicalDay = this.day;
    person.health = clamp(person.health + CLINIC_TREATMENT_RECOVERY, 0.08, 0.96);
    this.note(person, `clinical treatment raised health from ${Math.round(beforeHealth * 100)}% to ${Math.round(person.health * 100)}%`, "good");
    return { completed: true };
  }

  executePlannedSchool(person, firm) {
    const failure = this.plannedServiceFailure(person, firm, this.essentialCost() * EDUCATION_RESERVE_DAYS);
    if (failure) return { completed: false, failure };
    const beforeSkill = person.skill;
    if (!this.buy(person, firm, 1, "education")) return { completed: false, failure: "the exact education transaction failed" };
    person.educationSeller = firm.id;
    person.lastEducationDay = this.day;
    person.skill = clamp(person.skill + EDUCATION_SKILL_GAIN, 0, 0.95);
    this.syncGeneralKnowledge(person, { source: "education", sourceId: firm.id, sourceName: firm.name, rule: "paid-retail-course-general-skill-v1", phase: "Production" });
    this.applyKnowledgeLearning(person, { source: "education", sourceId: firm.id, sourceName: firm.name, domain: "retailOperations", rate: RETAIL_COURSE_LEARNING_RATE, rule: "paid-retail-course-retail-v1", phase: "Production" });
    this.applyKnowledgeLearning(person, { source: "education", sourceId: firm.id, sourceName: firm.name, domain: "inventoryHandling", rate: RETAIL_COURSE_INVENTORY_TRANSFER_RATE, rule: "paid-retail-course-inventory-transfer-v1", phase: "Production" });
    person.growth = clamp(person.growth + 0.015);
    this.note(person, `a retail operations course raised skill from ${Math.round(beforeSkill * 100)}% to ${Math.round(person.skill * 100)}% and added retail knowledge`, "good");
    return { completed: true };
  }

  recordDecision(person, observation, legalActions, decision, phase) {
    person.decisionSequence += 1;
    person.decisions.unshift({
      day: this.day,
      phase,
      ...temporalMetadata(this.day, phase),
      sequence: person.decisionSequence,
      policy: decision.policy ?? this.citizenPolicy.id ?? "unknown",
      kind: observation.kind,
      observation: structuredClone(observation),
      legalActions: [...legalActions],
      chosenAction: decision.action,
      reasons: Array.isArray(decision.reasons) ? [...decision.reasons] : [],
      scores: decision.scores ? { ...decision.scores } : {},
      control: decision.control ? structuredClone(decision.control) : null,
      shadow: decision.shadow ? structuredClone(decision.shadow) : null,
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
      person.rota = null;
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
    person.socialVenueToday = null;
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
    if (!this.firmOpenOnDay(firm)) return 0;
    const capacity = firm.employees.reduce((total, id) => {
      const person = this.people[id];
      if (!person.attended) return total;
      return total + firm.transactionsPerWorker;
    }, 0);
    const knowledgeSlots = this.knowledgeEnabled && firm.archetypeId === "everyday-grocer"
      ? firm.knowledgeCapacitySlotsToday
      : 0;
    return Math.floor(capacity * firm.operationalReadiness * this.scheduledShiftCapacityMultiplier()) + knowledgeSlots;
  }

  scheduledShiftCapacityMultiplier() {
    return this.schedulesEnabled ? 7 / 5 : 1;
  }

  transportCapacityPerWorker() {
    return this.schedulesEnabled ? SCHEDULED_TRANSPORT_CAPACITY_PER_WORKER : TRANSPORT_CAPACITY_PER_WORKER;
  }

  knowledgeCapacityContribution(firm) {
    if (!this.knowledgeEnabled || !firm.active || firm.archetypeId !== "everyday-grocer") return 0;
    const contribution = firm.employees.reduce((total, id) => {
      const person = this.people[id];
      if (!person.attended) return total;
      const vocationalKnowledge = weightedVocationalKnowledge(person.knowledgeProfile, firm.knowledge);
      return total + firm.transactionsPerWorker * vocationalKnowledge * firm.knowledge.maxBonus;
    }, 0);
    return Math.round(contribution * firm.operationalReadiness * this.scheduledShiftCapacityMultiplier() * 1_000_000) / 1_000_000;
  }

  accrueKnowledgeCapacity(firm) {
    if (firm.lastKnowledgeCapacityDay === this.day) return firm.knowledgeCapacitySlotsToday;
    firm.lastKnowledgeCapacityDay = this.day;
    firm.knowledgeCapacitySlotsToday = 0;
    const contribution = this.knowledgeCapacityContribution(firm);
    if (!contribution) return 0;
    const accumulated = Math.round((firm.knowledgeCapacityCarry + contribution) * 1_000_000) / 1_000_000;
    const slots = Math.floor(accumulated + 1e-9);
    firm.knowledgeCapacityCarry = Math.round((accumulated - slots) * 1_000_000) / 1_000_000;
    firm.knowledgeCapacitySlotsToday = slots;
    if (slots > 0) this.note(firm, `worker knowledge made ${slots} extra transaction slot${slots === 1 ? "" : "s"} available; ${(firm.knowledgeCapacityCarry * 100).toFixed(1)}% carry remains`, "good");
    return slots;
  }

  applyKnowledgeLearning(person, { source, sourceId, sourceName, domain, rate = null, target = null, rule, phase = PHASES[this.phase] ?? "Production" }) {
    if (!this.knowledgeEnabled || !person.alive || !(domain in person.knowledgeProfile) || domain === "version") return null;
    const before = person.knowledgeProfile[domain];
    const nextValue = target === null ? before + rate * (1 - before) : target;
    const after = Math.round(clamp(nextValue) * 1_000_000) / 1_000_000;
    if (after <= before) return null;
    person.knowledgeProfile[domain] = after;
    person.learningSequence += 1;
    const record = {
      day: this.day,
      phase,
      ...temporalMetadata(this.day, phase),
      sequence: person.learningSequence,
      source,
      sourceId,
      sourceName,
      domain,
      before,
      after,
      rule,
    };
    person.learningHistory.unshift(record);
    return record;
  }

  applyWorkplaceLearning(person, firm) {
    if (!this.knowledgeEnabled || !person.alive || !person.attended || !firm.active || person.employer !== firm.id || !firm.employees.includes(person.id)) return [];
    return firm.knowledge.domains.map((domain) => (
      this.applyKnowledgeLearning(person, {
        source: "workplace",
        sourceId: firm.id,
        sourceName: firm.name,
        domain: domain.id,
        rate: domain.workplaceLearningRate,
        rule: domain.learningRule,
        phase: "Production",
      })
    )).filter(Boolean);
  }

  syncGeneralKnowledge(person, { source, sourceId, sourceName, rule, phase = "Personal time" }) {
    return this.applyKnowledgeLearning(person, {
      source,
      sourceId,
      sourceName,
      domain: "general",
      target: person.skill,
      rule,
      phase,
    });
  }

  maintainFirm(firm) {
    if (!firm.active || !this.firmOpenOnDay(firm)) return;
    if (this.schedulesEnabled && firm.maintenanceUseMarkedDay !== this.day) return;
    const maintenanceContract = this.contracts.find((contract) => contract.use === "operations" && contract.buyerId === firm.id);
    if (!maintenanceContract) return;
    const maintenanceDue = this.schedulesEnabled
      ? firm.maintenanceUseDays - firm.lastMaintenanceUseCount >= MAINTENANCE_INTERVAL_DAYS
      : this.day - firm.lastMaintenanceDay >= MAINTENANCE_INTERVAL_DAYS;
    if (!maintenanceDue && firm.operationalReadiness >= 1) return;
    if (firm.operatingSupplies >= 1) {
      const wasConstrained = firm.operationalReadiness < 1;
      firm.operatingSupplies -= 1;
      firm.operationalReadiness = 1;
      firm.lastMaintenanceDay = this.day;
      firm.lastMaintenanceUseCount = firm.maintenanceUseDays;
      if (wasConstrained) this.note(firm, "maintenance supplies restored full operating capacity", "good");
      return;
    }
    if (firm.operationalReadiness >= 1) this.note(firm, "missing a maintenance kit reduced operating capacity", "bad");
    firm.operationalReadiness = MISSED_MAINTENANCE_CAPACITY;
  }

  markFirmUse(firm) {
    if (!this.schedulesEnabled || !this.firmOpenOnDay(firm) || firm.maintenanceUseMarkedDay === this.day) return false;
    firm.maintenanceUseMarkedDay = this.day;
    firm.maintenanceUseDays += 1;
    return true;
  }

  requestTransaction(firm, person, purpose) {
    if (!this.firmOpenOnDay(firm)) {
      const nextOpening = this.nextOpeningDay(firm);
      this.note(person, `${firm.name} was closed for the ${purpose}${nextOpening ? `; next opening D${nextOpening}` : ""}`, "bad");
      return false;
    }
    firm.attemptedTransactions += 1;
    if (firm.transactionsToday >= this.transactionCapacity(firm)) {
      firm.turnedAwayTransactions += 1;
      this.recordStaffingDemand(firm, "consumer", 1, "staffed transaction capacity");
      const description = purpose === "food"
        ? "food purchase"
        : purpose;
      this.note(person, `${firm.name} had no staffed capacity for the ${description}`, "bad");
      return false;
    }
    this.markFirmUse(firm);
    firm.transactionsToday += 1;
    return true;
  }

  recordStaffingDemand(firm, kind, units, cause) {
    if (!firm?.active || units <= 0 || !["consumer", "contract", "production"].includes(kind)) return false;
    const key = `${kind}Units`;
    firm.staffingDemandToday[key] += units;
    firm.staffingDemandToday.evidence.push(Object.freeze({ kind, units, cause }));
    return true;
  }

  staffingInputUnitCost(firm) {
    const inputContract = this.contracts.find((contract) => contract.active
      && contract.buyerId === firm.id
      && contract.use !== "operations");
    if (!inputContract) return 0;
    const carrier = this.transportEnabled && this.requiresHaulage(inputContract)
      ? this.firms.find((candidate) => candidate.active && candidate.archetypeId === "haulage")
      : null;
    return roundMoney(inputContract.unitPrice + (carrier ? carrier.price - carrier.basePrice : 0));
  }

  staffingIncrementalCapacity(firm) {
    const shiftCapacity = this.scheduledShiftCapacityMultiplier();
    if (firm.archetypeId === "haulage") return Math.floor(this.transportCapacityPerWorker() * firm.operationalReadiness * shiftCapacity);
    if (firm.processingPerWorker) return Math.floor(firm.processingPerWorker * firm.operationalReadiness * shiftCapacity);
    return Math.floor(firm.transactionsPerWorker * firm.operationalReadiness * shiftCapacity);
  }

  archiveStaffingDemand(firm) {
    if (firm.staffingDemandArchivedDay === this.day) return firm.staffingDemandHistory.at(-1) ?? null;
    const totalUnits = firm.staffingDemandToday.consumerUnits
      + firm.staffingDemandToday.contractUnits
      + firm.staffingDemandToday.productionUnits;
    const incrementalCapacity = this.staffingIncrementalCapacity(firm);
    const expectedUnits = Math.min(totalUnits * INVESTMENT_DEMAND_CAPTURE_RATE, incrementalCapacity);
    const unitContribution = Math.max(0, roundMoney(firm.price - this.staffingInputUnitCost(firm)));
    firm.staffingDemandSequence += 1;
    const record = Object.freeze({
      day: this.day,
      ...temporalMetadata(this.day, "Settlement"),
      sequence: firm.staffingDemandSequence,
      ...structuredClone(firm.staffingDemandToday),
      totalUnits,
      incrementalCapacity,
      expectedUnits,
      unitContribution,
      expectedContribution: roundMoney(expectedUnits * unitContribution),
    });
    firm.staffingDemandHistory.push(record);
    firm.staffingDemandArchivedDay = this.day;
    firm.staffingDemandToday = { consumerUnits: 0, contractUnits: 0, productionUnits: 0, evidence: [] };
    return record;
  }

  activeInvestmentSlot(firm) {
    return firm.investmentSlots.find((slot) => ["recruiting", "evaluating"].includes(slot.status)) ?? null;
  }

  endInvestmentSlot(firm, slot, status, outcome, kind = "bad") {
    slot.status = status;
    slot.endedDay = this.day;
    slot.outcome = outcome;
    firm.latestStaffingReason = `${status} investment slot ${slot.id}: ${outcome}`;
    this.note(firm, `${status === "withdrawn" ? "withdrew" : "ended"} investment slot ${slot.id}: ${outcome}`, kind);
    return slot;
  }

  maintainInvestmentSlot(firm, incomeSupportedStaff) {
    const slot = this.activeInvestmentSlot(firm);
    if (!slot) return null;
    if (firm.status !== "operating") return this.endInvestmentSlot(firm, slot, "withdrawn", `firm entered ${firm.status}`);
    if (slot.status === "recruiting") {
      if (firm.cash + 1e-9 < slot.fundingRequired) {
        return this.endInvestmentSlot(firm, slot, "withdrawn", `funding fell below the ${slot.fundingRequired.toFixed(2)} retained commitment`);
      }
      const recruitmentExpired = this.schedulesEnabled
        ? firm.openDayCount > slot.recruitmentDeadlineOpenDay
        : this.day > slot.recruitmentDeadline;
      if (recruitmentExpired) return this.endInvestmentSlot(firm, slot, "withdrawn", "the recruitment deadline passed without a hire");
      return slot;
    }
    const evaluatedWorker = this.people[slot.hiredCitizenId];
    const evaluationComplete = this.schedulesEnabled
      ? evaluatedWorker && evaluatedWorker.scheduledShiftsElapsed - slot.evaluationStartScheduledShift >= INVESTMENT_EVALUATION_DAYS
      : this.day >= slot.evaluationDeadline;
    if (!evaluationComplete) return slot;
    const retained = incomeSupportedStaff >= firm.employees.length;
    return this.endInvestmentSlot(
      firm,
      slot,
      "completed",
      retained ? "realized income supported the evaluated worker" : "the planned evaluation ended and ordinary staffing rules resumed",
      retained ? "good" : "neutral",
    );
  }

  approveInvestmentHiring(firm, incomeSupportedStaff) {
    if (!this.employmentInterventionEnabled
      || firm.status !== "operating"
      || firm.employees.length >= firm.maxStaff
      || this.activeInvestmentSlot(firm)) return null;
    if (firm.employees.length !== incomeSupportedStaff) {
      firm.latestStaffingReason = firm.employees.length < incomeSupportedStaff
        ? "ordinary income-supported expansion takes precedence"
        : "current staffing already exceeds the income-supported target";
      return null;
    }
    const window = firm.staffingDemandHistory.slice(-INVESTMENT_DEMAND_WINDOW_DAYS);
    const qualifying = window.filter((record) => record.totalUnits > 0);
    if (qualifying.length < INVESTMENT_DEMAND_REQUIRED_DAYS) {
      firm.latestStaffingReason = `${qualifying.length} of ${INVESTMENT_DEMAND_REQUIRED_DAYS} required staffing-demand days qualified`;
      return null;
    }
    const expectedContribution = roundMoney(qualifying.reduce((sum, record) => sum + record.expectedContribution, 0) / qualifying.length);
    const wage = this.scheduledShiftWage(firm);
    const requiredContribution = roundMoney(this.averageOpenDayWage(firm) * STAFFING_REVENUE_BUFFER);
    if (expectedContribution + 1e-9 < requiredContribution) {
      firm.latestStaffingReason = `${expectedContribution.toFixed(2)} expected contribution did not cover ${requiredContribution.toFixed(2)} buffered wage`;
      return null;
    }
    const fundingRequired = roundMoney(wage * INVESTMENT_WAGE_RESERVE_DAYS + this.nextOperatingNeed(firm));
    if (firm.cash + 1e-9 < fundingRequired) {
      firm.latestStaffingReason = `${firm.cash.toFixed(2)} cash did not cover the ${fundingRequired.toFixed(2)} investment reserve`;
      return null;
    }
    let slot = firm.investmentSlots[0] ?? null;
    if (!slot) {
      firm.investmentSlotSequence += 1;
      slot = {
        id: `${firm.instanceId}:investment:${firm.investmentSlotSequence}`,
        approvalCount: 0,
        attempts: [],
      };
      firm.investmentSlots.push(slot);
    }
    Object.assign(slot, {
      status: "recruiting",
      approvedDay: this.day,
      recruitmentDeadline: this.day + INVESTMENT_RECRUITMENT_DAYS,
      approvedOpenDayCount: firm.openDayCount,
      recruitmentDeadlineOpenDay: firm.openDayCount + INVESTMENT_RECRUITMENT_DAYS,
      hiredCitizenId: null,
      hiredDay: null,
      evaluationDeadline: null,
      expectedContribution,
      requiredContribution,
      fundingRequired,
      demandDays: qualifying.map((record) => record.day),
      incomeSupportedTargetAtApproval: incomeSupportedStaff,
      endedDay: null,
      outcome: null,
    });
    slot.approvalCount += 1;
    slot.attempts.push(Object.freeze({
      approval: slot.approvalCount,
      approvedDay: this.day,
      ...temporalMetadata(this.day, "Settlement"),
      sequence: slot.approvalCount,
      recruitmentDeadline: slot.recruitmentDeadline,
      expectedContribution,
      requiredContribution,
      fundingRequired,
      demandDays: [...slot.demandDays],
    }));
    firm.latestStaffingReason = `approved investment slot ${slot.id} from ${qualifying.length} qualifying demand days`;
    this.note(firm, `${firm.latestStaffingReason}; ${expectedContribution.toFixed(2)} expected contribution and ${fundingRequired.toFixed(2)} retained funding passed`, "good");
    return slot;
  }

  buy(person, firm, units, purpose) {
    this.reconcileInventoryBatches(firm);
    if (!person.alive || !firm?.active || firm.inventory < units) return 0;
    if (!this.firmOpenOnDay(firm)) {
      this.requestTransaction(firm, person, purpose);
      return 0;
    }
    const cost = roundMoney(firm.price * units);
    if (person.cash + 1e-9 < cost) {
      firm.priceRejectionsToday += 1;
      return 0;
    }
    if (!this.requestTransaction(firm, person, purpose)) return 0;
    const before = person.cash;
    const paid = this.transfer(person, firm, cost, { exact: true });
    if (paid !== cost) return 0;
    const inventoryTaken = this.takeFirmInventory(firm, units);
    if (!inventoryTaken.length) throw new Error(`Inventory changed during exact ${purpose} purchase`);
    firm.sales += paid;
    firm.unitsSold += units;
    if (this.isPerishable(firm.sells)) firm.perishableSalesToday += units;
    if (purpose === "food") {
      person.foodSeller = firm.id;
      inventoryTaken.forEach((batch) => {
        for (let unit = 0; unit < batch.quantity; unit += 1) person.foodStock.push({
          product: firm.sells,
          processedDay: batch.batchDay,
          purchasedDay: this.day,
          quality: batch.qualityBasis ?? firm.quality,
          qualityAtPurchase: this.effectiveFoodQuality({ quality: batch.qualityBasis ?? firm.quality, processedDay: batch.batchDay }),
          shelfLife: batch.shelfLife,
          seller: firm.id,
          ownerKind: person.kind,
          ownerId: person.id,
          ownerName: person.name,
        });
      });
    } else person.personalSeller = firm.id;
    const description = purpose === "food"
      ? `bought ${units} food portion${units === 1 ? "" : "s"} from ${firm.name}`
      : purpose === "medicine"
        ? `bought ${units} medicine dose${units === 1 ? "" : "s"} from ${firm.name}`
        : purpose === "education"
          ? `bought ${units} lesson${units === 1 ? "" : "s"} from ${firm.name}`
          : purpose === "clinical care"
            ? `bought ${units} clinical appointment${units === 1 ? "" : "s"} from ${firm.name}`
        : `${purpose} to ${firm.name}`;
    this.ledger(person, { direction: "out", amount: paid, text: description, before });
    return paid;
  }

  consumeFood(person, food) {
    const age = Math.max(0, this.day - (food.processedDay ?? food.purchasedDay));
    const quality = this.effectiveFoodQuality(food);
    person.lastFoodQuality = quality;
    person.lastFoodAge = age;
    person.foodSeller = food.seller;
    person.foodConsumedToday += 1;
    person.foodConsumedTotal += 1;
    person.hungryDays = Math.max(0, person.hungryDays - 1);
    person.health = clamp(person.health + quality * FOOD_HEALTH_RECOVERY);
    return quality;
  }

  effectiveFoodQuality(food) {
    const age = Math.max(0, this.day - (food.processedDay ?? food.purchasedDay));
    return clamp(food.quality - age * FOOD_QUALITY_DECAY_PER_DAY, MIN_FOOD_QUALITY, 1);
  }

  productionPhase() {
    if (!this.schedulesEnabled) this.firms.forEach((firm) => this.maintainFirm(firm));
    this.people.forEach((person) => {
      if (!person.alive) {
        person.attended = false;
        person.scarcityError = false;
        return;
      }
      person.scarcityError = this.random() < person.stress ** 2 * 0.24;
      if (person.employer < 0) return void (person.attended = false);
      const firm = this.firms[person.employer];
      if (!this.firmOpenOnDay(firm) || !this.scheduledForShift(person, firm)) return void (person.attended = false);
      person.scheduledShiftsElapsed += 1;
      if (this.schedulesEnabled) {
        const plan = person.dailyPlan?.day === this.day ? person.dailyPlan.workday : null;
        person.attended = plan?.action === `work-shift:${firm.id}`;
        if (!person.attended) {
          person.missedWork += 1;
          person.reliability = clamp(person.reliability - 0.018);
          this.note(person, `chose ${plan?.activity ?? "another activity"} instead of a scheduled shift and earned no wage`, "bad");
        } else person.missedWork = Math.max(0, person.missedWork - 1);
      } else this.considerAttendance(person, firm);
      if (person.attended) {
        person.scheduledShiftsWorked += 1;
        this.applyWorkplaceLearning(person, firm);
        if (this.schedulesEnabled && person.dailyPlan?.day === this.day) {
          person.dailyPlan.workday.status = "completed";
          person.currentPrimaryActivity = { day: this.day, block: "Workday", action: "shift", firmId: firm.id };
        }
      }
    });
    if (this.schedulesEnabled) this.firms.forEach((firm) => {
      if (!this.firmOpenOnDay(firm)) return;
      if (firm.employees.some((id) => this.people[id]?.alive && this.people[id].attended)) this.markFirmUse(firm);
      this.maintainFirm(firm);
    });
    this.firms.forEach((firm) => this.accrueKnowledgeCapacity(firm));
    this.firms.forEach((firm) => {
      if (!this.firmOpenOnDay(firm) || firm.production !== "direct") return;
      const produced = firm.employees.reduce((sum, id) => {
        const person = this.people[id];
        return sum + (person.attended ? (0.42 + person.skill * 0.75) * firm.productivity * person.health * (1 - person.stress * 0.32) * firm.operationalReadiness * this.scheduledShiftCapacityMultiplier() : 0);
      }, 0);
      this.addFirmInventory(firm, produced);
      if (this.isPerishable(firm.sells)) firm.perishableProcessedToday += produced;
    });
    if (this.schedulesEnabled) this.people.forEach((person) => {
      if (!person.alive || person.attended || person.dailyPlan?.day !== this.day) return;
      const activity = person.dailyPlan.workday;
      let result = { completed: true };
      if (activity.activity === "clinic") result = this.executePlannedClinic(person, this.firms[activity.firmId]);
      else if (activity.activity === "school") result = this.executePlannedSchool(person, this.firms[activity.firmId]);
      else if (activity.activity === "self-study") this.applyFreePersonalActivity(person, "self-study", "Production");
      else if (activity.activity === "rest") this.applyFreePersonalActivity(person, "rest", "Production");
      activity.status = result.completed ? "completed" : "failed";
      activity.failureReason = result.failure ?? null;
      person.currentPrimaryActivity = { day: this.day, block: "Workday", action: activity.activity, firmId: activity.firmId ?? null };
      if (!result.completed) this.note(person, `planned ${activity.activity} failed because ${result.failure}`, "bad");
    });
  }

  requiresHaulage(contract) {
    return this.transportEnabled && contract.use !== "operations" && contract.use !== "construction-project";
  }

  haulageUnitLoad(contract) {
    const supplier = this.firms[contract.supplierId];
    const buyer = this.firms[contract.buyerId];
    const distance = Math.hypot(supplier.x - buyer.x, supplier.y - buyer.y);
    const productLoad = TRANSPORT_LOAD_BY_PRODUCT[contract.product] ?? 1;
    return Math.max(1, Math.ceil(productLoad * (1 + distance * 2)));
  }

  haulageCapacity(carrier = this.firms.find((firm) => firm.active && firm.archetypeId === "haulage")) {
    if (!carrier?.active || !this.firmOpenOnDay(carrier)) return 0;
    const attendingWorkers = carrier.employees.filter((id) => this.people[id]?.alive && this.people[id].attended).length;
    return Math.floor(attendingWorkers * this.transportCapacityPerWorker() * carrier.operationalReadiness * this.scheduledShiftCapacityMultiplier());
  }

  processConstructionInputs(firm) {
    if (!this.firmOpenOnDay(firm) || !firm.processingPerWorker) return 0;
    const attendingWorkers = firm.employees.filter((id) => this.people[id]?.alive && this.people[id].attended).length;
    const remainingCapacity = Math.max(0, firm.processingCapacityToday - firm.processedToday);
    const units = Math.min(Math.floor(firm.inputInventory), remainingCapacity);
    if (units > 0) {
      firm.inputInventory -= units;
      firm.inventory += units;
      firm.processedToday += units;
      this.note(firm, `${attendingWorkers} attending worker${attendingWorkers === 1 ? "" : "s"} processed ${units} ${PRODUCTS[firm.input].unit}${units === 1 ? "" : "s"} into ${units} ${PRODUCTS[firm.sells].unit}${units === 1 ? "" : "s"}`, "good");
    }
    firm.processingShortfallToday = Math.max(0, Math.floor(firm.inputInventory) - Math.max(0, firm.processingCapacityToday - firm.processedToday));
    return units;
  }

  procurementContracts() {
    const dependencies = new Map(this.contracts.map((contract) => [contract, new Set()]));
    this.contracts.forEach((upstream) => {
      if (upstream.use === "operations") return;
      const processor = this.firms[upstream.buyerId];
      if (!processor?.processingPerWorker) return;
      this.contracts.forEach((downstream) => {
        if (downstream.supplierId === processor.id) dependencies.get(downstream).add(upstream);
      });
    });
    const pending = new Set(this.contracts);
    const ordered = [];
    while (pending.size) {
      const ready = [...pending]
        .filter((contract) => [...dependencies.get(contract)].every((dependency) => !pending.has(dependency)))
        .sort((left, right) => left.id - right.id);
      if (!ready.length) throw new Error("Supply contracts must form an acyclic product pipeline");
      ready.forEach((contract) => {
        pending.delete(contract);
        ordered.push(contract);
      });
    }
    return ordered;
  }

  procurementPhase() {
    const carrier = this.transportEnabled ? this.firms.find((firm) => firm.active && firm.archetypeId === "haulage") : null;
    let remainingTransportCapacity = this.haulageCapacity(carrier);
    if (carrier) {
      carrier.transportCapacityToday = remainingTransportCapacity;
      carrier.transportLoadToday = 0;
    }
    this.firms.forEach((firm) => {
      if (!firm.processingPerWorker) return;
      const attendingWorkers = firm.employees.filter((id) => this.people[id]?.alive && this.people[id].attended).length;
      firm.processingCapacityToday = firm.active
        ? Math.floor(attendingWorkers * firm.processingPerWorker * firm.operationalReadiness * this.scheduledShiftCapacityMultiplier())
        : 0;
      firm.processedToday = 0;
      firm.processingShortfallToday = 0;
      this.processConstructionInputs(firm);
    });
    this.procurementContracts().forEach((contract) => {
      contract.deliveredToday = 0;
      contract.shortfallToday = 0;
      contract.requestedToday = 0;
      contract.transportLoadToday = 0;
      contract.transportFeeToday = 0;
      contract.transportConstrainedToday = false;
      contract.shortfallCauseToday = null;
      contract.limitingFirmId = null;
      contract.supplierUnitPriceToday = contract.unitPrice;
      const supplier = this.firms[contract.supplierId];
      const buyer = this.firms[contract.buyerId];
      if (!contract.active || !supplier.active || !buyer.active) return;
      const buyerStock = contract.use === "operations"
        ? buyer.operatingSupplies
        : contract.use === "construction-project" ? 0 : buyer.processingPerWorker ? buyer.inputInventory : buyer.inventory;
      const livingPopulation = this.people.filter((person) => person.alive).length;
      const populationScaledFood = this.isPopulationScaledFoodContract(contract, buyer);
      const fallbackGrocer = populationScaledFood && buyer.archetypeId !== "everyday-grocer";
      const buyerNextOpening = populationScaledFood && this.schedulesEnabled ? this.nextOpeningDay(buyer) : null;
      const foodCoverageDays = buyerNextOpening ? Math.max(1, buyerNextOpening - this.day) : 1;
      const foodDailyCapacity = fallbackGrocer ? livingPopulation * 2 : contract.dailyQuantity;
      const dailyLimit = populationScaledFood
        ? fallbackGrocer
          ? foodDailyCapacity * foodCoverageDays
          : Math.min(foodDailyCapacity * foodCoverageDays, livingPopulation * foodCoverageDays)
        : contract.dailyQuantity;
      const targetStock = populationScaledFood ? livingPopulation * 2 : contract.targetStock ?? contract.dailyQuantity * 2;
      const housingProject = contract.use === "construction-project" ? this.housingProjectDemand(buyer) : null;
      contract.requestedToday = contract.use === "construction-project"
        ? Number(Boolean(housingProject))
        : Math.min(dailyLimit, Math.max(0, Math.ceil(targetStock - buyerStock)));
      const hauled = this.requiresHaulage(contract);
      const closedFirm = !this.firmOpenOnDay(supplier)
        ? supplier
        : !this.firmOpenOnDay(buyer)
          ? buyer
          : hauled && carrier && !this.firmOpenOnDay(carrier) ? carrier : null;
      if (closedFirm) {
        contract.shortfallToday = contract.requestedToday;
        contract.shortfallCauseToday = `${closedFirm.name} closed`;
        contract.limitingFirmId = closedFirm.id;
        const nextOpening = this.nextContractOpening(contract);
        if (contract.requestedToday > 0) this.note(buyer, `${closedFirm.name} was closed, so ${contract.requestedToday} ${PRODUCTS[contract.product].unit}${contract.requestedToday === 1 ? "" : "s"} remained undelivered${nextOpening ? `; next shared opening D${nextOpening}` : ""}`, "bad");
        return;
      }
      const available = Math.floor(supplier.inventory);
      const transportUnitLoad = hauled ? this.haulageUnitLoad(contract) : 0;
      const transportUnitFee = hauled && carrier ? carrier.price : 0;
      const supplierUnitPrice = hauled && carrier ? roundMoney(Math.max(0.01, contract.unitPrice - carrier.basePrice)) : contract.unitPrice;
      contract.supplierUnitPriceToday = supplierUnitPrice;
      const affordable = hauled && !carrier
        ? 0
        : Math.floor((buyer.cash + 1e-9) / (supplierUnitPrice + transportUnitFee));
      const transportable = hauled ? Math.floor(remainingTransportCapacity / transportUnitLoad) : contract.requestedToday;
      const units = Math.min(contract.requestedToday, available, affordable, transportable);
      supplier.priceRejectionsToday += Math.max(0, Math.min(contract.requestedToday, available) - affordable);
      const cost = roundMoney(units * supplierUnitPrice);
      const transportFee = roundMoney(units * transportUnitFee);
      if (units > 0) {
        const buyerBefore = buyer.cash;
        const supplierBefore = supplier.cash;
        const carrierBefore = carrier?.cash ?? 0;
        const canSettleExactly = buyer.cash + 1e-9 >= cost + transportFee;
        const paid = canSettleExactly ? this.transfer(buyer, supplier, cost, { exact: true }) : 0;
        const freightPaid = paid === cost && transportFee > 0 ? this.transfer(buyer, carrier, transportFee, { exact: true }) : 0;
        if (paid === cost && freightPaid === transportFee) {
          this.markFirmUse(supplier);
          this.markFirmUse(buyer);
          if (hauled && carrier) this.markFirmUse(carrier);
          this.takeFirmInventory(supplier, units);
          if (contract.use === "operations") buyer.operatingSupplies += units;
          else if (contract.use === "construction-project") {
            if (housingProject === "expansion") buyer.dwellingCapacity += HOUSING_PROJECT_CAPACITY_GAIN * units;
            buyer.lastHousingProjectDay = this.day;
            buyer.completedHousingProjects += units;
            this.note(buyer, housingProject === "expansion"
              ? `${supplier.name} expanded dwelling capacity to ${buyer.dwellingCapacity}`
              : `${supplier.name} completed a housing repair project`, "good");
          }
          else if (buyer.processingPerWorker) {
            buyer.inputInventory += units;
            this.processConstructionInputs(buyer);
          }
          else {
            this.addFirmInventory(buyer, units, { batchDay: this.day });
            if (this.isPerishable(buyer.sells)) buyer.perishableProcessedToday += units;
          }
          supplier.sales += paid;
          supplier.unitsSold += units;
          buyer.inputCosts += paid + freightPaid;
          contract.deliveredToday = units;
          if (hauled) {
            const transportLoad = units * transportUnitLoad;
            remainingTransportCapacity -= transportLoad;
            carrier.transportLoadToday += transportLoad;
            carrier.sales += freightPaid;
            carrier.unitsSold += units;
            carrier.transactionsToday += 1;
            contract.transportLoadToday = transportLoad;
            contract.transportFeeToday = freightPaid;
          }
          if (this.schedulesEnabled) [supplier, buyer, ...(hauled && carrier ? [carrier] : [])].forEach((firm) => this.maintainFirm(firm));
          const unit = PRODUCTS[contract.product].unit;
          const quantity = `${units} ${unit}${units === 1 ? "" : "s"}`;
          this.ledger(buyer, { direction: "out", amount: paid, text: `${quantity} from ${supplier.name}`, before: buyerBefore });
          this.ledger(supplier, { direction: "in", amount: paid, text: `${quantity} to ${buyer.name}`, before: supplierBefore });
          if (freightPaid > 0) {
            this.ledger(buyer, { direction: "out", amount: freightPaid, text: `haulage by ${carrier.name} for ${quantity} from ${supplier.name}`, before: buyerBefore - paid });
            this.ledger(carrier, { direction: "in", amount: freightPaid, text: `delivery for ${buyer.name}: ${quantity} from ${supplier.name}`, before: carrierBefore });
          }
        }
      }
      contract.shortfallToday = contract.requestedToday - contract.deliveredToday;
      if (contract.shortfallToday > 0) {
        const transportCause = hauled && (!carrier || transportable < Math.min(contract.requestedToday, available, affordable));
        contract.transportConstrainedToday = transportCause;
        const buyerCouldAfford = affordable >= contract.requestedToday;
        if (hauled && !carrier) {
          contract.shortfallCauseToday = "carrier unavailable";
          contract.limitingFirmId = null;
        } else if (!buyerCouldAfford) {
          contract.shortfallCauseToday = "buyer funding";
          contract.limitingFirmId = buyer.id;
        } else if (transportCause) {
          contract.shortfallCauseToday = carrier
            ? carrier.operationalReadiness >= 1 ? "carrier labor" : "carrier maintenance"
            : "carrier unavailable";
          contract.limitingFirmId = carrier?.id ?? null;
          if (carrier && carrier.operationalReadiness >= 1) this.recordStaffingDemand(carrier, "contract", contract.shortfallToday, "staffed haulage capacity");
        } else if (available < contract.requestedToday) {
          const maintained = supplier.operationalReadiness >= 1;
          const directLabor = supplier.production === "direct" && maintained;
          const processingLabor = supplier.processingPerWorker && maintained && supplier.processingShortfallToday > 0;
          contract.shortfallCauseToday = directLabor
            ? "supplier production labor"
            : processingLabor ? "supplier processing labor" : maintained ? "supplier inventory" : "supplier maintenance";
          contract.limitingFirmId = supplier.id;
          if (directLabor || processingLabor) this.recordStaffingDemand(supplier, "production", contract.shortfallToday, contract.shortfallCauseToday);
        } else {
          contract.shortfallCauseToday = "unattributed contract constraint";
        }
        this.note(buyer, transportCause
          ? `${carrier?.name ?? "No carrier"} could transport only ${contract.deliveredToday} of ${contract.requestedToday} requested ${PRODUCTS[contract.product].unit}s from ${supplier.name}`
          : `${supplier.name} delivered ${contract.deliveredToday} of ${contract.requestedToday} requested ${PRODUCTS[contract.product].unit}s`, "bad");
      }
    });
    this.firms.forEach((firm) => {
      if (!firm.active || !firm.processingPerWorker || firm.processingShortfallToday <= 0) return;
      const attendingWorkers = firm.employees.filter((id) => this.people[id]?.alive && this.people[id].attended).length;
      const inputUnit = PRODUCTS[firm.input].unit;
      const cause = attendingWorkers === 0 ? "no attending workers" : "labor capacity";
      this.note(firm, `${cause} left ${firm.processingShortfallToday} ${inputUnit}${firm.processingShortfallToday === 1 ? "" : "s"} unprocessed`, "bad");
    });
  }

  payrollPhase() {
    const taxRate = this.policy.taxRate / 100;
    this.firms.forEach((firm) => {
      if (!this.firmOpenOnDay(firm)) return;
      const attendees = firm.employees.map((id) => this.people[id]).filter((person) => person.alive && person.attended);
      const wage = this.scheduledShiftWage(firm);
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
    const foodFirms = this.firms.filter((firm) => this.firmServiceAvailable(firm, "Evening") && firm.sector === "food").sort((a, b) => a.price - b.price);
    const activeFoodFirms = this.firms.filter((firm) => firm.active && firm.sector === "food");
    const nextFoodOpening = foodFirms.length ? null : activeFoodFirms
      .map((firm) => this.nextOpeningDay(firm))
      .filter(Boolean)
      .sort((a, b) => a - b)[0] ?? null;
    this.foodAccessOrder().forEach((person) => {
      person.socialToday = false;
      person.socialVenueToday = null;
      if (this.schedulesEnabled && !foodFirms.length && activeFoodFirms.length) {
        this.note(person, `all food sellers were closed${nextFoodOpening ? `; next opening D${nextFoodOpening}` : ""}`, "neutral");
      }
      this.considerFood(person, foodFirms);
    });
  }

  foodReserveTargetForDay(person, activeFoodFirms = this.firms.filter((firm) => firm.active && firm.sector === "food")) {
    const normalTarget = Math.max(1, Math.min(3, person.foodReserveTarget));
    if (!this.schedulesEnabled || !activeFoodFirms.length) return normalTarget;
    const nextOpening = activeFoodFirms
      .map((firm) => this.nextOpeningDay(firm))
      .filter(Boolean)
      .sort((a, b) => a - b)[0];
    if (!nextOpening) return normalTarget;
    const mealsUntilNextOpening = Math.max(1, nextOpening - this.day);
    return Math.min(3, Math.max(normalTarget, mealsUntilNextOpening));
  }

  foodAccessOrder() {
    const populationSize = this.people.length;
    const rotatingRank = (person) => (person.id - this.day + populationSize) % populationSize;
    return this.people.filter((person) => person.alive).sort((a, b) => (
      b.hungryDays - a.hungryDays
      || a.health - b.health
      || rotatingRank(a) - rotatingRank(b)
    ));
  }

  considerFood(person, foodFirms) {
    if (!person.alive) return false;
    const reserveTarget = this.foodReserveTargetForDay(person);
    const oldestStoredFoodIndex = person.foodStock.reduce((oldest, food, index, stock) => {
      if (oldest < 0) return index;
      const day = food.processedDay ?? food.purchasedDay;
      const oldestDay = stock[oldest].processedDay ?? stock[oldest].purchasedDay;
      return day < oldestDay ? index : oldest;
    }, -1);
    const storedOptions = person.foodStock.length
      ? [person.foodStock[oldestStoredFoodIndex]].map((food) => ({
        index: oldestStoredFoodIndex,
        action: `eat-stored-food:${oldestStoredFoodIndex}`,
        source: "stored",
        sellerId: food.seller,
        sellerName: this.firms[food.seller]?.name ?? "unknown seller",
        units: 1,
        unitPrice: 0,
        totalPrice: 0,
        effectiveQuality: this.effectiveFoodQuality(food),
        age: Math.max(0, this.day - (food.processedDay ?? food.purchasedDay)),
        remainingShelfLife: Math.max(0, (food.shelfLife ?? 3) - Math.max(0, this.day - (food.processedDay ?? food.purchasedDay))),
        capacityAvailable: true,
      }))
      : [];
    const purchaseOptions = foodFirms.flatMap((firm) => {
        const topUpUnits = !this.schedulesEnabled && person.foodStock.length
          ? 0
          : Math.max(0, reserveTarget - person.foodStock.length);
        const maxUnits = Math.min(topUpUnits, Math.floor(firm.inventory), Math.floor((person.cash + 1e-9) / firm.price));
        return Array.from({ length: maxUnits }, (_, index) => {
          const units = index + 1;
          const batches = this.peekFirmInventory(firm, units);
          const effectiveQuality = batches.reduce((total, batch) => total + this.effectiveFoodQuality({ quality: batch.qualityBasis ?? firm.quality, processedDay: batch.batchDay }) * batch.quantity, 0) / units;
          const remainingShelfLife = Math.min(...batches.map((batch) => batch.shelfLife - (this.day - batch.batchDay)));
          return {
            action: `buy-food:${firm.id}:${units}`,
            source: "seller",
            sellerId: firm.id,
            sellerName: firm.name,
            units,
            unitPrice: firm.price,
            totalPrice: roundMoney(firm.price * units),
            effectiveQuality,
            age: Math.max(...batches.map((batch) => this.day - batch.batchDay)),
            remainingShelfLife,
            capacityAvailable: firm.transactionsToday < this.transactionCapacity(firm),
          };
        });
      });
    const options = [...storedOptions, ...purchaseOptions];
    if (!person.foodStock.length && !options.length && foodFirms.length) {
      const stockedFirms = foodFirms.filter((firm) => firm.inventory >= 1);
      if (stockedFirms.length) stockedFirms[0].priceRejectionsToday += 1;
      else this.note(person, "no food stock was available to purchase", "bad");
    }
    const legalActions = Object.freeze(["skip-food", ...options.map((option) => option.action)]);
    const observation = Object.freeze({
      kind: "food",
      citizenId: person.id,
      citizenName: person.name,
      stress: person.stress,
      health: person.health,
      hungryDays: person.hungryDays,
      runwayDays: this.runwayDays(person),
      reserveTarget,
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
    const housing = this.firms.find((firm) => this.firmServiceAvailable(firm, "Evening") && firm.sector === "housing");
    if (!housing) {
      if (this.schedulesEnabled) {
        const provider = this.firms.find((firm) => firm.active && firm.sector === "housing");
        if (provider) {
          const nextOpening = this.nextOpeningDay(provider);
          this.people.filter((person) => person.alive && (!person.housed || this.rentDueToday())).forEach((person) => {
            this.note(person, `${provider.name} was closed for housing payments${nextOpening ? `; next opening D${nextOpening}` : ""}`, "neutral");
          });
        }
      }
      return;
    }
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
    const occupancy = this.housingOccupancy();
    const dwellingAvailable = !this.housingCapacityEnabled || wasHoused || occupancy < housing.dwellingCapacity;
    if (!canPay) housing.priceRejectionsToday += 1;
    const option = canPay && dwellingAvailable ? {
      action: `${wasHoused ? "pay-housing" : "secure-housing"}:${housing.id}`,
      firmId: housing.id,
      firmName: housing.name,
      totalPrice: due,
      capacityAvailable: dwellingAvailable && housing.transactionsToday < this.transactionCapacity(housing),
    } : null;
    const inactiveAction = wasHoused ? "defer-housing" : "remain-unhoused";
    const legalActions = Object.freeze([inactiveAction, ...(option ? [option.action] : [])]);
    const observation = Object.freeze({
      kind: "housing",
      citizenId: person.id,
      citizenName: person.name,
      housed: wasHoused,
      rentArrears: person.rentArrears,
      dwellingCapacity: housing.dwellingCapacity,
      housingOccupancy: occupancy,
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
    const café = this.firms.find((firm) => this.firmServiceAvailable(firm, "Evening") && firm.sector === "service" && firm.inventory >= 1);
    const makers = this.firms.find((firm) => this.firmServiceAvailable(firm, "Evening") && firm.sector === "goods" && firm.inventory >= 1);
    const apothecary = this.firms.find((firm) => this.firmServiceAvailable(firm, "Evening") && firm.archetypeId === "apothecary" && firm.inventory >= 1);
    const school = this.firms.find((firm) => this.firmServiceAvailable(firm, "Evening") && firm.archetypeId === "school" && firm.inventory >= 1);
    const clinic = this.firms.find((firm) => this.firmServiceAvailable(firm, "Evening") && firm.archetypeId === "clinic" && firm.inventory >= 1);
    this.people.forEach((person) => {
      if (!person.alive) return;
      const receivedClinicalCare = this.schedulesEnabled ? false : this.considerClinicalCare(person, clinic);
      if (!receivedClinicalCare) this.considerHealthCare(person, apothecary);
      if (!this.schedulesEnabled) this.considerEducation(person, school);
      this.considerPersonalTime(person, café, makers);
    });
    ["café", "park"].forEach((venue) => this.pairSocialVisitors(
      this.people.filter((person) => person.alive && person.socialToday && person.socialVenueToday === venue),
      venue,
    ));
  }

  considerHealthCare(person, apothecary) {
    if (!person.alive || person.health >= HEALTH_TREATMENT_THRESHOLD) return false;
    const affordable = apothecary && person.cash + 1e-9 >= apothecary.price;
    if (apothecary && !affordable) apothecary.priceRejectionsToday += 1;
    const option = affordable ? {
      action: `buy-medicine:${apothecary.id}`,
      firmId: apothecary.id,
      firmName: apothecary.name,
      totalPrice: apothecary.price,
      expectedRecovery: HEALTH_TREATMENT_RECOVERY,
      capacityAvailable: apothecary.transactionsToday < this.transactionCapacity(apothecary),
    } : null;
    const legalActions = Object.freeze(["defer-treatment", ...(option ? [option.action] : [])]);
    const observation = Object.freeze({
      kind: "health",
      citizenId: person.id,
      citizenName: person.name,
      health: person.health,
      stress: person.stress,
      hungryDays: person.hungryDays,
      runwayDays: this.runwayDays(person),
      profile: { ...person.motivationProfile },
      options: option ? [{ ...option }] : [],
    });
    const decision = this.citizenPolicy.decide({ observation, legalActions, random: this.random });
    if (!decision || !legalActions.includes(decision.action)) {
      throw new Error(`Citizen policy ${this.citizenPolicy.id ?? "unknown"} chose an illegal health action`);
    }
    this.recordDecision(person, observation, legalActions, decision, "Personal time");
    if (!option || decision.action !== option.action) return false;
    const beforeHealth = person.health;
    if (!this.buy(person, apothecary, 1, "medicine")) return false;
    person.healthSeller = apothecary.id;
    person.lastTreatmentDay = this.day;
    person.health = clamp(person.health + HEALTH_TREATMENT_RECOVERY, 0.08, 0.92);
    this.note(person, `self-care medicine raised health from ${Math.round(beforeHealth * 100)}% to ${Math.round(person.health * 100)}%`, "good");
    return true;
  }

  considerClinicalCare(person, clinic) {
    if (!person.alive || person.health >= CLINIC_TREATMENT_THRESHOLD) return false;
    const reserve = this.essentialCost() * CLINIC_TREATMENT_RESERVE_DAYS;
    const affordable = clinic && person.cash + 1e-9 >= clinic.price + reserve;
    if (clinic && !affordable) clinic.priceRejectionsToday += 1;
    const option = affordable ? {
      action: `buy-clinical-care:${clinic.id}`,
      firmId: clinic.id,
      firmName: clinic.name,
      totalPrice: clinic.price,
      expectedRecovery: CLINIC_TREATMENT_RECOVERY,
      capacityAvailable: clinic.transactionsToday < this.transactionCapacity(clinic),
    } : null;
    const legalActions = Object.freeze(["defer-clinical-care", ...(option ? [option.action] : [])]);
    const observation = Object.freeze({
      kind: "clinical-care",
      citizenId: person.id,
      citizenName: person.name,
      health: person.health,
      stress: person.stress,
      hungryDays: person.hungryDays,
      runwayDays: this.runwayDays(person),
      profile: { ...person.motivationProfile },
      options: option ? [{ ...option }] : [],
    });
    const decision = this.citizenPolicy.decide({ observation, legalActions, random: this.random });
    if (!decision || !legalActions.includes(decision.action)) {
      throw new Error(`Citizen policy ${this.citizenPolicy.id ?? "unknown"} chose an illegal clinical-care action`);
    }
    this.recordDecision(person, observation, legalActions, decision, "Personal time");
    if (!option || decision.action !== option.action) return false;
    const beforeHealth = person.health;
    if (!this.buy(person, clinic, 1, "clinical care")) return false;
    person.clinicalSeller = clinic.id;
    person.lastClinicalDay = this.day;
    person.health = clamp(person.health + CLINIC_TREATMENT_RECOVERY, 0.08, 0.96);
    this.note(person, `clinical treatment raised health from ${Math.round(beforeHealth * 100)}% to ${Math.round(person.health * 100)}%`, "good");
    return true;
  }

  considerEducation(person, school) {
    if (!person.alive || person.skill >= EDUCATION_SKILL_THRESHOLD) return false;
    this.assessNeeds(person);
    const reserve = this.essentialCost() * EDUCATION_RESERVE_DAYS;
    const affordable = school && person.cash + 1e-9 >= school.price + reserve;
    if (school && !affordable) school.priceRejectionsToday += 1;
    const option = affordable ? {
      action: `buy-education:${school.id}`,
      firmId: school.id,
      firmName: school.name,
      course: "retail-operations",
      knowledgeDomain: "retail",
      totalPrice: school.price,
      skillGain: EDUCATION_SKILL_GAIN,
      retailLearningRate: RETAIL_COURSE_LEARNING_RATE,
      inventoryTransferRate: RETAIL_COURSE_INVENTORY_TRANSFER_RATE,
      capacityAvailable: school.transactionsToday < this.transactionCapacity(school),
    } : null;
    const legalActions = Object.freeze(["defer-education", ...(option ? [option.action] : [])]);
    const observation = Object.freeze({
      kind: "education",
      citizenId: person.id,
      citizenName: person.name,
      skill: person.skill,
      stress: person.stress,
      runwayDays: this.runwayDays(person),
      safetyNeed: person.needs.safety,
      profile: { ...person.motivationProfile },
      options: option ? [{ ...option }] : [],
    });
    const decision = this.citizenPolicy.decide({ observation, legalActions, random: this.random });
    if (!decision || !legalActions.includes(decision.action)) {
      throw new Error(`Citizen policy ${this.citizenPolicy.id ?? "unknown"} chose an illegal education action`);
    }
    this.recordDecision(person, observation, legalActions, decision, "Personal time");
    if (!option || decision.action !== option.action || !this.buy(person, school, 1, "education")) return false;
    const beforeSkill = person.skill;
    person.educationSeller = school.id;
    person.lastEducationDay = this.day;
    person.skill = clamp(person.skill + EDUCATION_SKILL_GAIN, 0, 0.95);
    this.syncGeneralKnowledge(person, {
      source: "education",
      sourceId: school.id,
      sourceName: school.name,
      rule: "paid-retail-course-general-skill-v1",
    });
    this.applyKnowledgeLearning(person, {
      source: "education",
      sourceId: school.id,
      sourceName: school.name,
      domain: "retailOperations",
      rate: RETAIL_COURSE_LEARNING_RATE,
      rule: "paid-retail-course-retail-v1",
      phase: "Personal time",
    });
    this.applyKnowledgeLearning(person, {
      source: "education",
      sourceId: school.id,
      sourceName: school.name,
      domain: "inventoryHandling",
      rate: RETAIL_COURSE_INVENTORY_TRANSFER_RATE,
      rule: "paid-retail-course-inventory-transfer-v1",
      phase: "Personal time",
    });
    person.growth = clamp(person.growth + 0.015);
    this.note(person, `a retail operations course raised skill from ${Math.round(beforeSkill * 100)}% to ${Math.round(person.skill * 100)}% and added retail knowledge`, "good");
    return true;
  }

  pairSocialVisitors(visitors, venue) {
    const social = [...visitors].sort(() => this.random() - 0.5);
    for (let index = 0; index + 1 < social.length; index += 2) {
      const a = social[index];
      const b = social[index + 1];
      const existingFriendship = Boolean(a.relationships[b.id]);
      if (this.recordSocialContact(a, b) && !existingFriendship) {
        this.note(a, `a ${venue} encounter became friendship with ${b.name}`, "good");
        this.note(b, `a ${venue} encounter became friendship with ${a.name}`, "good");
      }
    }
  }

  freePersonalActivity(person) {
    const relationships = this.relationshipStats(person);
    const sociallyDisconnected = relationships.count === 0 || this.day - person.lastSocialDay > 3;
    if (["esteem", "growth"].includes(person.focus)) return "self-study";
    if (!person.hungryDays && sociallyDisconnected && person.motivationProfile.connection >= person.motivationProfile.security) return "park-social";
    return "rest";
  }

  applyFreePersonalActivity(person, activity, phase = "Personal time") {
    if (activity === "park-social") {
      person.socialToday = true;
      person.socialVenueToday = "park";
      return true;
    }
    if (activity === "self-study") {
      person.skill = clamp(person.skill + 0.003);
      this.syncGeneralKnowledge(person, {
        source: "self-study",
        sourceId: person.id,
        sourceName: person.name,
        rule: "free-self-study-general-v1",
        phase,
      });
      person.growth = clamp(person.growth + 0.006);
      return true;
    }
    person.stress = clamp(person.stress - 0.025);
    if (!person.hungryDays) person.health = clamp(person.health + 0.0015, 0.08, 1);
    return true;
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
    const freeActivity = this.freePersonalActivity(person);
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
      freeActivity,
      knowledgeProfile: { ...person.knowledgeProfile },
      profile: { ...person.motivationProfile },
    });
    const frozenLegalActions = Object.freeze([...legalActions]);
    const decision = this.citizenPolicy.decide({ observation, legalActions: frozenLegalActions, random: this.random });
    if (!decision || !frozenLegalActions.includes(decision.action)) {
      throw new Error(`Citizen policy ${this.citizenPolicy.id ?? "unknown"} chose an illegal personal-time action`);
    }
    this.recordDecision(person, observation, frozenLegalActions, decision, "Personal time");
    person.currentPrimaryActivity = {
      day: this.day,
      block: "Evening",
      action: decision.action === "do-nothing" ? freeActivity : decision.action,
    };

    if (decision.action === "do-nothing") return this.applyFreePersonalActivity(person, freeActivity);

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
      person.socialVenueToday = "café";
      return true;
    }
    if (decision.action === "buy-learning-tools" && this.buy(person, makers, 1, "learning tools")) {
      person.skill = clamp(person.skill + 0.02);
      this.syncGeneralKnowledge(person, {
        source: "learning-tools",
        sourceId: makers.id,
        sourceName: makers.name,
        rule: "paid-learning-tools-general-v1",
      });
      person.growth = clamp(person.growth + 0.04);
      return true;
    }
    return false;
  }

  sleepQuality(person) {
    return clamp(
      1
      - (person.housed ? 0 : 0.35)
      - (person.hungryDays > 0 ? 0.15 : 0)
      - 0.25 * person.stress,
      0.2,
      1,
    );
  }

  resolveSleep(person) {
    if (!this.sleepEnabled || !person.alive) return null;
    const debtBefore = person.sleepDebt;
    const debtAfterAccrual = clamp(debtBefore + 0.25);
    const quality = this.sleepQuality(person);
    const lateStudyLegal = person.hungryDays === 0
      && person.health >= 0.4
      && debtBefore < 0.6
      && ["esteem", "growth"].includes(person.focus);
    const legalActions = Object.freeze(["sleep", ...(lateStudyLegal ? ["late-self-study"] : [])]);
    const observation = Object.freeze({
      kind: "sleep",
      citizenId: person.id,
      citizenName: person.name,
      sleepDebt: debtBefore,
      sleepQuality: quality,
      housed: person.housed,
      hungry: person.hungryDays > 0,
      health: person.health,
      stress: person.stress,
      focus: person.focus,
      profile: { ...person.motivationProfile },
    });
    const decision = this.citizenPolicy.decide({ observation, legalActions, random: this.random });
    if (!decision || !legalActions.includes(decision.action)) throw new Error(`Citizen policy ${this.citizenPolicy.id ?? "unknown"} chose an illegal sleep action`);
    this.recordDecision(person, observation, legalActions, decision, "Settlement");
    person.sleepDebt = decision.action === "sleep"
      ? clamp(debtAfterAccrual - 0.3 * quality)
      : debtAfterAccrual;
    if (decision.action === "late-self-study") this.applyFreePersonalActivity(person, "self-study", "Settlement");
    person.lastSleepQuality = decision.action === "sleep" ? quality : null;
    person.sleepSequence += 1;
    const record = Object.freeze({
      day: this.day,
      ...temporalMetadata(this.day, "Settlement"),
      sequence: person.sleepSequence,
      action: decision.action,
      sleepQuality: decision.action === "sleep" ? quality : null,
      housed: person.housed,
      hungry: person.hungryDays > 0,
      stress: person.stress,
      debtBefore,
      debtAfterAccrual,
      debtAfter: person.sleepDebt,
      rule: "bounded-sleep-debt-v1",
    });
    person.sleepHistory.unshift(record);
    person.currentPrimaryActivity = { day: this.day, block: "Overnight", action: decision.action };
    if (decision.action === "late-self-study") this.note(person, "chose late self-study instead of sleep", "neutral");
    else if (person.sleepDebt > debtBefore + 1e-9) this.note(person, "poor sleep increased sleep debt", "bad");
    return record;
  }

  applySleepDebtConsequences(person) {
    if (!this.sleepEnabled || !person.alive || person.sleepDebt <= 0) return 0;
    const loss = person.sleepDebt * 0.006;
    const before = person.health;
    person.health = clamp(person.health - loss, 0.08, 1);
    return before - person.health;
  }

  settlementPhase() {
    this.resolveHousingReceivership();
    this.resolveEssentialSectorReentry();
    this.resolveHousingCapacity();
    const budget = this.government.cash * (this.policy.supportRate / 100) * 0.18;
    let spent = 0;
    const vulnerable = this.people.filter((person) => person.alive).sort((a, b) => (b.hungryDays + (!b.housed ? 3 : 0)) - (a.hungryDays + (!a.housed ? 3 : 0)) || a.cash - b.cash);
    vulnerable.forEach((person) => {
      const shortfall = this.supportShortfall(person);
      if (spent >= budget || this.government.cash <= 0 || shortfall <= 0) return;
      const before = person.cash;
      const paid = this.transfer(this.government, person, Math.min(5, shortfall, budget - spent));
      spent = roundMoney(spent + paid);
      if (paid) this.ledger(person, { direction: "in", amount: paid, text: "support from treasury", before });
    });

    if (this.schedulesEnabled && calendarForDay(this.day).weekdayIndex === 6) {
      this.firms.filter((firm) => firm.active).forEach((firm) => this.reviewOwnerPrice(firm));
    }
    const operatingFirms = this.firms.filter((firm) => this.firmOpenOnDay(firm));
    operatingFirms.forEach((firm) => this.prepareFirmSettlement(firm));
    if (!this.schedulesEnabled) this.runJobMarket();
    operatingFirms.forEach((firm) => this.finishFirmSettlement(firm));
    if (this.sleepEnabled) this.people.forEach((person) => {
      if (!person.alive) return;
      this.resolveSleep(person);
      this.applySleepDebtConsequences(person);
    });
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
    this.observeFirmOpportunities();
    this.day += 1;
  }

  resolveHousingCapacity() {
    const housing = this.firms.find((firm) => firm.sector === "housing");
    if (!this.housingCapacityEnabled || !housing?.active || housing.lastCapacityLossDay === this.day) return false;
    const overdueDays = this.day - housing.lastHousingProjectDay - HOUSING_REPAIR_INTERVAL_DAYS;
    if (overdueDays <= HOUSING_REPAIR_GRACE_DAYS) return false;
    housing.lastCapacityLossDay = this.day;
    housing.dwellingCapacity = Math.max(0, housing.dwellingCapacity - 1);
    this.note(housing, `deferred repairs reduced dwelling capacity to ${housing.dwellingCapacity}`, "bad");
    const overflow = Math.max(0, this.housingOccupancy() - housing.dwellingCapacity);
    this.people.filter((person) => person.alive && person.housed)
      .sort((a, b) => a.cash - b.cash || a.id - b.id)
      .slice(0, overflow)
      .forEach((person) => {
        person.housed = false;
        person.rentArrears = 0;
        this.note(person, "deferred building repairs removed their dwelling from service", "bad");
      });
    return true;
  }

  nextProcurementUnits(contract) {
    const buyer = this.firms[contract.buyerId];
    if (!contract.active || !buyer?.active || contract.use === "operations") return 0;
    if (contract.use === "construction-project") return this.housingProjectDemand(buyer) ? contract.dailyQuantity : 0;
    const livingPopulation = this.people.filter((person) => person.alive).length;
    const populationScaledFood = this.isPopulationScaledFoodContract(contract, buyer);
    const fallbackGrocer = populationScaledFood && buyer.archetypeId !== "everyday-grocer";
    const foodDailyCapacity = fallbackGrocer ? livingPopulation * 2 : contract.dailyQuantity;
    const dailyLimit = populationScaledFood
      ? fallbackGrocer ? foodDailyCapacity : Math.min(foodDailyCapacity, livingPopulation)
      : contract.dailyQuantity;
    const targetStock = populationScaledFood ? livingPopulation * 2 : contract.targetStock ?? contract.dailyQuantity * 2;
    const buyerStock = buyer.processingPerWorker ? buyer.inputInventory : buyer.inventory;
    return Math.min(dailyLimit, Math.max(0, Math.ceil(targetStock - buyerStock)));
  }

  isPopulationScaledFoodContract(contract, buyer = this.firms[contract.buyerId]) {
    if (contract.product !== "produce" || contract.use || !buyer?.active) return false;
    if (buyer.archetypeId === "everyday-grocer") return true;
    return this.schedulesEnabled
      && buyer.archetypeId === "premium-grocer"
      && !this.firms.some((firm) => firm.active && firm.archetypeId === "everyday-grocer");
  }

  nextOperatingNeed(firm) {
    const wage = this.averageOpenDayWage(firm);
    const payroll = wage * Math.max(1, firm.employees.length);
    const inputs = this.contracts
      .filter((contract) => contract.active && contract.buyerId === firm.id)
      .reduce((total, contract) => {
        const carrier = this.transportEnabled && this.requiresHaulage(contract)
          ? this.firms.find((candidate) => candidate.active && candidate.archetypeId === "haulage")
          : null;
        const units = contract.use === "operations"
          ? contract.dailyQuantity / MAINTENANCE_INTERVAL_DAYS
          : this.nextProcurementUnits(contract);
        const dailyInput = units * contract.unitPrice;
        const freightDelta = carrier ? units * (carrier.price - carrier.basePrice) : 0;
        return total + dailyInput + freightDelta;
      }, 0);
    return roundMoney(payroll + inputs);
  }

  closeFirm(firm, reason = "sustained insolvency ended operations") {
    if (!firm.active) return false;
    [...firm.employees].forEach((id) => this.fire(firm, this.people[id], "business insolvency ended employment"));
    const investmentSlot = this.activeInvestmentSlot(firm);
    if (investmentSlot) this.endInvestmentSlot(firm, investmentSlot, "withdrawn", "firm closure ended the funded headcount commitment");
    firm.active = false;
    firm.closedDay = this.day;
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
    if (PRIVATE_FORMATION_ARCHETYPE_IDS.includes(firm.archetypeId)) this.opportunityWindows[firm.archetypeId] = [];
    this.note(firm, entersReceivership ? `${reason}; housing operations entered receivership` : reason, "bad");
    return true;
  }

  resolveHousingReceivership() {
    const housing = this.firms.find((firm) => firm.sector === "housing" && firm.status === "receivership");
    if (!housing) return false;
    const elapsed = this.day - housing.receivershipDay;
    const restartDelay = housing.receivershipCount === 0 ? HOUSING_RECEIVERSHIP_GRACE_DAYS : ESSENTIAL_REENTRY_COOLDOWN_DAYS;
    if (elapsed < restartDelay) return false;

    if (this.government.cash + 1e-9 >= HOUSING_RESTART_COST) {
      const workers = this.replacementWorkers(HOUSING_REPLACEMENT_STAFF);
      const treasuryBefore = this.government.cash;
      const housingBefore = housing.cash;
      const paid = workers.length === HOUSING_REPLACEMENT_STAFF
        ? this.transfer(this.government, housing, HOUSING_RESTART_COST, { exact: true })
        : 0;
      if (paid === HOUSING_RESTART_COST) {
        housing.active = true;
        housing.status = "operating";
        housing.receivershipDay = null;
        housing.receivershipCount += 1;
        housing.closedDay = null;
        housing.distressDays = 0;
        housing.trouble = 0;
        housing.targetStaff = HOUSING_REPLACEMENT_STAFF;
        housing.publiclyOperated = true;
        this.contracts.filter((contract) => contract.supplierId === housing.id || contract.buyerId === housing.id).forEach((contract) => {
          const counterpartyId = contract.supplierId === housing.id ? contract.buyerId : contract.supplierId;
          contract.active = this.firms[counterpartyId].active;
        });
        workers.forEach((person) => this.hire(housing, person));
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

  replacementWorkers(count) {
    return this.people
      .filter((person) => person.alive && person.employer < 0)
      .sort((a, b) => b.skill + b.reliability * 0.25 - (a.skill + a.reliability * 0.25) || a.id - b.id)
      .slice(0, count);
  }

  restartEssentialFirm(firm) {
    const workers = this.replacementWorkers(ESSENTIAL_REENTRY_STAFF);
    if (firm.active || workers.length < ESSENTIAL_REENTRY_STAFF || this.government.cash + 1e-9 < ESSENTIAL_REENTRY_COST) return false;
    const treasuryBefore = this.government.cash;
    const firmBefore = firm.cash;
    const paid = this.transfer(this.government, firm, ESSENTIAL_REENTRY_COST, { exact: true });
    if (paid !== ESSENTIAL_REENTRY_COST) return false;
    firm.active = true;
    firm.status = "operating";
    firm.closedDay = null;
    firm.reentryCount += 1;
    firm.publiclyOperated = true;
    firm.distressDays = 0;
    firm.trouble = 0;
    firm.targetStaff = ESSENTIAL_REENTRY_STAFF;
    this.contracts.filter((contract) => contract.supplierId === firm.id || contract.buyerId === firm.id).forEach((contract) => {
      const counterpartyId = contract.supplierId === firm.id ? contract.buyerId : contract.supplierId;
      contract.active = this.firms[counterpartyId].active;
    });
    workers.forEach((person) => this.hire(firm, person));
    this.ledger(this.government, { direction: "out", amount: paid, text: `essential-sector re-entry to ${firm.name}`, before: treasuryBefore });
    this.ledger(firm, { direction: "in", amount: paid, text: "essential-sector re-entry from treasury", before: firmBefore });
    this.note(firm, "treasury funded and staffed a public essential-sector operator", "good");
    return true;
  }

  resolveEssentialSectorReentry() {
    let restarted = false;
    ["agriculture", "food"].forEach((sector) => {
      if (this.firms.some((firm) => firm.active && firm.sector === sector)) return;
      if (sector === "food" && !this.firms.some((firm) => firm.active && firm.sector === "agriculture")) return;
      const firm = this.firms.find((candidate) => candidate.vital && candidate.sector === sector && candidate.status === "insolvent");
      const emergencyFoodContinuity = sector === "food" && this.people.some((person) => person.alive && person.hungryDays > 0);
      const cooldownDays = emergencyFoodContinuity ? ESSENTIAL_FOOD_EMERGENCY_REENTRY_DAYS : ESSENTIAL_REENTRY_COOLDOWN_DAYS;
      if (!firm || firm.closedDay === null || this.day - firm.closedDay < cooldownDays) return;
      restarted = this.restartEssentialFirm(firm) || restarted;
    });
    return restarted;
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
    const reviewDue = this.schedulesEnabled ? calendarForDay(this.day).weekdayIndex === 6 : this.day % PRICE_REVIEW_DAYS === 0;
    if (!reviewDue || firm.ownerDecision.priceDay === this.day) return false;
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
        : this.activeInvestmentSlot(firm)
          ? "active investment hiring commitment requires cash retention"
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
    if (!this.firmOpenOnDay(firm)) return;
    this.archiveStaffingDemand(firm);
    firm.pricingWindow.unitsSold += firm.unitsSold;
    firm.pricingWindow.revenue += firm.sales;
    firm.pricingWindow.inputCosts += firm.inputCosts;
    firm.pricingWindow.priceRejections += firm.priceRejectionsToday;
    firm.pricingWindow.turnedAway += firm.turnedAwayTransactions;
    this.reviewOwnerPrice(firm);
    const wage = this.averageOpenDayWage(firm);
    const netSales = Math.max(0, firm.sales - firm.inputCosts);
    const revenueSample = firm.sector === "housing" ? (firm.sales > 0 ? netSales / RENT_INTERVAL_DAYS : null) : netSales;
    if (revenueSample !== null) firm.revenueEMA = firm.revenueEMA * 0.72 + revenueSample * 0.28;
    const minimumStaff = this.minimumCoverageStaff(firm);
    const incomeSupportedStaff = clamp(Math.floor(firm.revenueEMA / (wage * STAFFING_REVENUE_BUFFER) + 1e-9), minimumStaff, firm.maxStaff);
    const fundedExpansion = incomeSupportedStaff > firm.employees.length && firm.cash >= wage * 6 && firm.employees.length < firm.maxStaff;
    firm.incomeSupportedTarget = incomeSupportedStaff;
    const incomeTarget = fundedExpansion ? Math.min(incomeSupportedStaff, firm.employees.length + 1) : Math.min(incomeSupportedStaff, firm.employees.length);
    const investmentSlot = this.maintainInvestmentSlot(firm, incomeSupportedStaff) ?? this.approveInvestmentHiring(firm, incomeSupportedStaff);
    firm.targetStaff = investmentSlot?.status === "recruiting"
      ? Math.max(incomeTarget, firm.employees.length + 1)
      : investmentSlot?.status === "evaluating"
        ? Math.max(incomeTarget, firm.employees.length)
        : incomeTarget;
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
    if (!this.firmOpenOnDay(firm)) return;
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
    firm.knowledgeCapacitySlotsToday = 0;
    firm.attemptedTransactions = 0;
    firm.turnedAwayTransactions = 0;
    firm.priceRejectionsToday = 0;
  }

  settleFirm(firm) {
    this.prepareFirmSettlement(firm);
    this.runJobMarket([firm]);
    this.finishFirmSettlement(firm);
  }

  planningPhase() {
    this.expirePerishableInventory();
    if (this.schedulesEnabled) Object.entries(this.pendingFormations).forEach(([archetypeId, pending]) => {
      const archetype = this.firmArchetype(archetypeId);
      if (!archetype || !this.archetypeOpenOnDay(archetype)) return;
      const firm = this.foundFirm(archetype, pending.evidence);
      if (firm) {
        const history = this.opportunityHistory.find((entry) => entry.sequence === pending.historySequence);
        if (history) history.foundedInstanceId = firm.instanceId;
      }
      delete this.pendingFormations[archetypeId];
    });
    if (this.schedulesEnabled) this.firms.forEach((firm) => {
      if (!this.firmOpenOnDay(firm) || firm.lastOpenDay === this.day) return;
      firm.openDayCount += 1;
      firm.lastOpenDay = this.day;
    });
    if (this.schedulesEnabled) {
      this.runJobMarket();
      this.people.forEach((person) => this.planWorkday(person));
    }
  }

  isExtinct() {
    return !this.people.some((person) => person.alive);
  }

  step() {
    if (this.isExtinct()) return this.snapshot();
    this.flows = [];
    [
      () => this.planningPhase(),
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
    if (this.firms.some((firm, id) => firm.id !== id)) throw new Error("Firm entity IDs must remain stable array references");
    if (new Set(this.firms.map((firm) => firm.instanceId)).size !== this.firms.length) throw new Error("Firm instance identities must remain unique");
    if (this.people.some((person) => !person.alive && person.employer >= 0)) throw new Error("A dead person cannot remain employed");
    if (this.schedulesEnabled && this.people.some((person) => person.employer >= 0 && (
      person.rota?.firmId !== person.employer
      || person.rota.weekdayIndices.length !== 5
      || person.rota.weekdayIndices.some((weekday) => !this.firms[person.employer].openWeekdays.includes(weekday))
    ))) throw new Error("An employed citizen must have a valid five-shift rota");
    if (this.people.some((person) => person.employer < 0 && person.rota !== null)) throw new Error("An unemployed citizen cannot retain an active rota");
    if (this.people.some((person) => !Number.isFinite(person.sleepDebt) || person.sleepDebt < 0 || person.sleepDebt > 1)) throw new Error("Sleep debt must remain bounded");
    this.firms.filter((firm) => this.isPerishable(firm.sells)).forEach((firm) => {
      const batchTotal = firm.inventoryBatches.reduce((total, batch) => total + batch.quantity, 0);
      if (Math.abs(batchTotal - firm.inventory) > 1e-6) throw new Error(`Perishable inventory batches do not reconcile for ${firm.name}`);
      if (firm.inventoryBatches.some((batch) => batch.quantity <= 0 || batch.product !== firm.sells)) throw new Error(`Invalid perishable inventory batch for ${firm.name}`);
    });
    if (this.people.some((person) => person.employer >= 0 && person.jobApplicationFirm >= 0)) throw new Error("An employed person cannot remain a job applicant");
    if (this.people.some((person) => person.employer >= 0 && (!this.firms[person.employer]?.active || !this.firms[person.employer].employees.includes(person.id)))) throw new Error("Employment references must be reciprocal and active");
    if (this.firms.some((firm) => firm.employees.some((personId) => this.people[personId]?.employer !== firm.id))) throw new Error("Firm employee references must be reciprocal");
    if (this.contracts.some((contract, id) => contract.id !== id || !this.firms[contract.supplierId] || !this.firms[contract.buyerId])) throw new Error("Supply contract references must remain valid");
    if (this.firms.some((firm) => !firm.active && !["insolvent", "receivership"].includes(firm.status))) throw new Error("An inactive firm must be insolvent or in receivership");
    if (this.firms.some((firm) => !Number.isFinite(firm.knowledgeCapacityCarry)
      || firm.knowledgeCapacityCarry < 0
      || firm.knowledgeCapacityCarry >= 1
      || !Number.isInteger(firm.knowledgeCapacitySlotsToday)
      || firm.knowledgeCapacitySlotsToday < 0)) throw new Error("Invalid knowledge capacity accumulator");
    if (this.firms.some((firm) => firm.processingPerWorker && (
      !Number.isInteger(firm.inputInventory)
      || firm.inputInventory < 0
      || !Number.isInteger(firm.processingCapacityToday)
      || firm.processingCapacityToday < 0
      || !Number.isInteger(firm.processedToday)
      || firm.processedToday < 0
      || !Number.isInteger(firm.processingShortfallToday)
      || firm.processingShortfallToday < 0
    ))) throw new Error("Invalid construction processing state");
    if (this.firms.some((firm) => firm.investmentSlots.length > 1
      || new Set(firm.investmentSlots.map((slot) => slot.id)).size !== firm.investmentSlots.length
      || firm.investmentSlots.some((slot) => !["recruiting", "evaluating", "withdrawn", "completed", "ended"].includes(slot.status)))) {
      throw new Error("Invalid investment headcount-slot state");
    }
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
    const townStage = inferTownStage({ day: this.day, people: this.people, firms: this.firms, policy: this.policy, essentialCost: this.essentialCost() });
    return {
      day: this.day,
      phase: this.phase,
      phaseName: PHASES[this.phase],
      block: PHASE_BLOCKS[PHASES[this.phase]],
      calendar: calendarForDay(this.day),
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
      dwellingCapacity: this.firms.find((firm) => firm.sector === "housing")?.dwellingCapacity ?? 0,
      housingOccupancy: this.housingOccupancy(),
      transport: (() => {
        const carrier = this.firms.find((firm) => firm.archetypeId === "haulage");
        return {
          enabled: this.transportEnabled,
          status: carrier?.status ?? "absent",
          capacity: carrier?.transportCapacityToday ?? 0,
          load: carrier?.transportLoadToday ?? 0,
        };
      })(),
      schedulesEnabled: this.schedulesEnabled,
      citizenPolicy: this.policyMetadata(),
      controlHistory: this.controlHistory.map((entry) => ({ ...entry })),
      townStage,
    };
  }
}
