# Gate ledger

One file per judgment-gate run: `YYYY-MM-DD-<gate>-<slug>.md` with
frontmatter `gate` (integration | security | design), `date`, `surface`,
`result` (pass | fail), `findings` (count), and the report summary as the
body. `npm run gate:sweep` reads this directory (by file mtime) to detect
judgment gates owed after changes. Skipping a gate on a triggering change is
allowed only WITH a stated reason recorded in the nearest report.
