import pg from "pg";
// A "pool" keeps a few open connections to PostgreSQL and reuses them,
// which is faster than opening a new connection for every query.
export const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});

// The shape of one row in the "todos" table, as TypeScript sees it.
export interface Todo {
    id: number;
    title: string;
    completed: boolean;
    created_at: Date;
    completed_at: Date | null;
}

export async function addTodo(title: string): Promise<Todo> {
    const result = await pool.query<Todo>(
        "INSERT INTO todos (title) VALUES ($1) RETURNING *",
        [title],
    );
    return result.rows[0];
}

export async function listTodos(
    status: "all" | "open" | "done",
): Promise<Todo[]> {
    let sql =
        "SELECT * FROM todos";
    if (status === "open") sql += " WHERE completed = FALSE";
    if (status === "done") sql += " WHERE completed = TRUE";
    sql += " ORDER BY id";
    const result = await pool.query<Todo>(sql);
    return result.rows;
}

export async function completeTodo(id: number): Promise<Todo | null> {
    const result = await pool.query<Todo>(
        `UPDATE todos
         SET completed = TRUE,
             completed_at = NOW()
         WHERE id = $1 RETURNING *`,
        [id],
    );
    return result.rows[0] ?? null;
}

export async function deleteTodo(id: number): Promise<Todo | null> {
    const result = await pool.query<Todo>(
        "DELETE FROM todos WHERE id = $1 RETURNING *",
        [id],
    );
    return result.rows[0] ?? null;
}