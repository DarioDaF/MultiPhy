
import * as esbuild from 'esbuild'
import esbuildPluginTsc from 'esbuild-plugin-tsc' // Needed for new decorators to work correctly

// Needing 'esbuild-plugin-tsc' and "useDefineForClassFields": false
// is due to esbuild ESNext not letting decorators pass as JS.
// In particular the tsc config prevents decorator syntax to be emitted
// while I do like for it to emit since it works in Chrome

import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Define them (not automatic using modules)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function copyRecursive(src, dest) {
  const stats = await fs.stat(src)
  // How to check it exists?
  if (stats.isDirectory()) {
    await fs.mkdir(dest, { recursive: true })
    for (const child of await fs.readdir(src)) {
      await copyRecursive(path.join(src, child), path.join(dest, child))
    }
  } else {
    await fs.copyFile(src, dest)
  }
};

const args = process.argv.slice(2) // 1st is node, 2nd the script

const IS_SERVE = args.includes('--serve')
const IS_WATCH = args.includes('--watch')
//const IS_BUNDLE = args.includes('--bundle')

function getSigInt() {
  return new Promise((resolve) => {
    process.on('SIGINT', () => {
      resolve()
    })
  })
}

const postLocalCopy = {
  name: 'postLocalCopy',
  setup(/** @type esbuild.PluginBuild */ build) {
    build.onEnd(
      async r => {
        console.log('Copying local distribution files...')
        const targetFolder = build.initialOptions.outdir
        const sourceFolder = path.join(__dirname, 'local', 'dist')
        await copyRecursive(sourceFolder, targetFolder)
      }
    )
  }
}

// Doesn't work well??? doesn't initialize I guess
const wasmPlugin = {
  name: 'wasm',
  setup(build) {
    // Resolve ".wasm" files to a path with a namespace
    build.onResolve({ filter: /\.wasm$/ }, args => {
      // If this is the import inside the stub module, import the
      // binary itself. Put the path in the "wasm-binary" namespace
      // to tell our binary load callback to load the binary file.
      if (args.namespace === 'wasm-stub') {
        return {
          path: args.path,
          namespace: 'wasm-binary',
        }
      }

      // Otherwise, generate the JavaScript stub module for this
      // ".wasm" file. Put it in the "wasm-stub" namespace to tell
      // our stub load callback to fill it with JavaScript.
      //
      // Resolve relative paths to absolute paths here since this
      // resolve callback is given "resolveDir", the directory to
      // resolve imports against.
      if (args.resolveDir === '') {
        return // Ignore unresolvable paths
      }
      return {
        path: path.isAbsolute(args.path) ? args.path : path.join(args.resolveDir, args.path),
        namespace: 'wasm-stub',
      }
    })

    // Virtual modules in the "wasm-stub" namespace are filled with
    // the JavaScript code for compiling the WebAssembly binary. The
    // binary itself is imported from a second virtual module.
    build.onLoad({ filter: /.*/, namespace: 'wasm-stub' }, async (args) => ({
      contents: `import wasm from ${JSON.stringify(args.path)}
        export default (imports) =>
          WebAssembly.instantiate(wasm, imports).then(
            result => result.instance.exports)`,
    }))

    // Virtual modules in the "wasm-binary" namespace contain the
    // actual bytes of the WebAssembly file. This uses esbuild's
    // built-in "binary" loader instead of manually embedding the
    // binary data inside JavaScript code ourselves.
    build.onLoad({ filter: /.*/, namespace: 'wasm-binary' }, async (args) => ({
      contents: await fs.readFile(args.path),
      loader: 'binary',
    }))
  },
}

const ctx = await esbuild.context({
  entryPoints: [ 'src/main.ts' ],
  bundle: true,
  //minify: true,
  sourcemap: true,
  //external: [ '*' ], // './*' would be local
  packages: 'external', // Makes duplications, but works... should look into this and build setup() code
  //treeShaking: true,
  format: 'esm',
  outdir: './dist/',
  outExtension: { '.js': '.mjs' },
  target: 'ESNext',
  plugins: [ postLocalCopy, wasmPlugin, esbuildPluginTsc({ force: true }) ]
})

await ctx.rebuild() // Manual rebuild

let block = false

if (IS_WATCH) {
  await ctx.watch({ })
  console.log('Watching enabled')
  block = true
}

if (IS_SERVE) {
  const { host, port } = await ctx.serve({
    port: 54321,
    servedir: '.'
  })
  console.log(`Serving on ${host} http://localhost:${port}`)
  block = true
}

if (block) {
  // Wait infinitely
  await getSigInt()
}

await ctx.dispose()
