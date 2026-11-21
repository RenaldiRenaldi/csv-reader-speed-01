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

  while (pos < length) {
    const lf = next('\n', pos);
    let end = lf;
    if (lf < length && text.charCodeAt(lf - 1) === 13) end--;
    if (quote < pos) quote = next('"', pos);
    if (cr < pos) cr = next('\r', pos);

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
          const comma = text.indexOf(',', start);
          if (comma < 0 || comma >= end) break;
          row[field] = text.slice(start, comma);
          start = comma + 1;
        }
        if (field === width - 1) {
          const comma = text.indexOf(',', start);
          if (comma < 0 || comma >= end) {
            row[field] = text.slice(start, end);
            rows.push(row);
            pos = lf + 1;
            line++;
            continue;
          }
        }
      }
    }

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
          const char = text.charCodeAt(pos);
          if (char === 34) {
            value += text.slice(start, pos++);
            if (text.charCodeAt(pos) !== 34) {
              closed = true;
              break;
            }
            value += '"';
            start = ++pos;
          } else if (char === 13) {
            value += text.slice(start, pos) + '\n';
            pos += text.charCodeAt(pos + 1) === 10 ? 2 : 1;
            start = pos;
            line++;
          } else {
            if (char === 10) line++;
            pos++;
          }
        }
        if (!closed) {
          pos = open + 1;
          line = openLine;
          value = '"';
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        }
      }

      let start = pos;
      let kept = 0;
      while (pos < length) {
        const char = text.charCodeAt(pos);
        if (char === 44 || char === 10 || (char === 13 && text.charCodeAt(pos + 1) === 10)) break;
        if (char === 13) {
          value += text.slice(start, pos);
          kept += pos - start;
          errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
          start = ++pos;
        } else {
          pos++;
        }
      }
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
