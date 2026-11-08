# rules/

The AI's behaviour settings. No code lives here. Full documentation: `RULES.md` (how files are loaded, rendered,
validated and changed), `HARNESS.md` (where each file is used) and `GUARDRAILS.md` (the safety policy).

After any change: bump the file's `version`, run `python scripts/validate_rules.py` and the Quick Model Test,
then reload with `POST /api/admin/reload-rules`.
