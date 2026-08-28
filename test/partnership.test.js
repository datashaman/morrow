import assert from "node:assert/strict";
import test from "node:test";
import { MotivationCitizenPolicy } from "../src/citizen-policy.ts";
import { PARTNERSHIP_COOLDOWN_DAYS } from "../src/config.js";
import { TownSimulation } from "../src/simulation.js";

const partnershipPolicy = ({ separateIds = new Set(), proposerId = 0, recipientId = 1 } = {}) => ({
  id: "partnership-test",
  decide: ({ observation, legalActions }) => {
    let action = legalActions[0];
    if (observation.kind === "partnership") {
      if (observation.domain === "separation") action = separateIds.has(observation.citizenId) ? "separate-partnership" : "continue-partnership";
      if (observation.domain === "proposal") action = observation.citizenId === proposerId && legalActions.includes(`propose-partnership:${recipientId}`)
        ? `propose-partnership:${recipientId}`
        : "remain-single";
      if (observation.domain === "response") action = observation.citizenId === recipientId && legalActions.includes(`accept-partnership:${proposerId}`)
        ? `accept-partnership:${proposerId}`
        : "decline-partnership";
    }
    return { action, reasons: ["deterministic partnership fixture"] };
  },
});

const isolateFriendship = (town, aId, bId, strength = 0.9) => {
  town.people.forEach((person) => { person.relationships = {}; });
  assert.equal(town.formFriendship(town.people[aId], town.people[bId], strength, town.day), true);
};

test("two eligible adults form one explicit partnership after proposal and acceptance", () => {
  const town = new TownSimulation({ seed: 58, lifecycleEnabled: true, citizenPolicy: partnershipPolicy() });
  isolateFriendship(town, 0, 1);

  town.runPartnerships();

  assert.equal(town.people[0].partnerId, 1);
  assert.equal(town.people[1].partnerId, 0);
  assert.equal(town.people[0].partnershipStartDay, 1);
  assert.equal(town.people[0].relationships[1].strength, 0.9);
  assert.deepEqual(town.people[0].lifecycleHistory.map(({ type, counterpartId, reason }) => ({ type, counterpartId, reason })), [
    { type: "partnership-formed", counterpartId: 1, reason: "mutual acceptance" },
  ]);
  assert.deepEqual(town.people[0].decisions.filter((record) => record.kind === "partnership").map((record) => record.observation.domain), ["proposal"]);
  assert.deepEqual(town.people[1].decisions.filter((record) => record.kind === "partnership").map((record) => record.observation.domain), ["response", "proposal"]);
});

test("partnership eligibility enforces adulthood, closeness, cooldown, exclusivity, and immediate kin exclusions", () => {
  const town = new TownSimulation({ seed: 58, lifecycleEnabled: true });
  const [a, b, c, d] = town.people;
  isolateFriendship(town, 0, 1, 0.74);
  assert.equal(town.formFriendship(a, c, 0.9, town.day), true);
  assert.equal(town.formFriendship(b, c, 0.9, town.day), true);
  assert.equal(town.legalPartnershipPair(a, b), false);
  a.relationships[1].strength = b.relationships[0].strength = 0.75;
  assert.equal(town.legalPartnershipPair(a, b), true);
  b.lifecycleStage = "student";
  b.isDependent = true;
  b.birthDay = -166;
  b.ageDays = 167;
  assert.equal(town.legalPartnershipPair(a, b), false);
  b.lifecycleStage = "adult";
  b.isDependent = false;
  b.birthDay = null;
  b.ageDays = null;
  b.parentIds = [c.id];
  assert.equal(town.legalPartnershipPair(b, c), false);
  c.parentIds = [d.id];
  assert.equal(town.formFriendship(a, d, 0.9, town.day), true);
  a.parentIds = [c.id];
  assert.equal(town.legalPartnershipPair(a, d), false);
  a.parentIds = [c.id];
  assert.equal(town.legalPartnershipPair(a, b), false);
  a.parentIds = [];
  b.parentIds = [];
  c.parentIds = [];
  a.formerGuardianIds = [b.id];
  assert.equal(town.legalPartnershipPair(a, b), false);
  a.formerGuardianIds = [];
  assert.equal(town.formPartnership(a, b), true);
  assert.equal(town.legalPartnershipPair(a, c), false);
  town.endPartnership(a, "test separation");
  assert.equal(town.legalPartnershipPair(a, b), false);
  town.day += PARTNERSHIP_COOLDOWN_DAYS;
  assert.equal(town.legalPartnershipPair(a, b), true);
});

test("either partner may separate while friendship persists and death creates no new survivor cooldown", () => {
  const separateIds = new Set([1]);
  const town = new TownSimulation({ seed: 58, lifecycleEnabled: true, citizenPolicy: partnershipPolicy({ separateIds }) });
  isolateFriendship(town, 0, 1);
  assert.equal(town.formPartnership(town.people[0], town.people[1]), true);
  town.day = 8;

  town.runPartnerships();

  assert.equal(town.people[0].partnerId, null);
  assert.equal(town.people[1].partnerId, null);
  assert.equal(town.people[0].lastPartnershipEndDay, 8);
  assert.equal(town.people[0].relationships[1].strength, 0.9);
  assert.match(town.people[0].lifecycleHistory[0].reason, /chose separation/);

  const deathTown = new TownSimulation({ seed: 58, lifecycleEnabled: true });
  isolateFriendship(deathTown, 0, 1);
  assert.equal(deathTown.formPartnership(deathTown.people[0], deathTown.people[1]), true);
  deathTown.die(deathTown.people[1], "test death");
  assert.equal(deathTown.people[0].partnerId, null);
  assert.equal(deathTown.people[0].lastPartnershipEndDay, null);
  assert.equal(deathTown.people[0].lifecycleHistory[0].reason, "partner died");
});

test("motivation partnership decisions and seeded town outcomes replay exactly", () => {
  const policy = new MotivationCitizenPolicy();
  const observation = {
    kind: "partnership", domain: "proposal", citizenId: 0, citizenName: "A", stress: 0.1,
    materialSecurity: 0.8, friendshipStrength: 0, contactStaleness: 0,
    profile: { comfort: 1, connection: 1.3, mastery: 1, security: 0.7, foodQuality: 1, planning: 1.2, avoidance: 0.7 },
    options: [{ action: "propose-partnership:1", citizenId: 1, citizenName: "B", friendshipStrength: 0.9 }],
  };
  assert.equal(policy.decide({ observation, legalActions: ["remain-single", "propose-partnership:1"], random: () => 0 }).action, "propose-partnership:1");

  const first = new TownSimulation({ seed: 5801, lifecycleEnabled: true });
  const second = new TownSimulation({ seed: 5801, lifecycleEnabled: true });
  [first, second].forEach((town) => isolateFriendship(town, 0, 1));
  first.runPartnerships();
  second.runPartnerships();
  assert.deepEqual(first.people, second.people);
});
