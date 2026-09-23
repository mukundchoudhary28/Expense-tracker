import { useCallback, useEffect, useMemo, useState } from "react";
import { listExpenses, type Expense } from "./api";
import ExpenseForm from "./components/ExpenseForm";
import ExpenseList from "./components/ExpenseList";
import Summary from "./components/Summary";

export default function App() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setExpenses(await listExpenses());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(
    () => [...new Set(expenses.map((e) => e.category))].sort(),
    [expenses],
  );

  function handleCreated(expense: Expense) {
    // Keep the same ordering as the API: newest date first.
    setExpenses((prev) =>
      [expense, ...prev].sort((a, b) => b.date.localeCompare(a.date)),
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Expense Tracker</h1>
        <p className="muted">Log what you spend and see where it goes.</p>
      </header>

      {error && (
        <div className="banner error" role="alert">
          <span>{error}</span>
          <button className="btn ghost" onClick={load}>
            Retry
          </button>
        </div>
      )}

      <Summary expenses={expenses} />

      <div className="layout">
        <section className="card">
          <h2>Add expense</h2>
          <ExpenseForm onCreated={handleCreated} />
        </section>
        <section className="card">
          <ExpenseList
            expenses={expenses}
            categories={categories}
            loading={loading}
          />
        </section>
      </div>
    </div>
  );
}
