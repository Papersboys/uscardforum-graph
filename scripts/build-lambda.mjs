import {build} from 'esbuild';
await build({entryPoints:{worker:'lambda/worker.ts',api:'lambda/api.ts'},outdir:'lambda/dist',outExtension:{'.js':'.cjs'},platform:'node',format:'cjs',bundle:true,target:'node22',minify:true});
