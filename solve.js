// Fast drop-in for csv-reader 1.0.0 (make.fun's own reference program): run(input) returns
// exactly csv-reader's answer {columns, rows, errors} for every input {text, header}, but
// reads the text with bulk scans instead of one character at a time.
//
// Design: two paths, both branch-exact with the reference.
//  - Fast path: a record whose line holds no quote and no stray CR is split by ',' with
//    indexOf and String.slice only; a line ending in CRLF is trimmed at the CR.
//  - Careful path: a record holding a quote or a stray CR is read field by field. An
//    unquoted field ends at the nearest of ',' / LF / CR (indexOf), so a stray CR costs a
//    rescan only where it actually occurs. A quoted field finds its closing quote with
//    indexOf (doubled "" skipped), slices the span directly when it holds no CR and no
//    doubled quote, and only then builds the value segment by segment ("" -> ", CR/CRLF
//    -> LF, counting lines). A quote that never closes is a literal character and the
//    text after it is re-read as unquoted, exactly as the reference does.
//
// Error records, line/row numbering, the header rule, short/long row padding and cutting,
// the single-empty-unquoted-field skip and the leading BOM/empty-line rules all follow
// the reference's order and shapes.

const COMMA = 44; // ','
const LF = 10; // '\n'
const CR = 13; // '\r'
const QUOTE = 34; // '"'

