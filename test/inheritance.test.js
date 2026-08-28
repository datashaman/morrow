import assert from "node:assert/strict";
import test from "node:test";
import { TownSimulation } from "../src/simulation.js";

function partner(town, first, second) {
  first.relationships = {};
  second.relationships = {};
  town.formFriendship(first, second, 0.9, town.day);
  assert.equal(town.formPartnership(first, second), true);
}

test("estate duty precedes partner and child inheritance with dependent shares restricted", () => {
  const town = new TownSimulation({ seed: 58, lifecycleEnabled: true });
  const deceased = town.people[0];
  const survivingPartner = town.people[1];
  partner(town, deceased, survivingPartner);
  const adultChild = town.createNewborn([deceased.id]);
  const dependentChild = town.createNewborn([deceased.id]);
  adultChild.lifecycleStage = "adult";
  adultChild.isDependent = false;
  deceased.cash = 10.03;
  const partnerBefore = survivingPartner.cash;
  const adultBefore = adultChild.cash;
  const treasuryBefore = town.government.cash;
  const moneyBefore = town.totalMoney();

  town.die(deceased, "test inheritance death");

  assert.equal(deceased.cash, 0);
  assert.equal(deceased.estateTransferred, 10.03);
  assert.equal(deceased.estateDutyPaid, 1);
  assert.equal(deceased.inheritanceDistributed, 9.03);
  assert.equal(town.government.cash, treasuryBefore + 1);
  assert.equal(survivingPartner.cash, partnerBefore + 4.51);
  assert.equal(adultChild.cash, adultBefore + 2.26);
  assert.equal(dependentChild.cash, 0);
  assert.equal(dependentChild.restrictedInheritance, 2.26);
  assert.equal(dependentChild.ledger[0].text, `restricted inheritance from ${deceased.name}`);
  assert.equal(town.totalMoney(), moneyBefore);
});

test("children-only estates allocate leftover cents by ascending immutable id", () => {
  const town = new TownSimulation({ seed: 58, lifecycleEnabled: true });
  const deceased = town.people[0];
  const children = [town.createNewborn([deceased.id]), town.createNewborn([deceased.id]), town.createNewborn([deceased.id])];
  deceased.cash = 1.11;
  const moneyBefore = town.totalMoney();

  town.die(deceased, "test child inheritance death");

  assert.equal(deceased.estateDutyPaid, 0.11);
  assert.deepEqual(children.map((child) => child.restrictedInheritance), [0.34, 0.33, 0.33]);
  assert.equal(deceased.inheritanceDistributed, 1);
  assert.equal(town.totalMoney(), moneyBefore);
});

test("members of one death cohort cannot inherit from each other", () => {
  const town = new TownSimulation({ seed: 58, lifecycleEnabled: true });
  const first = town.people[0];
  const second = town.people[1];
  partner(town, first, second);
  first.cash = 10;
  second.cash = 20;
  const treasuryBefore = town.government.cash;
  const moneyBefore = town.totalMoney();

  const estates = town.dieCohort([{ person: first, reason: "same-phase death" }, { person: second, reason: "same-phase death" }]);

  assert.deepEqual(estates.map((estate) => estate.partnerId), [null, null]);
  assert.equal(first.inheritanceDistributed, 0);
  assert.equal(second.inheritanceDistributed, 0);
  assert.equal(town.government.cash, treasuryBefore + 30);
  assert.equal(town.totalMoney(), moneyBefore);
});

test("a dependent's restricted balance is part of their own taxable estate", () => {
  const town = new TownSimulation({ seed: 58, lifecycleEnabled: true });
  const dependent = town.createNewborn([0]);
  dependent.cash = 1;
  dependent.restrictedInheritance = 10;
  const treasuryBefore = town.government.cash;
  const moneyBefore = town.totalMoney();

  town.die(dependent, "test dependent death");

  assert.equal(dependent.estateTransferred, 11);
  assert.equal(dependent.estateDutyPaid, 1.1);
  assert.equal(dependent.cash, 0);
  assert.equal(dependent.restrictedInheritance, 0);
  assert.equal(town.government.cash, treasuryBefore + 11);
  assert.equal(town.totalMoney(), moneyBefore);
});
