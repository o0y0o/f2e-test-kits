@FakeFeature @FakeFeature1

Feature: Fake Feature
  ***Main Functions***
  - [FakeModuleA] `FakeFunc1`

  @FakeScenario @FakeScenario1
  Scenario: Fake Scenario
    ***Related Functions***
    - [FakeModuleB] `FakeFunc2`

    Given X has done something
    When X does some actions
    Then X gets expected results

  @FakeScenarioOutline @FakeScenarioOutline1
  Scenario Outline: Fake Scenario Outline (<who>)
    ***Related Functions***
    - [FakeModuleC] `FakeFunc<func>`

    Given <who> has done something
    When <who> does some actions
    Then <who> gets expected results
    Examples:
      | who   | func |
      | admin | 3    |
      | user  | 4    |