const ENDED_COMMA = 0;
const ENDED_BREAK = 1;
const ENDED_END = 2;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const len = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (len > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // One scratch result shared by the field readers: they write R and return it, so a
  // case's ~150k fields cost no result object each.
  const R = { value: '', ended: 0, added: 0 };

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads unquoted characters from pos up to the next comma or line break: a CR not
  // followed by LF is dropped (stray_cr). Writes the field into R and how it ended;
  // R.added counts the characters kept by this call (not the `value0` it started from).
  function readUnquoted(value0) {
    let value = value0;
    let added = 0;
    let segStart = pos;
    while (true) {
      const comma = text.indexOf(',', pos);
      const lf = text.indexOf('\n', pos);
      const cr = text.indexOf('\r', pos);
      let m = -1;
      let kind = 0;
      if (comma !== -1) {
        m = comma;
        kind = 0;
      }
      if (lf !== -1 && (m === -1 || lf < m)) {
        m = lf;
        kind = 1;
      }
      if (cr !== -1 && (m === -1 || cr < m)) {
        m = cr;
        kind = 2;
      }
      if (m === -1) {
        value += text.slice(segStart, len);
        added += len - segStart;
        pos = len;
        R.value = value;
        R.ended = ENDED_END;
        R.added = added;
        return R;
      }
      if (kind === 0) {
        value += text.slice(segStart, m);
        added += m - segStart;
        pos = m + 1;
        R.value = value;
        R.ended = ENDED_COMMA;
        R.added = added;
        return R;
      }
      if (kind === 1) {
        value += text.slice(segStart, m);
        added += m - segStart;
        pos = m + 1;
        line += 1;
        R.value = value;
        R.ended = ENDED_BREAK;
        R.added = added;
        return R;
      }
      if (text.charCodeAt(m + 1) === LF) {
        value += text.slice(segStart, m);
        added += m - segStart;
        pos = m + 2;
        line += 1;
        R.value = value;
        R.ended = ENDED_BREAK;
        R.added = added;
        return R;
      }
      // A lone CR: dropped, and the field goes on after it.
      error('stray_cr');
      value += text.slice(segStart, m);
      added += m - segStart;
      pos = m + 1;
      segStart = m + 1;
    }
  }

  // Builds the value of a quoted span [a, b): doubled quotes collapse to one, CR and
  // CRLF each become one LF, and every line break inside counts. Only called when the
  // span holds a CR or a doubled quote; the common span is sliced directly.
  function buildQuotedSpan(a, b) {
    let parts = null;
    let seg = a;
    let i = a;
    while (i < b) {
      const c = text.charCodeAt(i);
      if (c === QUOTE) {
        if (parts === null) parts = [];
        parts.push(text.slice(seg, i));
        parts.push('"');
        i += 2;
        seg = i;
      } else if (c === CR) {
        if (parts === null) parts = [];
        parts.push(text.slice(seg, i));
        parts.push('\n');
        line += 1;
        i += text.charCodeAt(i + 1) === LF ? 2 : 1;
        seg = i;
      } else {
        if (c === LF) line += 1;
        i += 1;
      }
    }
    if (parts === null) return text.slice(a, b);
    parts.push(text.slice(seg, b));
    return parts.join('');
  }

  // Reads a quoted field whose opening quote is at pos. Writes the field into R.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let close = text.indexOf('"', pos + 1);
    if (close === -1) return unterminated(open, openLine);
    let doubled = false;
    while (text.charCodeAt(close + 1) === QUOTE) {
      doubled = true;
      close = text.indexOf('"', close + 2);
      if (close === -1) return unterminated(open, openLine);
    }
    const crAt = text.indexOf('\r', open + 1);
    const hasCR = crAt !== -1 && crAt < close;
    let value;
    if (!doubled && !hasCR) {
      value = text.slice(open + 1, close);
      let i = text.indexOf('\n', open + 1);
      while (i !== -1 && i < close) {
        line += 1;
        i = text.indexOf('\n', i + 1);
      }
    } else {
      value = buildQuotedSpan(open + 1, close);
    }
    pos = close + 1;
    if (pos >= len) {
      R.value = value;
      R.ended = ENDED_END;
      R.added = 0;
      return R;
    }
    const c = text.charCodeAt(pos);
    if (c === COMMA) {
      pos += 1;
      R.value = value;
      R.ended = ENDED_COMMA;
      R.added = 0;
      return R;
    }
    if (c === LF) {
      pos += 1;
      line += 1;
      R.value = value;
      R.ended = ENDED_BREAK;
      R.added = 0;
      return R;
    }
    if (c === CR && text.charCodeAt(pos + 1) === LF) {
      pos += 2;
      line += 1;
      R.value = value;
      R.ended = ENDED_BREAK;
      R.added = 0;
      return R;
    }
    // What follows the closing quote is appended as it stands, up to the next comma
    // or line break.
    const junk = readUnquoted(value);
    if (junk.added > 0) error('quote_junk');
    return junk;
  }

  // The quote never closes: it is a literal character, and the text after it is read
  // again as an unquoted field.
  function unterminated(open, openLine) {
    pos = open + 1;
    line = openLine;
    error('unterminated_quote');
    return readUnquoted('"');
  }

  // Reads one record field by field (the careful path): used when its line holds a
  // quote or a stray CR. Returns the fields; the last field's quoted flag goes in
  // lastQuoted.
  let lastQuoted = false;
  function parseRecordCareful() {
    const fields = [];
    let ended;
    do {
      if (text.charCodeAt(pos) === QUOTE) {
        readQuoted();
        lastQuoted = true;
      } else {
        readUnquoted('');
        lastQuoted = false;
      }
      fields.push(R.value);
      ended = R.ended;
    } while (ended === ENDED_COMMA);
    return fields;
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === LF) {
        pos += 1;
        line += 1;
      } else if (c === CR && text.charCodeAt(pos + 1) === LF) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    const nl = text.indexOf('\n', pos);
    const lineEnd = nl === -1 ? len : nl;
    const q = text.indexOf('"', pos);
    let fields;
    if (q !== -1 && q < lineEnd) {
      // A quoted field starts on this line: the record may span lines.
      fields = parseRecordCareful();
    } else {
      const cr = text.indexOf('\r', pos);
      if (cr !== -1 && cr < lineEnd && !(cr === lineEnd - 1 && nl !== -1)) {
        // A lone CR on this line: the careful path drops it with a stray_cr error.
        fields = parseRecordCareful();
      } else {
        // Fast path: no quotes, no stray CR; split this line by ','.
        const contentEnd = cr === lineEnd - 1 && nl !== -1 ? lineEnd - 1 : lineEnd;
        fields = [];
        let fs = pos;
        while (true) {
          const comma = text.indexOf(',', fs);
          if (comma === -1 || comma >= contentEnd) {
            fields.push(text.slice(fs, contentEnd));
            break;
          }
          fields.push(text.slice(fs, comma));
          fs = comma + 1;
        }
        lastQuoted = false;
        line += 1;
        pos = nl === -1 ? len : nl + 1;
      }
    }

    // A line that held only stray CRs is left with no characters: no record (its
    // stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
