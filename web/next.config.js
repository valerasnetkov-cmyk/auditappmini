const path = require('path')

/**
 * Resolve Next.js workspace tracing to the monorepo root
 * This suppresses the warning about multiple lockfiles in a monorepo setup.
 */
module.exports = {
  outputFileTracingRoot: path.resolve(__dirname, '..'),
}
