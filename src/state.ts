import { StateSchema, MessagesValue } from "@langchain/langgraph";
// The state is the "shared notebook" every node reads from and writes to.
// MessagesValue holds the conversation and APPENDS new messages
// instead of replacing the list (that merging rule is called a reducer).
export const AgentState = new StateSchema({
    messages: MessagesValue,
});