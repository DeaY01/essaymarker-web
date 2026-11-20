/** Dates are shown in Nigerian time so the server and browser render the same text. */
export function formatMarkedDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Lagos",
  });
}
