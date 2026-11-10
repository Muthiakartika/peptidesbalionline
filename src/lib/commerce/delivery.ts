/**
 * The checkout's delivery slot (the owner's snippet "Add Delivery Time n Date at checkout"): today and
 * the next 7 days, then a time window. Dates are in WordPress's time zone (UTC on live, Q-50); labels as
 * WordPress prints them: "Today", "Tomorrow", then wp_date("l, j F"), e.g. "Monday, 9 November".
 */
import { deliverySlots } from "./store-settings";

export type DeliveryOption = { value: string; label: string };

export function deliveryDayOptions(now = new Date()): DeliveryOption[] {
  const days: DeliveryOption[] = [{ value: "", label: "Choose a delivery day" }];
  const part = (date: Date, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: deliverySlots.timeZone, ...options }).format(date);
  for (let i = 0; i < deliverySlots.days; i++) {
    const date = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const [day, month, year] = part(date, { day: "2-digit", month: "2-digit", year: "numeric" }).split("/");
    const value = `${year}-${month}-${day}`;
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : `${part(date, { weekday: "long" })}, ${Number(day)} ${part(date, { month: "long" })}`;
    days.push({ value, label });
  }
  return days;
}

export function deliveryTimeOptions(): DeliveryOption[] {
  return [{ value: "", label: "Choose a time" }, ...deliverySlots.times.map((value) => ({ value, label: value.replace("-", "–") }))];
}
