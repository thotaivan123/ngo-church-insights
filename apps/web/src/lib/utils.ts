import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...values: ClassValue[]) => twMerge(clsx(values));

export const formatPercent = (value: number): string => `${Number(value).toFixed(1)}%`;

export const formatNumber = (value: number): string => new Intl.NumberFormat("en-IN").format(value);

export const downloadCsv = (fileName: string, headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>) => {
  const escapeCell = (value: string | number | boolean | null | undefined): string => {
    const text = value == null ? "" : String(value);
    return /[,"\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
  };

  const csv = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ].join("\n");

  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};
