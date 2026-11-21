# Broken CSV reader

[![Competition](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/competitions/csv-reader-speed-01-run-20261121)
[![Rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/RenaldiRenaldi/csv-reader-speed-01/rank.svg)](https://make.fun/competitions/csv-reader-speed-01-run-20261121)
[![Reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/RenaldiRenaldi/csv-reader-speed-01/reward.svg)](https://make.fun/competitions/csv-reader-speed-01-run-20261121)

This entry uses delimiter searches and pre-sized rows for clean LF and CRLF records. The fallback preserves csv-reader 1.0.0's quoting, line numbering, width repair, and error order.

Run with Node 22.18 or later. The driver reads `/input/cases.json` and writes `/output/answers.json`. Set `MAKEFUN_INPUT_DIR` and `MAKEFUN_OUTPUT_DIR` to use local directories.
