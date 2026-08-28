import {
  BIRTH_NAMES,
  BIRTH_SPACING_DAYS,
  CLINIC_TREATMENT_RECOVERY,
  CLINIC_TREATMENT_RESERVE_DAYS,
  CLINIC_TREATMENT_THRESHOLD,
  CONCEPTION_CHANCE,
  CLOSE_FRIENDSHIP_THRESHOLD,
  COOPERATION_MODES,
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
  GESTATION_DAYS,
  FOOD_HEALTH_RECOVERY,
  FOOD_PANTRY_CAPACITY,
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
  KNOWLEDGE_VOCATIONAL_DOMAINS,
  LEGACY_OPPORTUNITY_OBSERVATION_DAYS,
  LEGACY_OPPORTUNITY_PROTECTED_RUNWAY_DAYS,
  LIFECYCLE_STAGES,
  LIFECYCLE_STAGE_START_DAYS,
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
  PARTNERSHIP_COOLDOWN_DAYS,
  PARTNERSHIP_END_FRIENDSHIP_THRESHOLD,
  PARTNERSHIP_FRIENDSHIP_THRESHOLD,
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
  WELFARE_MODES,
  WELFARE_PROGRAMMES,
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

export const lifecycleStageForAge = (ageDays) => {
  if (!Number.isInteger(ageDays) || ageDays < 0) throw new Error("Citizen age must be a non-negative whole number of days");
  if (ageDays >= LIFECYCLE_STAGE_START_DAYS.adult) return "adult";
  if (ageDays >= LIFECYCLE_STAGE_START_DAYS.student) return "student";
  if (ageDays >= LIFECYCLE_STAGE_START_DAYS.child) return "child";
  return "infant";
};

export class TownSimulation {
  constructor({ seed = 20260823, policy = {}, citizenPolicy = createDefaultCitizenPolicy(), latentFirmNames = [], formationArchetypeIds = PRIVATE_FORMATION_ARCHETYPE_IDS, housingCapacityEnabled = false, transportEnabled = false, knowledgeEnabled = true, employmentInterventionEnabled = true, schedulesEnabled = false, sleepEnabled = false, cooperationMode = "legacy", welfareMode = "legacy-cash", lifecycleEnabled = false, birthsEnabled = false } = {}) {
    validateFirmKnowledgeConfigs(FIRMS);
    if (!COOPERATION_MODES.includes(cooperationMode)) throw new Error(`Unknown cooperation mode: ${cooperationMode}`);
    if (!WELFARE_MODES.includes(welfareMode)) throw new Error(`Unknown welfare mode: ${welfareMode}`);
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
    this.cooperationMode = cooperationMode;
    this.welfareMode = welfareMode;
    this.lifecycleEnabled = lifecycleEnabled;
    this.birthsEnabled = birthsEnabled;
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
      knowledgeEffectGrossToday: 0,
      knowledgeEffectUsedToday: 0,
      knowledgeEffectScalarToday: 0,
      knowledgeEffectSequence: 0,
      knowledgeEffectHistory: [],
      processingScalarCapacityToday: 0,
      transportScalarCapacityToday: 0,
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
      welfareSequence: 0,
      welfareHistory: [],
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
    this.foodItemSequence = 0;
    this.foodItems = {};
    this.mutualAidOfferSequence = 0;
    this.mutualAidTransferSequence = 0;
    this.welfareTransactionSequence = 0;
    this.gestationSequence = 0;
    this.gestations = [];
    this.birthAttemptCounts = {};
    this.birthAttemptHistory = [];
    this.lastBirthDays = {};
    this.welfareState = {
      day: null,
      envelopeSnapshotCash: 0,
      envelope: 0,
      spent: 0,
      directAidByCitizen: {},
    };
    this.cooperationMetrics = {
      parkAttendance: 0,
      cafeAttendance: 0,
      contacts: 0,
      newFriendships: 0,
      closeFriendshipsReached: 0,
    };
    this.opportunityHistory = [];
    this.pendingFormations = {};
    this.opportunityWindows = Object.fromEntries(FIRMS.map((archetype) => [archetype.archetypeId, []]));
    this.firmInstanceCounts = Object.fromEntries(FIRMS.map((archetype) => [archetype.archetypeId, 0]));
    this.government = { kind: "government", id: 0, name: "Town treasury", cash: 120, x: 0.88, y: 0.55, activitySequence: 0, ledger: [], events: [], welfareSequence: 0, welfareHistory: [] };
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
        lifecycleStage: "adult",
        birthDay: null,
        ageDays: null,
        isDependent: false,
        parentIds: [],
        guardianIds: [],
        formerGuardianIds: [],
        residentialGuardianId: null,
        treasuryGuardian: false,
        transitionHostId: null,
        transitionResidenceEndDay: null,
        restrictedInheritance: 0,
        studyDomain: null,
        studyDomainSelectionDay: null,
        schoolHistory: [],
        schoolSequence: 0,
        lifecycleSequence: 0,
        lifecycleHistory: [],
        partnerId: null,
        partnershipStartDay: null,
        lastPartnershipEndDay: null,
        alive: true,
        deathDay: null,
        estateTransferred: 0,
        estateDutyPaid: 0,
        inheritanceDistributed: 0,
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
        dependentHealthPlan: null,
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
        mutualAidHistory: [],
        welfareSequence: 0,
        welfareHistory: [],
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
    this.nextCitizenId = this.people.length;

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
      this.people.reduce((sum, person) => sum + person.cash + (person.restrictedInheritance ?? 0), 0)
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
    return this.people.filter((person) => person.alive && !person.isDependent && (
      (person.focus === "belonging" && person.cash > archetype.price + 7)
      || (person.scarcityError && person.stress > 0.65 && person.cash + 1e-9 >= archetype.price)
    )).length;
  }

  premiumFoodDemandCount(archetype) {
    const reserve = this.essentialCost() * this.formationProtectedRunwayDays();
    return this.people.reduce((total, person) => {
      if (!person.alive || person.isDependent || person.foodStock.length || person.cash + 1e-9 < archetype.price + reserve) return total;
      const affordableUnits = Math.floor((person.cash - reserve + 1e-9) / archetype.price);
      return total + Math.max(0, Math.min(person.foodReserveTarget, affordableUnits));
    }, 0);
  }

  apothecaryDemandCount(archetype) {
    const reserve = this.essentialCost() * HEALTH_TREATMENT_RESERVE_DAYS;
    return this.people.filter((person) => person.alive && !person.isDependent
      && person.health < HEALTH_TREATMENT_THRESHOLD
      && person.cash + 1e-9 >= archetype.price + reserve).length;
  }

  educationDemandCount(archetype) {
    const reserve = this.essentialCost() * EDUCATION_RESERVE_DAYS;
    return this.people.filter((person) => person.alive && !person.isDependent
      && person.skill < EDUCATION_SKILL_THRESHOLD
      && person.cash + 1e-9 >= archetype.price + reserve).length;
  }

  constructionMaterialDemandCount() {
    return this.firms.some((firm) => firm.active && firm.archetypeId === "housing-provider") ? 1 : 0;
  }

  clinicDemandCount(archetype) {
    const reserve = this.essentialCost() * CLINIC_TREATMENT_RESERVE_DAYS;
    return this.people.filter((person) => person.alive && !person.isDependent
      && person.health < CLINIC_TREATMENT_THRESHOLD
      && person.cash + 1e-9 >= archetype.price + reserve).length;
  }

  housingOccupancy() {
    return this.people.filter((person) => person.alive && !person.isDependent && person.housed && !this.transitionResidenceActive(person)).length;
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
        && !person.isDependent
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
        food.spoiledDay = this.day;
        food.ownerKind = null;
        food.ownerId = null;
        food.ownerName = null;
        const product = food.product ?? this.firms[food.seller]?.sells ?? "budgetFood";
        this.recordWaste(person, { product, quantity: 1, batchDay, age, reason: "expired in citizen pantry" });
        this.note(person, `a stored meal from ${this.firms[food.seller]?.name ?? "an unknown seller"} expired`, "bad");
      });
      person.foodStock = viable;
    });
  }

  ledger(person, { direction, amount, text, before, transactionId = null, programme = null }) {
    person.activitySequence += 1;
    const entry = {
      day: this.day,
      ...temporalMetadata(this.day, this.phase),
      sequence: person.activitySequence,
      direction,
      amount: roundMoney(amount),
      text,
      before: roundMoney(before),
      after: roundMoney(person.cash),
    };
    if (transactionId !== null) entry.transactionId = transactionId;
    if (programme !== null) entry.programme = programme;
    person.ledger.unshift(entry);
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

  beginWelfareEnvelope() {
    if (this.welfareState.day === this.day) return this.welfareState;
    const envelope = this.welfareMode === "none"
      ? 0
      : roundMoney(this.government.cash * (this.policy.supportRate / 100) * 0.18);
    this.welfareState = {
      day: this.day,
      envelopeSnapshotCash: roundMoney(this.government.cash),
      envelope,
      spent: 0,
      directAidByCitizen: {},
    };
    return this.welfareState;
  }

  remainingWelfareEnvelope() {
    const state = this.beginWelfareEnvelope();
    return roundMoney(Math.max(0, state.envelope - state.spent));
  }

  recordWelfare(actor, evidence, phase = PHASES[this.phase]) {
    actor.welfareSequence += 1;
    const record = Object.freeze({
      day: this.day,
      ...temporalMetadata(this.day, phase),
      sequence: actor.welfareSequence,
      actorKind: actor.kind,
      actorId: actor.id,
      actorName: actor.name,
      ...structuredClone(evidence),
    });
    actor.welfareHistory.unshift(record);
    return record;
  }

  directWelfareEnabled() {
    return this.policy.supportRate > 0 && (this.welfareMode === "direct-only" || this.welfareMode === "combined");
  }

  directAssistanceProviderFailure(recipient, provider, purpose) {
    if (!provider) return "no eligible provider";
    if (!provider.active) return "provider inactive";
    if (!this.firmOpenOnDay(provider)) return "provider closed";
    const serviceWindow = ["clinical care", "dependent education"].includes(purpose) ? "Workday" : "Evening";
    if (!this.firmServiceAvailable(provider, serviceWindow)) return purpose === "rent" ? "unavailable housing transaction" : "no eligible provider";
    if (purpose === "food") {
      this.reconcileInventoryBatches(provider);
      if (provider.sector !== "food" || provider.sells !== "budgetFood") return "no eligible provider";
      if (provider.inventory + 1e-9 < 1) return "no stock";
    } else if (purpose === "rent") {
      if (provider.sector !== "housing" || !recipient.housed || !this.rentDueToday()) return "unavailable housing transaction";
    } else if (purpose === "medicine") {
      if (provider.archetypeId !== "apothecary" || provider.sells !== "medicine" || provider.inventory < 1) return "no eligible provider";
    } else if (purpose === "clinical care") {
      if (provider.archetypeId !== "clinic" || provider.sells !== "clinicalCare" || provider.inventory < 1) return "no eligible provider";
    } else if (purpose === "dependent education") {
      if (provider.archetypeId !== "school" || provider.sells !== "education" || provider.inventory < 1) return "no eligible provider";
    }
    const attendedStaff = provider.employees.filter((id) => this.people[id]?.alive && this.people[id].attended).length;
    if (attendedStaff === 0) return "no attended staff";
    if (provider.transactionsToday >= this.transactionCapacity(provider)) return "no transaction capacity";
    return null;
  }

  assessWelfareOffer({ programme: programmeKey, recipient, decisionMaker = recipient, privatePayer = recipient, provider, purpose, urgency }) {
    const programme = WELFARE_PROGRAMMES[programmeKey];
    if (!programme) throw new Error(`Unknown welfare programme: ${programmeKey}`);
    this.welfareTransactionSequence += 1;
    const welfareId = `welfare:${this.day}:${this.welfareTransactionSequence}`;
    const completePrice = roundMoney(provider?.price ?? 0);
    const restrictedCash = purpose === "food" ? Math.max(0, recipient.restrictedInheritance ?? 0) : 0;
    const privateCash = roundMoney(Math.min(privatePayer.cash + restrictedCash, completePrice));
    const shortfall = roundMoney(Math.max(0, completePrice - privateCash));
    const envelopeBefore = this.remainingWelfareEnvelope();
    const treasuryBefore = roundMoney(this.government.cash);
    const providerFailure = this.directAssistanceProviderFailure(recipient, provider, purpose);
    const eligible = recipient.alive && decisionMaker.alive && privatePayer.alive && shortfall > 0 && !providerFailure;
    const baseEvidence = {
      welfareId,
      programme: programme.id,
      programmeName: programme.name,
      ruleVersion: programme.ruleVersion,
      recipientId: recipient.id,
      recipientName: recipient.name,
      decisionMakerId: decisionMaker.id,
      decisionMakerName: decisionMaker.name,
      providerId: provider?.id ?? null,
      providerName: provider?.name ?? null,
      purpose,
      completePrice,
      assessedPrivateCash: privateCash,
      exactShortfall: shortfall,
      envelopeBefore,
      envelopeAfter: envelopeBefore,
      treasuryBefore,
      treasuryAfter: treasuryBefore,
      eligibilityResult: eligible ? "eligible" : "ineligible",
      eligibilityReason: eligible ? "otherwise legal essential purchase exceeds private cash" : providerFailure ?? "no exact shortfall",
      offered: eligible,
      decision: null,
      motivationScores: null,
      privateContribution: 0,
      treasuryContribution: 0,
      linkedTransactionIds: [],
      outcome: eligible ? "offered" : "ineligible",
      reason: eligible ? "immediate voluntary welfare offer" : providerFailure ?? "no exact shortfall",
    };
    if (!eligible) {
      this.recordWelfare(recipient, baseEvidence);
      this.recordWelfare(this.government, baseEvidence);
      return Object.freeze({ welfareId, eligible: false, accepted: false, evidence: Object.freeze(baseEvidence) });
    }

    const observation = Object.freeze({
      kind: "welfare",
      programme: programme.id,
      citizenId: decisionMaker.id,
      citizenName: decisionMaker.name,
      stress: decisionMaker.stress,
      urgency: clamp(urgency),
      profile: { ...decisionMaker.motivationProfile },
    });
    const legalActions = Object.freeze(["refuse-welfare", "accept-welfare"]);
    const decision = this.citizenPolicy.decide({ observation, legalActions, random: this.random });
    if (!decision || !legalActions.includes(decision.action)) throw new Error(`Citizen policy ${this.citizenPolicy.id ?? "unknown"} chose an illegal welfare action`);
    this.recordDecision(decisionMaker, observation, legalActions, decision, PHASES[this.phase]);
    const accepted = decision.action === "accept-welfare";
    const evidence = {
      ...baseEvidence,
      decision: decision.action,
      motivationScores: structuredClone(decision.scores ?? {}),
      outcome: accepted ? "accepted" : "refused",
      reason: accepted ? "citizen accepted immediate assistance" : "citizen refused immediate assistance",
    };
    this.recordWelfare(recipient, evidence);
    this.recordWelfare(this.government, evidence);
    return Object.freeze({ welfareId, eligible: true, accepted, evidence: Object.freeze(evidence) });
  }

  cashReliefOrder() {
    const populationSize = this.people.length;
    const rotation = Math.floor((this.day - 1) / 7);
    const rotatingRank = (person) => (person.id - rotation + populationSize) % populationSize;
    return this.people.filter((person) => person.alive && person.isDependent !== true).sort((a, b) => (
      b.hungryDays - a.hungryDays
      || Number(a.housed) - Number(b.housed)
      || this.runwayDays(a) - this.runwayDays(b)
      || rotatingRank(a) - rotatingRank(b)
    ));
  }

  recordCashReliefAssessment(recipient, evidence) {
    this.recordWelfare(recipient, evidence);
    this.recordWelfare(this.government, evidence);
    return evidence;
  }

  assessCashReliefOffer(recipient) {
    const programme = WELFARE_PROGRAMMES.cash;
    const cashShortfall = this.supportShortfall(recipient);
    const directAid = roundMoney(this.welfareState.directAidByCitizen[recipient.id] ?? 0);
    const maximumCashRelief = roundMoney(Math.max(0, 5 - directAid));
    if (!recipient.alive || recipient.isDependent === true || cashShortfall <= 0 || maximumCashRelief <= 0) return null;
    this.welfareTransactionSequence += 1;
    const welfareId = `welfare:${this.day}:${this.welfareTransactionSequence}`;
    const envelopeBefore = this.remainingWelfareEnvelope();
    const treasuryBefore = roundMoney(this.government.cash);
    const amount = roundMoney(Math.min(cashShortfall, maximumCashRelief, envelopeBefore, treasuryBefore));
    const baseEvidence = {
      welfareId,
      programme: programme.id,
      programmeName: programme.name,
      ruleVersion: programme.ruleVersion,
      recipientId: recipient.id,
      recipientName: recipient.name,
      decisionMakerId: recipient.id,
      decisionMakerName: recipient.name,
      providerId: null,
      providerName: null,
      purpose: "unrestricted emergency cash",
      completePrice: null,
      assessedPrivateCash: roundMoney(recipient.cash),
      exactShortfall: cashShortfall,
      directAidReceivedToday: directAid,
      maximumCashRelief,
      offeredAmount: amount,
      envelopeBefore,
      envelopeAfter: envelopeBefore,
      treasuryBefore,
      treasuryAfter: treasuryBefore,
      eligibilityResult: "eligible",
      eligibilityReason: "cash remained below the four-day essential-runway target",
      offered: amount > 0,
      decision: null,
      motivationScores: null,
      privateContribution: 0,
      treasuryContribution: 0,
      linkedTransactionIds: [],
      outcome: amount > 0 ? "offered" : "failed",
      reason: amount > 0 ? "immediate voluntary welfare offer" : envelopeBefore <= 0 ? "exhausted daily envelope" : "insufficient treasury cash",
    };
    if (!(amount > 0)) {
      this.recordCashReliefAssessment(recipient, baseEvidence);
      return Object.freeze({ welfareId, eligible: true, accepted: false, amount: 0, evidence: Object.freeze(baseEvidence) });
    }
    const fourDayTarget = this.essentialCost() * SUPPORT_RUNWAY_TARGET_DAYS;
    const urgency = 0.5 * clamp(cashShortfall / fourDayTarget)
      + 0.3 * clamp(recipient.hungryDays / 2)
      + 0.2 * Number(!recipient.housed);
    const observation = Object.freeze({
      kind: "welfare",
      programme: programme.id,
      citizenId: recipient.id,
      citizenName: recipient.name,
      stress: recipient.stress,
      urgency: clamp(urgency),
      profile: { ...recipient.motivationProfile },
    });
    const legalActions = Object.freeze(["refuse-welfare", "accept-welfare"]);
    const decision = this.citizenPolicy.decide({ observation, legalActions, random: this.random });
    if (!decision || !legalActions.includes(decision.action)) throw new Error(`Citizen policy ${this.citizenPolicy.id ?? "unknown"} chose an illegal welfare action`);
    this.recordDecision(recipient, observation, legalActions, decision, "Settlement");
    const accepted = decision.action === "accept-welfare";
    const evidence = {
      ...baseEvidence,
      decision: decision.action,
      motivationScores: structuredClone(decision.scores ?? {}),
      outcome: accepted ? "accepted" : "refused",
      reason: accepted ? "citizen accepted immediate assistance" : "citizen refused immediate assistance",
    };
    this.recordCashReliefAssessment(recipient, evidence);
    return Object.freeze({ welfareId, eligible: true, accepted, amount, evidence: Object.freeze(evidence) });
  }

  settleEmergencyCashRelief(recipient, amount, welfareId) {
    if (!recipient.alive || recipient.isDependent === true) return Object.freeze({ completed: false, reason: "recipient ineligible" });
    const programme = WELFARE_PROGRAMMES.cash;
    const envelopeBefore = this.remainingWelfareEnvelope();
    const treasuryBefore = roundMoney(this.government.cash);
    const cashShortfall = this.supportShortfall(recipient);
    const directAid = roundMoney(this.welfareState.directAidByCitizen[recipient.id] ?? 0);
    const maximumCashRelief = roundMoney(Math.max(0, 5 - directAid));
    const exactAmount = roundMoney(amount);
    if (!(exactAmount > 0) || exactAmount > cashShortfall + 1e-9 || exactAmount > maximumCashRelief + 1e-9) throw new Error("Emergency Cash Relief exceeded its assessed limit");
    const failure = exactAmount > envelopeBefore + 1e-9
      ? "exhausted daily envelope"
      : exactAmount > treasuryBefore + 1e-9
        ? "insufficient treasury cash"
        : null;
    if (failure) {
      const evidence = {
        welfareId,
        programme: programme.id,
        programmeName: programme.name,
        ruleVersion: programme.ruleVersion,
        recipientId: recipient.id,
        recipientName: recipient.name,
        decisionMakerId: recipient.id,
        decisionMakerName: recipient.name,
        providerId: null,
        providerName: null,
        purpose: "unrestricted emergency cash",
        completePrice: null,
        assessedPrivateCash: roundMoney(recipient.cash),
        exactShortfall: cashShortfall,
        envelopeBefore,
        envelopeAfter: envelopeBefore,
        treasuryBefore,
        treasuryAfter: treasuryBefore,
        privateContribution: 0,
        treasuryContribution: 0,
        linkedTransactionIds: [],
        outcome: "failed",
        reason: failure,
      };
      this.recordCashReliefAssessment(recipient, evidence);
      return Object.freeze({ completed: false, reason: failure, evidence: Object.freeze(evidence) });
    }
    const transactionId = `${welfareId}:treasury`;
    const recipientBefore = recipient.cash;
    const paid = this.transfer(this.government, recipient, exactAmount, { exact: true });
    if (paid !== exactAmount) throw new Error("Atomic Emergency Cash Relief transfer failed");
    this.ledger(this.government, { direction: "out", amount: paid, text: `Emergency Cash Relief to ${recipient.name}`, before: treasuryBefore, transactionId, programme: programme.id });
    this.ledger(recipient, { direction: "in", amount: paid, text: "Emergency Cash Relief from treasury", before: recipientBefore, transactionId, programme: programme.id });
    this.welfareState.spent = roundMoney(this.welfareState.spent + paid);
    const evidence = {
      welfareId,
      programme: programme.id,
      programmeName: programme.name,
      ruleVersion: programme.ruleVersion,
      recipientId: recipient.id,
      recipientName: recipient.name,
      decisionMakerId: recipient.id,
      decisionMakerName: recipient.name,
      providerId: null,
      providerName: null,
      purpose: "unrestricted emergency cash",
      completePrice: null,
      assessedPrivateCash: recipientBefore,
      exactShortfall: cashShortfall,
      directAidReceivedToday: directAid,
      maximumCashRelief,
      envelopeBefore,
      envelopeAfter: this.remainingWelfareEnvelope(),
      treasuryBefore,
      treasuryAfter: roundMoney(this.government.cash),
      privateContribution: 0,
      treasuryContribution: paid,
      linkedTransactionIds: [transactionId],
      outcome: "delivered",
      reason: "unrestricted emergency cash transferred",
    };
    this.recordCashReliefAssessment(recipient, evidence);
    return Object.freeze({ completed: true, reason: evidence.reason, evidence: Object.freeze(evidence) });
  }

  runEmergencyCashRelief() {
    if (this.welfareMode !== "combined" || this.policy.supportRate <= 0) return [];
    return this.cashReliefOrder().map((person) => {
      const offer = this.assessCashReliefOffer(person);
      if (!offer?.accepted) return offer;
      return this.settleEmergencyCashRelief(person, offer.amount, offer.welfareId);
    }).filter(Boolean);
  }

  runLegacyCashSupport() {
    if (this.welfareMode !== "legacy-cash") return 0;
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
    return spent;
  }

  directAssistanceFailure({ programme, recipient, decisionMaker, provider, purpose, completePrice, privateCash, shortfall, reason, welfareId, envelopeBefore, treasuryBefore }) {
    const evidence = {
      welfareId,
      programme: programme.id,
      programmeName: programme.name,
      ruleVersion: programme.ruleVersion,
      recipientId: recipient.id,
      recipientName: recipient.name,
      decisionMakerId: decisionMaker.id,
      decisionMakerName: decisionMaker.name,
      providerId: provider?.id ?? null,
      providerName: provider?.name ?? null,
      purpose,
      completePrice,
      assessedPrivateCash: privateCash,
      exactShortfall: shortfall,
      envelopeBefore,
      envelopeAfter: envelopeBefore,
      treasuryBefore,
      treasuryAfter: treasuryBefore,
      privateContribution: 0,
      treasuryContribution: 0,
      linkedTransactionIds: [],
      outcome: "failed",
      reason,
    };
    this.recordWelfare(recipient, evidence);
    if (provider) this.recordWelfare(provider, evidence);
    this.recordWelfare(this.government, evidence);
    return Object.freeze({ completed: false, reason, evidence: Object.freeze(evidence) });
  }

  settleDirectAssistance({ programme: programmeKey, recipient, decisionMaker = recipient, privatePayer = recipient, provider, purpose, completePrice = provider?.price, welfareId: offeredWelfareId = null, privateContributionCap = Infinity }) {
    const programme = WELFARE_PROGRAMMES[programmeKey];
    if (!programme) throw new Error(`Unknown welfare programme: ${programmeKey}`);
    if (!offeredWelfareId) this.welfareTransactionSequence += 1;
    const welfareId = offeredWelfareId ?? `welfare:${this.day}:${this.welfareTransactionSequence}`;
    const price = roundMoney(completePrice ?? 0);
    const restrictedCash = ["food", "medicine", "clinical care", "dependent education"].includes(purpose) ? Math.max(0, recipient?.restrictedInheritance ?? 0) : 0;
    const restrictedContribution = roundMoney(Math.min(restrictedCash, price));
    const payerContribution = roundMoney(Math.min(Math.max(0, privatePayer?.cash ?? 0), Math.max(0, privateContributionCap), price - restrictedContribution));
    const privateCash = roundMoney(restrictedContribution + payerContribution);
    const shortfall = roundMoney(Math.max(0, price - privateCash));
    const state = this.beginWelfareEnvelope();
    const envelopeBefore = this.remainingWelfareEnvelope();
    const treasuryBefore = roundMoney(this.government.cash);
    const fail = (reason) => this.directAssistanceFailure({
      programme,
      recipient,
      decisionMaker,
      provider,
      purpose,
      completePrice: price,
      privateCash,
      shortfall,
      reason,
      welfareId,
      envelopeBefore,
      treasuryBefore,
    });

    if (!recipient?.alive || (!decisionMaker?.alive && decisionMaker?.kind !== "government") || !privatePayer?.alive) return fail("recipient ineligible");
    const providerFailure = this.directAssistanceProviderFailure(recipient, provider, purpose);
    if (providerFailure) return fail(providerFailure);
    if (!(price > 0) || Math.abs(price - roundMoney(provider.price)) > 1e-9) {
      return fail(purpose === "rent" ? "unavailable housing transaction" : "no eligible provider");
    }
    if (!["food", "rent", "medicine", "clinical care", "dependent education"].includes(purpose)) throw new Error(`Unsupported direct-assistance purpose: ${purpose}`);
    if (!(shortfall > 0) && programmeKey !== "childEducation") return fail("no exact shortfall");
    if (shortfall > envelopeBefore + 1e-9) return fail("exhausted daily envelope");
    if (shortfall > this.government.cash + 1e-9) return fail("insufficient treasury cash");

    const inventoryPurpose = ["food", "medicine", "clinical care", "dependent education"].includes(purpose);
    const inventory = inventoryPurpose ? this.peekFirmInventory(provider, 1) : null;
    if (inventoryPurpose && !inventory.length) return fail("no stock");
    const transactionPurpose = purpose === "rent" ? "housing payment" : purpose;
    if (!this.requestTransaction(provider, recipient, transactionPurpose)) {
      throw new Error(`Validated ${programme.name} transaction could not reserve provider capacity`);
    }

    const linkedTransactionIds = [];
    if (restrictedContribution > 0) {
      const transactionId = `${welfareId}:restricted`;
      const recipientBefore = recipient.restrictedInheritance;
      const providerBefore = provider.cash;
      recipient.restrictedInheritance = roundMoney(recipient.restrictedInheritance - restrictedContribution);
      provider.cash = roundMoney(provider.cash + restrictedContribution);
      this.flows.push({ from: { kind: recipient.kind, id: recipient.id }, to: { kind: provider.kind, id: provider.id }, amount: restrictedContribution, phase: this.phase, ...temporalMetadata(this.day, this.phase) });
      this.flows = this.flows.slice(-40);
      this.ledger(recipient, { direction: "out", amount: restrictedContribution, text: `${programme.name} restricted care contribution to ${provider.name}`, before: recipientBefore, transactionId, programme: programme.id });
      recipient.ledger[0].after = recipient.restrictedInheritance;
      this.ledger(provider, { direction: "in", amount: restrictedContribution, text: `${programme.name} restricted care contribution for ${recipient.name}`, before: providerBefore, transactionId, programme: programme.id });
      linkedTransactionIds.push(transactionId);
    }
    if (payerContribution > 0) {
      const transactionId = `${welfareId}:private`;
      const recipientBefore = privatePayer.cash;
      const providerBefore = provider.cash;
      const paid = this.transfer(privatePayer, provider, payerContribution, { exact: true });
      if (paid !== payerContribution) throw new Error(`Atomic ${programme.name} private contribution failed`);
      this.ledger(privatePayer, { direction: "out", amount: paid, text: `${programme.name} co-pay to ${provider.name} for ${recipient.name}`, before: recipientBefore, transactionId, programme: programme.id });
      this.ledger(provider, { direction: "in", amount: paid, text: `${programme.name} co-pay from ${privatePayer.name} for ${recipient.name}`, before: providerBefore, transactionId, programme: programme.id });
      linkedTransactionIds.push(transactionId);
    }
    if (shortfall > 0) {
      const treasuryTransactionId = `${welfareId}:treasury`;
      const providerBeforeTreasury = provider.cash;
      const treasuryPaid = this.transfer(this.government, provider, shortfall, { exact: true });
      if (treasuryPaid !== shortfall) throw new Error(`Atomic ${programme.name} treasury contribution failed`);
      this.ledger(this.government, { direction: "out", amount: treasuryPaid, text: `${programme.name} to ${provider.name} for ${recipient.name}`, before: treasuryBefore, transactionId: treasuryTransactionId, programme: programme.id });
      this.ledger(provider, { direction: "in", amount: treasuryPaid, text: `${programme.name} from treasury for ${recipient.name}`, before: providerBeforeTreasury, transactionId: treasuryTransactionId, programme: programme.id });
      linkedTransactionIds.push(treasuryTransactionId);
    }

    if (purpose === "food") {
      const inventoryTaken = this.takeFirmInventory(provider, 1);
      if (!inventoryTaken.length) throw new Error(`Inventory changed during atomic ${programme.name} settlement`);
      recipient.foodSeller = provider.id;
      inventoryTaken.forEach((batch) => {
        const food = {
          mealId: ++this.foodItemSequence,
          product: provider.sells,
          processedDay: batch.batchDay,
          purchasedDay: this.day,
          quality: batch.qualityBasis ?? provider.quality,
          qualityAtPurchase: this.effectiveFoodQuality({ quality: batch.qualityBasis ?? provider.quality, processedDay: batch.batchDay }),
          shelfLife: batch.shelfLife,
          seller: provider.id,
          ownerKind: recipient.kind,
          ownerId: recipient.id,
          ownerName: recipient.name,
          custody: [],
          consumedDay: null,
          spoiledDay: null,
        };
        this.foodItems[food.mealId] = food;
        recipient.foodStock.push(food);
      });
      provider.perishableSalesToday += 1;
    } else if (purpose === "rent") {
      recipient.rentSeller = provider.id;
      recipient.rentArrears = 0;
    } else {
      const inventoryTaken = this.takeFirmInventory(provider, 1);
      if (!inventoryTaken.length) throw new Error(`Inventory changed during atomic ${programme.name} settlement`);
      if (purpose === "medicine") recipient.healthSeller = provider.id;
      else if (purpose === "clinical care") recipient.clinicalSeller = provider.id;
      else recipient.educationSeller = provider.id;
    }
    provider.sales = roundMoney(provider.sales + price);
    provider.unitsSold += 1;
    state.spent = roundMoney(state.spent + shortfall);
    state.directAidByCitizen[recipient.id] = roundMoney((state.directAidByCitizen[recipient.id] ?? 0) + shortfall);
    const evidence = {
      welfareId,
      programme: programme.id,
      programmeName: programme.name,
      ruleVersion: programme.ruleVersion,
      recipientId: recipient.id,
      recipientName: recipient.name,
      decisionMakerId: decisionMaker.id,
      decisionMakerName: decisionMaker.name,
      providerId: provider.id,
      providerName: provider.name,
      purpose,
      completePrice: price,
      assessedPrivateCash: privateCash,
      exactShortfall: shortfall,
      envelopeBefore,
      envelopeAfter: this.remainingWelfareEnvelope(),
      treasuryBefore,
      treasuryAfter: roundMoney(this.government.cash),
      privateContribution: privateCash,
      treasuryContribution: shortfall,
      linkedTransactionIds,
      outcome: "delivered",
      reason: "exact essential purchase completed",
    };
    this.recordWelfare(recipient, evidence);
    this.recordWelfare(provider, evidence);
    this.recordWelfare(this.government, evidence);
    return Object.freeze({ completed: true, reason: evidence.reason, evidence: Object.freeze(evidence) });
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

  recordLifecycle(person, type, text, counterpart = null, reason = null) {
    person.lifecycleSequence += 1;
    const phase = PHASES[this.phase];
    const record = {
      day: this.day,
      ...temporalMetadata(this.day, phase),
      sequence: person.lifecycleSequence,
      type,
      text,
      counterpartId: counterpart?.id ?? null,
      counterpartName: counterpart?.name ?? null,
      reason,
    };
    person.lifecycleHistory.unshift(record);
    return record;
  }

  materialSecurity(person) {
    return clamp(0.4 * Number(person.housed) + 0.3 * Number(person.employer >= 0) + 0.3 * clamp(this.runwayDays(person) / 12));
  }

  partnershipCooldownActive(person) {
    return person.lastPartnershipEndDay !== null && this.day - person.lastPartnershipEndDay < PARTNERSHIP_COOLDOWN_DAYS;
  }

  partnershipKinExcluded(a, b) {
    const aParents = new Set(a.parentIds ?? []);
    const bParents = new Set(b.parentIds ?? []);
    const isAncestor = (ancestorId, descendant) => {
      const pending = [...(descendant.parentIds ?? [])];
      const visited = new Set();
      while (pending.length) {
        const parentId = pending.shift();
        if (parentId === ancestorId) return true;
        if (visited.has(parentId)) continue;
        visited.add(parentId);
        pending.push(...(this.people[parentId]?.parentIds ?? []));
      }
      return false;
    };
    const parentOrDescendant = isAncestor(a.id, b) || isAncestor(b.id, a);
    const siblings = [...aParents].some((parentId) => bParents.has(parentId));
    const guardianRelation = [...(a.guardianIds ?? []), ...(a.formerGuardianIds ?? [])].includes(b.id)
      || [...(b.guardianIds ?? []), ...(b.formerGuardianIds ?? [])].includes(a.id);
    return parentOrDescendant || siblings || guardianRelation;
  }

  legalPartnershipPair(a, b, { requireUnpartnered = true } = {}) {
    if (!a || !b || a === b || !a.alive || !b.alive || a.lifecycleStage !== "adult" || b.lifecycleStage !== "adult") return false;
    if (requireUnpartnered && (a.partnerId !== null || b.partnerId !== null)) return false;
    if (this.partnershipCooldownActive(a) || this.partnershipCooldownActive(b) || this.partnershipKinExcluded(a, b)) return false;
    if (this.activeGestationFor(a.id) || this.activeGestationFor(b.id)) return false;
    const strength = Math.min(a.relationships[b.id]?.strength ?? 0, b.relationships[a.id]?.strength ?? 0);
    return strength + 1e-9 >= PARTNERSHIP_FRIENDSHIP_THRESHOLD;
  }

  partnershipObservation(person, domain, options = [], partner = null) {
    const relationship = partner ? person.relationships[partner.id] : null;
    return Object.freeze({
      kind: "partnership",
      domain,
      citizenId: person.id,
      citizenName: person.name,
      stress: person.stress,
      materialSecurity: this.materialSecurity(person),
      friendshipStrength: relationship?.strength ?? 0,
      contactStaleness: relationship ? clamp((this.day - relationship.lastContactDay - FRIENDSHIP_DECAY_GRACE_DAYS) / 10) : 0,
      profile: { ...person.motivationProfile },
      options: Object.freeze(options.map((option) => Object.freeze({ ...option }))),
    });
  }

  decidePartnership(person, domain, legalActions, options = [], partner = null) {
    const observation = this.partnershipObservation(person, domain, options, partner);
    const frozenActions = Object.freeze([...legalActions]);
    const decision = this.citizenPolicy.decide({ observation, legalActions: frozenActions, random: this.random });
    if (!decision || !frozenActions.includes(decision.action)) throw new Error(`Citizen policy ${this.citizenPolicy.id ?? "unknown"} chose an illegal partnership action`);
    this.recordDecision(person, observation, frozenActions, decision, "Planning");
    return decision;
  }

  formPartnership(a, b) {
    if (!this.legalPartnershipPair(a, b)) return false;
    a.partnerId = b.id;
    b.partnerId = a.id;
    a.partnershipStartDay = b.partnershipStartDay = this.day;
    this.recordLifecycle(a, "partnership-formed", `formed a romantic partnership with ${b.name}`, b, "mutual acceptance");
    this.recordLifecycle(b, "partnership-formed", `formed a romantic partnership with ${a.name}`, a, "mutual acceptance");
    return true;
  }

  endPartnership(person, reason, { cooldown = true } = {}) {
    if (person.partnerId === null) return false;
    const partner = this.people[person.partnerId];
    if (!partner || partner.partnerId !== person.id) throw new Error("Partnership references must be reciprocal");
    person.partnerId = null;
    partner.partnerId = null;
    person.partnershipStartDay = null;
    partner.partnershipStartDay = null;
    if (cooldown) person.lastPartnershipEndDay = partner.lastPartnershipEndDay = this.day;
    this.recordLifecycle(person, "partnership-ended", `romantic partnership with ${partner.name} ended`, partner, reason);
    this.recordLifecycle(partner, "partnership-ended", `romantic partnership with ${person.name} ended`, person, reason);
    return true;
  }

  pairKey(aId, bId) {
    return [aId, bId].sort((a, b) => a - b).join(":");
  }

  activeGestationFor(citizenId) {
    return this.gestations.find((gestation) => gestation.status === "active" && gestation.parentIds.includes(citizenId)) ?? null;
  }

  isolatedConceptionDraw(aId, bId, attemptSequence) {
    const [left, right] = [aId, bId].sort((a, b) => a - b);
    const isolatedSeed = (this.seed ^ Math.imul(left + 1, 0x9e3779b1) ^ Math.imul(right + 1, 0x85ebca6b) ^ Math.imul(attemptSequence, 0xc2b2ae35)) >>> 0;
    return createRandom(isolatedSeed)();
  }

  birthName(citizenId) {
    const random = createRandom((this.seed ^ Math.imul(citizenId + 1, 0x27d4eb2d)) >>> 0);
    const base = BIRTH_NAMES[Math.floor(random() * BIRTH_NAMES.length)];
    const matches = this.people.filter((person) => person.name === base || person.name.startsWith(`${base} `)).length;
    return matches ? `${base} ${matches + 1}` : base;
  }

  createNewborn(parentIds) {
    const id = this.nextCitizenId;
    const guardians = parentIds.map((parentId) => this.people[parentId]).filter((parent) => parent?.alive).sort((a, b) => a.id - b.id);
    if (!guardians.length) return null;
    const residentialGuardian = guardians.find((guardian) => guardian.housed) ?? guardians[0];
    const name = this.birthName(id);
    const newborn = {
      kind: "person", id, name, lifecycleStage: "infant", birthDay: this.day, ageDays: 0, isDependent: true,
      parentIds: [...parentIds].sort((a, b) => a - b), guardianIds: guardians.map((guardian) => guardian.id), formerGuardianIds: [],
      residentialGuardianId: residentialGuardian.id, treasuryGuardian: false, transitionHostId: null, transitionResidenceEndDay: null, restrictedInheritance: 0, studyDomain: null, studyDomainSelectionDay: null, schoolHistory: [], schoolSequence: 0, lifecycleSequence: 1,
      lifecycleHistory: [{ day: this.day, ...temporalMetadata(this.day, "Planning"), sequence: 1, type: "birth", text: `born to ${parentIds.map((parentId) => this.people[parentId].name).join(" and ")}`, counterpartId: null, counterpartName: null, reason: "completed gestation" }],
      partnerId: null, partnershipStartDay: null, lastPartnershipEndDay: null,
      alive: true, deathDay: null, estateTransferred: 0, estateDutyPaid: 0, inheritanceDistributed: 0, criticalHealthDays: 0, cash: 0, skill: 0.05,
      knowledgeProfile: createKnowledgeProfile(0.05), learningHistory: [], learningSequence: 0, reliability: 0.75,
      employer: -1, employmentSpellSequence: 0, rota: null, scheduledShiftsWorked: 0, scheduledShiftsElapsed: 0,
      dailyPlan: null, dependentHealthPlan: null, currentPrimaryActivity: null, sleepDebt: 0, lastSleepQuality: null, sleepSequence: 0, sleepHistory: [],
      jobApplicationFirm: -1, relationships: {}, socialCapacity: 0, lastSocialDay: 0, hungryDays: 0, rentArrears: 0,
      housed: residentialGuardian.housed, health: 0.75, stress: 0, esteemBaseline: 0, motivationProfile: createMotivationProfile(this.seed, id),
      dividendPreference: 0, ownerRecoveryThreshold: 0, growth: 0, attended: false, scarcityError: false, missedWork: 0,
      foodSeller: -1, foodReserveTarget: 1, foodStock: [], mutualAidHistory: [], welfareSequence: 0, welfareHistory: [],
      foodConsumedToday: 0, foodConsumedTotal: 0, wasteSequence: 0, wasteHistory: [], lastFoodQuality: null, lastFoodAge: null,
      personalSeller: -1, healthSeller: -1, lastTreatmentDay: null, educationSeller: -1, lastEducationDay: null,
      clinicalSeller: -1, lastClinicalDay: null, socialVenueToday: null, rentSeller: -1,
      homeX: residentialGuardian.homeX, homeY: residentialGuardian.homeY, x: residentialGuardian.homeX, y: residentialGuardian.homeY,
      activitySequence: 1, decisionSequence: 0, decisions: [], ledger: [],
      events: [{ day: this.day, ...temporalMetadata(this.day, "Planning"), sequence: 1, text: `born to ${parentIds.map((parentId) => this.people[parentId].name).join(" and ")}`, kind: "good" }],
      needs: { physiological: 0.75, safety: 0, belonging: 0, esteem: 0, growth: 0 }, focus: "physiological", socialToday: false,
    };
    this.people.push(newborn);
    this.nextCitizenId += 1;
    parentIds.forEach((parentId) => this.recordLifecycle(this.people[parentId], "birth", `${newborn.name} was born`, newborn, "completed gestation"));
    return newborn;
  }

  reconcileDependentCare(dependent) {
    if (!dependent?.alive || !dependent.isDependent) return [];
    const previousGuardians = [...dependent.guardianIds];
    const livingGuardians = previousGuardians
      .map((id) => this.people[id])
      .filter((guardian) => guardian?.alive && !guardian.isDependent)
      .sort((a, b) => a.id - b.id);
    const livingIds = livingGuardians.map((guardian) => guardian.id);
    const removedIds = previousGuardians.filter((id) => !livingIds.includes(id));
    if (removedIds.length) {
      dependent.formerGuardianIds = [...new Set([...dependent.formerGuardianIds, ...removedIds])].sort((a, b) => a - b);
      dependent.guardianIds = livingIds;
      this.recordLifecycle(dependent, "guardianship-changed", removedIds.length === 1 ? "a guardian died" : "guardians died", null, "only living citizen guardians remain");
    }
    dependent.treasuryGuardian = livingGuardians.length === 0;
    const preferred = livingGuardians.filter((guardian) => guardian.housed).sort((a, b) => a.id - b.id)[0]
      ?? livingGuardians[0]
      ?? null;
    if (dependent.residentialGuardianId !== (preferred?.id ?? null)) {
      dependent.residentialGuardianId = preferred?.id ?? null;
      this.recordLifecycle(dependent, "residence-changed", preferred ? `residence moved with ${preferred.name}` : "entered treasury guardianship", preferred, preferred ? "preferred a housed living guardian" : "no living citizen guardian remained");
    }
    dependent.housed = Boolean(preferred?.housed);
    if (preferred) {
      dependent.homeX = preferred.homeX;
      dependent.homeY = preferred.homeY;
    }
    return livingGuardians;
  }

  reconcileAllDependentCare() {
    this.people.filter((person) => person.alive && person.isDependent).forEach((dependent) => this.reconcileDependentCare(dependent));
  }

  transitionResidenceActive(person) {
    const host = this.people[person?.transitionHostId];
    return Boolean(person?.alive && !person.isDependent && person.transitionResidenceEndDay !== null
      && this.day < person.transitionResidenceEndDay && host?.alive && host.housed);
  }

  reconcileTransitionResidence(person) {
    if (!person?.alive || person.transitionResidenceEndDay === null) return false;
    const active = this.transitionResidenceActive(person);
    if (active) {
      const host = this.people[person.transitionHostId];
      person.housed = true;
      person.homeX = host.homeX;
      person.homeY = host.homeY;
      return true;
    }
    const host = this.people[person.transitionHostId];
    const reason = this.day >= person.transitionResidenceEndDay
      ? "28-day transition residence ended"
      : !host?.alive
        ? "transition host died"
        : "transition host lost housing";
    person.transitionHostId = null;
    person.transitionResidenceEndDay = null;
    person.housed = false;
    person.rentArrears = 0;
    this.recordLifecycle(person, "transition-residence-ended", "became independently unhoused", host, reason);
    this.note(person, reason, "bad");
    return false;
  }

  reconcileAllTransitionResidences() {
    this.people.filter((person) => person.alive && person.transitionResidenceEndDay !== null)
      .forEach((person) => this.reconcileTransitionResidence(person));
  }

  resolveLifecycleStages() {
    if (!this.lifecycleEnabled) return [];
    const transitions = [];
    this.people.filter((person) => person.alive && person.birthDay !== null).sort((a, b) => a.id - b.id).forEach((person) => {
      person.ageDays = this.day - person.birthDay;
      const nextStage = lifecycleStageForAge(person.ageDays);
      if (nextStage === person.lifecycleStage) return;
      const previousStage = person.lifecycleStage;
      person.lifecycleStage = nextStage;
      person.isDependent = nextStage !== "adult";
      this.recordLifecycle(person, "stage-changed", `entered the ${nextStage} stage`, null, `calendar age reached ${person.ageDays} days`);
      if (nextStage === "student" && person.studyDomain === null) this.selectStudentDomain(person);
      if (nextStage === "adult") {
        const formerResidentialGuardian = this.people[person.residentialGuardianId];
        const formerGuardians = person.guardianIds.map((id) => this.people[id]).filter(Boolean).sort((a, b) => a.id - b.id);
        person.formerGuardianIds = [...new Set([...person.formerGuardianIds, ...person.guardianIds])].sort((a, b) => a - b);
        person.guardianIds = [];
        person.residentialGuardianId = null;
        person.treasuryGuardian = false;
        const host = formerResidentialGuardian?.alive && formerResidentialGuardian.housed
          ? formerResidentialGuardian
          : formerGuardians.find((guardian) => guardian.alive && guardian.housed) ?? null;
        person.transitionHostId = host?.id ?? null;
        person.transitionResidenceEndDay = host ? this.day + 28 : null;
        person.housed = Boolean(host);
        if (host) {
          person.homeX = host.homeX;
          person.homeY = host.homeY;
        }
        if (person.restrictedInheritance > 0) {
          const released = person.restrictedInheritance;
          const before = person.cash;
          person.restrictedInheritance = 0;
          person.cash = roundMoney(person.cash + released);
          this.ledger(person, { direction: "in", amount: released, text: "restricted inheritance released at adulthood", before, transactionId: `maturation:${this.day}:${person.id}` });
        }
        const capacityRandom = createRandom((this.seed ^ Math.imul(person.id + 1, 0x165667b1)) >>> 0);
        person.socialCapacity = 3 + Math.floor(capacityRandom() * 4);
        this.recordLifecycle(person, "maturation", "adult economic actions became available", host, host ? `28-day transition residence with ${host.name}` : "no housed former guardian was available");
      }
      transitions.push(Object.freeze({ citizenId: person.id, previousStage, stage: nextStage, ageDays: person.ageDays }));
    });
    return transitions;
  }

  studentDomainAffinity(citizenId, domainIndex) {
    return createRandom((this.seed ^ Math.imul(citizenId + 1, 0x9e3779b1) ^ Math.imul(domainIndex + 1, 0x85ebca6b)) >>> 0)();
  }

  selectStudentDomain(person) {
    if (!person?.alive || person.lifecycleStage !== "student" || person.studyDomain !== null) return person?.studyDomain ?? null;
    const vacancies = Object.fromEntries(KNOWLEDGE_VOCATIONAL_DOMAINS.map((domain) => [domain, 0]));
    this.firms.filter((firm) => firm.active).forEach((firm) => {
      const funded = Math.max(0, firm.targetStaff - firm.employees.length);
      firm.knowledge.domains.forEach(({ id }) => { vacancies[id] += funded; });
    });
    const total = Object.values(vacancies).reduce((sum, count) => sum + count, 0);
    const scored = KNOWLEDGE_VOCATIONAL_DOMAINS.map((domain, index) => ({
      domain,
      score: person.motivationProfile.planning * (vacancies[domain] / Math.max(1, total)) * 0.55
        + person.motivationProfile.mastery * 0.25
        + this.studentDomainAffinity(person.id, index) * 0.35,
    }));
    const selected = scored.reduce((best, candidate) => candidate.score > best.score ? candidate : best);
    person.studyDomain = selected.domain;
    person.studyDomainSelectionDay = this.day;
    this.recordLifecycle(person, "study-domain-selected", `selected ${selected.domain} for student study`, null, "vacancy opportunity, motivation, and stable affinity");
    return selected.domain;
  }

  recentScheduledSchoolRecords(dependent) {
    return dependent.schoolHistory.filter((record) => record.scheduled).slice(0, 5);
  }

  dependentEducationNeed(dependent) {
    const records = this.recentScheduledSchoolRecords(dependent);
    const missed = records.filter((record) => record.outcome !== "attended").length;
    return 0.55 * (1 - dependent.knowledgeProfile.general) + 0.45 * clamp(missed / 5);
  }

  guardianAllocatedMealCost(guardian) {
    const cheapestMeal = this.firms.filter((firm) => firm.active && firm.sector === "food")
      .reduce((price, firm) => Math.min(price, firm.price), this.essentialCost());
    return this.people.filter((dependent) => dependent.alive && dependent.isDependent && dependent.guardianIds.includes(guardian.id))
      .reduce((total, dependent) => total + cheapestMeal / Math.max(1, dependent.guardianIds.length), 0);
  }

  guardianSchoolProtectedReserve(guardian) {
    return roundMoney(3 * (this.essentialCost() + this.guardianAllocatedMealCost(guardian)));
  }

  guardianCanFundSchool(guardian, dependent, school) {
    if (!guardian?.alive || !dependent?.alive || !dependent.isDependent || !school?.active) return false;
    const restrictedContribution = Math.min(dependent.restrictedInheritance, school.price);
    const guardianContribution = roundMoney(school.price - restrictedContribution);
    return guardian.cash - guardianContribution + 1e-9 >= this.guardianSchoolProtectedReserve(guardian);
  }

  settleDependentSchoolPayment(dependent, guardian, school) {
    const reserve = guardian?.kind === "person" ? this.guardianSchoolProtectedReserve(guardian) : 0;
    const availableGuardianCash = guardian?.kind === "person" ? Math.max(0, roundMoney(guardian.cash - reserve)) : 0;
    const privateFunds = roundMoney(dependent.restrictedInheritance + availableGuardianCash);
    if (privateFunds + 1e-9 >= school.price && guardian?.kind === "person") {
      return this.settleDirectAssistance({
        programme: "childEducation",
        recipient: dependent,
        decisionMaker: guardian,
        privatePayer: guardian,
        provider: school,
        purpose: "dependent education",
        privateContributionCap: availableGuardianCash,
      });
    }
    if (!this.directWelfareEnabled()) return Object.freeze({ completed: false, reason: "no finite education assistance" });
    return this.settleDirectAssistance({
      programme: "childEducation",
      recipient: dependent,
      decisionMaker: guardian ?? this.government,
      privatePayer: guardian?.kind === "person" ? guardian : dependent,
      provider: school,
      purpose: "dependent education",
      privateContributionCap: availableGuardianCash,
    });
  }

  recordDependentSchool(dependent, outcome, { school = null, guardian = null, scheduled = true, reason = null } = {}) {
    dependent.schoolSequence += 1;
    const record = Object.freeze({
      day: this.day,
      ...temporalMetadata(this.day, PHASES[this.phase]),
      sequence: dependent.schoolSequence,
      scheduled,
      outcome,
      schoolId: school?.id ?? null,
      schoolName: school?.name ?? null,
      guardianId: guardian?.id ?? null,
      guardianName: guardian?.name ?? null,
      reason,
    });
    dependent.schoolHistory.unshift(record);
    return record;
  }

  planGuardianSchoolFunding(guardian, dependent, school) {
    const reserve = this.guardianSchoolProtectedReserve(guardian);
    const available = Math.max(0, roundMoney(guardian.cash - reserve)) + dependent.restrictedInheritance;
    const canOffer = this.guardianCanFundSchool(guardian, dependent, school) || this.directWelfareEnabled();
    const observation = Object.freeze({
      kind: "dependent-school-funding",
      citizenId: guardian.id,
      citizenName: guardian.name,
      dependentId: dependent.id,
      dependentName: dependent.name,
      stress: guardian.stress,
      educationNeed: this.dependentEducationNeed(dependent),
      careScarcity: clamp(1 - this.dependentCareRunway(guardian) / 12),
      costPressure: clamp(school.price / Math.max(school.price, available)),
      profile: { ...guardian.motivationProfile },
      schoolId: school.id,
    });
    const legalActions = Object.freeze(["defer-dependent-school-funding", ...(canOffer ? [`fund-dependent-school:${school.id}`] : [])]);
    const decision = this.citizenPolicy.decide({ observation, legalActions, random: this.random });
    if (!decision || !legalActions.includes(decision.action)) throw new Error(`Citizen policy ${this.citizenPolicy.id ?? "unknown"} chose an illegal dependent-school-funding action`);
    this.recordDecision(guardian, observation, legalActions, decision, "Planning");
    return decision.action === `fund-dependent-school:${school.id}`;
  }

  planDependentSchooling(dependent) {
    if (!dependent.alive || !dependent.isDependent || !["child", "student"].includes(dependent.lifecycleStage)
      || dependent.dailyPlan?.day === this.day && dependent.dailyPlan.workday?.activity === "dependent-clinic") return false;
    const school = this.firms.find((firm) => this.firmServiceAvailable(firm, "Workday") && firm.archetypeId === "school");
    if (!school) return false;
    const guardians = this.reconcileDependentCare(dependent).sort((a, b) => (
      Number(b.id === dependent.residentialGuardianId) - Number(a.id === dependent.residentialGuardianId) || a.id - b.id
    ));
    const guardian = guardians.find((candidate) => this.planGuardianSchoolFunding(candidate, dependent, school)) ?? null;
    if (!guardian && !(guardians.length === 0 && this.directWelfareEnabled())) return false;
    const records = this.recentScheduledSchoolRecords(dependent);
    const missed = records.filter((record) => record.outcome !== "attended").length;
    const observation = Object.freeze({
      kind: "dependent-school-attendance",
      citizenId: dependent.id,
      citizenName: dependent.name,
      schoolId: school.id,
      educationNeed: this.dependentEducationNeed(dependent),
      missedLessonRate: clamp(missed / 5),
      hunger: Number(dependent.hungryDays > 0),
      health: dependent.health,
      sleepDebt: this.sleepEnabled ? dependent.sleepDebt : 0,
      stress: dependent.stress,
      reliability: dependent.reliability,
      profile: { ...dependent.motivationProfile },
    });
    const legalActions = Object.freeze(["miss-dependent-school", `attend-dependent-school:${school.id}`]);
    const decision = this.citizenPolicy.decide({ observation, legalActions, random: this.random });
    if (!decision || !legalActions.includes(decision.action)) throw new Error(`Citizen policy ${this.citizenPolicy.id ?? "unknown"} chose an illegal dependent-school-attendance action`);
    this.recordDecision(dependent, observation, legalActions, decision, "Planning");
    dependent.dailyPlan = { day: this.day, workday: {
      action: decision.action,
      activity: "dependent-school",
      schoolId: school.id,
      guardianId: guardian?.id ?? null,
      attend: decision.action === `attend-dependent-school:${school.id}`,
      status: "planned",
      failureReason: null,
    } };
    return true;
  }

  dependentSchoolPriority(dependents = this.people) {
    const populationSize = this.people.length;
    const rotation = Math.floor((this.day - 1) / 7);
    const rotatingRank = (person) => (person.id - rotation + populationSize) % populationSize;
    return dependents.filter((person) => person.alive && person.isDependent && ["child", "student"].includes(person.lifecycleStage))
      .sort((a, b) => {
        const missedA = this.recentScheduledSchoolRecords(a).filter((record) => record.outcome !== "attended").length;
        const missedB = this.recentScheduledSchoolRecords(b).filter((record) => record.outcome !== "attended").length;
        return missedB - missedA
          || Number(b.lifecycleStage === "student") - Number(a.lifecycleStage === "student")
          || rotatingRank(a) - rotatingRank(b);
      });
  }

  plannedSchoolCapacity(school) {
    if (!school || !this.firmOpenOnDay(school)) return 0;
    const teachers = school.employees.filter((id) => {
      const teacher = this.people[id];
      return teacher?.alive
        && this.scheduledForShift(teacher, school)
        && teacher.dailyPlan?.day === this.day
        && teacher.dailyPlan.workday?.action === `work-shift:${school.id}`;
    }).length;
    return Math.floor(teachers * school.transactionsPerWorker * school.operationalReadiness * this.scheduledShiftCapacityMultiplier());
  }

  planAllDependentSchooling() {
    const school = this.firms.find((firm) => this.firmServiceAvailable(firm, "Workday") && firm.archetypeId === "school");
    if (!school) return [];
    const capacity = this.plannedSchoolCapacity(school);
    let reserved = 0;
    const planned = [];
    this.dependentSchoolPriority().forEach((dependent) => {
      if (dependent.dailyPlan?.day === this.day && dependent.dailyPlan.workday?.activity === "dependent-clinic") return;
      if (reserved >= capacity) {
        this.recordDependentSchool(dependent, "capacity-unavailable", { school, scheduled: true, reason: "higher-priority dependent lessons used planned teaching capacity" });
        return;
      }
      if (this.planDependentSchooling(dependent)) {
        reserved += 1;
        planned.push(dependent.id);
      }
    });
    return planned;
  }

  executeDependentSchooling(dependent, activity) {
    const school = this.firms[activity.schoolId];
    const guardian = activity.guardianId === null ? this.government : this.people[activity.guardianId];
    if (!activity.attend) {
      if (school.transactionsToday < this.transactionCapacity(school)) {
        school.transactionsToday += 1;
        this.markFirmUse(school);
      }
      this.recordDependentSchool(dependent, "missed", { school, guardian, reason: "dependent chose not to attend" });
      return { completed: true };
    }
    const payment = this.settleDependentSchoolPayment(dependent, guardian, school);
    if (!payment.completed) {
      this.recordDependentSchool(dependent, "failed", { school, guardian, reason: payment.reason });
      return { completed: false, failure: payment.reason };
    }
    const generalRate = dependent.lifecycleStage === "student" ? 0.006 : 0.004;
    const before = dependent.skill;
    dependent.skill = clamp(before + generalRate * (1 - before), 0, 0.95);
    this.syncGeneralKnowledge(dependent, { source: "education", sourceId: school.id, sourceName: school.name, rule: `dependent-${dependent.lifecycleStage}-general-v1`, phase: "Production" });
    if (dependent.lifecycleStage === "student" && dependent.studyDomain) this.applyKnowledgeLearning(dependent, {
      source: "education", sourceId: school.id, sourceName: school.name, domain: dependent.studyDomain, rate: 0.003,
      rule: "dependent-student-domain-v1", phase: "Production",
    });
    dependent.lastEducationDay = this.day;
    this.recordDependentSchool(dependent, "attended", { school, guardian, reason: "paid lesson delivered" });
    return { completed: true };
  }

  resolveGestations() {
    if (!this.lifecycleEnabled || !this.birthsEnabled || calendarForDay(this.day).weekdayIndex !== 0) return [];
    const resolved = [];
    this.gestations.filter((gestation) => gestation.status === "active" && gestation.dueDay <= this.day).sort((a, b) => a.id - b.id).forEach((gestation) => {
      const livingParents = gestation.parentIds.filter((parentId) => this.people[parentId]?.alive);
      if (!livingParents.length) {
        gestation.status = "ended";
        gestation.endedDay = this.day;
        gestation.outcome = "both prospective guardians died";
        gestation.parentIds.forEach((parentId) => this.recordLifecycle(this.people[parentId], "gestation-ended", "gestation ended before birth", null, gestation.outcome));
        resolved.push(gestation);
        return;
      }
      const newborn = this.createNewborn(gestation.parentIds);
      gestation.status = "completed";
      gestation.completedDay = this.day;
      gestation.newbornId = newborn.id;
      this.lastBirthDays[this.pairKey(...gestation.parentIds)] = this.day;
      resolved.push(gestation);
    });
    return resolved;
  }

  runBirthAttempts() {
    if (!this.lifecycleEnabled || !this.birthsEnabled || calendarForDay(this.day).weekdayIndex !== 0) return [];
    const results = [];
    this.people.filter((person) => person.alive && person.partnerId !== null && person.id < person.partnerId).sort((a, b) => a.id - b.id).forEach((a) => {
      const b = this.people[a.partnerId];
      const key = this.pairKey(a.id, b.id);
      if (this.activeGestationFor(a.id) || this.activeGestationFor(b.id)) return;
      if (this.lastBirthDays[key] !== undefined && this.day - this.lastBirthDays[key] < BIRTH_SPACING_DAYS) return;
      const currentDependents = new Set([...this.people.filter((person) => person.isDependent && person.guardianIds.some((id) => id === a.id || id === b.id)).map((person) => person.id)]).size;
      const careLoad = clamp(currentDependents / 3);
      const sharedSecurity = Math.min(this.materialSecurity(a), this.materialSecurity(b));
      const housingAvailable = this.housingOccupancy() < (this.firms.find((firm) => firm.sector === "housing")?.dwellingCapacity ?? 0) ? 1 : 0;
      const foodReliable = this.firms.some((firm) => firm.active && firm.sector === "food" && firm.inventory > 0) ? 1 : 0;
      const careCapacity = clamp(0.35 * sharedSecurity + 0.2 * ((a.health + b.health) / 2) + 0.2 * housingAvailable + 0.15 * foodReliable + 0.1 * (1 - careLoad));
      const friendshipStrength = Math.min(a.relationships[b.id]?.strength ?? 0, b.relationships[a.id]?.strength ?? 0);
      const decisions = [a, b].map((person) => {
        const observation = Object.freeze({ kind: "birth-attempt", citizenId: person.id, citizenName: person.name, partnerId: person === a ? b.id : a.id, partnerName: person === a ? b.name : a.name, stress: person.stress, friendshipStrength, sharedSecurity, careCapacity, careLoad, profile: { ...person.motivationProfile } });
        const legalActions = Object.freeze(["wait-for-child", "try-for-child"]);
        const decision = this.citizenPolicy.decide({ observation, legalActions, random: this.random });
        if (!decision || !legalActions.includes(decision.action)) throw new Error(`Citizen policy ${this.citizenPolicy.id ?? "unknown"} chose an illegal birth-attempt action`);
        this.recordDecision(person, observation, legalActions, decision, "Planning");
        return decision;
      });
      if (!decisions.every((decision) => decision.action === "try-for-child")) return;
      const attemptSequence = (this.birthAttemptCounts[key] ?? 0) + 1;
      this.birthAttemptCounts[key] = attemptSequence;
      const draw = this.isolatedConceptionDraw(a.id, b.id, attemptSequence);
      const conceived = draw < CONCEPTION_CHANCE;
      const attempt = { day: this.day, parentIds: [a.id, b.id], attemptSequence, draw, chance: CONCEPTION_CHANCE, conceived };
      results.push(attempt);
      this.birthAttemptHistory.unshift(Object.freeze({ ...attempt }));
      if (!conceived) return;
      const gestation = { id: ++this.gestationSequence, parentIds: [a.id, b.id], attemptSequence, conceivedDay: this.day, dueDay: this.day + GESTATION_DAYS, status: "active", newbornId: null };
      this.gestations.push(gestation);
      this.recordLifecycle(a, "conception", `began a gestation with ${b.name}`, b, `attempt ${attemptSequence}`);
      this.recordLifecycle(b, "conception", `began a gestation with ${a.name}`, a, `attempt ${attemptSequence}`);
    });
    return results;
  }

  runPartnerships() {
    if (!this.lifecycleEnabled || calendarForDay(this.day).weekdayIndex !== 0) return;
    const pairs = this.people.filter((person) => person.alive && person.partnerId !== null && person.id < person.partnerId)
      .map((person) => [person, this.people[person.partnerId]]);
    const separations = [];
    pairs.forEach(([a, b]) => {
      if (!b?.alive) {
        separations.push({ person: a, reason: "partner died", cooldown: false });
        return;
      }
      const strength = Math.min(a.relationships[b.id]?.strength ?? 0, b.relationships[a.id]?.strength ?? 0);
      if (strength < PARTNERSHIP_END_FRIENDSHIP_THRESHOLD) {
        separations.push({ person: a, reason: "friendship strength fell below the partnership floor", cooldown: true });
        return;
      }
      const decisions = [a, b].map((person) => this.decidePartnership(person, "separation", ["continue-partnership", "separate-partnership"], [], person === a ? b : a));
      if (decisions.some((decision) => decision.action === "separate-partnership")) separations.push({ person: a, reason: "one partner chose separation", cooldown: true });
    });
    separations.forEach(({ person, reason, cooldown }) => {
      if (person.partnerId !== null) this.endPartnership(person, reason, { cooldown });
    });

    const adults = this.people.filter((person) => person.alive && person.lifecycleStage === "adult" && person.partnerId === null && !this.partnershipCooldownActive(person)).sort((a, b) => a.id - b.id);
    const proposals = [];
    adults.forEach((proposer) => {
      const options = adults.filter((candidate) => this.legalPartnershipPair(proposer, candidate)).map((candidate) => ({
        action: `propose-partnership:${candidate.id}`,
        citizenId: candidate.id,
        citizenName: candidate.name,
        friendshipStrength: Math.min(proposer.relationships[candidate.id].strength, candidate.relationships[proposer.id].strength),
      }));
      if (!options.length) return;
      const decision = this.decidePartnership(proposer, "proposal", ["remain-single", ...options.map((option) => option.action)], options);
      const option = options.find((candidate) => candidate.action === decision.action);
      if (option) proposals.push({ proposerId: proposer.id, recipientId: option.citizenId, friendshipStrength: option.friendshipStrength });
    });

    const accepted = [];
    const byRecipient = proposals.reduce((groups, proposal) => {
      const group = groups.get(proposal.recipientId) ?? [];
      group.push(proposal);
      groups.set(proposal.recipientId, group);
      return groups;
    }, new Map());
    [...byRecipient.entries()].sort(([a], [b]) => a - b).forEach(([recipientId, offers]) => {
      const recipient = this.people[recipientId];
      const options = offers.sort((a, b) => a.proposerId - b.proposerId).map((offer) => ({
        action: `accept-partnership:${offer.proposerId}`,
        citizenId: offer.proposerId,
        citizenName: this.people[offer.proposerId].name,
        friendshipStrength: offer.friendshipStrength,
      }));
      const decision = this.decidePartnership(recipient, "response", ["decline-partnership", ...options.map((option) => option.action)], options);
      const option = options.find((candidate) => candidate.action === decision.action);
      if (option) accepted.push([this.people[option.citizenId], recipient]);
    });
    accepted.sort(([a1, b1], [a2, b2]) => a1.id - a2.id || b1.id - b2.id).forEach(([a, b]) => this.formPartnership(a, b));
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
          if (person.partnerId === friend.id) this.endPartnership(person, "friendship faded below the partnership floor");
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
    if (!firm.active || !person.alive || person.isDependent || person.employer >= 0) return false;
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
    if (!firm.active || !candidate.alive || candidate.isDependent || candidate.employer >= 0) return false;
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
    if (!person.alive || person.isDependent || person.employer >= 0) return null;
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
      .filter((person) => person.alive && !person.isDependent && person.employer < 0)
      .forEach((person) => this.considerJobSearch(person, eligibleFirms));
    let hires = 0;
    eligibleFirms.forEach((firm) => {
      const candidate = this.people
        .filter((person) => person.alive && !person.isDependent && person.employer < 0 && person.jobApplicationFirm === firm.id)
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
    if (!person.alive || person.isDependent) return null;
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
    const record = {
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
    };
    person.decisions.unshift(record);
    return record;
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

  deathEstateSnapshot(person) {
    return Object.freeze({
      person,
      partnerId: person.partnerId,
      childIds: this.people.filter((candidate) => candidate.parentIds.includes(person.id)).map((candidate) => candidate.id),
      estate: roundMoney(person.cash + (person.restrictedInheritance ?? 0)),
    });
  }

  markDeath(person, reason = "died after health reached a critical level") {
    if (!person.alive) return false;
    if (person.partnerId !== null) this.endPartnership(person, "partner died", { cooldown: false });
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
    this.note(person, reason, "bad");
    this.people.filter((dependent) => dependent.alive && dependent.isDependent && dependent.guardianIds.includes(person.id))
      .forEach((dependent) => this.reconcileDependentCare(dependent));
    return true;
  }

  transferInheritance(from, heir, amount, transactionId) {
    if (amount <= 0) return 0;
    const deceasedBefore = from.cash;
    if (heir.isDependent) {
      if (from.cash + 1e-9 < amount) throw new Error("Inheritance cannot overdraw an estate");
      const heirBefore = heir.restrictedInheritance;
      from.cash = roundMoney(from.cash - amount);
      heir.restrictedInheritance = roundMoney(heir.restrictedInheritance + amount);
      this.flows.push({ from: { kind: from.kind, id: from.id }, to: { kind: heir.kind, id: heir.id }, amount, phase: this.phase, ...temporalMetadata(this.day, this.phase) });
      this.flows = this.flows.slice(-40);
      this.ledger(from, { direction: "out", amount, text: `inheritance to ${heir.name}`, before: deceasedBefore, transactionId });
      this.ledger(heir, { direction: "in", amount, text: `restricted inheritance from ${from.name}`, before: heirBefore, transactionId });
      heir.ledger[0].after = heir.restrictedInheritance;
      return amount;
    }
    const heirBefore = heir.cash;
    const paid = this.transfer(from, heir, amount, { exact: true });
    if (paid !== amount) throw new Error("Inheritance transfer was incomplete");
    this.ledger(from, { direction: "out", amount: paid, text: `inheritance to ${heir.name}`, before: deceasedBefore, transactionId });
    this.ledger(heir, { direction: "in", amount: paid, text: `inheritance from ${from.name}`, before: heirBefore, transactionId });
    return paid;
  }

  distributeEstate(snapshot, cohortIds) {
    const { person, estate, partnerId, childIds } = snapshot;
    person.cash = estate;
    person.restrictedInheritance = 0;
    person.estateTransferred = estate;
    const duty = Math.floor(estate * 10 + 1e-9) / 100;
    const postDuty = roundMoney(estate - duty);
    let distributed = 0;
    if (duty > 0) {
      const deceasedBefore = person.cash;
      const treasuryBefore = this.government.cash;
      const transactionId = `estate:${this.day}:${person.id}:duty`;
      const paid = this.transfer(person, this.government, duty, { exact: true });
      this.ledger(person, { direction: "out", amount: paid, text: "estate duty to treasury", before: deceasedBefore, transactionId });
      this.ledger(this.government, { direction: "in", amount: paid, text: `estate duty from ${person.name}`, before: treasuryBefore, transactionId });
    }
    person.estateDutyPaid = duty;
    const partner = partnerId === null || cohortIds.has(partnerId) ? null : this.people[partnerId];
    const children = childIds.map((id) => this.people[id]).filter((child) => child.alive && !cohortIds.has(child.id)).sort((a, b) => a.id - b.id);
    let partnerShare = 0;
    let childrenPool = 0;
    if (partner?.alive && children.length) {
      partnerShare = Math.floor(postDuty * 50 + 1e-9) / 100;
      childrenPool = roundMoney(postDuty - partnerShare);
    } else if (partner?.alive) partnerShare = postDuty;
    else if (children.length) childrenPool = postDuty;
    if (partnerShare > 0) distributed += this.transferInheritance(person, partner, partnerShare, `estate:${this.day}:${person.id}:partner`);
    if (childrenPool > 0 && children.length) {
      const poolCents = Math.round(childrenPool * 100);
      const baseCents = Math.floor(poolCents / children.length);
      const remainder = poolCents % children.length;
      children.forEach((child, index) => {
        const share = (baseCents + Number(index < remainder)) / 100;
        distributed += this.transferInheritance(person, child, share, `estate:${this.day}:${person.id}:child:${child.id}`);
      });
    }
    const treasuryRemainder = roundMoney(person.cash);
    if (treasuryRemainder > 0) {
      const deceasedBefore = person.cash;
      const treasuryBefore = this.government.cash;
      const transactionId = `estate:${this.day}:${person.id}:remainder`;
      const paid = this.transfer(person, this.government, treasuryRemainder, { exact: true });
      const text = partner?.alive || children.length ? "unallocated estate remainder to treasury" : "intestate estate remainder to treasury";
      this.ledger(person, { direction: "out", amount: paid, text, before: deceasedBefore, transactionId });
      this.ledger(this.government, { direction: "in", amount: paid, text: `${text} from ${person.name}`, before: treasuryBefore, transactionId });
    }
    person.inheritanceDistributed = roundMoney(distributed);
    return Object.freeze({ personId: person.id, estate, duty, partnerId: partner?.alive ? partner.id : null, childIds: children.map((child) => child.id), distributed: person.inheritanceDistributed, treasuryRemainder });
  }

  dieCohort(entries) {
    const seen = new Set();
    const deaths = entries.map((entry) => entry?.person ? entry : { person: entry, reason: "died after health reached a critical level" })
      .filter(({ person }) => {
        if (!person?.alive || seen.has(person.id)) return false;
        seen.add(person.id);
        return true;
      });
    const snapshots = deaths.map(({ person }) => this.deathEstateSnapshot(person));
    const cohortIds = new Set(snapshots.map(({ person }) => person.id));
    deaths.forEach(({ person, reason }) => this.markDeath(person, reason));
    return snapshots.map((snapshot) => this.distributeEstate(snapshot, cohortIds));
  }

  die(person, reason = "died after health reached a critical level") {
    if (!person.alive) return false;
    this.dieCohort([{ person, reason }]);
    return true;
  }

  transactionCapacity(firm) {
    if (!this.firmOpenOnDay(firm)) return 0;
    const capacity = this.scalarTransactionCapacity(firm);
    const knowledgeSlots = this.knowledgeEnabled && firm.knowledge.effectType === "transaction-capacity"
      ? firm.knowledgeCapacitySlotsToday
      : 0;
    return capacity + knowledgeSlots;
  }

  scalarTransactionCapacity(firm) {
    const attendingWorkers = firm.employees.filter((id) => this.people[id]?.alive && this.people[id].attended).length;
    return Math.floor(attendingWorkers * firm.transactionsPerWorker * firm.operationalReadiness * this.scheduledShiftCapacityMultiplier());
  }

  scheduledShiftCapacityMultiplier() {
    return this.schedulesEnabled ? 7 / 5 : 1;
  }

  transportCapacityPerWorker() {
    return this.schedulesEnabled ? SCHEDULED_TRANSPORT_CAPACITY_PER_WORKER : TRANSPORT_CAPACITY_PER_WORKER;
  }

  directScalarOutput(person, firm) {
    if (!person?.alive || !person.attended) return 0;
    return (0.42 + person.skill * 0.75) * firm.productivity * person.health * (1 - person.stress * 0.32) * firm.operationalReadiness * this.scheduledShiftCapacityMultiplier();
  }

  knowledgeScalarForWorker(person, firm) {
    if (!person?.alive || !person.attended) return 0;
    if (firm.knowledge.effectType === "transaction-capacity") return firm.transactionsPerWorker * firm.operationalReadiness * this.scheduledShiftCapacityMultiplier();
    if (firm.knowledge.effectType === "processing-capacity") return firm.processingPerWorker * firm.operationalReadiness * this.scheduledShiftCapacityMultiplier();
    if (firm.knowledge.effectType === "haulage-capacity") return this.transportCapacityPerWorker() * firm.operationalReadiness * this.scheduledShiftCapacityMultiplier();
    if (firm.knowledge.effectType === "direct-yield") return this.directScalarOutput(person, firm);
    return 0;
  }

  knowledgeCapacityContribution(firm) {
    if (!this.knowledgeEnabled || !firm.active) return 0;
    const contribution = firm.employees.reduce((total, id) => {
      const person = this.people[id];
      const scalar = this.knowledgeScalarForWorker(person, firm);
      if (!scalar) return total;
      const vocationalKnowledge = weightedVocationalKnowledge(person.knowledgeProfile, firm.knowledge);
      const workerContribution = Math.round(scalar * vocationalKnowledge * firm.knowledge.maxBonus * 1_000_000) / 1_000_000;
      return total + workerContribution;
    }, 0);
    return Math.round(contribution * 1_000_000) / 1_000_000;
  }

  accrueKnowledgeCapacity(firm) {
    if (firm.lastKnowledgeCapacityDay === this.day) return firm.knowledgeCapacitySlotsToday;
    firm.lastKnowledgeCapacityDay = this.day;
    firm.knowledgeCapacitySlotsToday = 0;
    firm.knowledgeEffectGrossToday = 0;
    firm.knowledgeEffectUsedToday = 0;
    firm.knowledgeEffectScalarToday = firm.employees.reduce((total, id) => total + this.knowledgeScalarForWorker(this.people[id], firm), 0);
    const contribution = this.knowledgeCapacityContribution(firm);
    if (!contribution) return 0;
    firm.knowledgeEffectGrossToday = contribution;
    const discrete = firm.knowledge.effectType !== "direct-yield";
    const carryBefore = firm.knowledgeCapacityCarry;
    const accumulated = discrete ? Math.round((carryBefore + contribution) * 1_000_000) / 1_000_000 : 0;
    const slots = discrete ? Math.floor(accumulated + 1e-9) : 0;
    firm.knowledgeCapacityCarry = discrete ? Math.round((accumulated - slots) * 1_000_000) / 1_000_000 : 0;
    firm.knowledgeCapacitySlotsToday = slots;
    if (!discrete) firm.knowledgeEffectUsedToday = contribution;
    firm.knowledgeEffectSequence += 1;
    const record = {
      day: this.day,
      phase: "Production",
      ...temporalMetadata(this.day, "Production"),
      sequence: firm.knowledgeEffectSequence,
      effectType: firm.knowledge.effectType,
      rule: firm.knowledge.effectRule,
      scalarBaseline: Math.round(firm.knowledgeEffectScalarToday * 1_000_000) / 1_000_000,
      grossContribution: contribution,
      releasedUnits: slots,
      carryBefore,
      carryAfter: firm.knowledgeCapacityCarry,
      usedUnits: firm.knowledgeEffectUsedToday,
    };
    firm.knowledgeEffectHistory.unshift(record);
    if (slots > 0 && firm.knowledge.effectType === "transaction-capacity") {
      this.note(firm, `worker knowledge made ${slots} extra transaction slot${slots === 1 ? "" : "s"} available; ${(firm.knowledgeCapacityCarry * 100).toFixed(1)}% carry remains`, "good");
    }
    return slots;
  }

  markKnowledgeEffectUsed(firm, usedUnits) {
    if (!this.knowledgeEnabled || usedUnits <= firm.knowledgeEffectUsedToday) return firm.knowledgeEffectUsedToday;
    const availableEffect = firm.knowledge.effectType === "direct-yield"
      ? firm.knowledgeEffectGrossToday
      : firm.knowledgeCapacitySlotsToday;
    firm.knowledgeEffectUsedToday = Math.min(availableEffect, usedUnits);
    const record = firm.knowledgeEffectHistory.find((entry) => entry.day === this.day);
    if (record) record.usedUnits = firm.knowledgeEffectUsedToday;
    return firm.knowledgeEffectUsedToday;
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
    this.markKnowledgeEffectUsed(firm, Math.max(0, firm.transactionsToday - this.scalarTransactionCapacity(firm)));
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
        for (let unit = 0; unit < batch.quantity; unit += 1) {
          const food = {
            mealId: ++this.foodItemSequence,
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
            custody: [],
            consumedDay: null,
            spoiledDay: null,
          };
          this.foodItems[food.mealId] = food;
          person.foodStock.push(food);
        }
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
    food.consumedDay = this.day;
    food.ownerKind = null;
    food.ownerId = null;
    food.ownerName = null;
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
      const scalarProduced = firm.employees.reduce((sum, id) => sum + this.directScalarOutput(this.people[id], firm), 0);
      const produced = scalarProduced + (this.knowledgeEnabled && firm.knowledge.effectType === "direct-yield" ? firm.knowledgeEffectGrossToday : 0);
      this.addFirmInventory(firm, produced);
      if (this.isPerishable(firm.sells)) firm.perishableProcessedToday += produced;
    });
    if (this.schedulesEnabled) [...this.people].sort((a, b) => Number(b.isDependent) - Number(a.isDependent) || a.id - b.id).forEach((person) => {
      if (!person.alive || person.attended || person.dailyPlan?.day !== this.day) return;
      const activity = person.dailyPlan.workday;
      if (activity.status !== "planned") return;
      let result = { completed: true };
      if (activity.activity === "clinic") result = this.executePlannedClinic(person, this.firms[activity.firmId]);
      else if (activity.activity === "dependent-clinic") {
        const dependent = this.people[activity.dependentId];
        result = activity.guardianId === null && person.id === activity.dependentId
          ? this.executeDependentHealthCare(dependent, this.government, this.firms[activity.firmId], "clinic")
          : person.id === activity.guardianId
            ? this.executeDependentHealthCare(dependent, person, this.firms[activity.firmId], "clinic")
          : { completed: false, failure: "guardian was unavailable for the shared clinic visit" };
        if (dependent?.dailyPlan?.day === this.day) {
          dependent.dailyPlan.workday.status = result.completed ? "completed" : "failed";
          dependent.dailyPlan.workday.failureReason = result.failure ?? null;
          dependent.currentPrimaryActivity = { day: this.day, block: "Workday", action: "dependent-clinic", firmId: activity.firmId };
        }
      }
      else if (activity.activity === "school") result = this.executePlannedSchool(person, this.firms[activity.firmId]);
      else if (activity.activity === "dependent-school") result = this.executeDependentSchooling(person, activity);
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
    const scalarCapacity = Math.floor(attendingWorkers * this.transportCapacityPerWorker() * carrier.operationalReadiness * this.scheduledShiftCapacityMultiplier());
    const knowledgeCapacity = this.knowledgeEnabled && carrier.knowledge.effectType === "haulage-capacity"
      ? carrier.knowledgeCapacitySlotsToday
      : 0;
    return scalarCapacity + knowledgeCapacity;
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
      this.markKnowledgeEffectUsed(firm, Math.max(0, firm.processedToday - firm.processingScalarCapacityToday));
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
      carrier.transportScalarCapacityToday = Math.max(0, remainingTransportCapacity - carrier.knowledgeCapacitySlotsToday);
      carrier.transportLoadToday = 0;
    }
    this.firms.forEach((firm) => {
      if (!firm.processingPerWorker) return;
      const attendingWorkers = firm.employees.filter((id) => this.people[id]?.alive && this.people[id].attended).length;
      firm.processingScalarCapacityToday = firm.active
        ? Math.floor(attendingWorkers * firm.processingPerWorker * firm.operationalReadiness * this.scheduledShiftCapacityMultiplier())
        : 0;
      firm.processingCapacityToday = firm.processingScalarCapacityToday
        + (this.knowledgeEnabled && firm.knowledge.effectType === "processing-capacity" ? firm.knowledgeCapacitySlotsToday : 0);
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
            this.markKnowledgeEffectUsed(carrier, Math.max(0, carrier.transportLoadToday - carrier.transportScalarCapacityToday));
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

  dependentCareRunway(guardian) {
    const cheapestMeal = this.firms.filter((firm) => firm.active && firm.sector === "food").reduce((price, firm) => Math.min(price, firm.price), this.essentialCost());
    const allocatedCareCost = this.people.filter((dependent) => dependent.alive && dependent.isDependent && dependent.guardianIds.includes(guardian.id))
      .reduce((total, dependent) => {
        const share = dependent.guardianIds.filter((id) => this.people[id]?.alive).length > 1 ? 0.5 : 1;
        return total + share * Math.max(0, cheapestMeal - dependent.restrictedInheritance);
      }, 0);
    return guardian.cash / Math.max(0.01, this.essentialCost() + allocatedCareCost);
  }

  transferGuardianMeal(guardian, dependent, mealId) {
    const index = guardian.foodStock.findIndex((meal) => meal.mealId === mealId && this.foodExpiryDay(meal) > this.day);
    if (index < 0) return false;
    const [meal] = guardian.foodStock.splice(index, 1);
    const sequence = ++this.mutualAidTransferSequence;
    meal.custody = [...(meal.custody ?? []), Object.freeze({
      offerId: `dependent-care:${this.day}:${guardian.id}:${dependent.id}:${sequence}`,
      day: this.day,
      ...temporalMetadata(this.day, "Food shopping"),
      phase: "Food shopping",
      sequence,
      giverId: guardian.id,
      giverName: guardian.name,
      recipientId: dependent.id,
      recipientName: dependent.name,
      reason: "dependent care",
    })];
    meal.ownerKind = dependent.kind;
    meal.ownerId = dependent.id;
    meal.ownerName = dependent.name;
    dependent.foodStock.push(meal);
    this.note(guardian, `provided a stored meal to ${dependent.name}`, "good");
    this.note(dependent, `${guardian.name} provided a stored meal`, "good");
    return true;
  }

  buyDependentFoodFromRestrictedBalance(dependent, firm) {
    this.reconcileInventoryBatches(firm);
    const price = roundMoney(firm.price);
    if (!dependent.alive || !dependent.isDependent || dependent.restrictedInheritance + 1e-9 < price || firm.inventory < 1) return false;
    if (!this.requestTransaction(firm, dependent, "food")) return false;
    const inventoryTaken = this.takeFirmInventory(firm, 1);
    if (!inventoryTaken.length) throw new Error("Inventory changed during exact restricted dependent purchase");
    const before = dependent.restrictedInheritance;
    const providerBefore = firm.cash;
    dependent.restrictedInheritance = roundMoney(dependent.restrictedInheritance - price);
    firm.cash = roundMoney(firm.cash + price);
    firm.sales = roundMoney(firm.sales + price);
    firm.unitsSold += 1;
    firm.perishableSalesToday += 1;
    const transactionId = `dependent-care:${this.day}:${dependent.id}:${dependent.activitySequence + 1}`;
    this.flows.push({ from: { kind: dependent.kind, id: dependent.id }, to: { kind: firm.kind, id: firm.id }, amount: price, phase: this.phase, ...temporalMetadata(this.day, this.phase) });
    this.flows = this.flows.slice(-40);
    this.ledger(dependent, { direction: "out", amount: price, text: `restricted care funds bought 1 food portion from ${firm.name}`, before, transactionId });
    dependent.ledger[0].after = dependent.restrictedInheritance;
    this.ledger(firm, { direction: "in", amount: price, text: `dependent food purchase for ${dependent.name}`, before: providerBefore, transactionId });
    inventoryTaken.forEach((batch) => {
      const food = {
        mealId: ++this.foodItemSequence,
        product: firm.sells,
        processedDay: batch.batchDay,
        purchasedDay: this.day,
        quality: batch.qualityBasis ?? firm.quality,
        qualityAtPurchase: this.effectiveFoodQuality({ quality: batch.qualityBasis ?? firm.quality, processedDay: batch.batchDay }),
        shelfLife: batch.shelfLife,
        seller: firm.id,
        ownerKind: dependent.kind,
        ownerId: dependent.id,
        ownerName: dependent.name,
        custody: [],
        consumedDay: null,
        spoiledDay: null,
      };
      this.foodItems[food.mealId] = food;
      dependent.foodStock.push(food);
    });
    return true;
  }

  guardianFoodOptions(guardian, dependent, foodFirms) {
    const pantry = guardian.foodStock.filter((meal) => this.foodExpiryDay(meal) > this.day).map((meal) => {
      const age = Math.max(0, this.day - (meal.processedDay ?? meal.purchasedDay));
      return Object.freeze({
        action: `transfer-dependent-meal:${meal.mealId}`,
        source: "pantry",
        mealId: meal.mealId,
        mealQuality: this.effectiveFoodQuality(meal),
        spoilagePressure: clamp(age / Math.max(1, meal.shelfLife ?? 3)),
        reserveCoverage: clamp(guardian.foodStock.length / Math.max(1, guardian.foodReserveTarget)),
        costPressure: 0,
        capacityAvailable: true,
      });
    });
    const sellers = foodFirms.filter((firm) => firm.inventory >= 1 && (
      dependent.restrictedInheritance + 1e-9 >= firm.price
      || guardian.cash + 1e-9 >= firm.price
      || (this.directWelfareEnabled() && firm.sells === "budgetFood")
    )).map((firm) => {
      const batch = this.peekFirmInventory(firm, 1)[0];
      return Object.freeze({
        action: `buy-dependent-food:${firm.id}`,
        source: "seller",
        sellerId: firm.id,
        mealQuality: this.effectiveFoodQuality({ quality: batch?.qualityBasis ?? firm.quality, processedDay: batch?.batchDay ?? this.day }),
        spoilagePressure: 0,
        reserveCoverage: clamp((dependent.foodStock.length + 1) / Math.max(1, dependent.foodReserveTarget)),
        costPressure: clamp(firm.price / Math.max(firm.price, guardian.cash)),
        capacityAvailable: firm.transactionsToday < this.transactionCapacity(firm),
      });
    });
    return [...pantry, ...sellers];
  }

  considerGuardianFood(guardian, dependent, foodFirms) {
    const options = this.guardianFoodOptions(guardian, dependent, foodFirms);
    const dependentNeed = 0.6 * clamp((dependent.hungryDays + 1) / 2) + 0.4 * (1 - dependent.health);
    const guardianSelfNeed = 0.6 * clamp(guardian.hungryDays / 2) + 0.4 * (1 - guardian.health);
    const careScarcity = clamp(1 - this.dependentCareRunway(guardian) / 12);
    const legalActions = Object.freeze(["defer-dependent-food", ...options.map((option) => option.action)]);
    const observation = Object.freeze({
      kind: "dependent-food-care",
      citizenId: guardian.id,
      citizenName: guardian.name,
      dependentId: dependent.id,
      dependentName: dependent.name,
      stress: guardian.stress,
      dependentNeed,
      guardianSelfNeed,
      careScarcity,
      profile: { ...guardian.motivationProfile },
      options,
    });
    const decision = this.citizenPolicy.decide({ observation, legalActions, random: this.random });
    if (!decision || !legalActions.includes(decision.action)) throw new Error(`Citizen policy ${this.citizenPolicy.id ?? "unknown"} chose an illegal dependent-care action`);
    this.recordDecision(guardian, observation, legalActions, decision, "Food shopping");
    const option = options.find((candidate) => candidate.action === decision.action);
    if (!option) return false;
    if (option.source === "pantry") return this.transferGuardianMeal(guardian, dependent, option.mealId);
    const provider = this.firms[option.sellerId];
    if (dependent.restrictedInheritance + 1e-9 >= provider.price) return this.buyDependentFoodFromRestrictedBalance(dependent, provider);
    if (guardian.cash + 1e-9 >= provider.price) {
      const beforeCount = guardian.foodStock.length;
      if (!this.buy(guardian, provider, 1, "food")) return false;
      const meal = guardian.foodStock.splice(beforeCount, 1)[0];
      if (!meal) throw new Error("Guardian food purchase did not create the dependent meal");
      dependent.foodStock.push(meal);
      meal.ownerKind = dependent.kind;
      meal.ownerId = dependent.id;
      meal.ownerName = dependent.name;
      this.note(dependent, `${guardian.name} bought a meal from ${provider.name}`, "good");
      return true;
    }
    const urgency = clamp(dependentNeed);
    const welfare = this.assessWelfareOffer({ programme: "food", recipient: dependent, decisionMaker: guardian, privatePayer: guardian, provider, purpose: "food", urgency });
    if (!welfare.accepted) return false;
    return this.settleDirectAssistance({ programme: "food", recipient: dependent, decisionMaker: guardian, privatePayer: guardian, provider, purpose: "food", welfareId: welfare.welfareId }).completed;
  }

  considerDependentFood(dependent, foodFirms) {
    if (!dependent.alive || !dependent.isDependent) return false;
    if (dependent.foodStock.length) {
      const meal = dependent.foodStock.shift();
      this.consumeFood(dependent, meal);
      return true;
    }
    const guardians = this.reconcileDependentCare(dependent).sort((a, b) => (
      Number(b.id === dependent.residentialGuardianId) - Number(a.id === dependent.residentialGuardianId) || a.id - b.id
    ));
    for (const guardian of guardians) {
      if (this.considerGuardianFood(guardian, dependent, foodFirms) && dependent.foodStock.length) {
        this.consumeFood(dependent, dependent.foodStock.shift());
        return true;
      }
    }
    if (!guardians.length) {
      const provider = foodFirms.find((firm) => firm.sells === "budgetFood" && !this.directAssistanceProviderFailure(dependent, firm, "food"));
      if (provider) {
        if (dependent.restrictedInheritance + 1e-9 >= provider.price && this.buyDependentFoodFromRestrictedBalance(dependent, provider)) {
          this.consumeFood(dependent, dependent.foodStock.shift());
          return true;
        }
        if (this.directWelfareEnabled()) {
          const delivered = this.settleDirectAssistance({ programme: "food", recipient: dependent, decisionMaker: this.government, privatePayer: dependent, provider, purpose: "food" });
          if (delivered.completed) {
            this.consumeFood(dependent, dependent.foodStock.shift());
            return true;
          }
        }
      }
    }
    dependent.hungryDays += 1;
    dependent.health = clamp(dependent.health - 0.045);
    if (dependent.hungryDays === 2) this.note(dependent, "missed food for two days", "bad");
    return false;
  }

  guardianHealthOptions(guardian, dependent) {
    const availableFunds = roundMoney(dependent.restrictedInheritance + guardian.cash);
    const publicFallback = this.directWelfareEnabled();
    const options = [];
    const apothecary = this.firms.find((firm) => firm.active && firm.archetypeId === "apothecary");
    const clinic = this.firms.find((firm) => firm.active && firm.archetypeId === "clinic");
    if (dependent.health < HEALTH_TREATMENT_THRESHOLD && this.firmServiceAvailable(apothecary, "Evening")) {
      if (availableFunds + 1e-9 >= apothecary.price || publicFallback) options.push(Object.freeze({
        action: `buy-dependent-medicine:${apothecary.id}`,
        source: "medicine",
        firmId: apothecary.id,
        expectedRecovery: HEALTH_TREATMENT_RECOVERY,
        costPressure: clamp(apothecary.price / Math.max(apothecary.price, availableFunds)),
        capacityAvailable: apothecary.inventory >= 1 && apothecary.transactionsToday < this.transactionCapacity(apothecary),
      }));
      else apothecary.priceRejectionsToday += 1;
    }
    const guardianCommittedToClinic = guardian.dailyPlan?.day === this.day && guardian.dailyPlan.workday?.activity === "dependent-clinic";
    if (!guardianCommittedToClinic && dependent.health < CLINIC_TREATMENT_THRESHOLD && this.firmServiceAvailable(clinic, "Workday")) {
      if (availableFunds + 1e-9 >= clinic.price || publicFallback) options.push(Object.freeze({
        action: `buy-dependent-clinic:${clinic.id}`,
        source: "clinic",
        firmId: clinic.id,
        expectedRecovery: CLINIC_TREATMENT_RECOVERY,
        costPressure: clamp(clinic.price / Math.max(clinic.price, availableFunds)),
        capacityAvailable: clinic.inventory >= 1 && clinic.transactionsToday < this.transactionCapacity(clinic),
      }));
      else clinic.priceRejectionsToday += 1;
    }
    return options;
  }

  planGuardianHealthCare(guardian, dependent) {
    const options = this.guardianHealthOptions(guardian, dependent);
    const employer = guardian.employer >= 0 ? this.firms[guardian.employer] : null;
    const scheduled = guardian.dailyPlan?.day === this.day && guardian.dailyPlan.workday?.activity === "shift";
    const wage = scheduled && employer ? this.scheduledShiftWage(employer) : 0;
    const observation = Object.freeze({
      kind: "dependent-health-care",
      citizenId: guardian.id,
      citizenName: guardian.name,
      dependentId: dependent.id,
      dependentName: dependent.name,
      stress: guardian.stress,
      healthNeed: clamp((1 - dependent.health) + dependent.hungryDays * 0.15),
      careScarcity: clamp(1 - this.dependentCareRunway(guardian) / 12),
      lostWagePressure: scheduled ? wage / Math.max(1, guardian.cash + wage) : 0,
      profile: { ...guardian.motivationProfile },
      options,
    });
    const legalActions = Object.freeze(["defer-dependent-health", ...options.map((option) => option.action)]);
    const decision = this.citizenPolicy.decide({ observation, legalActions, random: this.random });
    if (!decision || !legalActions.includes(decision.action)) throw new Error(`Citizen policy ${this.citizenPolicy.id ?? "unknown"} chose an illegal dependent-health action`);
    this.recordDecision(guardian, observation, legalActions, decision, "Planning");
    const option = options.find((candidate) => candidate.action === decision.action);
    if (!option) return false;
    dependent.dependentHealthPlan = { day: this.day, guardianId: guardian.id, firmId: option.firmId, source: option.source, status: "planned", failureReason: null };
    if (option.source === "clinic") {
      const activity = { action: option.action, activity: "dependent-clinic", guardianId: guardian.id, dependentId: dependent.id, firmId: option.firmId, firmName: this.firms[option.firmId].name, status: "planned", failureReason: null };
      guardian.dailyPlan = { day: this.day, workday: activity };
      dependent.dailyPlan = { day: this.day, workday: { ...activity } };
    }
    return true;
  }

  planDependentHealthCare(dependent) {
    dependent.dependentHealthPlan = null;
    if (!dependent.alive || !dependent.isDependent || dependent.health >= HEALTH_TREATMENT_THRESHOLD) return false;
    const guardians = this.reconcileDependentCare(dependent).sort((a, b) => (
      Number(b.id === dependent.residentialGuardianId) - Number(a.id === dependent.residentialGuardianId) || a.id - b.id
    ));
    if (guardians.some((guardian) => this.planGuardianHealthCare(guardian, dependent))) return true;
    return guardians.length ? false : this.planTreasuryDependentHealthCare(dependent);
  }

  planTreasuryDependentHealthCare(dependent) {
    const canFund = (firm) => firm && (dependent.restrictedInheritance + 1e-9 >= firm.price || this.directWelfareEnabled());
    const clinic = this.firms.find((firm) => firm.active && firm.archetypeId === "clinic");
    const apothecary = this.firms.find((firm) => firm.active && firm.archetypeId === "apothecary");
    const source = dependent.health < CLINIC_TREATMENT_THRESHOLD && this.firmServiceAvailable(clinic, "Workday") && canFund(clinic)
      ? "clinic"
      : this.firmServiceAvailable(apothecary, "Evening") && canFund(apothecary) ? "medicine" : null;
    if (!source) return false;
    const firm = source === "clinic" ? clinic : apothecary;
    dependent.dependentHealthPlan = { day: this.day, guardianId: null, firmId: firm.id, source, status: "planned", failureReason: null };
    if (source === "clinic") dependent.dailyPlan = { day: this.day, workday: {
      action: `buy-dependent-clinic:${firm.id}`,
      activity: "dependent-clinic",
      guardianId: null,
      dependentId: dependent.id,
      firmId: firm.id,
      firmName: firm.name,
      status: "planned",
      failureReason: null,
    } };
    this.note(dependent, `treasury guardianship planned ${source} care at ${firm.name}`, "neutral");
    return true;
  }

  buyDependentHealthCare(dependent, guardian, firm, source) {
    this.reconcileInventoryBatches(firm);
    const price = roundMoney(firm?.price ?? 0);
    const restrictedContribution = roundMoney(Math.min(dependent.restrictedInheritance, price));
    const guardianContribution = roundMoney(price - restrictedContribution);
    const window = source === "clinic" ? "Workday" : "Evening";
    if (!dependent.alive || !dependent.isDependent || (!guardian?.alive && guardian?.kind !== "government") || !firm?.active || firm.inventory < 1
      || !this.firmServiceAvailable(firm, window) || guardian.cash + 1e-9 < guardianContribution
      || firm.transactionsToday >= this.transactionCapacity(firm)) return false;
    if (!this.requestTransaction(firm, dependent, source === "clinic" ? "dependent clinical care" : "dependent medicine")) return false;
    const transactionBase = `dependent-health:${this.day}:${dependent.id}:${dependent.decisionSequence + 1}`;
    if (restrictedContribution > 0) {
      const before = dependent.restrictedInheritance;
      const providerBefore = firm.cash;
      dependent.restrictedInheritance = roundMoney(before - restrictedContribution);
      firm.cash = roundMoney(firm.cash + restrictedContribution);
      this.flows.push({ from: { kind: dependent.kind, id: dependent.id }, to: { kind: firm.kind, id: firm.id }, amount: restrictedContribution, phase: this.phase, ...temporalMetadata(this.day, this.phase) });
      this.flows = this.flows.slice(-40);
      this.ledger(dependent, { direction: "out", amount: restrictedContribution, text: `restricted care funds paid ${firm.name} for ${source}`, before, transactionId: `${transactionBase}:restricted` });
      dependent.ledger[0].after = dependent.restrictedInheritance;
      this.ledger(firm, { direction: "in", amount: restrictedContribution, text: `restricted care payment for ${dependent.name}`, before: providerBefore, transactionId: `${transactionBase}:restricted` });
    }
    if (guardianContribution > 0) {
      const before = guardian.cash;
      const providerBefore = firm.cash;
      const paid = this.transfer(guardian, firm, guardianContribution, { exact: true });
      if (paid !== guardianContribution) throw new Error("Atomic guardian health contribution failed");
      this.ledger(guardian, { direction: "out", amount: paid, text: `paid ${firm.name} for ${dependent.name}'s ${source}`, before, transactionId: `${transactionBase}:guardian` });
      this.ledger(firm, { direction: "in", amount: paid, text: `guardian payment from ${guardian.name} for ${dependent.name}`, before: providerBefore, transactionId: `${transactionBase}:guardian` });
    }
    const inventoryTaken = this.takeFirmInventory(firm, 1);
    if (!inventoryTaken.length) throw new Error("Inventory changed during atomic dependent health purchase");
    firm.sales = roundMoney(firm.sales + price);
    firm.unitsSold += 1;
    return true;
  }

  settleDependentHealthPayment(dependent, guardian, firm, source) {
    const completePrivateFunds = roundMoney(dependent.restrictedInheritance + (guardian.kind === "person" ? guardian.cash : 0));
    if (completePrivateFunds + 1e-9 >= firm.price) return this.buyDependentHealthCare(dependent, guardian, firm, source);
    if (!this.directWelfareEnabled()) return false;
    return this.settleDirectAssistance({
      programme: "childHealth",
      recipient: dependent,
      decisionMaker: guardian,
      privatePayer: guardian.kind === "person" ? guardian : dependent,
      provider: firm,
      purpose: source === "clinic" ? "clinical care" : "medicine",
    }).completed;
  }

  executeDependentHealthCare(dependent, guardian, firm, source) {
    const plan = dependent.dependentHealthPlan;
    if (!plan || plan.day !== this.day || plan.status !== "planned" || plan.source !== source) return { completed: false, failure: "dependent care was not planned" };
    if (!this.settleDependentHealthPayment(dependent, guardian, firm, source)) {
      plan.status = "failed";
      plan.failureReason = "provider, capacity, stock, or exact funding was unavailable";
      this.note(dependent, `planned ${source} care failed because ${plan.failureReason}`, "bad");
      return { completed: false, failure: plan.failureReason };
    }
    const beforeHealth = dependent.health;
    if (source === "clinic") {
      dependent.clinicalSeller = firm.id;
      dependent.lastClinicalDay = this.day;
      dependent.health = clamp(dependent.health + CLINIC_TREATMENT_RECOVERY, 0.08, 0.96);
    } else {
      dependent.healthSeller = firm.id;
      dependent.lastTreatmentDay = this.day;
      dependent.health = clamp(dependent.health + HEALTH_TREATMENT_RECOVERY, 0.08, 0.92);
    }
    plan.status = "completed";
    this.note(dependent, `${guardian.name} arranged ${source} care that raised health from ${Math.round(beforeHealth * 100)}% to ${Math.round(dependent.health * 100)}%`, "good");
    return { completed: true };
  }

  foodPhase() {
    this.beginWelfareEnvelope();
    if (this.cooperationMode === "mutual-aid") this.runMutualAidExchange();
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
      if (person.isDependent) this.considerDependentFood(person, foodFirms);
      else this.considerFood(person, foodFirms);
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

  foodExpiryDay(food) {
    return (food.processedDay ?? food.purchasedDay) + (food.shelfLife ?? 3);
  }

  foodReserveRemainsViable(person, stock) {
    const protectedReserve = this.foodReserveTargetForDay(person);
    if (stock.length < protectedReserve) return false;
    const expiryDays = stock.map((meal) => this.foodExpiryDay(meal)).sort((a, b) => a - b);
    let searchFrom = 0;
    for (let offset = 0; offset < protectedReserve; offset += 1) {
      const intendedDay = this.day + offset;
      while (searchFrom < expiryDays.length && expiryDays[searchFrom] <= intendedDay) searchFrom += 1;
      if (searchFrom >= expiryDays.length) return false;
      searchFrom += 1;
    }
    return true;
  }

  closeFriendshipStrength(a, b) {
    const forward = a.relationships[b.id]?.strength;
    const reciprocal = b.relationships[a.id]?.strength;
    if (forward === undefined || reciprocal === undefined) return 0;
    const strength = Math.min(forward, reciprocal);
    return strength + 1e-9 >= CLOSE_FRIENDSHIP_THRESHOLD ? strength : 0;
  }

  mutualAidRecipientNeed(snapshot) {
    const scarcity = clamp(1 - snapshot.runwayDays / 12);
    const pantryFill = clamp(snapshot.viableMealCount / FOOD_PANTRY_CAPACITY);
    return clamp(
      0.45 * clamp(snapshot.hungryDays / 2)
      + 0.25 * (1 - pantryFill)
      + 0.2 * scarcity
      + 0.1 * (snapshot.housed ? 0 : 1),
    );
  }

  runMutualAidExchange() {
    const living = this.people.filter((person) => person.alive && !person.isDependent).sort((a, b) => a.id - b.id);
    const snapshots = new Map(living.map((person) => [person.id, Object.freeze({
      personId: person.id,
      alive: person.alive,
      hungryDays: person.hungryDays,
      housed: person.housed,
      runwayDays: this.runwayDays(person),
      viableMealCount: person.foodStock.length,
      pantryCapacity: FOOD_PANTRY_CAPACITY,
      stress: person.stress,
      foodStock: Object.freeze(person.foodStock.map((meal) => Object.freeze({ ...meal, custody: Object.freeze([...(meal.custody ?? [])]) }))),
    })]));
    const offered = [];

    living.forEach((giver) => {
      const giverSnapshot = snapshots.get(giver.id);
      const protectedReserve = this.foodReserveTargetForDay(giver);
      const friends = living.map((recipient) => ({
        recipient,
        strength: recipient.id === giver.id ? 0 : this.closeFriendshipStrength(giver, recipient),
      })).filter(({ recipient, strength }) => strength && snapshots.get(recipient.id).viableMealCount < FOOD_PANTRY_CAPACITY);
      const options = [];
      giverSnapshot.foodStock.forEach((meal) => {
        if (this.foodExpiryDay(meal) <= this.day) return;
        const remaining = giverSnapshot.foodStock.filter((candidate) => candidate.mealId !== meal.mealId);
        if (!this.foodReserveRemainsViable(giver, remaining)) return;
        const reserveHeadroom = clamp(remaining.length / Math.max(1, protectedReserve) - 1);
        const age = Math.max(0, this.day - (meal.processedDay ?? meal.purchasedDay));
        const spoilagePressure = clamp(age / Math.max(1, meal.shelfLife ?? 3));
        friends.forEach(({ recipient, strength }) => {
          const offerId = ++this.mutualAidOfferSequence;
          options.push(Object.freeze({
            action: `offer-meal:${offerId}`,
            offerId,
            mealId: meal.mealId,
            recipientId: recipient.id,
            recipientName: recipient.name,
            relationshipStrength: strength,
            recipientNeed: this.mutualAidRecipientNeed(snapshots.get(recipient.id)),
            reserveHeadroom,
            spoilagePressure,
          }));
        });
      });
      if (!options.length) return;
      const legalActions = Object.freeze(["keep-meals", ...options.map((option) => option.action)]);
      const observation = Object.freeze({
        kind: "mutual-aid-offer",
        citizenId: giver.id,
        citizenName: giver.name,
        stress: giverSnapshot.stress,
        runwayDays: giverSnapshot.runwayDays,
        protectedReserve,
        profile: { ...giver.motivationProfile },
        options,
      });
      const decision = this.citizenPolicy.decide({ observation, legalActions, random: this.random });
      if (!decision || !legalActions.includes(decision.action)) throw new Error(`Citizen policy ${this.citizenPolicy.id ?? "unknown"} chose an illegal mutual-aid offer action`);
      const decisionRecord = this.recordDecision(giver, observation, legalActions, decision, "Food shopping");
      const option = options.find((candidate) => candidate.action === decision.action);
      if (option) offered.push(Object.freeze({ ...option, giverId: giver.id, giverName: giver.name, giverDecisionSequence: decisionRecord.sequence }));
    });

    const accepted = [];
    const offersByRecipient = offered.reduce((groups, offer) => {
      const group = groups.get(offer.recipientId) ?? [];
      group.push(offer);
      groups.set(offer.recipientId, group);
      return groups;
    }, new Map());
    [...offersByRecipient.entries()].sort(([left], [right]) => left - right).forEach(([recipientId, offers]) => {
      const recipient = this.people[recipientId];
      const recipientSnapshot = snapshots.get(recipientId);
      const options = offers.sort((a, b) => a.offerId - b.offerId).map((offer) => {
        const meal = snapshots.get(offer.giverId).foodStock.find((candidate) => candidate.mealId === offer.mealId);
        const age = Math.max(0, this.day - (meal.processedDay ?? meal.purchasedDay));
        const shelfLife = Math.max(1, meal.shelfLife ?? 3);
        return Object.freeze({
          action: `accept-meal:${offer.offerId}`,
          offerId: offer.offerId,
          mealId: offer.mealId,
          giverId: offer.giverId,
          giverName: offer.giverName,
          relationshipStrength: offer.relationshipStrength,
          recipientNeed: offer.recipientNeed,
          mealQuality: this.effectiveFoodQuality(meal),
          remainingLifeFraction: clamp((shelfLife - age) / shelfLife),
        });
      });
      const legalActions = Object.freeze(["refuse-all-meal-gifts", ...options.map((option) => option.action)]);
      const observation = Object.freeze({
        kind: "mutual-aid-receive",
        citizenId: recipient.id,
        citizenName: recipient.name,
        stress: recipientSnapshot.stress,
        pantryFill: clamp(recipientSnapshot.viableMealCount / FOOD_PANTRY_CAPACITY),
        profile: { ...recipient.motivationProfile },
        options,
      });
      const decision = this.citizenPolicy.decide({ observation, legalActions, random: this.random });
      if (!decision || !legalActions.includes(decision.action)) throw new Error(`Citizen policy ${this.citizenPolicy.id ?? "unknown"} chose an illegal mutual-aid response action`);
      const decisionRecord = this.recordDecision(recipient, observation, legalActions, decision, "Food shopping");
      const option = options.find((candidate) => candidate.action === decision.action);
      if (option) accepted.push({ offer: offers.find((candidate) => candidate.offerId === option.offerId), recipientDecision: decisionRecord });
    });

    const usedGivers = new Set();
    const usedRecipients = new Set();
    accepted.sort((left, right) => left.offer.offerId - right.offer.offerId).forEach(({ offer, recipientDecision }) => {
      const giver = this.people[offer.giverId];
      const recipient = this.people[offer.recipientId];
      const mealIndex = giver?.foodStock.findIndex((meal) => meal.mealId === offer.mealId) ?? -1;
      const remaining = mealIndex >= 0 ? giver.foodStock.filter((_, index) => index !== mealIndex) : [];
      const failure = !giver?.alive || !recipient?.alive
        ? "giver or recipient was no longer living"
        : usedGivers.has(giver.id) || usedRecipients.has(recipient.id)
          ? "daily giver or recipient limit was already used"
          : !this.closeFriendshipStrength(giver, recipient)
            ? "the reciprocal close friendship no longer qualified"
            : mealIndex < 0
              ? "the exact offered meal was no longer owned by the giver"
              : !this.foodReserveRemainsViable(giver, remaining)
                ? "the giver's closure-aware protected reserve no longer remained viable"
                : recipient.foodStock.length >= FOOD_PANTRY_CAPACITY
                  ? "the recipient pantry no longer had room"
                  : this.foodExpiryDay(giver.foodStock[mealIndex]) <= this.day
                    ? "the offered meal was no longer unexpired"
                    : null;
      recipientDecision.application = Object.freeze({ offerId: offer.offerId, applied: !failure, failure });
      const giverDecision = giver?.decisions.find((decision) => decision.sequence === offer.giverDecisionSequence);
      if (giverDecision) giverDecision.application = Object.freeze({ offerId: offer.offerId, applied: !failure, failure });
      if (failure) return;

      const giverPantryBefore = giver.foodStock.length;
      const recipientPantryBefore = recipient.foodStock.length;
      const [meal] = giver.foodStock.splice(mealIndex, 1);
      const transferSequence = ++this.mutualAidTransferSequence;
      const custody = Object.freeze({
        offerId: offer.offerId,
        day: this.day,
        ...temporalMetadata(this.day, "Food shopping"),
        phase: "Food shopping",
        sequence: transferSequence,
        giverId: giver.id,
        giverName: giver.name,
        recipientId: recipient.id,
        recipientName: recipient.name,
      });
      meal.custody = [...(meal.custody ?? []), custody];
      meal.ownerKind = recipient.kind;
      meal.ownerId = recipient.id;
      meal.ownerName = recipient.name;
      recipient.foodStock.push(meal);
      usedGivers.add(giver.id);
      usedRecipients.add(recipient.id);
      const shared = {
        offerId: offer.offerId,
        mealId: meal.mealId,
        giverId: giver.id,
        giverName: giver.name,
        recipientId: recipient.id,
        recipientName: recipient.name,
        sellerId: meal.seller,
        sellerName: this.firms[meal.seller]?.name ?? "unknown seller",
        quality: this.effectiveFoodQuality(meal),
        age: Math.max(0, this.day - (meal.processedDay ?? meal.purchasedDay)),
        custody,
      };
      giver.activitySequence += 1;
      recipient.activitySequence += 1;
      giver.mutualAidHistory.unshift(Object.freeze({ day: this.day, ...temporalMetadata(this.day, "Food shopping"), sequence: giver.activitySequence, direction: "out", pantryBefore: giverPantryBefore, pantryAfter: giver.foodStock.length, ...shared }));
      recipient.mutualAidHistory.unshift(Object.freeze({ day: this.day, ...temporalMetadata(this.day, "Food shopping"), sequence: recipient.activitySequence, direction: "in", pantryBefore: recipientPantryBefore, pantryAfter: recipient.foodStock.length, ...shared }));
    });
  }

  foodAccessOrder() {
    const populationSize = this.people.length;
    const rotation = this.directWelfareEnabled() ? Math.floor((this.day - 1) / 7) : this.day;
    const rotatingRank = (person) => (person.id - rotation + populationSize) % populationSize;
    return this.people.filter((person) => person.alive).sort((a, b) => (
      b.hungryDays - a.hungryDays
      || a.health - b.health
      || (this.directWelfareEnabled() ? this.runwayDays(a) - this.runwayDays(b) : 0)
      || rotatingRank(a) - rotatingRank(b)
    ));
  }

  considerFood(person, foodFirms) {
    if (!person.alive || person.isDependent) return false;
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
    let welfareAssessment = null;
    if (this.directWelfareEnabled() && !person.foodStock.length) {
      const everydayProviders = this.firms
        .filter((firm) => firm.archetypeId === "everyday-grocer")
        .sort((a, b) => a.price - b.price || a.id - b.id);
      const eligibleProvider = everydayProviders.find((firm) => !this.directAssistanceProviderFailure(person, firm, "food"));
      const provider = eligibleProvider ?? everydayProviders[0] ?? null;
      if (provider && person.cash + 1e-9 < provider.price) {
        const urgency = 0.55 * clamp((person.hungryDays + 1) / 3) + 0.45 * (1 - person.health);
        welfareAssessment = this.assessWelfareOffer({ programme: "food", recipient: person, provider, purpose: "food", urgency });
        if (welfareAssessment.accepted) {
          const settlement = this.settleDirectAssistance({ programme: "food", recipient: person, provider, purpose: "food", welfareId: welfareAssessment.welfareId });
          if (settlement.completed) {
            const meal = person.foodStock.shift();
            if (!meal) throw new Error("Delivered Food Assistance did not create the purchased meal");
            this.consumeFood(person, meal);
            return true;
          }
        }
      }
    }
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
    if (!person.foodStock.length && !options.length && foodFirms.length && !welfareAssessment) {
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
          this.people.filter((person) => person.alive && !person.isDependent && (this.transitionResidenceActive(person) || !person.housed || this.rentDueToday())).forEach((person) => {
            this.note(person, `${provider.name} was closed for housing payments${nextOpening ? `; next opening D${nextOpening}` : ""}`, "neutral");
          });
        }
      }
      return;
    }
    this.housingAccessOrder().forEach((person) => {
      if (!person.alive) return;
      const inTransition = this.transitionResidenceActive(person);
      if (!person.housed) person.rentArrears = 0;
      if (person.housed && !inTransition && !this.rentDueToday()) return;
      this.considerHousing(person, housing);
    });
  }

  housingAccessOrder() {
    if (!this.directWelfareEnabled()) return this.people;
    const populationSize = this.people.length;
    const rotation = Math.floor((this.day - 1) / 7);
    const rotatingRank = (person) => (person.id - rotation + populationSize) % populationSize;
    return this.people.filter((person) => person.alive).sort((a, b) => (
      b.rentArrears - a.rentArrears
      || this.runwayDays(a) - this.runwayDays(b)
      || rotatingRank(a) - rotatingRank(b)
    ));
  }

  considerHousing(person, housing) {
    if (!person.alive || person.isDependent || !housing?.active) return false;
    const inTransition = this.transitionResidenceActive(person);
    const wasHoused = person.housed && !inTransition;
    const due = roundMoney(wasHoused ? housing.price : housing.price * 3);
    const canPay = person.cash + 1e-9 >= due;
    const occupancy = this.housingOccupancy();
    const dwellingAvailable = !this.housingCapacityEnabled || wasHoused || occupancy < housing.dwellingCapacity;
    let welfareAssessment = null;
    if (!canPay && wasHoused && this.directWelfareEnabled()) {
      const urgency = 0.65 * clamp((person.rentArrears + 1) / 3) + 0.35 * clamp(1 - this.runwayDays(person) / 4);
      welfareAssessment = this.assessWelfareOffer({ programme: "rent", recipient: person, provider: housing, purpose: "rent", urgency });
      if (welfareAssessment.accepted) {
        const settlement = this.settleDirectAssistance({ programme: "rent", recipient: person, provider: housing, purpose: "rent", welfareId: welfareAssessment.welfareId });
        if (settlement.completed) return true;
      }
    }
    if (!canPay && !welfareAssessment) housing.priceRejectionsToday += 1;
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
        if (inTransition) {
          person.transitionHostId = null;
          person.transitionResidenceEndDay = null;
          this.recordLifecycle(person, "transition-residence-ended", "secured an independent tenancy", null, "independent housing ended the maturation transition early");
        }
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
      if (person.isDependent && person.dependentHealthPlan?.day === this.day && person.dependentHealthPlan.source === "medicine" && person.dependentHealthPlan.status === "planned") {
        const plan = person.dependentHealthPlan;
        const guardian = plan.guardianId === null ? this.government : this.people[plan.guardianId];
        this.executeDependentHealthCare(person, guardian, this.firms[plan.firmId], "medicine");
      }
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
    if (!person.alive || person.isDependent || person.health >= HEALTH_TREATMENT_THRESHOLD) return false;
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
    if (!person.alive || person.isDependent || person.health >= CLINIC_TREATMENT_THRESHOLD) return false;
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
    if (!person.alive || person.isDependent || person.skill >= EDUCATION_SKILL_THRESHOLD) return false;
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
    const pairs = [];
    if (this.cooperationMode === "legacy") {
      const social = [...visitors].sort(() => this.random() - 0.5);
      for (let index = 0; index + 1 < social.length; index += 2) pairs.push([social[index], social[index + 1]]);
    } else {
      const orderedVisitors = [...visitors].sort((a, b) => a.id - b.id);
      const available = new Set(orderedVisitors.map((person) => person.id));
      const friendEdges = orderedVisitors.flatMap((person, index) => orderedVisitors.slice(index + 1)
        .filter((candidate) => person.relationships[candidate.id] && candidate.relationships[person.id])
        .map((candidate) => ({
          a: person,
          b: candidate,
          strength: Math.min(person.relationships[candidate.id].strength, candidate.relationships[person.id].strength),
        })))
        .sort((left, right) => right.strength - left.strength || left.a.id - right.a.id || left.b.id - right.b.id);
      friendEdges.forEach(({ a, b }) => {
        if (!available.has(a.id) || !available.has(b.id)) return;
        pairs.push([a, b]);
        available.delete(a.id);
        available.delete(b.id);
      });
      const strangers = orderedVisitors.filter((person) => available.has(person.id));
      for (let index = strangers.length - 1; index > 0; index -= 1) {
        const selected = Math.floor(this.random() * (index + 1));
        [strangers[index], strangers[selected]] = [strangers[selected], strangers[index]];
      }
      for (let index = 0; index + 1 < strangers.length; index += 2) pairs.push([strangers[index], strangers[index + 1]]);
    }
    if (venue === "park") this.cooperationMetrics.parkAttendance += visitors.length;
    if (venue === "café") this.cooperationMetrics.cafeAttendance += visitors.length;
    this.cooperationMetrics.contacts += pairs.length;
    pairs.forEach(([a, b]) => {
      const existingFriendship = Boolean(a.relationships[b.id]);
      const previousStrength = existingFriendship ? this.closeFriendshipStrength(a, b) || Math.min(a.relationships[b.id].strength, b.relationships[a.id].strength) : 0;
      const contacted = this.recordSocialContact(a, b);
      if (contacted && !existingFriendship) {
        this.cooperationMetrics.newFriendships += 1;
        this.note(a, `a ${venue} encounter became friendship with ${b.name}`, "good");
        this.note(b, `a ${venue} encounter became friendship with ${a.name}`, "good");
      }
      if (contacted && previousStrength < CLOSE_FRIENDSHIP_THRESHOLD && this.closeFriendshipStrength(a, b)) this.cooperationMetrics.closeFriendshipsReached += 1;
    });
    return pairs.map(([a, b]) => [a.id, b.id]);
  }

  freePersonalActivity(person) {
    const relationships = this.relationshipStats(person);
    const sociallyDisconnected = relationships.count === 0 || this.day - person.lastSocialDay > 3;
    if (["esteem", "growth"].includes(person.focus)) return "self-study";
    const hardshipAllowsPark = this.cooperationMode !== "legacy" || !person.hungryDays;
    if (hardshipAllowsPark && sociallyDisconnected && person.motivationProfile.connection >= person.motivationProfile.security) return "park-social";
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
    if (!person.alive || person.isDependent) return false;
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
    const lateStudyLegal = !person.isDependent
      && person.hungryDays === 0
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
    const decision = person.isDependent
      ? { action: "sleep", reasons: ["Dependents sleep automatically and cannot choose late study."], scores: { sleep: 1 }, policy: "dependent-sleep-v1" }
      : this.citizenPolicy.decide({ observation, legalActions, random: this.random });
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
    this.runLegacyCashSupport();
    this.runEmergencyCashRelief();

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
    const deathCohort = [];
    this.people.forEach((person) => {
      if (!person.alive) return;
      if (person.isDependent) {
        person.criticalHealthDays = person.health <= 0.08 ? person.criticalHealthDays + 1 : 0;
        if (person.criticalHealthDays >= 3) deathCohort.push({ person, reason: "died after health reached a critical level" });
        else this.assessNeeds(person);
        return;
      }
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
        deathCohort.push({ person, reason: "died after health reached a critical level" });
        return;
      }
      this.updateStress(person);
      this.assessNeeds(person);
    });
    this.dieCohort(deathCohort);
    if (this.lifecycleEnabled) this.reconcileAllDependentCare();
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
    this.people.filter((person) => person.alive && !person.isDependent && person.housed && !this.transitionResidenceActive(person))
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
    const housed = this.people.filter((person) => person.alive && !person.isDependent && person.housed && !this.transitionResidenceActive(person)).sort((a, b) => a.id - b.id);
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
    this.resolveGestations();
    this.resolveLifecycleStages();
    this.reconcileAllDependentCare();
    this.reconcileAllTransitionResidences();
    this.runPartnerships();
    this.runBirthAttempts();
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
      this.people.forEach((person) => this.planDependentHealthCare(person));
      this.planAllDependentSchooling();
    }
  }

  isExtinct() {
    return !this.people.some((person) => person.alive);
  }

  foodCustodyChecks() {
    const pantryMeals = this.people.flatMap((person) => person.foodStock.map((meal) => ({ person, meal })));
    const occurrences = pantryMeals.reduce((counts, { meal }) => counts.set(meal.mealId, (counts.get(meal.mealId) ?? 0) + 1), new Map());
    const offerIds = new Set();
    let validChains = true;
    let noExpiredGifts = true;
    Object.values(this.foodItems).forEach((meal) => {
      const custody = meal.custody ?? [];
      custody.forEach((entry, index) => {
        if (offerIds.has(entry.offerId)) validChains = false;
        offerIds.add(entry.offerId);
        if (index && custody[index - 1].recipientId !== entry.giverId) validChains = false;
        if (index && custody[index - 1].sequence >= entry.sequence) validChains = false;
        if (this.foodExpiryDay(meal) <= entry.day) noExpiredGifts = false;
      });
    });
    const ownershipReconciled = Object.values(this.foodItems).every((meal) => {
      const count = occurrences.get(meal.mealId) ?? 0;
      if (meal.consumedDay !== null || meal.spoiledDay !== null) return count === 0;
      const owner = pantryMeals.find((entry) => entry.meal.mealId === meal.mealId)?.person;
      return count === 1 && owner?.id === meal.ownerId;
    });
    return Object.freeze({
      pantryWithinCapacity: this.people.every((person) => person.foodStock.length <= FOOD_PANTRY_CAPACITY),
      validChains,
      noExpiredGifts,
      ownershipReconciled,
    });
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
    if (this.lifecycleEnabled && this.phase !== 7) {
      this.reconcileAllDependentCare();
      this.reconcileAllTransitionResidences();
    }
    this.phase = (this.phase + 1) % PHASES.length;
    this.assertInvariants();
    return this.snapshot();
  }

  assertInvariants() {
    const entities = [...this.people, ...this.firms, this.government];
    if (entities.some((entity) => entity.cash < -1e-9 || !Number.isFinite(entity.cash))) throw new Error("Invalid cash balance");
    if (this.firms.some((firm, id) => firm.id !== id)) throw new Error("Firm entity IDs must remain stable array references");
    if (this.people.some((person, id) => person.id !== id) || this.nextCitizenId !== this.people.length) throw new Error("Citizen entity IDs must remain stable append-only array references");
    if (this.people.some((person) => !LIFECYCLE_STAGES.includes(person.lifecycleStage)
      || person.isDependent !== (person.lifecycleStage !== "adult")
      || (person.birthDay === null) !== (person.ageDays === null)
      || (person.ageDays !== null && lifecycleStageForAge(person.ageDays) !== person.lifecycleStage))) {
      throw new Error("Invalid citizen lifecycle state");
    }
    if (this.people.some((person) => person.partnerId !== null && (this.people[person.partnerId]?.partnerId !== person.id || person.lifecycleStage !== "adult" || !person.alive))) throw new Error("Partnership references must be reciprocal living adults");
    if (new Set(this.gestations.map((gestation) => gestation.id)).size !== this.gestations.length
      || this.gestations.some((gestation) => gestation.parentIds.length !== 2
        || gestation.parentIds[0] === gestation.parentIds[1]
        || gestation.parentIds.some((parentId) => !this.people[parentId])
        || !["active", "completed", "ended"].includes(gestation.status)
        || gestation.dueDay !== gestation.conceivedDay + GESTATION_DAYS)) throw new Error("Invalid gestation state");
    if (this.people.some((person) => person.isDependent && (person.employer >= 0 || person.jobApplicationFirm >= 0 || person.partnerId !== null))) throw new Error("A dependent cannot hold adult economic or romantic roles");
    if (this.people.some((person) => !Number.isFinite(person.restrictedInheritance) || person.restrictedInheritance < -1e-9)) throw new Error("Invalid restricted inheritance balance");
    if (this.people.some((person) => [person.estateTransferred, person.estateDutyPaid, person.inheritanceDistributed]
      .some((amount) => !Number.isFinite(amount) || amount < -1e-9)
      || person.estateDutyPaid + person.inheritanceDistributed > person.estateTransferred + 1e-9
      || (!person.alive && (person.cash > 1e-9 || person.restrictedInheritance > 1e-9)))) throw new Error("Invalid death-estate accounting");
    if (this.people.some((person) => person.alive && person.isDependent && (
      person.guardianIds.some((id) => !this.people[id]?.alive || this.people[id].isDependent)
      || person.treasuryGuardian !== (person.guardianIds.length === 0)
      || (person.residentialGuardianId !== null && !person.guardianIds.includes(person.residentialGuardianId))
      || person.housed !== Boolean(this.people[person.residentialGuardianId]?.housed)
    ))) throw new Error("Invalid dependent guardianship or residence state");
    if (new Set(this.firms.map((firm) => firm.instanceId)).size !== this.firms.length) throw new Error("Firm instance identities must remain unique");
    if (this.people.some((person) => !person.alive && person.employer >= 0)) throw new Error("A dead person cannot remain employed");
    if (this.schedulesEnabled && this.people.some((person) => person.employer >= 0 && (
      person.rota?.firmId !== person.employer
      || person.rota.weekdayIndices.length !== 5
      || person.rota.weekdayIndices.some((weekday) => !this.firms[person.employer].openWeekdays.includes(weekday))
    ))) throw new Error("An employed citizen must have a valid five-shift rota");
    if (this.people.some((person) => person.employer < 0 && person.rota !== null)) throw new Error("An unemployed citizen cannot retain an active rota");
    if (this.people.some((person) => !Number.isFinite(person.sleepDebt) || person.sleepDebt < 0 || person.sleepDebt > 1)) throw new Error("Sleep debt must remain bounded");
    const foodCustody = this.foodCustodyChecks();
    if (this.cooperationMode === "mutual-aid" && Object.values(foodCustody).some((passed) => !passed)) throw new Error("Mutual-aid food custody invariant failed");
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
    if (this.firms.some((firm) => [
      firm.knowledgeEffectGrossToday,
      firm.knowledgeEffectUsedToday,
      firm.knowledgeEffectScalarToday,
    ].some((value) => !Number.isFinite(value) || value < 0)
      || !Number.isInteger(firm.knowledgeEffectSequence)
      || firm.knowledgeEffectSequence < 0
      || firm.knowledgeEffectHistory.some((entry) => !Number.isInteger(entry.day)
        || !Number.isInteger(entry.sequence)
        || entry.sequence <= 0
        || entry.effectType !== firm.knowledge.effectType
        || entry.rule !== firm.knowledge.effectRule
        || [entry.scalarBaseline, entry.grossContribution, entry.releasedUnits, entry.carryBefore, entry.carryAfter, entry.usedUnits]
          .some((value) => !Number.isFinite(value) || value < 0)
        || entry.usedUnits > (entry.effectType === "direct-yield" ? entry.grossContribution : entry.releasedUnits) + 1e-9))) {
      throw new Error("Invalid knowledge effect evidence");
    }
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
    const workforceAdults = this.people.filter((person) => person.alive && !person.isDependent).length;
    const dependents = alive - workforceAdults;
    const lifecycleCounts = Object.fromEntries(LIFECYCLE_STAGES.map((stage) => [stage, this.people.filter((person) => person.alive && person.lifecycleStage === stage).length]));
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
      workforceAdults,
      dependencyRatio: workforceAdults ? dependents / workforceAdults : dependents ? Infinity : 0,
      alive,
      dead,
      totalCitizens: this.people.length,
      lifecycleEnabled: this.lifecycleEnabled,
      birthsEnabled: this.birthsEnabled,
      lifecycleCounts,
      activeGestations: this.gestations.filter((gestation) => gestation.status === "active").length,
      birthAttempts: this.birthAttemptHistory.length,
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
      cooperationMode: this.cooperationMode,
      welfareMode: this.welfareMode,
      welfare: {
        day: this.welfareState.day,
        envelopeSnapshotCash: this.welfareState.envelopeSnapshotCash,
        envelope: this.welfareState.envelope,
        spent: this.welfareState.spent,
        remaining: this.welfareState.day === this.day ? this.remainingWelfareEnvelope() : 0,
      },
      citizenPolicy: this.policyMetadata(),
      controlHistory: this.controlHistory.map((entry) => ({ ...entry })),
      townStage,
    };
  }
}
