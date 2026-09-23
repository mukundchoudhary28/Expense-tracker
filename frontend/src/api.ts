// Mirrors backend/app/schemas.py. Pydantic serialises Decimal as a string.
export interface Expense {
  id: number;
  description: string;
  amount: string;
  category: string;
  date: string; // YYYY-MM-DD
}

export interface ExpenseCreate {
  description: string;
  amount: string;
  category: string;
  date?: string;
}

export class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError("Can't reach the server. Is the backend running?");
  }
  if (!res.ok) throw new ApiError(await errorMessage(res));
  return res.json() as Promise<T>;
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    // FastAPI validation errors: { detail: [{ loc, msg }] }
    if (Array.isArray(body.detail)) {
      return body.detail
        .map((d: { loc?: unknown[]; msg: string }) => {
          const field = d.loc?.[d.loc.length - 1];
          return field ? `${field}: ${d.msg}` : d.msg;
        })
        .join("; ");
    }
    if (typeof body.detail === "string") return body.detail;
  } catch {
    /* fall through */
  }
  return `Request failed (${res.status})`;
}

export const listExpenses = () => request<Expense[]>("/api/expenses");

export const createExpense = (data: ExpenseCreate) =>
  request<Expense>("/api/expenses", {
    method: "POST",
    body: JSON.stringify(data),
  });
