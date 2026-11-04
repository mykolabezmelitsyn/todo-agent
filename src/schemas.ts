import { z } from "zod";
// Each schema describes the arguments one tool accepts.
// The .describe() text is sent to the model, so write it for the model.
export const AddTodoInput = z.object({
    title: z
        .string()
        .trim()
        .min(1, "Title cannot be empty")
        .max(200, "Title is too long")
        .describe("A short description of the task, e.g. 'Buy milk'"),
});
export const ListTodosInput = z.object({
    status: z
        .enum(["all", "open", "done"])
        .default("all")
        .describe("Which tasks to show: all, open (not done) or done"),
});
export const CompleteTodoInput = z.object({
    id: z.number().int().positive().describe("The numeric id of the task"),
});
export const DeleteTodoInput = z.object({
    id: z.number().int().positive().describe("The numeric id of the task"),
});