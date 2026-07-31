import fs from 'node:fs';
import process from 'node:process';

const expected = process.argv[2];
const command = fs.readFileSync('/proc/1/cmdline', 'utf8').replaceAll('\0', ' ');
process.exit(expected && command.includes(expected) ? 0 : 1);
