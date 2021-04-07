const chalk = require('chalk')
const cliTruncate = require('cli-truncate')
const logUpdate = require('log-update')
const indent = require('./utils/indent')

function createSpinner(frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']) {
  let i = 0
  return () => frames[(i = ++i % frames.length)]
}

function truncate(text) {
  return cliTruncate(text, process.stdout.columns).replace(/…$/, chalk.gray('…'))
}

function getTaskSymbol(task) {
  if (!task.spinner) task.spinner = createSpinner()
  if (task.isPending()) return chalk.yellow(task.hasSubtasks() ? '❯' : task.spinner())
  if (task.isCompleted()) return chalk.green('✔')
  if (task.hasFailed()) return chalk.red('✖')
  if (task.isSkipped()) return chalk.yellow('↓')
  return ' '
}

function getTaskListLog(tasks, level = 0) {
  const lines = []
  for (const task of tasks) {
    if (!level && !task.task.isStarted()) continue
    const skippedText = task.isSkipped() ? ` ${chalk.dim('[skipped]')}` : ''
    lines.push(truncate(indent(` ${getTaskSymbol(task)} ${task.title}${skippedText}`, level, '  ')))
    if (task.hasFailed() && task.output) {
      const messages = task.output.replace(/(^\n+|\n+$)/g, '').split('\n')
      for (let i = 0; i < Math.min(messages.length, 100); i++) {
        const symbol = i === 0 ? '→' : ' '
        lines.push(truncate(`   ${indent(chalk.gray(`${symbol} ${messages[i]}`), level, '  ')}`))
      }
    }
    if (task.hasSubtasks() && (task.isPending() || task.hasFailed())) {
      lines.push(getTaskListLog(task.subtasks, level + 1))
    }
  }
  return lines.join('\n')
}

module.exports = class TaskRenderer {
  constructor(tasks, options) {
    this.tasks = tasks
    this.options = options
    this.spinner = createSpinner(['🌕', '🌖', '🌗', '🌘', '🌒', '🌓', '🌔'])
  }

  paint() {
    let log = getTaskListLog(this.tasks)
    const stats = this.options.getTaskStats()
    if (stats.finished !== stats.total) {
      const progress = ` ${this.spinner()}  Progress: ${((stats.finished / stats.total) * 100).toFixed(1)}% `
      log += `\n ${chalk.white.bgBlackBright.bold(progress)}`
    }
    logUpdate(log)
  }

  render() {
    if (this.intervalId) return
    this.intervalId = setInterval(this.paint.bind(this), 100)
  }

  end() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }
    this.paint()
    logUpdate.done()
  }
}
