export type CsvExpense = {
  spentOn: string;
  payerName: string;
  paymentMethod: string;
  category: string;
  amountCents: number;
  scope: "shared" | "personal";
  note: string;
};

export function buildExpenseCsv(rows: CsvExpense[]): string {
  const header = ["日期", "付款人", "支付類型", "消費類型", "金額(HKD)", "歸屬", "備註"];
  const body = rows.map((row) => [
    row.spentOn,
    row.payerName,
    row.paymentMethod,
    row.category,
    (row.amountCents / 100).toFixed(2),
    row.scope === "shared" ? "共同" : "個人",
    row.note,
  ]);
  const lines = [header, ...body].map((line, index) =>
    line
      .map((cell, cellIndex) => escapeCell(cell, index > 0 && cellIndex === 4))
      .join(","),
  );
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function escapeCell(value: string, numeric: boolean): string {
  let cell = value ?? "";
  if (!numeric && /^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  if (/[",\r\n]/.test(cell)) return `"${cell.replaceAll('"', '""')}"`;
  return cell;
}
