const { exec } = require('child_process')
const path = require('path')
const fs = require('fs-extra')
const AllureReporter = require('./lib/AllureReporter')

function execAsync(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, error => (error ? reject(error) : resolve()))
  })
}

const reportFnames = []
const suiteFnames = []
const suiteNames = []
const caseFnames = []
const caseReports = []
const argsFnames = []

const exptDesc = (mod, func) =>
  `^<p><em><strong>Revision</strong></em></p>\n<p>v0.0.0</p>\n<p><em><strong>Time</strong></em></p>\n<p>\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\+08:00</p>\n<p><em><strong>Main Functions</strong></em></p>\n<ul>\n<li>\\[FakeModule\\] <code>FakeFunc</code></li>\n</ul>\n<p><em><strong>Related Functions</strong></em></p>\n<ul>\n<li>\\[FakeModule${mod}\\] <code>FakeFunc${func}</code></li>\n</ul>\n$`
const exptResult = exptDesc => ({
  descriptionHtml: expect.stringMatching(new RegExp(exptDesc)),
  uuid: expect.any(String),
  start: expect.any(Number),
  stop: expect.any(Number),
  steps: expect.any(Array)
})
const exptStep = {
  start: expect.any(Number),
  stop: expect.any(Number),
  attachments: expect.any(Array)
}

beforeAll(async () => {
  await execAsync('cucumber-js test/feature --require test/step --format test/lib/AllureReporter.js')
  reportFnames.push(...(await fs.readdir(AllureReporter.reportDir)))
  suiteFnames.push(...reportFnames.filter(fname => /-container\.json$/.test(fname)))
  suiteNames.push(...suiteFnames.map(fname => require(path.join(AllureReporter.reportDir, fname)).name))
  caseFnames.push(...reportFnames.filter(fname => /-result\.json$/.test(fname)))
  caseReports.push(...caseFnames.map(fname => require(path.join(AllureReporter.reportDir, fname))))
  argsFnames.push(...reportFnames.filter(fname => /-arguments\.csv$/.test(fname)))
})

describe('@0y0/cucumber-kits/CucumberAllureReporter', () => {
  it('should generate expected allure results', () => {
    const exptFname = /^allure-test-reports_[\w-]+-((container|result)\.json|arguments\.csv)/
    expect(reportFnames).toHaveLength(7)
    expect(suiteFnames).toHaveLength(2)
    expect(caseFnames).toHaveLength(3)
    expect(argsFnames).toHaveLength(2)
    for (const actFname of reportFnames) expect(actFname).toMatch(exptFname)
  })

  it('should generate specific allure report name', () => {
    expect(suiteNames).toContain(AllureReporter.reportName)
  })

  it('should generate specific feature report name', () => {
    expect(suiteNames).toContain('[moduleA] Fake Feature')
  })

  it('should generate scenario report', () => {
    const actResult = caseReports.find(report => report.name === 'Fake Scenario')
    expect(actResult).toMatchSnapshot(exptResult(exptDesc('A', 'A1')))
    for (const actStep of actResult.steps) expect(actStep).toMatchSnapshot(exptStep)
  })

  it('should generate scenario outline report', () => {
    const actResult1 = caseReports.find(report => report.name === 'Fake Scenario Outline (admin)')
    const actResult2 = caseReports.find(report => report.name === 'Fake Scenario Outline (user)')
    expect(actResult1).toMatchSnapshot(exptResult(exptDesc('B', 'B1')))
    expect(actResult2).toMatchSnapshot(exptResult(exptDesc('B', 'B2')))
    for (const actStep of actResult1.steps) expect(actStep).toMatchSnapshot(exptStep)
    for (const actStep of actResult2.steps) expect(actStep).toMatchSnapshot(exptStep)
  })
})
