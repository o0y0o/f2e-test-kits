@FakeFeatureTag1 @FakeFeatureTag2

Feature: This is Sample Feature for Testing
  ***Main Functions***
  - [FakeModule1] `FakeFunc1`
  - [FakeModule2] `FakeFunc2`

  ***Related Functions***
  - [FakeModule3] `FakeFunc3`
  - [FakeModule4] `FakeFunc4`

  @FakeScenarioTag1 @FakeScenarioTag2
  Scenario: This is Sample Scenario for Testing
    ***Main Functions***
    - [FakeModuleA] `FakeFuncA`
    - [FakeModuleB] `FakeFuncB`

    ***Related Functions***
    - [FakeModuleC] `FakeFuncC`
    - [FakeModuleD] `FakeFuncD`

    Given X has done something
    And Y has done something
    When X does some actions
    And Y does some actions
    Then X will get expected results
    And Y will get expected results
