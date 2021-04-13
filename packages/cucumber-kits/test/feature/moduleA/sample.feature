@FakeFeature @FakeFeature1

Feature: Fake Feature
  ***Main Functions***
  - [FakeModule] `FakeFunc`

  @FakeScenario @FakeScenario1
  Scenario: Fake Scenario
    ***Related Functions***
    - [FakeModuleA] `FakeFuncA1`

    Given X has done something
    When X does some actions
    Then X gets expected results

  @FakeScenarioOutline @FakeScenarioOutline1
  Scenario Outline: Fake Scenario Outline (<who>)
    ***Related Functions***
    - [FakeModuleB] `FakeFunc<func>`

    Given <who> has done something
    When <who> does some actions
    Then <who> gets expected results
    And <who> stores expected results
      | func   | param   |
      | <func> | <param> |
    Examples:
      | who   | func | param |
      | admin | B1   | P1    |
      | user  | B2   | P2    |
