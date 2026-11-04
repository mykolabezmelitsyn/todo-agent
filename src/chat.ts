import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { HumanMessage } from "@langchain/core/messages";
import { graph } from "./graph.js";
import { pool } from "./db.js";

// A tiny terminal chat, handy for testing without an HTTP client.
const rl = readline.createInterface({ input, output });
const config = { configurable: { thread_id: "terminal" } };

console.log('To-Do Agent ready. Type "exit" to quit.');

while (true) {
    const text = (await rl.question("you> ")).trim();

    if (text === "exit") break;
    if (!text) continue;

    const result = await graph.invoke(
        { messages: [new HumanMessage(text)] },
        config,
    );

    console.log("agent>", result.messages[result.messages.length - 1].text);
}

rl.close();
await pool.end();