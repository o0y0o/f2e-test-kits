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

beforeAll(async () => {
  await execAsync('cucumber-js test/feature --require test/step --format test/lib/AllureReporter.js')
  reportFnames.push(...(await fs.readdir(AllureReporter.reportDir)))
  suiteFnames.push(...reportFnames.filter(fname => /-container\.json$/.test(fname)))
  suiteNames.push(...suiteFnames.map(fname => require(path.join(AllureReporter.reportDir, fname)).name))
  caseFnames.push(...reportFnames.filter(fname => /-result\.json$/.test(fname)))
  caseReports.push(...caseFnames.map(fname => require(path.join(AllureReporter.reportDir, fname))))
})

describe('@0y0/cucumber-kits/CucumberAllureReporter', () => {
  it('should generate expected allure results', () => {
    expect(reportFnames).toHaveLength(5)
    expect(suiteFnames).toHaveLength(2)
    expect(caseFnames).toHaveLength(3)

    const expectedFname = /^allure-test-reports_[\w-]+-(container|result)\.json/
    for (const fname of reportFnames) expect(fname).toMatch(expectedFname)
  })

  it('should generate specific allure report name', () => {
    expect(suiteNames).toContain(AllureReporter.reportName)
  })

  it('should generate specific feature report name', () => {
    expect(suiteNames).toContain('[moduleA] Fake Feature')
  })
})
