# Broken CSV reader

[![Competition](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![Rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/RenaldiRenaldi/csv-reader-speed-01/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![Reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/RenaldiRenaldi/csv-reader-speed-01/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

This entry uses delimiter searches and pre-sized rows for clean LF and CRLF records. The fallback preserves csv-reader 1.0.0's quoting, line numbering, width repair, and error order.

Run with Node 22.18 or later. The driver reads `/input/cases.json` and writes `/output/answers.json`. Set `MAKEFUN_INPUT_DIR` and `MAKEFUN_OUTPUT_DIR` to use local directories.

The fast path accepts a record only when no quote or stray CR occurs before its terminator and the comma count gives the established width. Under those conditions each slice is one complete field, no parser error can occur, and the terminator advances the physical line count once. Empty physical lines are skipped. The fallback handles the first record, ragged rows and any record that may contain quoting or stray CRs. It records errors against the starting line and row, even when a quoted field spans lines.

Run the local differential test and CPU benchmark with the unpacked competition kit:

```sh
node tools/verify.mjs /path/to/kit
```

The verifier checks exhaustive short inputs under both header settings, the practice set, and 12 reproducible sets from the kit generator. It then compares every timed output byte for byte with a fresh house run on the same set. It alternates execution order, using one warm-up and nine timed runs per program per set. The reported CPU means drop the two fastest and two slowest runs, matching the heat's trimming rule.
