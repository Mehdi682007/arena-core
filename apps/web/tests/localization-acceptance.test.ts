import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { uiMessagesFor } from '../src/i18n/ui-messages';
import {
  presentAction,
  presentCategory,
  presentChannel,
  presentEvidenceType,
  presentReason,
  presentStatus,
  presentationCatalogs,
} from '../src/i18n/presentation';

const webRoot = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(webRoot, 'src');
const arabicScript = /\p{Script=Arabic}/u;

type Finding = Readonly<{
  path: string;
  line: number;
  kind: string;
  signature: string;
}>;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return entry.isFile() && target.endsWith('.tsx') ? [target] : [];
  });
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 120);
}

function persianTsxFindings(): Finding[] {
  const findings: Finding[] = [];
  for (const file of sourceFiles(sourceRoot)) {
    const content = readFileSync(file, 'utf8');
    const source = ts.createSourceFile(
      file,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visit = (node: ts.Node): void => {
      const value = ts.isJsxText(node) || ts.isStringLiteralLike(node) ? node.text : undefined;
      if (value && arabicScript.test(value)) {
        const location = source.getLineAndCharacterOfPosition(node.getStart(source));
        findings.push({
          path: path.relative(webRoot, file).replaceAll('\\', '/'),
          line: location.line + 1,
          kind: ts.SyntaxKind[node.kind],
          signature: normalize(value),
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return findings;
}

function renderedRawEnumFindings(): Finding[] {
  const findings: Finding[] = [];
  const enumFields = new Set(['status', 'reasonCode', 'action', 'type', 'category', 'severity']);
  for (const file of sourceFiles(sourceRoot)) {
    const content = readFileSync(file, 'utf8');
    const source = ts.createSourceFile(
      file,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visit = (node: ts.Node): void => {
      if (
        ts.isJsxExpression(node) &&
        ts.isJsxElement(node.parent) &&
        node.expression &&
        ts.isPropertyAccessExpression(node.expression) &&
        enumFields.has(node.expression.name.text) &&
        !/^(ui|dictionary|messages)(\.|$)/.test(node.expression.expression.getText(source))
      ) {
        const location = source.getLineAndCharacterOfPosition(node.expression.getStart(source));
        findings.push({
          path: path.relative(webRoot, file).replaceAll('\\', '/'),
          line: location.line + 1,
          kind: 'RawEnumJsxExpression',
          signature: normalize(node.expression.getText(source)),
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return findings;
}

function directLocaleConditionalFindings(): Finding[] {
  const findings: Finding[] = [];
  for (const file of sourceFiles(sourceRoot)) {
    const content = readFileSync(file, 'utf8');
    const source = ts.createSourceFile(
      file,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visit = (node: ts.Node): void => {
      if (
        ts.isJsxExpression(node) &&
        ts.isJsxElement(node.parent) &&
        node.expression &&
        ts.isConditionalExpression(node.expression) &&
        /\b(locale|en)\b/.test(node.expression.condition.getText(source)) &&
        (ts.isStringLiteralLike(node.expression.whenTrue) ||
          ts.isStringLiteralLike(node.expression.whenFalse))
      ) {
        const location = source.getLineAndCharacterOfPosition(node.expression.getStart(source));
        findings.push({
          path: path.relative(webRoot, file).replaceAll('\\', '/'),
          line: location.line + 1,
          kind: 'DirectLocaleConditional',
          signature: normalize(node.expression.getText(source)),
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return findings;
}

const placeholders = (value: string) =>
  [...value.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)].map((match) => match[1]).sort();

describe('global localization acceptance', () => {
  it('keeps Persian and Arabic-script UI copy out of TSX components', () => {
    const findings = persianTsxFindings();
    expect(
      findings,
      [`findings=${String(findings.length)}`]
        .concat(
          findings.map(
            (finding) =>
              `${finding.path}:${String(finding.line)} ${finding.kind} ${JSON.stringify(finding.signature)}`,
          ),
        )
        .join('\n'),
    ).toEqual([]);
  });

  it('keeps the Persian and English UI catalogs in structural and interpolation parity', () => {
    const fa = uiMessagesFor('fa');
    const en = uiMessagesFor('en');
    expect(Object.keys(en).sort()).toEqual(Object.keys(fa).sort());
    for (const key of Object.keys(fa) as (keyof typeof fa)[]) {
      expect(fa[key].trim(), `fa.${key}`).not.toBe('');
      expect(en[key].trim(), `en.${key}`).not.toBe('');
      expect(placeholders(en[key]), `placeholder mismatch for ${key}`).toEqual(
        placeholders(fa[key]),
      );
    }
  });

  it('does not render known enum fields directly from API values', () => {
    expect(renderedRawEnumFindings()).toEqual([]);
  });

  it('does not select rendered UI copy with direct locale conditionals', () => {
    expect(directLocaleConditionalFindings()).toEqual([]);
  });

  it('provides bilingual enum mappings and safe non-leaking fallbacks', () => {
    for (const catalog of Object.values(presentationCatalogs)) {
      for (const [raw, localized] of Object.entries(catalog)) {
        expect(localized.fa, `${raw}.fa`).not.toBe(raw);
        expect(localized.en, `${raw}.en`).not.toBe(raw);
      }
    }
    const unknown = 'UNRECOGNIZED_BACKEND_VALUE';
    expect(presentStatus(unknown, 'en')).not.toContain(unknown);
    expect(presentAction(unknown, 'fa')).not.toContain(unknown);
    expect(presentReason(unknown, 'en')).not.toContain(unknown);
    expect(presentCategory(unknown, 'fa')).not.toContain(unknown);
    expect(presentChannel(unknown, 'en')).not.toContain(unknown);
    expect(presentEvidenceType(unknown, 'fa')).not.toContain(unknown);
  });
});
