import dotenv from 'dotenv';
import start_game from './app.js';
import yargs from 'yargs';

dotenv.config();

const argv = yargs(process.argv.slice(2)).argv;

const agentName = argv.agentname || 'SingleAgent';

await start_game(agentName);
