// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { downloadJson, JsonFileError, readJsonFile } from './browser';

afterEach(() => vi.restoreAllMocks());

describe('readJsonFile', () => {
  it('parses JSON', async () => {
    expect(await readJsonFile(new Blob(['{"a":1}']))).toEqual({ a: 1 });
  });
  it('rejects invalid JSON and oversized files', async () => {
    await expect(readJsonFile(new Blob(['{nope']))).rejects.toBeInstanceOf(JsonFileError);
    await expect(readJsonFile(new Blob(['{}']), 1)).rejects.toThrow(/too large/);
  });
});

describe('downloadJson', () => {
  it('clicks a temporary anchor with a .json name and cleans up', async () => {
    // jsdom lacks object URLs.
    const create = vi.fn(() => 'blob:x');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('backup.json');
      expect(this.href).toBe('blob:x');
    });
    downloadJson('backup', { a: 1 });
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a')).toBeNull();
    const blob = (create.mock.calls[0] as unknown as [Blob])[0];
    expect(JSON.parse(await blob.text())).toEqual({ a: 1 });
    await new Promise((r) => setTimeout(r, 0));
    expect(revoke).toHaveBeenCalledWith('blob:x');
  });
});
