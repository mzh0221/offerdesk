// Syntax-only check; use npm run typecheck for full semantic verification.
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
let files=0,errors=0;
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','.next','.git'].includes(entry.name))continue;const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(/\.tsx?$/.test(file)&&!file.endsWith('.d.ts')){files++;const result=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}});for(const d of result.diagnostics||[])if(d.category===ts.DiagnosticCategory.Error){errors++;console.error(file,ts.flattenDiagnosticMessageText(d.messageText,' '));}}}}
walk('.');console.log(`${files} TypeScript files, ${errors} syntax errors`);process.exitCode=errors?1:0;
