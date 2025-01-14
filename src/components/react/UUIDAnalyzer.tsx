import { useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { useHexCasePreferences } from "./useHexCasePreferences.tsx";
import { generateUUID } from "../../generateUUID.ts";
import { SVGStringWrapper } from "./SVGStringWrapper.tsx";
import { writeToClipboard } from "../../clipboard.ts";
import { CopyToClipboardButton } from "./CopyToClipboardButton.tsx";

const UUID_REGEX = /^([0-9a-f]{8})-([0-9a-f]{4})-([1-5])([0-9a-f]{3})-([89AB][0-9a-f]{3})-([0-9a-f]{12})$/i;
const UUID_REGEX_NO_DASH = /^([0-9a-f]{8})-?([0-9a-f]{4})-?([1-5])([0-9a-f]{3})-?([89AB][0-9a-f]{3})-?([0-9a-f]{12})$/i;

async function bytesToBase64DataUrl(bytes: Uint8Array, type = "application/octet-stream") {
return await new Promise<string>((resolve, reject) => {
    const reader = Object.assign(new FileReader(), {
            onload: () => resolve(reader.result!.toString()),
            onerror: () => reject(reader.error),
        });
        reader.readAsDataURL(new File([bytes], "", { type }));
    });
}

type UUIDDetails = {
    uuid: string,
    version: string,
    withoutDashes: string,
    binary: string,
    base64: string,
    decimalDigest: string,
    hexDigest: string,
    escapedBinary: string,
}

export function UUIDAnalyzer() {
    const [isHexUppper, _, hexUppercaseButton] = useHexCasePreferences();
    const [ignoreDashes, setIgnoreDashes] = useState(false);
    const [input, setInput] = useState('');
    const [uuidDetails, setUUIDDetails] = useState<UUIDDetails | null>(null);

    function generateNew() {
        const uuid = generateUUID();
        setInput(uuid);
    }

    useEffect(() => {
        (async () => {
            const regex = !ignoreDashes ? UUID_REGEX : UUID_REGEX_NO_DASH;
            const matches = input.trim().match(regex);
            if (!matches) {
                setUUIDDetails(null);
                return;
            }
            const uuid = `${matches[1]}-${matches[2]}-${matches[3]}${matches[4]}-${matches[5]}-${matches[6]}`;
            const version = matches[3];
            const withoutDashes = uuid!.replaceAll('-', '');

            const digestBytes = withoutDashes.match(/.{1,2}/g)!.map((byteDigest: string) => {
                return parseInt(byteDigest, 16);
            });
            const hexDigest = digestBytes.map(n => n.toString(16).padStart(2, '0')).join(' ');
            const buffer = new Uint8Array(digestBytes);
            const base64 = (await bytesToBase64DataUrl(buffer)).replace('data:application/octet-stream;base64,', '');

            const binary = String.fromCharCode(...digestBytes);
            const escapedBinary = digestBytes.map(byte => {
                const hex = byte.toString(16).padStart(2, '0');
                return `\\x${isHexUppper ? hex.toUpperCase() : hex}`;
            }).join('');

            setUUIDDetails({
                uuid: isHexUppper ? uuid.toUpperCase() : uuid,
                version: `v${version}`,
                withoutDashes: isHexUppper ? withoutDashes.toUpperCase() : withoutDashes,
                binary,
                base64,
                decimalDigest: digestBytes.join(' '),
                hexDigest: isHexUppper ? hexDigest.toUpperCase() : hexDigest,
                escapedBinary: escapedBinary,
            });
        })();
    }, [input, isHexUppper, ignoreDashes]);

    return (<div>
        <fieldset>
            <label htmlFor="input">UUID</label>
            <input id="input" value={input} onChange={(e) => setInput(e.target.value)} />
        </fieldset>

        <fieldset>
            <input id="dashes" type="checkbox" checked={ignoreDashes} onChange={() => setIgnoreDashes(!ignoreDashes)}/>
            <label htmlFor="dashes">Ignore absence of dashes?</label>
        </fieldset>

        <button onClick={() => generateNew()}>Generate new</button>
        &nbsp;
        {hexUppercaseButton}

        <hr/>

        {!uuidDetails ? (<i>No valid UUID found</i>) : (
            <table>
            <tbody>
                <TableRow head="UUID" value={uuidDetails.uuid} />
                <TableRow head="Version" value={uuidDetails.version} />
                <TableRow head="Without dashes" value={uuidDetails.withoutDashes} />
                <TableRow head="Raw binary" value={uuidDetails.binary} />
                <TableRow head="Escaped binary" value={uuidDetails.escapedBinary} />
                <TableRow head="Base64" value={uuidDetails.base64} />
                <TableRow head="Hex digest" value={uuidDetails.hexDigest} />
                <TableRow head="Decimal digest" value={uuidDetails.decimalDigest} />
            </tbody>
            </table>
        )}

    </div>);
}

type TableRowProps = {
    head: string,
    value: string,
} & PropsWithChildren;

function TableRow({head, value}: TableRowProps) {
    return (
        <tr>
            <td>{head}</td>
            <td><code>{value}</code></td>
            <td>
                <CopyToClipboardButton data={value}/>
            </td>
        </tr>
    );
}
