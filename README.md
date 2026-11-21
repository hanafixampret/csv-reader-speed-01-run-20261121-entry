# csv-reader-speed-01-run-20261121-entry

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/hanafixampret/csv-reader-speed-01-run-20261121-entry/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/hanafixampret/csv-reader-speed-01-run-20261121-entry/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A fast drop-in for csv-reader 1.0.0: a single-pass, slice-based CSV reader that answers exactly as the reference does on every case — broken rows included (stray CRs, quote junk, unterminated quotes, short and long rows). Records without quotes or stray CRs are split by `indexOf` alone; records with quotes take a field-by-field path that slices quoted spans directly and only rebuilds the rare span holding a doubled quote or a CR.

## Run it

```sh
node main.ts
```

It reads every case from `/input/cases.json` (or `$MAKEFUN_INPUT_DIR`) and writes `/output/answers.json` (or `$MAKEFUN_OUTPUT_DIR`).

---

<sub>Entered on [make.fun](https://make.fun/?ref=hnbaye7d&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
