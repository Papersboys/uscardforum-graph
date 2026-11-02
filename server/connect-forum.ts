import {loadEnvFile} from 'node:process';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {prepareUserAuth,completeUserAuth} from './user-auth.ts';
try{loadEnvFile();}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
const directory=path.resolve(process.env.FORUM_DATA_DIR??'.forum-data');
if(process.argv[2]){await completeUserAuth(directory,await readFile(process.argv[2],'utf8'));console.log('Read-only authorization saved locally. Restart the server.');}else console.log(await prepareUserAuth(directory));
