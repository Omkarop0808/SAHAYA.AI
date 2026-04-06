# Project Rules:
- Always detect required skills based on the user's prompt.
- Load only relevant skills from the `.claude/skills/` directory.
- Keep output minimal and structured.
- Prioritize performance and clarity.
- Utilize the 21st-dev magic MCP for UI/UX elements.

## Auto Skill Detection System
If task includes:
- UI → load frontend-design
- UX → load ui-ux-pro-max
- SEO → load seo
- Security → load owasp-security
- Code → load code-review