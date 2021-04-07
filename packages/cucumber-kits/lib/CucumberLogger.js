/* eslint-disable no-console */

const chalk = require('chalk')
const Listr = require('listr')
const BaseCucumberFormatter = require('./BaseCucumberFormatter')
const TaskRenderer = require('./TaskRenderer')

function createTestCaseTask(ctx, testCase) {
  const task = () =>
    new Listr(
      testCase.steps.map(testStep => ({
        title: testStep.name,
        skip: () => !!ctx.failedTestCases[testCase.id],
        task: () => new Promise((resolve, reject) => (ctx.testStepTasks[testStep.id] = { resolve, reject }))
      }))
    )
  task.isStarted = () => !!ctx.startedTestCases[testCase.id]
  return task
}

class CucumberLogger extends BaseCucumberFormatter {
  numOfTestSteps = 0
  numOfFinishedTestSteps = 0
  testCases = []
  startedTestCases = {}
  failedTestCases = {}
  testStepTasks = {}

  constructor(options) {
    super(options)
    console.log(chalk.green.bold('Start to run tests...'))
  }

  onPickleAccepted(testCase) {
    this.numOfTestSteps += testCase.steps.length
    this.testCases.push(testCase)
  }

  onTestRunStarted() {
    const task = new Listr(
      this.testCases.map(testCase => ({
        title: testCase.name,
        task: createTestCaseTask(this, testCase)
      })),
      {
        concurrent: true,
        exitOnError: false,
        getTaskStats: () => ({ total: this.numOfTestSteps, finished: this.numOfFinishedTestSteps }),
        renderer: TaskRenderer
      }
    )
    task.run().catch(() => {})
  }

  onTestCaseStarted(testCase) {
    this.startedTestCases[testCase.id] = true
  }

  onTestStepFinished(testStep, result) {
    const task = this.testStepTasks[testStep.id]
    if (result.status !== 'passed') {
      this.failedTestCases[testStep.caseId] = true
      task && task.reject(result.exception || new Error(`Reason: ${result.status}`))
    } else {
      task && task.resolve()
    }
    this.numOfFinishedTestSteps++
  }

  onTestRunFinished() {
    console.log(chalk.green.bold('Finish testing.\n'))
  }
}

module.exports = CucumberLogger
