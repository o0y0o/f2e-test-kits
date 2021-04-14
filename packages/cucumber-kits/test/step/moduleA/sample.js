const { defineStep } = require('cucumber')
const AllureReporter = require('../../lib/AllureReporter')

defineStep(/^.+ has done something$/, function () {})
defineStep(/^.+ does some actions$/, function () {})
defineStep(/^.+ gets expected results$/, function () {})
defineStep(/^.+ attaches expected results$/, function (table) {
  const { func, param, result } = table.rowsHash()
  AllureReporter.runtimeState[result] = `${func}.${param}`
})
