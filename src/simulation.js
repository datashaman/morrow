import {
  DEFAULT_POLICY,
  FIRMS,
  FOOD_HEALTH_RECOVERY,
  FOOD_QUALITY_DECAY_PER_DAY,
  MIN_FOOD_QUALITY,
  NAMES,
  PHASES,
  RENT_INTERVAL_DAYS,
} from "./config.js";
import { createRandom } from "./random.js";

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const roundMoney = (value) => Math.round(value * 100) / 100;

export class TownSimulation {
  constructor({ seed = 20260823, policy = {} } = {}) {
    this.seed = seed;
    this.policy = { ...DEFAULT_POLICY, ...policy };
    this.reset();
  }

  reset(seed = this.seed) {
    this.seed = seed;
    this.random = createRandom(seed);
    this.day = 1;
    this.phase = 0;
    this.flows = [];
    this.government = { kind: "government", id: 0, name: "Town treasury", cash: 120, x: 0.88, y: 0.55 };
    this.firms = FIRMS.map((firm, id) => ({
      ...firm,
      kind: "firm",
      id,
      cash: 150,
      owner: id,
      employees: [],
      sales: 0,
      unitsSold: 0,
      transactionsToday: 0,
      attemptedTransactions: 0,
      turnedAwayTransactions: 0,
      active: true,
      trouble: 0,
      demandEMA: firm.demand,
      targetStaff: firm.initialStaff,
      vacancyAge: 0,
      overstaffedDays: 0,
    }));
    this.people = NAMES.map((name, id) => {
      const homeX = 0.68 + this.random() * 0.22;
      const homeY = 0.43 + this.random() * 0.18;
      return {
        kind: "person",
        id,
        name,
        alive: true,
        deathDay: null,
        criticalHealthDays: 0,
        cash: roundMoney(18 + this.random() * 62),
        skill: 0.25 + this.random() * 0.65,
        reliability: 0.55 + this.random() * 0.43,
        employer: -1,
        friends: [],
        socialCapacity: 3 + Math.floor(this.random() * 4),
        lastSocialDay: 0,
        hungryDays: 0,
        rentArrears: 0,
        housed: true,
        health: 0.58 + this.random() * 0.36,
        stress: 0.12 + this.random() * 0.25,
        esteemBaseline: 0.05 + this.random() * 0.12,
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
        ledger: [],
        events: [{ day: 1, sequence: 1, text: "entered the town economy", kind: "neutral" }],
      };
    });

    for (let i = 0; i < 52; i += 1) {
      const a = this.random.pick(this.people);
      const b = this.random.pick(this.people);
      if (a !== b && !a.friends.includes(b.id) && a.friends.length < a.socialCapacity && b.friends.length < b.socialCapacity) {
        a.friends.push(b.id);
        b.friends.push(a.id);
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

  note(person, text, kind = "neutral") {
    person.activitySequence += 1;
    person.events.unshift({ day: this.day, sequence: person.activitySequence, text, kind });
    person.events = person.events.slice(0, 8);
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
    person.ledger = person.ledger.slice(0, 12);
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

  stressPressure(person) {
    const runwayPressure = 1 - clamp(this.runwayDays(person) / 12);
    const firmRisk = person.employer >= 0 ? clamp((this.firms[person.employer].trouble || 0) / 4) : 1;
    const isolation = person.friends.length ? clamp((this.day - person.lastSocialDay - 3) / 10) : 1;
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
    const recentContact = this.day - person.lastSocialDay <= 3 ? 0.2 : 0;
    const belonging = clamp(0.12 + Math.min(1, person.friends.length / Math.max(3, person.socialCapacity)) * 0.68 + recentContact);
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
    firm.employees.push(person.id);
    if (!silent) this.note(person, `hired by ${firm.name}`, "good");
    return true;
  }

  fire(firm, person, reason) {
    firm.employees = firm.employees.filter((id) => id !== person.id);
    person.employer = -1;
    this.note(person, `${reason} at ${firm.name}`, "bad");
  }

  die(person, reason = "died after health reached a critical level") {
    if (!person.alive) return false;
    if (person.employer >= 0) {
      const firm = this.firms[person.employer];
      firm.employees = firm.employees.filter((id) => id !== person.id);
      person.employer = -1;
    }
    person.friends.forEach((friendId) => {
      const friend = this.people[friendId];
      friend.friends = friend.friends.filter((id) => id !== person.id);
    });
    person.friends = [];
    person.alive = false;
    person.deathDay = this.day;
    person.attended = false;
    person.socialToday = false;
    person.rentArrears = 0;
    this.note(person, reason, "bad");
    return true;
  }

  transactionCapacity(firm) {
    const attending = firm.employees.reduce((total, id) => total + (this.people[id].attended ? 1 : 0), 0);
    return attending * firm.transactionsPerWorker;
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
    if (person.cash + 1e-9 < cost || !this.requestTransaction(firm, person, purpose)) return 0;
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
    const description = purpose === "food" && units > 1 ? `${units} food portions from ${firm.name}` : `${purpose} to ${firm.name}`;
    this.ledger(person, { direction: "out", amount: paid, text: description, before });
    return paid;
  }

  consumeFood(person, food) {
    const age = Math.max(0, this.day - food.purchasedDay);
    const quality = clamp(food.quality - age * FOOD_QUALITY_DECAY_PER_DAY, MIN_FOOD_QUALITY, 1);
    person.lastFoodQuality = quality;
    person.lastFoodAge = age;
    person.foodSeller = food.seller;
    person.hungryDays = Math.max(0, person.hungryDays - 1);
    person.health = clamp(person.health + quality * FOOD_HEALTH_RECOVERY);
    return quality;
  }

  productionPhase() {
    this.people.forEach((person) => {
      if (!person.alive) {
        person.attended = false;
        person.scarcityError = false;
        return;
      }
      person.scarcityError = this.random() < person.stress ** 2 * 0.24;
      if (person.employer < 0) return void (person.attended = false);
      const missChance = 0.015 + person.stress * 0.1 + (1 - person.health) * 0.22 + (person.hungryDays ? 0.1 : 0);
      person.attended = this.random() >= missChance;
      if (!person.attended) {
        person.missedWork += 1;
        person.reliability = clamp(person.reliability - 0.018);
        this.note(person, "missed a shift and earned no wage", "bad");
      } else person.missedWork = Math.max(0, person.missedWork - 1);
    });
    this.firms.forEach((firm) => {
      if (!firm.active || firm.sector === "housing") return;
      firm.inventory += firm.employees.reduce((sum, id) => {
        const person = this.people[id];
        return sum + (person.attended ? (0.42 + person.skill * 0.75) * firm.productivity * person.health * (1 - person.stress * 0.32) : 0);
      }, 0);
    });
  }

  payrollPhase() {
    const taxRate = this.policy.taxRate / 100;
    this.firms.forEach((firm) => {
      const attendees = firm.employees.map((id) => this.people[id]).filter((person) => person.alive && person.attended);
      const wage = Math.max(this.policy.minimumWage, firm.wage);
      const ratio = attendees.length ? Math.min(1, firm.cash / (wage * attendees.length)) : 1;
      attendees.forEach((person) => {
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

  foodPhase() {
    const foodFirms = this.firms.filter((firm) => firm.active && firm.sector === "food" && firm.inventory >= 1).sort((a, b) => a.price - b.price);
    this.people.forEach((person) => {
      if (!person.alive) return;
      person.socialToday = false;
      let meal = person.foodStock.shift();
      if (meal) {
        this.consumeFood(person, meal);
        return;
      }
      const affordable = foodFirms.filter((firm) => person.cash >= firm.price && firm.inventory >= 1);
      const delayed = person.scarcityError && person.stress > 0.62 && this.runwayDays(person) < 5 && this.random() < 0.32;
      const sellers = person.scarcityError && affordable.length > 1 ? [...affordable].reverse() : affordable;
      const paid = delayed ? 0 : sellers.reduce((result, firm) => {
        const units = Math.min(person.foodReserveTarget, Math.floor(firm.inventory), Math.floor(person.cash / firm.price));
        return result || this.buy(person, firm, units, "food");
      }, 0);
      if (paid) {
        meal = person.foodStock.shift();
        this.consumeFood(person, meal);
      } else {
        person.hungryDays += 1;
        person.health = clamp(person.health - 0.045);
        if (delayed) this.note(person, "scarcity stress disrupted an essential purchase", "bad");
        else if (person.hungryDays === 2) this.note(person, "missed food for two days", "bad");
      }
    });
  }

  housingPhase() {
    const housing = this.firms.find((firm) => firm.active && firm.sector === "housing");
    if (!housing) return;
    this.people.forEach((person) => {
      if (!person.alive) return;
      if (!person.housed) person.rentArrears = 0;
      if (person.housed && !this.rentDueToday()) return;
      const due = roundMoney(person.housed ? housing.price : housing.price * 3);
      const avoidance = person.housed && person.scarcityError && person.stress > 0.6 && this.runwayDays(person) < 5 && this.random() < 0.38;
      if (avoidance) {
        person.rentArrears += 1;
        this.note(person, `stress-driven avoidance deferred rent to ${housing.name}`, "bad");
      } else {
        const before = person.cash;
        const canPay = person.cash + 1e-9 >= due;
        const paid = canPay && this.requestTransaction(housing, person, "housing payment")
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
          return;
        }
        if (person.housed) person.rentArrears += 1;
      }
      if (person.housed && person.rentArrears >= 3) {
        person.housed = false;
        person.rentArrears = 0;
        this.note(person, "three missed rents caused eviction", "bad");
      }
    });
  }

  personalPhase() {
    const café = this.firms.find((firm) => firm.active && firm.sector === "service" && firm.inventory >= 1);
    const makers = this.firms.find((firm) => firm.active && firm.sector === "goods" && firm.inventory >= 1);
    this.people.forEach((person) => {
      if (!person.alive) return;
      this.assessNeeds(person);
      const pursuesDiscretionaryPurchase = this.random() < this.policy.discretionaryDemand / 100;
      if (pursuesDiscretionaryPurchase && person.scarcityError && person.stress > 0.65 && café && this.buy(person, café, 1, "short-term comfort")) {
        person.stress = clamp(person.stress - 0.035);
        this.note(person, "stress relief spending reduced thin reserves", "bad");
      } else if (pursuesDiscretionaryPurchase && person.focus === "belonging" && café && person.cash > café.price + 7 && this.buy(person, café, 1, "social visit")) {
        person.socialToday = true;
        person.lastSocialDay = this.day;
      } else if (pursuesDiscretionaryPurchase && ["esteem", "growth"].includes(person.focus) && makers && person.cash > makers.price + 10 && this.buy(person, makers, 1, "learning tools")) {
        person.skill = clamp(person.skill + 0.02);
        person.growth = clamp(person.growth + 0.04);
      }
    });
    const social = this.people.filter((person) => person.alive && person.socialToday).sort(() => this.random() - 0.5);
    for (let index = 0; index + 1 < social.length; index += 2) {
      const a = social[index];
      const b = social[index + 1];
      a.lastSocialDay = b.lastSocialDay = this.day;
      if (!a.friends.includes(b.id) && a.friends.length < a.socialCapacity && b.friends.length < b.socialCapacity) {
        a.friends.push(b.id);
        b.friends.push(a.id);
        this.note(a, `a café encounter became friendship with ${b.name}`, "good");
        this.note(b, `a café encounter became friendship with ${a.name}`, "good");
      }
    }
  }

  settlementPhase() {
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

    this.firms.forEach((firm) => this.settleFirm(firm));
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

  settleFirm(firm) {
    if (!firm.active) return;
    const wage = Math.max(this.policy.minimumWage, firm.wage);
    if (firm.sector !== "housing" || this.rentDueToday()) {
      firm.demandEMA = firm.demandEMA * 0.72 + firm.attemptedTransactions * 0.28;
    }
    const transactionsPerWorker = firm.transactionsPerWorker;
    const demandStaff = clamp(Math.ceil(firm.demandEMA / transactionsPerWorker), firm.sector === "housing" ? 2 : 1, firm.maxStaff);
    const unmetDemand = Math.max(0, firm.demandEMA - firm.employees.length * transactionsPerWorker);
    const marginalRevenue = Math.min(transactionsPerWorker, unmetDemand) * firm.price;
    const profitableVacancy = marginalRevenue >= wage * 1.08 && firm.cash >= wage * 6 && firm.employees.length < firm.maxStaff;
    firm.targetStaff = profitableVacancy ? Math.min(demandStaff, firm.employees.length + 1) : Math.min(demandStaff, firm.employees.length);
    firm.trouble = firm.cash < wage * Math.max(1, firm.employees.length) * 0.7 ? firm.trouble + 1 : Math.max(0, firm.trouble - 1);
    firm.overstaffedDays = firm.employees.length > demandStaff || firm.trouble >= 3 ? firm.overstaffedDays + 1 : 0;
    if (firm.overstaffedDays >= 3 && firm.employees.length > 1) {
      const worker = this.people[[...firm.employees].sort((a, b) => this.people[a].reliability - this.people[b].reliability)[0]];
      this.fire(firm, worker, "lower demand eliminated a position");
      firm.overstaffedDays = 0;
    }
    const vacancies = Math.max(0, firm.targetStaff - firm.employees.length);
    firm.vacancyAge = vacancies ? firm.vacancyAge + 1 : 0;
    if (vacancies && firm.vacancyAge >= 2) {
      const candidate = this.people.filter((person) => person.alive && person.employer < 0).sort((a, b) => b.skill + b.reliability * 0.25 - (a.skill + a.reliability * 0.25))[0];
      if (candidate && wage >= 3.2 + candidate.skill * 4.5 && this.random() < 0.5 + candidate.reliability * 0.35) {
        this.hire(firm, candidate);
        firm.vacancyAge = 0;
      }
    }
    if (this.random() < (this.policy.shockRisk / 100) * 0.025) {
      this.transfer(firm, this.government, Math.min(firm.cash, 12 + this.random() * 22));
      firm.trouble += 1;
    }
    if (firm.cash > 230) {
      const owner = this.people[firm.owner];
      if (owner.alive) {
        const before = owner.cash;
        const paid = this.transfer(firm, owner, (firm.cash - 210) * 0.35);
        this.ledger(owner, { direction: "in", amount: paid, text: `owner dividend from ${firm.name}`, before });
      }
    }
    if (firm.cash < 0.5 && firm.trouble > 5) {
      [...firm.employees].forEach((id) => this.fire(firm, this.people[id], "business closure ended employment"));
      firm.active = false;
    }
    firm.sales = 0;
    firm.unitsSold = 0;
    firm.transactionsToday = 0;
    firm.attemptedTransactions = 0;
    firm.turnedAwayTransactions = 0;
  }

  step() {
    this.flows = [];
    [
      () => this.productionPhase(),
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
