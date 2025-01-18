export function downloadString(string: string, filename: string, mime: string = 'text/plain') {
    const blob = new Blob([string], {type: mime});

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();

    URL.revokeObjectURL(a.href);
}
