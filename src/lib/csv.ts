export function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const bom = "\uFEFF"
  const crlf = "\r\n"
  const quote = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  const csv = bom + header.map(quote).join(",") + crlf + rows.map((r) => r.map(quote).join(",")).join(crlf)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a"); a.href = url; a.download = `${filename}-${Date.now()}.csv`; a.click()
  URL.revokeObjectURL(url)
}
