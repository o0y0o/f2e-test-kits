const path = require('path')
const { AllureRuntime, LabelName } = require('allure2-js-commons')
const csvStringify = require('csv-stringify')
const day = require('dayjs')
const dayUtcPlugin = require('dayjs/plugin/utc')
const fs = require('fs-extra')
const { kebabCase } = require('lodash')
const marked = require('marked')
const { nanoid } = require('nanoid')
const promisify = require('./utils/promisify')
const BaseCucumberFormatter = require('./BaseCucumberFormatter')
const CucumberLogger = require('./CucumberLogger')

day.extend(dayUtcPlugin)

function cucumberStatusToAllureStatus(status, ignoreIfFailed) {
  switch (status) {
    case 'passed':
      return status
    case 'failed':
      return ignoreIfFailed ? 'broken' : 'failed'
    default:
      return 'skipped'
  }
}

function cucumberStatusToAllureStage(status) {
  switch (status) {
    case 'passed':
      return 'finished'
    case 'skipped':
      return 'pending'
    default:
      return 'interrupted'
  }
}

function createPackageName(testSuite) {
  const moduleName = kebabCase(testSuite.name.match(/^\[(.*)\]/)[1])
  const featureName = kebabCase(testSuite.id.match(/([^/]+)\.feature$/)[1])
  return `${kebabCaseReportName}.${moduleName}.${featureName}`.replace(/\.$/, '')
}

module.exports = class CucumberAllureReporter extends BaseCucumberFormatter {
  logger = undefined
  allureRuntime = undefined
  reportName = undefined
  reportPrefix = undefined
  reportRevision = undefined
  reportDir = undefined
  rootReport = undefined
  reports = {}
  testSuites = {}
  tasks = []

  constructor(options) {
    super(options)
    const {
      reportName = 'Cucumber Test Reports',
      reportRevision = Date.now(),
      reportUtcOffset = day().utcOffset(),
      reportDir
    } = options.allure || {}
    if (reportDir == null) throw new Error('`options.allure.reportDir` should not be null')
    try {
      const filenames = fs.readdirSync(reportDir)
      for (const filename of filenames) fs.removeSync(path.join(reportDir, filename))
    } catch {}
    this.logger = new CucumberLogger(options)
    this.allureRuntime = new AllureRuntime({ resultsDir: reportDir })
    this.reportName = reportName
    this.reportPrefix = `${kebabCase(reportName)}_${day().format('YYYY-MM-DD')}`
    this.reportRevision = reportRevision
    this.reportUtcOffset = reportUtcOffset
    this.reportDir = reportDir
    this.rootReport = this.allureRuntime.startGroup(reportName)
  }

  onGherkinDocument(testSuite) {
    this.testSuites[testSuite.id] = testSuite
  }

  onTestCaseStarted(testCase) {
    const testSuite = this.testSuites[testCase.suiteId]
    let suiteReport = this.reports[testCase.suiteId]
    if (!suiteReport) {
      suiteReport = this.rootReport.startGroup(testSuite.name)
      suiteReport.numOfUnfinishedCases = testSuite.cases.length
      this.reports[testCase.suiteId] = suiteReport
    }

    const title = [
      { name: 'Revision', value: this.reportRevision },
      { name: 'Time', value: day().utcOffset(this.reportUtcOffset).format() }
    ]
      .filter(meta => meta.value)
      .map(meta => `***${meta.name}***\n\n${meta.value}`)
      .join('\n\n')
    const caseReport = suiteReport.startTest(testCase.name)
    caseReport.historyId = `${this.reportName}: ${testCase.name}`
    caseReport.descriptionHtml = marked(`${title}\n\n${testCase.description}`)
    caseReport.addLabel(LabelName.PACKAGE, createPackageName(testSuite))
    caseReport.addLabel(LabelName.SUITE, this.rootReport.name)
    caseReport.addLabel(LabelName.SUB_SUITE, suiteReport.name)
    caseReport.addLabel(LabelName.FEATURE, suiteReport.name)
    caseReport.addLabel(LabelName.STORY, testCase.text)
    ;[...testSuite.tags, ...testCase.tags].forEach(t => caseReport.addLabel('tag', t))
    this.reports[testCase.id] = caseReport
  }

  onTestHookStarted(testHook) {
    if (this.reports[testHook.id]) return

    const suiteReport = this.reports[testHook.suiteId]
    const hookReport = testHook.type === 'before' ? suiteReport.addBefore() : suiteReport.addAfter()
    hookReport.name = testHook.name
    hookReport.info.start = Date.now()
    this.reports[testHook.id] = hookReport
  }

  onTestHookFinished(testHook, result) {
    const hookReport = this.reports[testHook.id]
    if (hookReport.info.stop) return

    hookReport.status = cucumberStatusToAllureStatus(result.status)
    hookReport.stage = cucumberStatusToAllureStage(result.status)
    hookReport.detailsMessage = result.exception?.message
    if (result.exception?.stack) {
      this.attachFile(hookReport, 'stack.txt', 'text/plain', result.exception.stack)
    }
    hookReport.info.stop = Date.now()
  }

  onTestStepStarted(testStep) {
    const caseReport = this.reports[testStep.caseId]
    const stepReport = caseReport.startStep(testStep.name)
    this.reports[testStep.id] = stepReport
  }

  onTestStepFinished(testStep, result) {
    const stepReport = this.reports[testStep.id]
    stepReport.status = cucumberStatusToAllureStatus(result.status)
    stepReport.stage = cucumberStatusToAllureStage(result.status)
    stepReport.detailsMessage = result.exception?.message
    if (result.exception?.stack) this.attachFile(stepReport, 'stack.txt', 'text/plain', result.exception.stack)
    if (testStep.args) this.attachFile(stepReport, 'arguments.csv', 'text/csv', promisify(csvStringify, testStep.args))
    stepReport.endStep()
  }

  onTestCaseFinished(testCase, result) {
    const testSuite = this.testSuites[testCase.suiteId]
    const caseReport = this.reports[testCase.id]
    const ignoreIfFailed = [...testSuite.tags, ...testCase.tags].includes('@unstable')
    caseReport.status = cucumberStatusToAllureStatus(result.status, ignoreIfFailed)
    caseReport.stage = cucumberStatusToAllureStage(result.status)
    caseReport.detailsMessage = result.exception?.message
    for (const attachment of result.attachments) {
      this.attachFile(caseReport, attachment.filename, attachment.media, attachment.data)
    }
    caseReport.endTest()

    const suiteReport = this.reports[testCase.suiteId]
    if (!--suiteReport.numOfUnfinishedCases) suiteReport.endGroup()
  }

  async onTestRunFinished() {
    this.rootReport.endGroup()

    await Promise.all(this.tasks)

    const filenames = await fs.readdir(this.reportDir)
    for (const filename of filenames) {
      if (filename.startsWith(this.reportPrefix)) continue
      const oldPath = path.join(this.reportDir, filename)
      const newPath = path.join(this.reportDir, `${this.reportPrefix}_${filename}`)
      await fs.rename(oldPath, newPath)
    }
  }

  attachFile(report, name, media, data) {
    const filename = `${this.reportPrefix}_${nanoid()}-${name}`
    const filePath = path.join(this.reportDir, filename)
    report.addAttachment(name, media, filename)
    if (typeof data === 'function') data = data()
    this.tasks.push(Promise.resolve(data).then(data => fs.outputFile(filePath, data)))
  }
}
