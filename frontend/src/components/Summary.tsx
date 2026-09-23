import type { Expense } from "../api";
import { formatMoney, todayIso } from "../format";

export default function Summary({ expenses }: { expenses: Expense[] }) {
  const monthPrefix = todayIso().slice(0, 7);
  let total = 0;
  let thisMonth = 0;
  const byCategory = new Map<string, number>();

  for (const e of expenses) {
    const amt = Number(e.amount);
    total += amt;
    if (e.date.startsWith(monthPrefix)) thisMonth += amt;
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + amt);
  }

  const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = top[0]?.[1] ?? 0;

  return (
    <section className="summary">
      <div className="stat card">
        <span className="stat-label">This month</span>
        <span className="stat-value">{formatMoney(thisMonth)}</span>
      </div>
      <div className="stat card">
        <span className="stat-label">All time</span>
        <span className="stat-value">{formatMoney(total)}</span>
        <span className="stat-sub muted">
          {expenses.length} {expenses.length === 1 ? "expense" : "expenses"}
        </span>
      </div>
      <div className="card categories">
        <span className="stat-label">Top categories</span>
        {top.length === 0 ? (
          <p className="muted small">No data yet</p>
        ) : (
          <ul>
            {top.map(([name, amt]) => (
              <li key={name}>
                <div className="bar-label">
                  <span>{name}</span>
                  <span className="muted">{formatMoney(amt)}</span>
                </div>
                <div className="bar">
                  <div style={{ width: `${(amt / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
