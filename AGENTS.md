# Big8K Agent Guide

This repository is a field-debugging tool, not a demo app. Keep changes small,
traceable, and easy to verify on real 8K OLED hardware.

## Working Habits

- Think before editing. State assumptions, success criteria, and likely risks.
- Prefer the simplest working change. Do not add speculative abstractions.
- Make surgical edits. Touch only files required by the current task.
- Preserve known-good hardware flows unless the task explicitly changes them.
- Verify with local commands whenever possible, and record what was not verified.
- Treat unclear device behavior as a fact-finding problem, not a styling problem.

## Project Rules

- Keep `README.md` as the project map and `docs/README.md` as the document index.
- Use `resources/README.md` for deployment resource layout and manifest notes.
- Avoid PowerShell bulk replacement on Chinese text files; it can corrupt encoding.
- Do not delete hardware references, deployment scripts, or generated release
  artifacts unless they are explicitly classified first.
- Keep C# PC-SW parity in mind when changing behavior. The migration target is
  reliable field operation, not a clean-room rewrite.

## Review Checklist

- Frontend action names must match registered Tauri commands.
- Shell and ADB/SSH command paths need quoting or strict allowlists.
- High-impact operations such as reboot, initrd repack, delete, and kill must be
  visible in the UI and reviewable in logs.
- Bundled resources must match deployment manifests and README documentation.
- Build outputs, caches, logs, and one-off analysis artifacts should stay out of
  source control.

