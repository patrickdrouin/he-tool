/*
 * TSV export helpers — SciTradUM fork addition.
 *
 * `/api/evaluations/<id>/results` returns rows built for the on-screen
 * Marot viewer (public/viewer.js), which injects them as innerHTML — so a
 * literal "<br>" there is intentional markup the viewer turns back into a
 * line break, and "<v>...</v>" marks the flagged error span the same way.
 * Read as a plain text file instead, that convention is exactly backwards:
 * "<br>" shows up as literal, cluttering text, and anything the backend
 * *didn't* think to escape (a raw \r, or a multi-line comment, which gets
 * no treatment at all server-side) can silently break the file into
 * misaligned rows.
 *
 * These are two different audiences reading the same underlying data, so
 * rather than changing the shared endpoint (and risking the live viewer),
 * this cleans a row up specifically for the downloaded file: normalize
 * every line-ending variant, turn the viewer's "<br>" markup into a plain
 * space, and flatten any remaining raw newline (e.g. from a comment) into
 * a space too, so every row is guaranteed to stay on one line.
 */

function sanitizeTsvRow(row) {
  // Each row already carries its own trailing newline (appended server
  // side); drop it before cleaning so it can't get caught up in the
  // newline-flattening below, then add a single clean one back.
  const body = row.replace(/\r?\n$/, "");
  const cleaned = body
    .replace(/\r\n|\r/g, "\n") // normalize CRLF/CR so only \n remains anywhere
    .replace(/<br\s*\/?>/gi, " ") // viewer-only markup -> space in the text file
    .replace(/\n/g, " ") // any raw newline left (e.g. a multi-line comment) -> space
    .replace(/ {2,}/g, " "); // collapse the extra spaces that leaves behind
  return `${cleaned}\n`;
}

export function downloadTsv(rows, filename) {
  const blob = new Blob([rows.map(sanitizeTsvRow).join("")], {
    type: "text/tab-separated-values",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
