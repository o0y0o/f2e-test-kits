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
const args = []

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
const exptArgAtt = {
  source: expect.stringMatching(/-arguments\.csv$/)
}

beforeAll(async () => {
  await execAsync('cucumber-js test/feature --require test/step --format test/lib/AllureReporter.js')
  reportFnames.push(...(await fs.readdir(AllureReporter.reportDir)))
  suiteFnames.push(...reportFnames.filter(fname => /-container\.json$/.test(fname)))
  suiteNames.push(...suiteFnames.map(fname => require(path.join(AllureReporter.reportDir, fname)).name))
  caseFnames.push(...reportFnames.filter(fname => /-result\.json$/.test(fname)))
  caseReports.push(...caseFnames.map(fname => require(path.join(AllureReporter.reportDir, fname))))
  argsFnames.push(...reportFnames.filter(fname => /-arguments\.csv$/.test(fname)))
  args.push(
    ...(await Promise.all(
      argsFnames.map(async fname => {
        const bf = await fs.readFile(path.join(AllureReporter.reportDir, fname))
        const content = bf.toString('utf8')
        return { fname, content }
      })
    ))
  )
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
    validateTestResult(actResult, 'A', 'A1')
  })

  it('should generate scenario outline report', () => {
    const actResult1 = caseReports.find(report => report.name === 'Fake Scenario Outline (admin)')
    const actResult2 = caseReports.find(report => report.name === 'Fake Scenario Outline (user)')
    validateTestResult(actResult1, 'B', 'B1')
    validateTestResult(actResult2, 'B', 'B2')
  })

  function validateTestResult(act, mod, func) {
    expect(act).toMatchSnapshot(exptResult(exptDesc(mod, func)))
    for (const actStep of act.steps) {
      expect(actStep).toMatchSnapshot(exptStep)
      if (actStep.name.includes('attaches')) {
        const actArgAtt = actStep.attachments[0]
        expect(actArgAtt).toMatchSnapshot(exptArgAtt)
        const actArg = args.find(({ fname }) => fname === actArgAtt.source)
        expect(actArg.content).toMatchSnapshot()
      }
    }
  }
})
