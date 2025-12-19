# Contributing to mcp-piwik

Thanks for your interest in contributing!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR-USERNAME/mcp-piwik.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature`

## Development

```bash
# Build
npm run build

# Watch mode
npm run watch

# Test locally (requires Piwik PRO credentials)
PIWIK_ACCOUNT=your-account PIWIK_CLIENT_ID=your-id PIWIK_CLIENT_SECRET=your-secret node dist/index.js
```

## Adding New Tools

1. Add tool definition in `src/index.ts` using `server.tool()`
2. Follow existing patterns for error handling
3. Update README.md with tool documentation
4. Test the tool locally

## Code Style

- TypeScript with strict mode
- Use async/await for async operations
- Include error handling with meaningful messages

## Submitting Changes

1. Commit with conventional commits: `feat:`, `fix:`, `docs:`
2. Push to your fork
3. Open a Pull Request with a clear description

## Questions?

Open an issue for bugs or feature requests.
