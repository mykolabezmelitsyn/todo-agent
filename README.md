# todo-agent

A TypeScript to-do assistant built with LangGraph and the OpenAI API. Use natural language through a terminal chat or an HTTP API to create tasks, list all/open/completed tasks, mark tasks as done, and permanently delete tasks. Tasks are stored in PostgreSQL.

## How it works

1. The terminal or HTTP entry point wraps the user's text in a `HumanMessage` and invokes the graph with a conversation ID.
2. The graph sends the conversation and system instructions to `ChatOpenAI`, using the Responses API. The default model is `gpt-6-luna`, with reasoning effort set to `low`; `OPENAI_MODEL` can override the model.
3. The model can request any of four tools. LangGraph's `ToolNode` executes them and returns their results to the model. This loop continues until the model replies without requesting tools.
4. The final assistant text is printed in the terminal or returned as JSON over HTTP.

| Tool | Behavior |
| --- | --- |
| `add_todo` | Creates a task with a trimmed title of 1–200 characters. |
| `list_todos` | Lists tasks by `all`, `open`, or `done` status, ordered by numeric ID. Defaults to `all`. |
| `complete_todo` | Marks a task as complete and sets its completion timestamp. Requires a positive integer ID. |
| `delete_todo` | Permanently deletes a task by positive integer ID. |

Tools validate arguments with Zod, call the database functions, and return JSON to the model. Completing or deleting a missing ID returns an error result. The system prompt instructs the model to look up IDs before completing or deleting a task by name, ask when multiple tasks match, and briefly confirm changes. These are model instructions, not additional enforcement in the database layer.

PostgreSQL persists task IDs, titles, completion flags, creation times, and completion times. LangGraph's `MemorySaver` keeps conversation messages in process memory, keyed by `thread_id`. Conversation history disappears when that process exits. **Conversation IDs separate chat history, but every conversation shares the same task table.**

## Setup

Requirements:

- Node.js 22 or newer, as required by the locked `@langchain/openai` dependency, and npm.
- A running PostgreSQL database and the `psql` command-line client for schema setup.
- An OpenAI API key with access to a model that supports tool calling through the Responses API and the configured reasoning settings.

From the repository root, install dependencies:

```sh
npm ci
```

Create a `.env` file in the repository root. Replace the placeholder values below with your own configuration; `.env` is ignored by Git.

```dotenv
OPENAI_API_KEY=<your-api-key>
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database>
# Optional overrides:
OPENAI_MODEL=gpt-6-luna
PORT=3000
```

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | API key used by the OpenAI client. |
| `DATABASE_URL` | PostgreSQL connection string passed to the `pg` connection pool. Configure it for the database containing the `todos` table. |
| `OPENAI_MODEL` | Optional model name; defaults to `gpt-6-luna`. Availability depends on your API account. |
| `PORT` | Optional HTTP server port; defaults to `3000`. |

The server also logs the values of `LANGSMITH_TRACING` and `LANGSMITH_PROJECT` and whether `LANGSMITH_API_KEY` is present. They are optional LangChain tracing configuration; the application does not require them or implement a separate tracing setup.

Create the PostgreSQL database beforehand, then apply the schema using the same connection string you configured in `.env`:

```sh
psql 'postgresql://<user>:<password>@<host>:<port>/<database>' -v ON_ERROR_STOP=1 -f sql/schema.sql
```

The schema creates the `todos` table if it does not exist. The application does not create the database or apply the schema on startup. Its database credentials need permission to read, insert, update, and delete tasks and use the ID sequence.

## Usage

All run scripts load `.env` from the repository root and execute TypeScript directly with `tsx`; no build step is required.

### Terminal chat

```sh
npm run chat
```

The terminal prints `To-Do Agent ready. Type "exit" to quit.` and prompts with `you>`. For example:

```text
you> Add a task to buy milk.
agent> Added “buy milk” to your to-do list.
you> Show my open tasks.
agent> 1. buy milk
you> Mark buy milk as done.
agent> Marked “buy milk” as done.
you> exit
```

Assistant wording and IDs are illustrative and depend on model output and existing tasks. The terminal uses the fixed conversation ID `terminal`. Entering `exit` closes the prompt and database pool; blank input is ignored.

### HTTP API

Start the server:

```sh
npm start
```

For development with automatic restarts on file changes:

```sh
npm run dev
```

Send a message from another terminal:

```sh
curl -X POST http://localhost:3000/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Add a task to buy milk.","threadId":"demo"}'
```

The response has this shape, with model-generated reply text:

```json
{"reply":"Added “buy milk” to your to-do list.","threadId":"demo"}
```

Reuse `threadId` for follow-up messages in the same server process. It defaults to `default` if omitted. Both `message` and an explicitly supplied `threadId` must be nonempty strings. Invalid chat fields return HTTP 400 with an `error` string; graph failures return HTTP 500 with `{"error":"The agent failed. Check the server logs."}`.

To inspect all task rows directly, without a model call:

```sh
curl http://localhost:3000/todos
```

`GET /todos` returns a JSON array containing `id`, `title`, `completed`, `created_at`, and `completed_at` for each task, ordered by ID. It returns `[]` when the table is empty.

## Project structure

```text
src/
  chat.ts       Terminal chat entry point
  server.ts     Express server: POST /chat and GET /todos
  graph.ts      Model configuration, system prompt, graph loop, and checkpointer
  state.ts      Conversation message state and append behavior
  tools.ts      Four model-callable task tools and their JSON results
  schemas.ts    Zod schemas for tool arguments
  db.ts         PostgreSQL connection pool and task queries
sql/
  schema.sql    Initial todos table definition
package.json    Dependencies and npm scripts
package-lock.json  Locked dependency versions
tsconfig.json   Strict TypeScript configuration
```

## Checks and limitations

```sh
npm run typecheck
```

- There is no automated test suite; `npm test` is a placeholder that exits with an error.
- There is no authentication, per-user task ownership, or authorization. Anyone who can access the server can read the shared task list and request changes. A `threadId` is not an access control mechanism.
- Conversation memory is neither persisted nor shared between processes. There is no history expiration or pruning implemented in the application.
- Tasks have no editing, reopening, due dates, priorities, reminders, or external task-service integration. Deletion has no undo or mandatory confirmation step.
- Model choice and tool selection depend on the OpenAI service. Responses are not deterministic, and API access and database connectivity are required for task operations. There is no application-level retry or fallback policy.
- The terminal does not catch graph errors. The server catches chat graph failures, but has no custom database-error response for `GET /todos` or graceful shutdown handler for its pool.
- There is no browser interface, deployment configuration, or migration runner.
