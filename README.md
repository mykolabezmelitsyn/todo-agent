# todo-agent

A TypeScript to-do assistant built with LangGraph and the OpenAI API. Use natural language through a browser UI, terminal chat, or HTTP API to create tasks, list all/open/completed tasks, mark tasks as done, and permanently delete tasks. Tasks are stored in PostgreSQL. The browser UI includes a chat panel and a task list.

## How it works

1. The browser sends messages to `POST /chat`. The terminal or HTTP entry point wraps the user's text in a `HumanMessage` and invokes the graph with a conversation ID.
2. The graph sends the conversation and system instructions to `ChatOpenAI`, using the Responses API. The default model is `gpt-6-luna`, with reasoning effort set to `low`; `OPENAI_MODEL` can override the model.
3. The model can request any of four tools. LangGraph's `ToolNode` executes them and returns their results to the model. This loop continues until the model replies without requesting tools.
4. The final assistant text is printed in the terminal or returned as JSON over HTTP. The browser displays the reply and refreshes its task list through `GET /todos`.

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
- PostgreSQL 14 or newer, running locally, and the `psql` command-line client. You need an administrator account to create a database and user.
- An OpenAI API key with access to a model that supports tool calling through the Responses API and the configured reasoning settings.
- Git and, for the Node.js selection commands below, an installed `nvm`.

### Quick start

1. Clone the repository and install dependencies:

```sh
git clone https://github.com/mykolabezmelitsyn/todo-agent.git
cd todo-agent
nvm use 22
npm install
cp .env.example .env
```

If Node.js 22 is not installed in `nvm`, run `nvm install 22`, then repeat `nvm use 22`. The repository has no `.nvmrc`, so specify the version explicitly.

2. Create the PostgreSQL user and database. Connect as a PostgreSQL administrator (replace `postgres` if your installation uses a different administrator role):

```sh
psql -U postgres -d postgres
```

Run these commands inside `psql`:

```sql
CREATE USER todo_user WITH PASSWORD 'todo_pass';
CREATE DATABASE todo_agent OWNER todo_user;
\q
```

These local development credentials match `.env.example`. If you choose different credentials, update `DATABASE_URL` and the schema command below to match. Administrator login methods depend on your PostgreSQL installation.

3. Edit `.env`: replace `OPENAI_API_KEY=sk-your-key-here` with your API key and verify the database connection:

```dotenv
DATABASE_URL=postgres://todo_user:todo_pass@localhost:5432/todo_agent
```

Keep `PORT=3000` for the URL below. The template also contains optional model and LangSmith tracing settings. `.env.example` is intended for version control; `.env` is ignored by Git and should contain your local values.

4. From the repository root, create the task table as the application user:

```sh
psql -h localhost -p 5432 -U todo_user -d todo_agent -W -v ON_ERROR_STOP=1 -f sql/schema.sql
```

Enter the password you set for `todo_user` when prompted. The schema creates the `todos` table if it does not exist. The application does not create the database or apply the schema on startup.

5. Start the server and UI:

```sh
npm run dev
```

Leave the process running and open **http://localhost:3000/**. Send “Add a task to buy milk.” and check that it appears in **Your tasks**. Both the browser UI and API use this server; no separate frontend process is needed. Press **Ctrl+C** to stop it.

For interface details and more examples, see [Usage](#usage) and [How to use the agent](#how-to-use-the-agent).

### Environment variables

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | API key used by the OpenAI client. |
| `DATABASE_URL` | PostgreSQL connection string passed to the `pg` connection pool. Configure it for the database containing the `todos` table. |
| `OPENAI_MODEL` | Optional model name; defaults to `gpt-6-luna`. Availability depends on your API account. |
| `PORT` | Optional HTTP server port; defaults to `3000`. |

The server also logs the values of `LANGSMITH_TRACING` and `LANGSMITH_PROJECT` and whether `LANGSMITH_API_KEY` is present. They are optional LangChain tracing configuration; the application does not require them or implement a separate tracing setup.

The database credentials need permission to read, insert, update, and delete tasks and use the ID sequence. Applying the schema as `todo_user`, as shown above, gives that role ownership of the table and sequence.

## Usage

All run scripts load `.env` from the repository root and execute TypeScript directly with `tsx`; no build step is required.

### Browser UI

After completing Setup, start the server from the repository root:

```sh
npm start
```

Alternatively, use `npm run dev` to restart the server when server source files change. Open **http://localhost:3000/** in a modern browser, or use the port configured in `PORT`. Express serves both the API and `public/index.html`; no separate frontend installation, process, or build is needed. The page uses plain HTML, CSS, and JavaScript with no external assets.

There is one page:

- **Chat panel:** type a request and click **Send** or press **Enter**. Use **Shift+Enter** for a new line. The page shows “Thinking…” while waiting, then displays the reply or an error. Sending is disabled while a request is pending.
- **Your tasks:** shows all tasks with numeric IDs; completed tasks are crossed out. The list loads when the page opens and refreshes after each chat request finishes. It has no edit buttons or status filters; request changes and filtered lists through chat. Changes from other clients appear on the next refresh, not in real time.
- **New conversation:** clears the displayed messages and selects a new conversation ID. Saved tasks remain unchanged.

The browser saves its conversation ID under `threadId` in `localStorage`. Reloading the page clears the visible transcript but reuses that ID, so the agent retains context while the same server process is running. If storage is blocked, each page load uses a new ID. Restarting the server loses conversation context even if the browser retains its ID. The UI requires browser support for `crypto.randomUUID()`; use localhost or HTTPS.

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

## How to use the agent

The agent manages the shared to-do list from plain-language requests. Complete Setup, then run `npm start` and open **http://localhost:3000/** to chat in the browser, or run `npm run chat` for the terminal interface. The terminal interface runs independently and does not require the HTTP server.

Ask it to add a task, show all/open/completed tasks, mark a task as done, or delete a task. You can identify existing tasks by name or numeric ID. If names are ambiguous, the agent is instructed to ask which task you mean. There is no required command syntax; `exit` is the terminal-only command for quitting.

Example requests:

- “Add a task to buy milk.”
- “Show my open tasks.”
- “Mark buy milk as done.”

The agent replies with a confirmation or task list; exact wording varies. In the UI, check **Your tasks** for the saved result. Tasks are shared across conversations, and deletion is permanent with no required confirmation. The agent cannot edit titles, reopen completed tasks, schedule reminders, or manage due dates. Conversation context lasts only until its process exits; see Checks and limitations for other constraints.

## Project structure

```text
src/
  chat.ts       Terminal chat entry point
  server.ts     Express server: static UI, POST /chat, and GET /todos
  graph.ts      Model configuration, system prompt, graph loop, and checkpointer
  state.ts      Conversation message state and append behavior
  tools.ts      Four model-callable task tools and their JSON results
  schemas.ts    Zod schemas for tool arguments
  db.ts         PostgreSQL connection pool and task queries
public/
  index.html    Browser chat and task list, including inline CSS and JavaScript
sql/
  schema.sql    Initial todos table definition
package.json    Dependencies and npm scripts
package-lock.json  Locked dependency versions
tsconfig.json   Strict TypeScript configuration
.env.example    Environment variable template; copy to .env and edit
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
- There is no deployment configuration or migration runner.
