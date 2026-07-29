import base from './base.mjs';
import nextVitals from 'eslint-config-next/core-web-vitals';

const nextFrameworkRules = nextVitals.filter((config) => config.name !== 'next/typescript');

export default [...nextFrameworkRules, ...base];
