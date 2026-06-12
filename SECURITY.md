# Security Policy

## Supported version

Security fixes are applied to the current `master` branch. Older snapshots and
unmaintained deployments should be upgraded before reporting compatibility
issues.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability.

Send a report to [info@auditavto.ru](mailto:info@auditavto.ru) with
`[SECURITY]` in the subject. Include:

- affected component and version or commit;
- reproduction steps or a minimal proof of concept;
- expected impact and affected data or roles;
- suggested mitigation, if known.

Please avoid accessing data that does not belong to your test account,
disrupting service availability, social engineering, or publishing details
before a fix is available.

We aim to acknowledge reports within five business days. Disclosure timing is
coordinated after validation and remediation.

## Scope

The policy covers:

- backend authentication, MFA, tenant isolation, billing and upload APIs;
- the Next.js web application and resource administration;
- the Expo mobile application;
- deployment, backup and CI configuration stored in this repository.

Detailed runtime controls and known security backlog are documented in
[`docs/SECURITY.md`](docs/SECURITY.md).
