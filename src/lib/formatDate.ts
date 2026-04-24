import dayjs from "dayjs";

/**
 * Formats a date string or Date object to a consistent display format.
 * Default: 'DD MMM YYYY, HH:mm:ss'
 * @param date Date object or ISO string
 * @param format Optional dayjs format string
 */
export function formatDate(
  date: string | Date,
  format = "DD MMM YYYY, HH:mm:ss",
) {
  return dayjs(date).format(format);
}
