# Broken CSV reader

[![Competition](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![Rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/RenaldiRenaldi/csv-reader-speed-01/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![Reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/RenaldiRenaldi/csv-reader-speed-01/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

This entry uses delimiter searches and pre-sized rows for clean LF and CRLF records. The fallback preserves csv-reader 1.0.0's quoting, line numbering, width repair, and error order.

Round 5 extends the cached quote/CR lookahead to commas and LF. The fallback jumps between delimiters and exceptional characters instead of visiting every code unit. A rejected clean-record width probe restores its comma cursor, and an unterminated quoted probe invalidates its advanced lookaheads before rewinding. Both details matter for exact broken-input semantics.

The driver serializes and writes each case's answer before parsing the next case, keeping the JSON output byte-identical while reducing the lifetime of row arrays and field strings. `run(input)` still returns independent arrays and strings; it does not reuse output buffers across calls.

Run with Node 22.18 or later. The driver reads `/input/cases.json` and writes `/output/answers.json`. Set `MAKEFUN_INPUT_DIR` and `MAKEFUN_OUTPUT_DIR` to use local directories.

The fast path accepts a record only when no quote or stray CR occurs before its terminator and the comma count gives the established width. Under those conditions each slice is one complete field, no parser error can occur, and the terminator advances the physical line count once. Empty physical lines are skipped. The fallback handles the first record, ragged rows and any record that may contain quoting or stray CRs. It records errors against the starting line and row, even when a quoted field spans lines.

Run the local differential test and CPU benchmark with the unpacked competition kit:

```sh
node tools/verify.mjs /path/to/kit
```

The verifier checks exhaustive short inputs under both header settings, the practice set, and 12 reproducible sets from the kit generator. It then compares every timed output byte for byte with a fresh house run on the same set. It alternates execution order, using one warm-up and nine timed runs per program per set. The reported CPU means drop the two fastest and two slowest runs, matching the heat's trimming rule.

Profile parsing and serialization with `node tools/profile.mjs /path/to/kit`.
Compare full-driver fresh-process CPU medians against Round 4 with:

```sh
node tools/bench.mjs /path/to/kit 558ecf5 21
```

This comparison alternates process order, checks every output against the practice reference, and reports all samples in microseconds. Add `--same-driver` after the round count to isolate parser changes using the current driver for both versions. Temporary files for both verification tools stay inside the repository and are removed on completion. All timings are LOCAL measurements, not server predictions or qualification results.

The complete Round 5 differential run on Node 22.23.4 checked 235,862 case-output pairs with zero mismatches: exhaustive and targeted short inputs, practice, and 12 generated sets with nine alternating timed rounds per program. The comparisons include repeated executions and verify both the parser results and the driver's serialized output.

The final 21-round LOCAL comparison on Node 22.23.4 measured a fresh-process median of 987,682 µs for Round 4 (`558ecf5`) and 706,942 µs for Round 5: 280,740 µs saved (28.4%). This exceeds the 100,000 µs gap locally by 180,740 µs. It does not establish a server CPU time or a final-heat place.
