import { useMemo, useState } from "react";
import type { Expense } from "../api";
import { formatDate, formatMoney } from "../format";

interface Props {
  expenses: Expense[];
  categories: string[];
  loading: boolean;
}

export default function ExpenseList({ expenses, categories, loading }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return expenses.filter(
      (e) =>
        (!category || e.category === category) &&
        (!q || e.description.toLowerCase().includes(q)),
    );
  }, [expenses, query, category]);

  const filteredTotal = filtered.reduce((s, e) => s + Number(e.amount), 0);
  const isFiltered = query.trim() !== "" || category !== "";

  return (
    <>
      <div className="list-header">
        <h2>Expenses</h2>
        <div className="filters">
          <input
            type="search"
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search descriptions"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="empty">Loading…</p>
      ) : expenses.length === 0 ? (
        <p className="empty">No expenses yet. Add your first one.</p>
      ) : filtered.length === 0 ? (
        <p className="empty">Nothing matches these filters.</p>
      ) : (
        <>
          <ul className="expense-list">
            {filtered.map((e) => (
              <li key={e.id} className="expense">
                <div className="expense-main">
                  <span className="expense-desc">{e.description}</span>
                  <span className="expense-meta">
                    <span className="chip">{e.category}</span>
                    {formatDate(e.date)}
                  </span>
                </div>
                <span className="expense-amount">
                  {formatMoney(Number(e.amount))}
                </span>
              </li>
            ))}
          </ul>
          {isFiltered && (
            <p className="list-footer muted">
              {filtered.length} of {expenses.length} ·{" "}
              {formatMoney(filteredTotal)}
            </p>
          )}
        </>
      )}
    </>
  );
}
