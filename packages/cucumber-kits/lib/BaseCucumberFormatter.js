const { Formatter } = require('cucumber')
const { identity } = require('lodash')

function replaceArgs(text = '', args = {}, match = identity) {
  return Object.entries(args).reduce(replaceWithArgs, text)
  function replaceWithArgs(text, [key, value]) {
    return text.replace(new RegExp(match(key), 'g'), value)
  }
}

function replaceTestParams(text, params) {
  return replaceArgs(text, params, k => `<${k}>`)
}

function getDescription(featureDescription, scenarioDescription, params) {
  return [featureDescription, replaceTestParams(scenarioDescription, params)].map(trim).filter(Boolean).join('\n\n')
  function trim(text = '') {
    return text
      .split('\n')
      .map(line => line.replace(/^\s{0,4}/, '').replace(/\s*$/, ''))
      .join('\n')
  }
}

function getHooks(allHooks, type, suiteId, tags) {
  return allHooks
    .filter(hook => hook.pickleFilter.tagExpressionNode?.evaluate(tags) ?? true)
    .map(hook => ({
      suiteId,
      type,
      id: `${suiteId}:${hook.uri}:${hook.line}`,
      name: `${hook.uri}, line: ${hook.line}`
    }))
}

function getTestStep(suiteId, caseId, step, params) {
  return {
    suiteId,
    caseId,
    id: `${caseId}:${step.location.line}`,
    name: `${step.keyword}${replaceTestParams(step.text, params)}`,
    text: step.text,
    args: step.argument?.type === 'DataTable' ? replaceRows(step.argument.rows) : null
  }
  function replaceRows(rows) {
    return rows.map(r => r.cells.map(c => replaceTestParams(c.value, params)))
  }
}

function getTestCases(suiteId, feature) {
  const cases = []
  for (const scenario of feature.children) {
    switch (scenario.type) {
      case 'Scenario': {
        const caseId = `${suiteId}:${scenario.location.line}`
        cases.push({
          suiteId,
          id: caseId,
          name: scenario.name,
          description: getDescription(feature.description, scenario.description),
          text: scenario.name,
          tags: scenario.tags.map(t => t.name),
          steps: scenario.steps.map(s => getTestStep(suiteId, caseId, s)),
          params: {}
        })
        break
      }
      case 'ScenarioOutline': {
        for (const { tableHeader, tableBody, tags } of scenario.examples) {
          const paramKeys = tableHeader.cells.map(c => c.value)
          cases.push(
            ...tableBody.map(row => {
              const caseId = `${suiteId}:${row.location.line}`
              const params = row.cells.reduce((p, c, i) => ({ ...p, [paramKeys[i]]: c.value }), {})
              return {
                suiteId,
                id: caseId,
                name: replaceTestParams(scenario.name, params),
                description: getDescription(feature.description, scenario.description, params),
                text: scenario.name,
                tags: [...scenario.tags, ...tags].map(t => t.name),
                steps: scenario.steps.map(s => getTestStep(suiteId, caseId, s, params)),
                params
              }
            })
          )
        }
        break
      }
    }
  }
  return cases
}

module.exports = class BaseCucumberFormatter extends Formatter {
  constructor(options) {
    super(options)

    const testSuites = []
    const {
      eventBroadcaster,
      supportCodeLibrary: {
        beforeTestCaseHookDefinitions: allBeforeHooks,
        afterTestCaseHookDefinitions: allAfterHooks
      },
      suiteFormatter = identity,
      runtimeState
    } = options

    eventBroadcaster
      .on('gherkin-document', data => {
        const { document, uri: suiteId } = data
        const { feature } = document
        const tags = feature.tags.map(t => t.name)
        const testSuite = {
          id: suiteId,
          name: suiteFormatter(feature.name, suiteId),
          cases: getTestCases(suiteId, feature),
          tags,
          beforeHooks: getHooks(allBeforeHooks, 'before', suiteId, tags),
          afterHooks: getHooks(allAfterHooks, 'after', suiteId, tags)
        }
        testSuites.push(testSuite)
        this.onGherkinDocument(testSuite)
      })
      .on('pickle-accepted', data => {
        const { uri: suiteId, pickle } = data
        const [{ line }] = pickle.locations
        const caseId = `${suiteId}:${line}`
        const testSuite = testSuites.find(s => s.id === suiteId)
        const testCase = testSuite.cases.find(c => c.id === caseId)
        this.onPickleAccepted(testCase)
      })
      .on('test-run-started', this.onTestRunStarted.bind(this))
      .on('test-case-started', data => {
        const { uri: suiteId, line } = data.sourceLocation
        const caseId = `${suiteId}:${line}`
        const testSuite = testSuites.find(s => s.id === suiteId)
        const testCase = testSuite.cases.find(c => c.id === caseId)
        this.onTestCaseStarted(testCase)
      })
      .on('test-step-started', data => {
        const { index } = data
        const { uri: suiteId, line } = data.testCase.sourceLocation
        const caseId = `${suiteId}:${line}`
        const testSuite = testSuites.find(s => s.id === suiteId)
        const testCase = testSuite.cases.find(c => c.id === caseId)
        const numOfSteps = testCase.steps.length
        const numOfBeforeHooks = testSuite.beforeHooks.length
        const isBeforeHook = index < numOfBeforeHooks
        const isAfterHook = index >= numOfBeforeHooks + numOfSteps
        if (isBeforeHook || isAfterHook) {
          const testHook = isBeforeHook
            ? testSuite.beforeHooks[index]
            : testSuite.afterHooks[index - numOfBeforeHooks - numOfSteps]
          return this.onTestHookStarted(testHook)
        }
        const testStep = testCase.steps[index - numOfBeforeHooks]
        this.onTestStepStarted(testStep)
      })
      .on('test-step-finished', data => {
        const { index, result } = data
        const { uri: suiteId, line } = data.testCase.sourceLocation
        const caseId = `${suiteId}:${line}`
        const testSuite = testSuites.find(s => s.id === suiteId)
        const testCase = testSuite.cases.find(c => c.id === caseId)
        const numOfSteps = testCase.steps.length
        const numOfBeforeHooks = testSuite.beforeHooks.length
        const isBeforeHook = index < numOfBeforeHooks
        const isAfterHook = index >= numOfBeforeHooks + numOfSteps
        if (isBeforeHook || isAfterHook) {
          const testHook = isBeforeHook
            ? testSuite.beforeHooks[index]
            : testSuite.afterHooks[index - numOfBeforeHooks - numOfSteps]
          return this.onTestHookFinished(testHook, result)
        }
        const testStep = testCase.steps[index - numOfBeforeHooks]
        if (testStep.args) {
          testStep.args = testStep.args.map(cells => cells.map(cell => replaceArgs(cell, runtimeState)))
        }
        this.onTestStepFinished(testStep, result)
      })
      .on('test-case-finished', data => {
        const { uri: suiteId, line } = data.sourceLocation
        const caseId = `${suiteId}:${line}`
        const testSuite = testSuites.find(s => s.id === suiteId)
        const testCase = testSuite.cases.find(c => c.id === caseId)
        this.onTestCaseFinished(testCase, data.result)
      })
      .on('test-run-finished', data => this.onTestRunFinished(data.result))
  }

  onGherkinDocument() {}
  onPickleAccepted() {}
  onTestRunStarted() {}
  onTestCaseStarted() {}
  onTestHookStarted() {}
  onTestHookFinished() {}
  onTestStepStarted() {}
  onTestStepFinished() {}
  onTestCaseFinished() {}
  onTestRunFinished() {}
}
