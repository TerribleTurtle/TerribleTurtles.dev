/** @type {import('stylelint').Config} */
export default {
  extends: [
    "stylelint-config-standard",
    "stylelint-config-astro"
  ],
  rules: {
    "color-named": "never",
    "color-no-hex": [true, { ignoreProperties: ["/^--/"] }],
    "function-disallowed-list": ["rgb", "rgba", "hsl", "hsla"],
    "declaration-property-value-allowed-list": {
      "/^color$/": ["/^var\\(/", "transparent", "inherit", "initial", "currentColor"],
      "/^background-color$/": ["/^var\\(/", "transparent", "inherit", "initial", "currentColor", "none"],
      "/^border-color$/": ["/^var\\(/", "transparent", "inherit", "initial", "currentColor", "none"],
      "/^fill$/": ["/^var\\(/", "transparent", "inherit", "initial", "currentColor", "none"],
      "/^stroke$/": ["/^var\\(/", "transparent", "inherit", "initial", "currentColor", "none"]
    }
  }
};
