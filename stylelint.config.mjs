/**
 * Colour discipline:
 * - Raw colour values (hex, named colours, any colour function) are banned everywhere
 *   except `src/styles/tokens.css`, which may use `oklch()` inside `light-dark()`.
 * - Colour-bearing properties must use `var(--token)` or a safe keyword.
 * - `color-scheme` is a keyword property, not a colour, so it is excluded from the
 *   strict-value regex (a plain `/color/` match would wrongly catch it).
 *
 * @type {import('stylelint').Config}
 */
const colorFunctions = ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color', 'color-mix', 'light-dark'];
const safeKeywords = ['transparent', 'inherit', 'initial', 'currentcolor', 'currentColor', 'none'];
/** CSS system colour keywords allowed for forced-colors high contrast mode. */
const systemColors = ['CanvasText', 'GrayText', 'Canvas'];

export default {
  plugins: ['stylelint-declaration-strict-value'],
  extends: ['stylelint-config-standard', 'stylelint-config-astro'],
  rules: {
    'scale-unlimited/declaration-strict-value': [
      ['/^(color|.+-color)$/', 'fill', 'stroke'],
      { ignoreValues: [...safeKeywords, ...systemColors, '/^var\\(/i'] },
    ],
    'color-named': 'never',
    'color-no-hex': true,
    'function-disallowed-list': colorFunctions,
    'declaration-property-value-allowed-list': {
      '/^color$/': ['/^var\\(/', 'transparent', 'inherit', 'initial', 'currentcolor', 'currentColor', ...systemColors],
      '/^background-color$/': ['/^var\\(/', ...safeKeywords, ...systemColors],
      '/^border-color$/': ['/^var\\(/', ...safeKeywords, ...systemColors],
      '/^fill$/': ['/^var\\(/', ...safeKeywords, ...systemColors],
      '/^stroke$/': ['/^var\\(/', ...safeKeywords, ...systemColors],
    },
    'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global'] }],
  },
  overrides: [
    {
      // The single source of raw colour values.
      files: ['src/styles/tokens.css'],
      rules: {
        'function-disallowed-list': colorFunctions.filter((fn) => fn !== 'oklch' && fn !== 'light-dark'),
      },
    },
  ],
};
