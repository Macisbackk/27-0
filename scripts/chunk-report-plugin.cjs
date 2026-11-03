/**
 * Webpack plugin (client production build only, enabled with CHUNK_REPORT=1 — see next.config.ts).
 * Writes .next/chunk-modules.json: every emitted client chunk with its files and the source
 * modules inside it (pre-minify size), so scripts/health-chunk-report.mjs can say exactly what
 * makes each route's first-load JS heavy. No dependencies.
 */
const fs = require("fs");
const path = require("path");

function shortName(id) {
  // Drop loader prefixes and the absolute project path.
  const last = String(id).split("!").pop() || String(id);
  return last.replace(process.cwd() + path.sep, "").replace(/^\.\//, "").replace(/\?.*$/, "");
}

class ChunkReportPlugin {
  apply(compiler) {
    compiler.hooks.afterEmit.tap("ChunkReportPlugin", (compilation) => {
      try {
        const { chunkGraph } = compilation;
        const chunks = [];
        for (const chunk of compilation.chunks) {
          const modules = new Map();
          for (const m of chunkGraph.getChunkModulesIterable(chunk)) {
            const inner = m.modules ? [...m.modules] : [m];
            for (const im of inner) {
              const name = shortName(im.nameForCondition?.() || im.identifier());
              let size = 0;
              try {
                size = im.size();
              } catch {
                size = 0;
              }
              modules.set(name, (modules.get(name) || 0) + size);
            }
          }
          chunks.push({
            id: chunk.id,
            name: chunk.name || null,
            files: [...chunk.files].filter((f) => f.endsWith(".js")),
            modules: [...modules.entries()].map(([name, size]) => ({ name, size })).sort((a, b) => b.size - a.size),
          });
        }
        const outDir = path.join(process.cwd(), ".next");
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, "chunk-modules.json"), JSON.stringify({ chunks }));
      } catch (err) {
        console.warn("[chunk-report] failed:", err && err.message);
      }
    });
  }
}

module.exports = ChunkReportPlugin;
