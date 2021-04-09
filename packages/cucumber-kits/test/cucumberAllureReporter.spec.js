const { exec } = require('child_process')

describe('@0y0/cucumber-kits/CucumberAllureReporter', () => {
  it('should generate expected allure reports', done => {
    const cmd = 'cucumber-js test/feature --require test/step --format test/lib/AllureReporter.js'
    exec(cmd, error => {
      if (error) throw error
      done()
    })
  })
})
