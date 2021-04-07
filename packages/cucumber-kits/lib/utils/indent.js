module.exports = (text, level, spaces) => {
  let prefix = ''
  for (let i = 0; i < level; i++) prefix += spaces
  return text
    .split('\n')
    .map(line => prefix + line)
    .join('\n')
}
