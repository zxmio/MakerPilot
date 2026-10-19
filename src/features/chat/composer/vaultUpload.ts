import type { App } from 'obsidian';

/**
 * Copies files picked from the computer into the vault, where Obsidian places pasted
 * attachments for `sourcePath`, and returns their vault paths in order.
 */
export async function copyFilesIntoVault(app: App, files: readonly File[], sourcePath: string): Promise<string[]> {
  const paths: string[] = [];
  for (const file of files) {
    const path = await app.fileManager.getAvailablePathForAttachment(file.name, sourcePath);
    await app.vault.createBinary(path, await file.arrayBuffer());
    paths.push(path);
  }
  return paths;
}
