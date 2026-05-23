// Replacement for Next.js's bundled `polyfill-module` shim.
//
// Our `package.json` browserslist gates the site to Chrome 93+, Firefox 92+,
// Safari 15.4+, iOS Safari 15.4+, and equivalent Edge / Android Chrome — all
// of which natively support Array.prototype.{at,flat,flatMap},
// Object.{hasOwn,fromEntries}, String.prototype.{trimStart,trimEnd},
// Promise.prototype.finally, and Symbol.prototype.description. Next.js
// bundles them anyway because its internal support matrix is broader; that
// adds ~12 KiB of dead code per Lighthouse "Legacy JavaScript". This file is
// aliased over `next/dist/build/polyfills/polyfill-module` via the webpack
// config so the bytes never ship.
//
// If you bump the browserslist to support older browsers, remove the alias.
//
// URL.canParse (Chrome 120+, Safari 17+) is the one item Next polyfills here
// that some of our supported browsers lack — we don't call it anywhere in
// the codebase, but if you start, polyfill it locally instead of restoring
// the full Next shim.
