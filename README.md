# 🔌 MCP registry UI

[![Deploy to GitHub Pages](https://github.com/vemonet/mcp-registry/actions/workflows/deploy.yml/badge.svg)](https://github.com/vemonet/mcp-registry/actions/workflows/deploy.yml)

Unofficial web UI to access the [official registry](https://github.com/modelcontextprotocol/registry) for [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) servers available at **[vemonet.github.io/mcp-registry](https://vemonet.github.io/mcp-registry)**.

It lets you find available MCP servers, and easily install them into compatible clients such as [Visual Studio Code](https://code.visualstudio.com/docs/copilot/customization/mcp-servers) or [Cursor](https://cursor.com/docs/context/mcp).

- 🌍 Access all MCP servers published to the official MCP registry
- 🔌 Point the web UI at any compatible registry URL
- 🔎 Search by server name, and filter by last published date
- 📥 Install MCP servers into compatible clients in 1 click (VSCode and Cursor)
- 🧩 Build a stack from selected MCP servers, and export to VSCode `mcp.json`, or Cursor config formats
- 🦊 Runs entirely in the browser, and fetches data directly from [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io/docs)

> [!NOTE]
>
> Contributions welcome, in particular regarding integration of new clients install links/config.

## 🧑‍💻 Development

### 📥 Installation

Install dependencies:

```sh
npm i
```

### ⚡️ Start server in development

Start the development server at http://localhost:5173

```sh
npm run dev
```

> [!TIP]
>
> Create new UI components with [shadcn/ui](https://ui.shadcn.com/docs/components)
>
> ```sh
> npx shadcn@latest add button
> ```

### 🧹 Format, lint and check types

Format and lint with `prettier` and `eslint`:

```sh
npm run fmt
```

Check types with TypeScript:

```sh
npm run typecheck
```

> [!NOTE]
>
> Formatting and type checking will be run automatically when you commit with `husky` and `lint-staged`.

### ⏫ Upgrade dependencies

Upgrade dependencies to the latest versions listed in `package.json`:

```sh
npm run upgrade
```

### 📦 Building for Production

Create a production build:

```sh
npm run build
```

> [!TIP]
>
> Test it with:
>
> ```sh
> cp -R dist dist/mcp-registry
> npx http-server dist -o mcp-registry
> ```

> [!NOTE]
>
> If you're familiar with deploying Node applications, the built-in app server is production-ready. Deploy the `dist` folder.

### 🐳 Docker Deployment

To build and run using Docker:

```bash
docker build -t mcp-registry-app .
```

Run the container:

```sh
docker run -p 3000:3000 mcp-registry-app
```

## ✅ To do

- [ ] Enable browsing server versions (for example: add a dedicated page per server)
- [ ] Improve filtering: filter by status and server type (stdio, http, sse)
