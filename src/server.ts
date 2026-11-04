import express from "express";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { graph } from "./graph.js";
import { listTodos } from "./db.js";

const app = express();
app.use(express.json()); // parse JSON request bodies

// Validate what clients send us, using Zod again.
const ChatRequest = z.object({
    message: z.string().min(1),
    threadId: z.string().min(1).default("default"),
});

app.post("/chat", async (req, res) => {
    const parsed = ChatRequest.safeParse(req.body);

    if (!parsed.success) {
        res.status(400).json({ error: z.prettifyError(parsed.error) });
        return;
    }

    const { message, threadId } = parsed.data;

    try {
        const result = await graph.invoke(
            { messages: [new HumanMessage(message)] },
            { configurable: { thread_id: threadId } },
        );

        const last = result.messages[result.messages.length - 1];
        res.json({ reply: last.text, threadId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "The agent failed. Check the server logs." });
    }
});

// A plain endpoint (no AI) to see the raw table contents.
app.get("/todos", async (_req, res) => {
    res.json(await listTodos("all"));
});

const port = Number(process.env.PORT ?? 3000);

console.log("LangSmith configuration:", {
    tracing: process.env.LANGSMITH_TRACING,
    project: process.env.LANGSMITH_PROJECT,
    hasApiKey: Boolean(process.env.LANGSMITH_API_KEY),
});

app.listen(port, () => {
    console.log(`To-Do Agent listening on http://localhost:${port}`);
});