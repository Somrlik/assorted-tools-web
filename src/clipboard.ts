export function isClipboardAvailable(): boolean {
  return navigator.clipboard ? typeof navigator.clipboard.writeText === 'function' : false;
}

export function writeToClipboard(toWrite: string): Promise<boolean> {
  return new Promise((resolve) => {
    navigator.clipboard.writeText(toWrite).then(() => {
      resolve(true);
    }, () => {
      resolve(false);
    });
  });
}
