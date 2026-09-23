import { useState, type FormEvent } from "react";
import { createExpense, type Expense } from "../api";
import { todayIso } from "../format";

export const CATEGORIES = ["Food", "Travel", "Bills", "Other"];

interface Props {
  onCreated: (expense: Expense) => void;
}

export default function ExpenseForm({ onCreated }: Props) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [date, setDate] = useState(todayIso());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createExpense({
        description: description.trim(),
        amount: value.toFixed(2),
        category,
        date,
      });
      onCreated(created);
      setDescription("");
      setAmount("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label>
        Description
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={255}
          placeholder="e.g. Groceries"
          required
        />
      </label>

      <div className="row">
        <label>
          Amount
          <input
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            max="99999999.99"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </label>
        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
      </div>

      <label>
        Category
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
        >
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <button className="btn primary" type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Add expense"}
      </button>
    </form>
  );
}
