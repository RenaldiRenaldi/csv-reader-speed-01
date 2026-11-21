// Delimiter searches handle clean records. Only the fallback interprets CSV
// quoting and records errors. All offsets are UTF-16 code unit indices.
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const length = text.length;
  const rows = [];
  const errors = [];
  let columns = null;
  let width = -1;
  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;

  function next(char, from) {
    const found = text.indexOf(char, from);
    return found < 0 ? length : found;
  }

  // Cache the next exceptional character across records. Searching from every
  // record would repeatedly scan the same suffix when a character is rare.
  let quote = next('"', pos);
  let cr = next('\r', pos);
  let comma = next(',', pos);
  let lf = next('\n', pos);

  while (pos < length) {
    if (lf < pos) lf = next('\n', pos);
    let end = lf;
    if (lf < length && text.charCodeAt(lf - 1) === 13) end--;
    if (quote < pos) quote = next('"', pos);
    if (cr < pos) cr = next('\r', pos);
    const firstComma = comma;

    if (quote >= end && cr >= end) {
      if (pos === end) {
        pos = lf + 1;
        line++;
        continue;
      }
      if (width >= 0) {
        const row = new Array(width);
        let start = pos;
        let field = 0;
        // Before the final field, every comma must lie within the record.
        for (; field < width - 1; field++) {
          if (comma < start) comma = next(',', start);
          if (comma >= end) break;
          row[field] = text.slice(start, comma);
          start = comma + 1;
        }
        if (field === width - 1) {
          if (comma < start) comma = next(',', start);
          if (comma >= end) {
            row[field] = text.slice(start, end);
            rows.push(row);
            pos = lf + 1;
            line++;
            continue;
          }
        }
      }
    }

    // A rejected width probe must not consume the fallback's comma lookahead.
    comma = firstComma;
    const recordLine = line;
    const recordRow = header && columns === null ? null : rows.length;
    const fields = width < 0 ? [] : new Array(width);
    let count = 0;
    let quoted;
    let delimiter;
    do {
      quoted = text.charCodeAt(pos) === 34;
      let value = '';
      let closed = false;
      if (quoted) {
        const open = pos++;
        const openLine = line;
        let start = pos;
        while (pos < length) {
          if (quote < pos) quote = next('"', pos);
          if (cr < pos) cr = next('\r', pos);
          if (lf < pos) lf = next('\n', pos);
          const stop = quote < cr ? quote : cr;
          while (lf < stop) {
            line++;
            lf = next('\n', lf + 1);
          }
          pos = stop;
          if (pos === length) break;
          if (pos === quote) {
            value += text.slice(start, pos++);
            if (text.charCodeAt(pos) !== 34) {
              closed = true;
              break;
            }
            value += '"';
            start = ++pos;
          } else {
            value += text.slice(start, pos) + '\n';
            pos += text.charCodeAt(pos + 1) === 10 ? 2 : 1;
            start = pos;
            line++;
          }
        }
        if (!closed) {
          pos = open + 1;
          line = openLine;
          // A failed quoted probe rewinds past the advanced lookaheads.
          quote = next('"', pos);
          cr = next('\r', pos);
          lf = next('\n', pos);
          value = '"';
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        }
      }

      let start = pos;
      let kept = 0;
      if (comma < pos) comma = next(',', pos);
      if (lf < pos) lf = next('\n', pos);
      if (cr < pos) cr = next('\r', pos);
      let stop = comma < lf ? comma : lf;
      while (cr < stop) {
        if (text.charCodeAt(cr + 1) === 10) {
          stop = cr;
          break;
        }
        value += text.slice(start, cr);
        kept += cr - start;
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        start = cr + 1;
        cr = next('\r', start);
      }
      pos = stop;
      value += text.slice(start, pos);
      kept += pos - start;
      delimiter = text.charCodeAt(pos);
      if (delimiter === 44) {
        pos++;
      } else if (pos < length) {
        pos += delimiter === 13 ? 2 : 1;
        line++;
      }
      if (closed && kept > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
      fields[count++] = value;
    } while (delimiter === 44);

    if (count === 1 && fields[0] === '' && !quoted) continue;
    if (width < 0) width = count;
    if (recordRow === null) {
      columns = fields;
    } else {
      if (count < width) {
        errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: count });
        fields.fill('', count);
      } else if (count > width) {
        errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
      }
      rows.push(fields);
    }
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
