const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');

// Prefer this backend's compiler. An explicit external compiler path also permits
// dependency-free local adapter qualification; no external provider is mocked.
const ts = process.env.MGR_TEST_TYPESCRIPT ? require(process.env.MGR_TEST_TYPESCRIPT) : require('typescript');
const filename = path.resolve(__dirname, '../src/services/storage/LocalFilesystemAdapter.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, reportDiagnostics: true,
});
assert.equal((compiled.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error).length, 0);
const adapterModule = { exports: {} };
vm.runInThisContext(`(function(require,module,exports){${compiled.outputText}\n})`, { filename })(require, adapterModule, adapterModule.exports);
const { LocalFilesystemAdapter } = adapterModule.exports;
const fixtureRoot = process.env.MGR_STORAGE_TEST_ROOT;
if (!fixtureRoot || !path.isAbsolute(fixtureRoot)) throw Error('Set MGR_STORAGE_TEST_ROOT to an absolute owned fixture directory.');
fs.mkdirSync(fixtureRoot, { recursive: true });
async function fixture() {
  const directory = await fsp.mkdtemp(path.join(fixtureRoot, 'adapter-proof-'));
  const vault = path.join(directory, 'vault'), outside = path.join(directory, 'outside');
  await fsp.mkdir(vault); await fsp.mkdir(outside);
  await fsp.writeFile(path.join(outside, 'canary.txt'), 'outside-owned-fixture');
  return { directory, vault, outside, adapter: new LocalFilesystemAdapter({ basePath: vault, capacityBytes: 1024 }) };
}

