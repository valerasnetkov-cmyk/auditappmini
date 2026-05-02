const path = require('path')

module.exports = {
  // Enable React strict mode for catching potential issues
  reactStrictMode: true,
  // Root for Next's output file tracing (monorepos like this repo require a correct root)
  outputFileTracingRoot: path.resolve(__dirname, '..'),
}
