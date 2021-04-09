const path = require('path')
const { CucumberAllureReporter } = require('@0y0/cucumber-kits')

const suiteFormatter = (featureName, suiteId) => {
  const moduleName = suiteId.match(/feature\/(.+)\/[^/]+\.feature$/)[1]
  return `[${moduleName}] ${featureName}`
}

class AllureReporter extends CucumberAllureReporter {
  constructor(options) {
    super({
      ...options,
      allure: {
        reportName: AllureReporter.reportName,
        reportRevision: AllureReporter.reportRevision,
        reportUtcOffset: AllureReporter.reportUtcOffset,
        reportDir: AllureReporter.reportDir
      },
      suiteFormatter,
      runtimeState: AllureReporter.globalState
    })
  }
}

AllureReporter.reportName = 'Allure Test Reports'
AllureReporter.reportRevision = 'v0.0.0'
AllureReporter.reportUtcOffset = 480
AllureReporter.reportDir = path.join(__dirname, '../.tmp/allure-reports')
AllureReporter.globalState = {}

module.exports = AllureReporter
