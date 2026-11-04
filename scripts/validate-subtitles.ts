import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { cueAtTime, subtitleSpeakers, subtitleTracks } from '../src/components/subtitles';

const root = process.cwd();
// Read the real pin/import mapping without trying to load MP3 files in Node.
const source = ts.createSourceFile('config.ts', readFileSync(path.join(root, 'src/config.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
const imports = new Map<string, string>();
let pins: ts.ArrayLiteralExpression | undefined;
for (const statement of source.statements) {
  if (ts.isImportDeclaration(statement) && statement.importClause?.name && ts.isStringLiteral(statement.moduleSpecifier)) {
    imports.set(statement.importClause.name.text, statement.moduleSpecifier.text);
  }
  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(source) === 'DEFAULT_PINS' && declaration.initializer && ts.isArrayLiteralExpression(declaration.initializer)) {
        pins = declaration.initializer;
      }
    }
  }
}
assert.ok(pins, 'Find the current app pin list');
const pinAudio = new Map<string, string>();
for (const element of pins.elements) {
  assert.ok(ts.isObjectLiteralExpression(element));
  const properties = new Map(element.properties.filter(ts.isPropertyAssignment).map(property => [property.name.getText(source).replaceAll('"', ''), property.initializer]));
  const id = properties.get('id');
  const audio = properties.get('audioUrl');
  assert.ok(id && ts.isStringLiteral(id) && audio && ts.isIdentifier(audio));
  const imported = imports.get(audio.text);
  assert.ok(imported);
  pinAudio.set(id.text, path.resolve(root, 'src', imported));
}
assert.equal(pinAudio.size, 22);
assert.deepEqual([...pinAudio.keys()].filter(id => /^pin-\d+$/.test(id)),
  Array.from({ length: 16 }, (_, i) => 'pin-' + (i + 1)), 'Main stop numbers are consecutive');
assert.match(path.basename(pinAudio.get('pin-2')!), /^v9 02 Blk 324\.mp3$/);
assert.ok(![...pinAudio.values()].some(file => path.basename(file).includes('Boarding')), 'Boarding has no GPS trigger');
const boardingImport = imports.get('boardingAudio');
assert.ok(boardingImport);
pinAudio.set('boarding', path.resolve(root, 'src', boardingImport));
assert.deepEqual(Object.keys(subtitleTracks).sort(), [...pinAudio.keys()].sort(),
  'Every recording has its own subtitle track');
const ambient = new Set(['pin-7b', 'pin-13b', 'pin-15b']);
let checked = 0;
for (const [id, track] of Object.entries(subtitleTracks)) {
  const audio = pinAudio.get(id)!;
  assert.equal(path.basename(audio), track.audioFile, `${id}: current audio filename`);
  assert.equal(createHash('sha256').update(readFileSync(audio)).digest('hex'), track.sha256, `${id}: audio fingerprint`);
  assert.ok(Number.isFinite(track.duration) && track.duration > 0);
  assert.equal(track.offsetSeconds, 0);
  assert.equal(track.contentStatus, ambient.has(id) ? 'ambient' : 'speech');
  assert.equal(track.cues.length === 0, ambient.has(id), `${id}: no invented dialogue over ambience`);
  assert.equal(cueAtTime(track.cues, 0), null);
  assert.equal(cueAtTime(track.cues, track.duration), null);
  for (const invalid of [-1, NaN, Infinity]) assert.equal(cueAtTime(track.cues, invalid), null);
  for (let index = track.cues.length - 1; index >= 0; index--) {
    const cue = track.cues[index];
    assert.ok(subtitleSpeakers[cue.speaker], `${id}: known speaker`);
    assert.ok(Number.isFinite(cue.start) && Number.isFinite(cue.end));
    assert.ok(0 <= cue.start && cue.start < cue.end && cue.end <= track.duration);
    assert.ok(cue.lines.length >= 1 && cue.lines.length <= 3);
    assert.ok(cue.lines.every(line => line.trim() && line.length <= 32), `${id}: readable line lengths`);
    if (index) assert.ok(track.cues[index - 1].end <= cue.start, `${id}: sorted, nonoverlapping cues`);
    assert.equal(cueAtTime(track.cues, cue.start), cue, `${id}: seek to cue start`);
    assert.equal(cueAtTime(track.cues, (cue.start + cue.end) / 2), cue, `${id}: seek backward into cue`);
    assert.notEqual(cueAtTime(track.cues, cue.end), cue, `${id}: half-open end boundary`);
    const expected = track.cues.find(candidate => candidate.start <= cue.end && cue.end < candidate.end) ?? null;
    assert.equal(cueAtTime(track.cues, cue.end), expected);
    checked++;
  }
}
assert.equal(subtitleTracks['pin-1'].cues[0].speaker, 'archive');
assert.ok(subtitleTracks['pin-14'].cues.some(cue => cue.speaker === 'phone-caller'));
console.log(`Verified ${checked} cues across ${Object.keys(subtitleTracks).length} v9 tracks, including 3 ambient tracks with no captions.`);
