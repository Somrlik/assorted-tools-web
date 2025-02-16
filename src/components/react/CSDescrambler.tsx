import { useMemo, useState, type ChangeEvent } from "react";
import { CopyToClipboardButton } from "./CopyToClipboardButton.tsx";

const addCommaSecondLast = (str: string) => {
    if (str.length < 2) return str; // If string is too short, return as is
    return str.slice(0, -2) + ',' + str.slice(-2);
};

/**
 * @see https://www.csas.cz/static_internet/cs/Obchodni_informace-Produkty/Prime_bankovnictvi/Spolecne/Prilohy/ABO_format.pdf
 */
const SCRAMBLE_PATTERN = [
    'P1 P2 P3 P4 P5 P6 C1 C2 C3 C4 C5 C6 C7 C8 C9 C0',
    'C0 C8 C9 C6 C1 C2 C3 C4 C5 C7 P1 P2 P3 P4 P5 P6',
];

function descramble(csNumber: string): string {
    const withoutSlash = csNumber.replace('/', '').replace('-', '');
    const padded = withoutSlash.padStart(16, '0');

    return [
        padded.at(15), // C0
        padded.at(13), // C8
        padded.at(14), // C9
        padded.at(11), // C6
        padded.at(6),  // C1
        padded.at(7),  // C2
        padded.at(8),  // C3
        padded.at(9),  // C4
        padded.at(10), // C5
        padded.at(12), // C7
        padded.at(0),  // P1
        padded.at(1),  // P2
        padded.at(2),  // P3
        padded.at(3),  // P4
        padded.at(4),  // P5
        padded.at(5),  // P6
    ].join('');
}

export function CSDescrambler() {
    return (
        <main className="container">
            <SingleDescrabmler/>
            <ABODescrambler/>
        </main>
    );
}

function SingleDescrabmler() {
    const [csNumber, setCsNumber] = useState('');

    const descrambled = descramble(csNumber).replace(/^0+/, '');

    return (
        <section>
            <fieldset>
                <label>Česká Spořitelna Account Number</label>
                <input onChange={(ev: ChangeEvent<HTMLInputElement>) => setCsNumber(ev.target.value)} value={csNumber} />
            </fieldset>
            <fieldset>
                <label>Normal Czech Account Number</label>
                <CopyToClipboardButton data={descrambled}/>
                <input style={{width: '90%'}} readOnly={true} value={descrambled}/>
            </fieldset>
        </section>
    )
}

function splitArrayBuffer(buffer: ArrayBuffer, delimiter = new Uint8Array([0x0d, 0x0a])): Uint8Array[] {
    const uint8Array = new Uint8Array(buffer);
    const parts = [];
    let start = 0;

    for (let i = 0; i < uint8Array.length - 1; i++) {
        if (uint8Array[i] === delimiter[0] && uint8Array[i + 1] === delimiter[1]) {
            parts.push(uint8Array.slice(start, i)); // Store split part as ArrayBuffer
            start = i + 2; // Skip the delimiter
        }
    }

    // Push the last part
    if (start < uint8Array.length) {
        parts.push(uint8Array.slice(start));
    }

    return parts;
}

type SingleLine = {
    ownAccount: string,
    otherAccountScrambled: string,
    otherAccount: string,
    id: string,
    amount: string,
    vs: string,
    note: string,
    bank: string,
}

type ProcessedFile = {
    originalName: string,
    contents: string,
    lines: SingleLine[],
}

function ABODescrambler() {
    const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
    const [processing, setProcessing] = useState(false);

    async function processUpload(files: FileList | null): Promise<void> {
        if (files === null) return;

        const newProcessedFiles: ProcessedFile[] = [];
        for (const file of files) {
            const buffer = await file.arrayBuffer();
            const lines = splitArrayBuffer(buffer);

            const processedLines: SingleLine[] = [];
            for (const line of lines) {
                const identifier = String.fromCharCode(...line.slice(0, 3));
                if (identifier === '075') {
                    const scrambled = String.fromCharCode(...line.slice(3 + 16, 3 + 16 + 16));
                    const descrambled = descramble(scrambled);

                    const debet = String.fromCharCode(...line.slice(3, 3 + 16));
                    const minus = ['1', '4'].includes(debet);

                    processedLines.push({
                        ownAccount: String.fromCharCode(...line.slice(3, 3 + 16)),
                        otherAccount: descrambled,
                        otherAccountScrambled: scrambled,
                        id: String.fromCharCode(...line.slice(35, 48)),
                        amount: (minus ? '-' : '') + String.fromCharCode(...line.slice(48, 60)),
                        vs: String.fromCharCode(...line.slice(61, 71)),
                        bank: String.fromCharCode(...line.slice(73, 77)),
                        note: String.fromCharCode(...line.slice(97, 117)),
                    });
                }
            }
            newProcessedFiles.push({
                contents: '',
                lines: processedLines,
                originalName: file.name,
            });
        }

        setProcessedFiles(newProcessedFiles);
    }

    const processedFilesRender = useMemo(() => {
        return (<>
            {processedFiles.length === 0 ? '' : <section>
                {processedFiles.map(file => {
                    return (
                        <article key={file.originalName}>
                            <header>{file.originalName}</header>
                            <table>
                            <thead>
                                <tr>
                                    <th>Own Acc</th>
                                    <th>Other Acc Scramble</th>
                                    <th>Other Acc Proper</th>
                                    <th>Amount</th>
                                    <th>VS</th>
                                    <th>Note</th>
                                </tr>
                            </thead>
                            <tbody>
                                {file.lines.map(line => {
                                    return (
                                        <tr key={`line-${line.id}`}>
                                            <td>{line.ownAccount.replace(/^0+/, '')}</td>
                                            <td style={{textAlign: 'right'}}>{line.otherAccountScrambled.replace(/^0+/, '')}</td>
                                            <td style={{textAlign: 'right'}}>
                                                {line.otherAccount.replace(/^0+/, '')}/{line.bank}
                                            </td>
                                            <td style={{textAlign: 'right'}}>{addCommaSecondLast(line.amount.replace(/^0+/, ''))}</td>
                                            <td>{line.vs}</td>
                                            <td>{line.note}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            </table>
                        </article>
                    );
                })}
            </section>}
        </>);
    }, [processedFiles]);

    return (
        <section>
            <h3>ABO File Descrambler</h3>
            <p>You can also descramble ABO files here. Nothing is uploaded.</p>
            {processing && <div>Processing, please wait...</div>}
            {!processing && <fieldset>
                <input type="file" multiple={true} onChange={(ev: ChangeEvent<HTMLInputElement>) => processUpload(ev.target.files)} />
            </fieldset>}
            {processedFilesRender}
        </section>
    );
}
