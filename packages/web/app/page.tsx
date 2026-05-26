import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            ato-mcp.com
          </h1>
          <p className="text-xl text-gray-600">
            Australian tax retrieval for AI agents
          </p>
          <p className="text-base text-gray-500 max-w-lg mx-auto">
            Give your AI assistant direct access to ATO legislation, rulings,
            and determinations via the Model Context Protocol.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/onboard"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
          >
            Get started
          </Link>
          <a
            href="https://github.com/ato-pro"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            View on GitHub
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-gray-100">
          <div className="text-left space-y-2">
            <h3 className="font-semibold text-gray-900">MCP Native</h3>
            <p className="text-sm text-gray-500">
              Works with Claude, Cursor, and any MCP-compatible AI client.
            </p>
          </div>
          <div className="text-left space-y-2">
            <h3 className="font-semibold text-gray-900">ATO Corpus</h3>
            <p className="text-sm text-gray-500">
              Searches legislation, tax rulings, and ATO determinations.
            </p>
          </div>
          <div className="text-left space-y-2">
            <h3 className="font-semibold text-gray-900">Personal Context</h3>
            <p className="text-sm text-gray-500">
              Optionally store your tax situation for tailored responses.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