test('actual nested upload, URL escaping, read, reopen, list and delete preserve expected bytes', async () => {
  const { adapter, vault } = await fixture();
  const bytes = Buffer.from('actual saved document bytes');
  const result = await adapter.upload('case-a/Owner #1.txt', bytes);
  assert.equal(result.success, true); assert.equal(result.url, '/api/documents/case-a/Owner%20%231.txt');
  assert.deepEqual((await adapter.download('case-a/Owner #1.txt')).data, bytes);
  const reopened = new LocalFilesystemAdapter({ basePath: vault, capacityBytes: 1024 });
  assert.deepEqual((await reopened.download('case-a/Owner #1.txt')).data, bytes);
  assert.equal(await reopened.exists('case-a/Owner #1.txt'), true);
  const listing = await reopened.list('case-a');
  assert.equal(listing.length, 1); assert.equal(listing[0].size, bytes.length);
  assert.equal((await reopened.delete('case-a/Owner #1.txt')).success, true);
  assert.equal(await adapter.exists('case-a/Owner #1.txt'), false);
  assert.equal((await adapter.delete('case-a/Owner #1.txt')).success, true);
});
test('relative Windows keys remain compatible and atomic replacement leaves no visible staging file', async () => {
  const { adapter } = await fixture();
  assert.equal((await adapter.upload('case-a\\document.txt', Buffer.from('one'))).success, true);
  assert.equal((await adapter.upload('case-a/document.txt', Buffer.from('two'))).success, true);
  assert.equal((await adapter.download('case-a\\document.txt')).data.toString(), 'two');
  assert.deepEqual((await adapter.list('case-a')).map(file => file.path), ['case-a/document.txt']);
  assert.deepEqual((await adapter.list('case-a/')).map(file => file.path), ['case-a/document.txt']);
});
test('all file operations reject lexical, absolute, encoded, device and alternate-stream escape keys', async () => {
  const { adapter, directory, outside } = await fixture();
  const invalid = ['../outside/canary.txt', '..\\outside\\canary.txt', 'case/../../outside/canary.txt',
    '/outside/canary.txt', path.join(outside, 'canary.txt'), 'C:\\Windows\\system.ini', 'C:relative.txt',
    '\\\\host\\share\\document.txt', '%2e%2e/outside/canary.txt', '%252e%252e/outside/canary.txt',
    'case%2f..%2foutside.txt', 'case%5c..%5coutside.txt', 'case/file.txt:stream', 'case/NUL.txt',
    'case/con', 'case/COM1.pdf', 'case/file.', 'case/file ', 'case/./file', 'case//file', '', '\0', 'a'.repeat(1025)];
  const before = (await fsp.readdir(directory)).sort();
  for (const key of invalid) {
    assert.equal((await adapter.upload(key, Buffer.from('denied'))).success, false, `upload ${key}`);
    assert.equal((await adapter.download(key)).success, false, `download ${key}`);
    assert.equal((await adapter.delete(key)).success, false, `delete ${key}`);
    assert.equal(await adapter.exists(key), false, `exists ${key}`);
    if (key) assert.deepEqual(await adapter.list(key), [], `list ${key}`);
  }
  assert.deepEqual((await fsp.readdir(directory)).sort(), before);
  assert.equal(await fsp.readFile(path.join(outside, 'canary.txt'), 'utf8'), 'outside-owned-fixture');
});
test('actual Windows junction at a child directory denies every outside operation', async () => {
  const { adapter, vault, outside } = await fixture();
  await fsp.symlink(outside, path.join(vault, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal((await adapter.download('linked/canary.txt')).success, false);
  assert.equal((await adapter.upload('linked/new.txt', Buffer.from('denied'))).success, false);
  assert.equal((await adapter.delete('linked/canary.txt')).success, false);
  assert.equal(await adapter.exists('linked/canary.txt'), false);
  assert.deepEqual(await adapter.list('linked'), []);
  assert.equal(fs.existsSync(path.join(outside, 'new.txt')), false);
  assert.equal(await fsp.readFile(path.join(outside, 'canary.txt'), 'utf8'), 'outside-owned-fixture');
});
test('configured root and an ancestor junction cannot be used for writes, health or reads', async () => {
  const { directory, outside } = await fixture();
  const junction = path.join(directory, 'root-junction');
  await fsp.symlink(outside, junction, process.platform === 'win32' ? 'junction' : 'dir');
  for (const basePath of [junction, path.join(junction, 'nested-vault')]) {
    const adapter = new LocalFilesystemAdapter({ basePath });
    assert.equal((await adapter.upload('new.txt', Buffer.from('denied'))).success, false);
    assert.equal((await adapter.download('canary.txt')).success, false);
    assert.equal((await adapter.healthCheck()).healthy, false);
    await assert.rejects(() => adapter.getUsage());
  }
  assert.deepEqual(await fsp.readdir(outside), ['canary.txt']);
});
test('hard-linked files cannot be read, replaced, listed as ordinary files or deleted', async () => {
  const { adapter, vault, outside } = await fixture();
  await fsp.link(path.join(outside, 'canary.txt'), path.join(vault, 'hard-link.txt'));
  assert.equal((await adapter.download('hard-link.txt')).success, false);
  assert.equal((await adapter.upload('hard-link.txt', Buffer.from('denied'))).success, false);
  assert.equal((await adapter.delete('hard-link.txt')).success, false);
  assert.equal(await adapter.exists('hard-link.txt'), false);
  assert.deepEqual(await adapter.list(''), []);
  await assert.rejects(() => adapter.getUsage());
  assert.equal(await fsp.readFile(path.join(outside, 'canary.txt'), 'utf8'), 'outside-owned-fixture');
});
test('health and usage execute actual writes and report actual persisted size', async () => {
  const { adapter, vault } = await fixture();
  assert.equal((await adapter.healthCheck()).healthy, true);
  assert.equal((await adapter.upload('file-a.txt', Buffer.from('abc'))).success, true);
  assert.equal((await adapter.upload('case/file-b.txt', Buffer.from('de'))).success, true);
  assert.deepEqual(await adapter.getUsage(), { usedBytes: 5, capacityBytes: 1024, freeBytes: 1019 });
  assert.deepEqual((await adapter.list('')).map(file => file.path), ['file-a.txt']);
  assert.equal((await fsp.readdir(vault)).some(name => name.startsWith('.health-check-')), false);
});
test('missing files, directories and invalid runtime arguments fail without exposing absolute paths', async () => {
  const { adapter, vault } = await fixture();
  assert.equal((await adapter.download('missing.txt')).success, false);
  await fsp.mkdir(path.join(vault, 'directory'));
  for (const operation of [() => adapter.download('directory'), () => adapter.upload('directory', Buffer.from('denied')), () => adapter.delete('directory'), () => adapter.upload('valid.txt', 'not a buffer')]) {
    const result = await operation(); assert.equal(result.success, false);
    assert.equal(result.error, 'Local storage operation is unavailable.');
    assert.equal(result.error.includes(vault), false);
  }
  assert.equal((await fsp.stat(path.join(vault, 'directory'))).isDirectory(), true);
});
test('capacity must be a positive safe integer; values are reporting configuration, not an enforced disk quota', () => {
  for (const capacityBytes of [0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => new LocalFilesystemAdapter({ basePath: fixtureRoot, capacityBytes }), /capacity/);
  }
});
