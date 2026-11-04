import { StateGraph, START, MemorySaver, type GraphNode } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import { AgentState } from "./state.js";
import { tools } from "./tools.js";

// 1. The language model. bindTools() tells the model which tools exist
//    and what arguments each one takes (taken from the Zod schemas).
const model = new ChatOpenAI({
    model: process.env.OPENAI_MODEL ?? "gpt-6-luna",
    useResponsesApi: true,
    reasoning: {
        effort: "low",
    },
}).bindTools(tools);


const SYSTEM_PROMPT = `You are a helpful to-do list assistant.
You manage the user's tasks ONLY through the tools you have.
- To complete or delete a task by name, call list_todos first to find its id.
- Never invent task ids.
- After each change, confirm briefly what you did.
- If a request is ambiguous (two tasks match), ask which one.`;

// 2. The "agent" node: send the conversation to the model, store its reply.
const callModel: GraphNode<typeof AgentState> = async (state) => {
    const response = await model.invoke([
        new SystemMessage(SYSTEM_PROMPT),
        ...state.messages,
    ]);

    return { messages: [response] };
};

// 3. The "tools" node: runs whatever tool calls the model asked for.
const toolNode = new ToolNode(tools);

// 4. Wire the nodes together with edges.
const builder = new StateGraph(AgentState)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", toolsCondition, ["tools", "__end__"])
    .addEdge("tools", "agent");

// 5. Compile. The checkpointer remembers each conversation by thread_id.
export const graph = builder.compile({
    checkpointer: new MemorySaver(),
});