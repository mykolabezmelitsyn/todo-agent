import { tool } from "@langchain/core/tools";
import { addTodo, listTodos, completeTodo, deleteTodo } from "./db.js";
import {
    AddTodoInput,
    ListTodosInput,
    CompleteTodoInput,
    DeleteTodoInput,
} from "./schemas.js";

export const addTodoTool = tool(
    async ({ title }) => {
        const todo = await addTodo(title);
        return JSON.stringify({ ok: true, todo });
    },
    {
        name: "add_todo",
        description: "Create a new task on the user's to-do list.",
        schema: AddTodoInput,
    },
);

export const listTodosTool = tool(
    async ({ status }) => {
        const todos = await listTodos(status);
        return JSON.stringify({ ok: true, count: todos.length, todos });
    },
    {
        name: "list_todos",
        description: "List the user's tasks. Call this first whenever you need a task id.",
        schema: ListTodosInput,
    },
);
export const completeTodoTool = tool(
    async ({ id }) => {
        const todo = await completeTodo(id);
        if (!todo) return JSON.stringify({ ok: false, error: `No task with id ${id}` })
        return JSON.stringify({ ok: true, todo });
    },
    {
        name: "complete_todo",
        description: "Mark a task as done, using its numeric id.",
        schema: CompleteTodoInput,
    },
);

export const deleteTodoTool = tool(
    async ({ id }) => {
        const todo = await deleteTodo(id);
        if (!todo) return JSON.stringify({ ok: false, error: `No task with id ${id}` });
        return JSON.stringify({ ok: true, deleted: todo });
    },
    {
        name: "delete_todo",
        description: "Permanently remove a task, using its numeric id.",
        schema: DeleteTodoInput,
    },
);
export const tools = [addTodoTool, listTodosTool, completeTodoTool, deleteTodoTool];