# Commit Message Convention

Default to Conventional Commits unless this repo's recent history or docs say otherwise.

Format:

```text
<type>(<optional scope>): <short imperative summary>

<optional body explaining what and why>

<optional footer>
```

Common types:

- `feat` - new feature
- `fix` - bug fix
- `docs` - documentation only
- `style` - formatting/whitespace only
- `refactor` - code change that neither fixes nor adds a feature
- `perf` - performance improvement
- `test` - tests only
- `build` - build system or dependencies
- `ci` - CI configuration
- `chore` - maintenance
- `revert` - revert a prior change

Rules:

- Subject line is imperative, present tense, and preferably <= 72 characters.
- Add `!` after type/scope and/or a `BREAKING CHANGE:` footer for breaking changes.
- One commit should contain one coherent logical change.
- Prefer an explicit repo convention over these defaults.
- This skill drafts the message only. Do not run `git add` or `git commit`.
