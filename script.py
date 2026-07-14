import os

base_dir = r"C:\Users\evanw\.gemini\antigravity\brain\9b3b361e-9c79-4360-a06c-dcd685073bf3\.system_generated\worktrees\subagent-UI-Implementer-self-1bd2af08"

global_css_path = os.path.join(base_dir, "src", "styles", "global.css")
with open(global_css_path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    "  --text-primary: #F4F4F4;\n  --text-muted: #94A3B8;\n  --accent-primary: #2A9D8F;\n  --border-color: #2E2E2E;\n  /* stylelint-enable color-no-hex */\n  --border-radius: 8px; /* 6px to 8px range from SDD */\n  --border-radius-sm: 6px;\n  --font-sans: 'Inter', sans-serif;\n  --font-mono: 'Fira Code', monospace;\n}",
    "  --text-primary: #F4F4F4;\n  --text-muted: #64748B;\n  --accent-primary: #2A9D8F;\n  --border-color: #2E2E2E;\n  /* stylelint-enable color-no-hex */\n  --border-radius: 8px; /* 6px to 8px range from SDD */\n  --border-radius-sm: 6px;\n  --space-xs: 0.25rem;\n  --space-sm: 0.5rem;\n  --space-md: 1rem;\n  --space-lg: 1.5rem;\n  --space-xl: 2rem;\n  --space-2xl: 2.5rem;\n  --font-sans: 'Inter', sans-serif;\n  --font-mono: 'Fira Code', monospace;\n}"
)

content = content.replace(
    "* {\n  box-sizing: border-box;\n}",
    "* {\n  box-sizing: border-box;\n}\n\n.container {\n  max-width: 900px;\n  margin: 0 auto;\n  padding: 0 1.5rem;\n}"
)

content = content.replace(
    "a {\n  color: var(--accent-primary);\n  text-decoration: underline;\n}\n\n*:focus-visible {\n  outline: 2px solid var(--accent-primary);\n  outline-offset: 2px;\n}\n\na:hover {\n  text-decoration: underline;\n}",
    "a {\n  color: var(--accent-primary);\n  text-decoration: none;\n  transition: text-decoration-color 0.2s ease;\n}\n\n*:focus-visible {\n  outline: 2px solid var(--accent-primary);\n  outline-offset: 2px;\n}\n\na:hover {\n  text-decoration: underline;\n  text-decoration-thickness: 2px;\n  text-underline-offset: 4px;\n}"
)

with open(global_css_path, "w", encoding="utf-8") as f:
    f.write(content)

layout_path = os.path.join(base_dir, "src", "layouts", "BaseLayout.astro")
with open(layout_path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    "    <title>{title}</title>\n    \n  </head>",
    "    <title>{title}</title>\n    <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\" />\n    <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin />\n    <link href=\"https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=Inter:wght@400;500;600;700&display=swap\" rel=\"stylesheet\" />\n  </head>"
)

content = content.replace("    <header>", "    <header class=\"container\">")
content = content.replace("    <main id=\"main\">", "    <main id=\"main\" class=\"container\">")
content = content.replace("    <footer>", "    <footer class=\"container\">")

content = content.replace(
    "  header nav ul, footer nav ul {\n    display: flex;\n    gap: 1rem;\n    list-style: none;\n    padding: 1rem;\n    margin: 0;\n  }\n  \n  header {\n    border-bottom: 1px solid var(--border-color);\n  }\n  \n  footer {\n    border-top: 1px solid var(--border-color);\n    margin-top: 2rem;\n  }\n  \n  .skip-link {\n    position: absolute;\n    top: -40px;\n    left: 0;\n    background: var(--accent-primary);\n    color: var(--bg-base);\n    padding: 8px;\n    z-index: 100;\n  }\n  \n  .skip-link:focus {\n    top: 0;\n  }",
    "  header nav ul, footer nav ul {\n    display: flex;\n    gap: var(--space-md);\n    list-style: none;\n    padding: var(--space-md);\n    margin: 0;\n  }\n  \n  header {\n    border-bottom: 1px solid var(--border-color);\n  }\n  \n  footer {\n    border-top: 1px solid var(--border-color);\n    margin-top: var(--space-xl);\n  }\n  \n  .skip-link {\n    position: absolute;\n    top: calc(var(--space-2xl) * -1);\n    left: 0;\n    background: var(--accent-primary);\n    color: var(--bg-base);\n    padding: var(--space-sm);\n    z-index: 100;\n  }\n  \n  .skip-link:focus {\n    top: 0;\n  }"
)

with open(layout_path, "w", encoding="utf-8") as f:
    f.write(content)

card_path = os.path.join(base_dir, "src", "components", "ProjectCard.astro")
with open(card_path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    "const { title, description, link, tags = [] } = Astro.props;\n---",
    "const { title, description, link, tags = [] } = Astro.props;\nconst descId = desc-;\n---"
)

content = content.replace(
    "    <h3><a href={link} class=\"card-link\">{title}</a></h3>\n  </header>\n  <div class=\"content\">\n    <p>{description}</p>\n  </div>\n  {tags.length > 0 && (\n    <footer>\n      <ul class=\"tags\">",
    "    <h3><a href={link} class=\"card-link\" aria-describedby={descId}>{title}</a></h3>\n  </header>\n  <div class=\"content\">\n    <p id={descId}>{description}</p>\n  </div>\n  {tags.length > 0 && (\n    <footer>\n      <ul class=\"tags\" aria-label=\"Project tags\">"
)

content = content.replace(
    "    gap: 1rem;\n    background-color: var(--surface-card);\n    border: 1px solid var(--border-color);\n    border-radius: var(--border-radius);\n    padding: 1.5rem;",
    "    gap: var(--space-md);\n    background-color: var(--surface-card);\n    border: 1px solid var(--border-color);\n    border-radius: var(--border-radius);\n    padding: var(--space-lg);"
)

content = content.replace(
    "    flex-wrap: wrap;\n    gap: 0.5rem;\n    list-style: none;",
    "    flex-wrap: wrap;\n    gap: var(--space-sm);\n    list-style: none;"
)

content = content.replace(
    "    font-size: 0.75rem;\n    padding: 0.25rem 0.5rem;\n    background-color: var(--bg-base);\n    border: 1px solid var(--border-color);\n    border-radius: var(--border-radius-sm);\n    color: var(--text-muted);",
    "    font-size: 0.75rem;\n    padding: var(--space-xs) var(--space-sm);\n    background-color: var(--bg-base);\n    border: 1px solid var(--border-color);\n    border-radius: var(--border-radius-sm);\n    color: #CBD5E1;"
)

with open(card_path, "w", encoding="utf-8") as f:
    f.write(content)

print('success')
