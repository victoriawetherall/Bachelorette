import type { BudgetApplication, BudgetItem, Session } from "@/lib/insforge";

export function classifySession(label: string): BudgetApplication | null {
  const l = label.toLowerCase();
  if (l.includes("friday")) return "friday_night";
  if (l.includes("bathhouse")) return "bathhouse";
  if (l.includes("saturday") && (l.includes("night") || l.includes("stay")))
    return "saturday_night";
  if (
    l.includes("saturday") &&
    (l.includes("lunch") || l.includes("activit") || l.includes("day"))
  )
    return "saturday_day";
  return null;
}

export function estimateCost(
  budgetItems: BudgetItem[],
  sessions: Session[],
  selectedSessionIds: Set<string>,
  drinksAlcohol: boolean | null
): number | null {
  if (budgetItems.length === 0) return null;

  const selectedCategories = new Set<BudgetApplication>();
  sessions.forEach((session) => {
    if (!selectedSessionIds.has(session.id)) return;
    const category = classifySession(session.label);
    if (category) selectedCategories.add(category);
  });
  if (drinksAlcohol) selectedCategories.add("alcohol");

  const total = budgetItems.reduce((sum, item) => {
    if (item.applies_to === "flat" || selectedCategories.has(item.applies_to)) {
      return sum + item.cost_per_person;
    }
    return sum;
  }, 0);

  return Math.ceil(total);
}
