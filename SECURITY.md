# Security Policy

## Supported Versions

The actively supported branch for this repository is:

| Version | Supported |
| --- | --- |
| `main` | Yes |

Feature branches are short-lived delivery branches and should be merged or closed promptly.

## Reporting a Vulnerability

Please do not open a public issue for unpatched security problems.

If GitHub private vulnerability reporting is enabled for this repository, use the **Report a vulnerability** flow in the Security tab. Otherwise, contact the repository owner through a private channel and include:

- a short description of the issue
- affected files, routes, or workflows
- reproduction steps or proof of concept
- severity and potential impact
- suggested mitigation, if known

We will aim to acknowledge reports promptly, validate impact, and coordinate a fix before public disclosure.

## Security Baseline

This repository is intended to follow a lightweight secure-by-default baseline:

- pull requests for changes to `main`
- automated CI for install and test validation
- dependency update automation through Dependabot
- dependency auditing in GitHub Actions
- CodeQL analysis for JavaScript and TypeScript code
- no committed secrets or live environment values
