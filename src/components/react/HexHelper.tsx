import { useEffect, useMemo, useState } from "react";
import { useSystemEndianess } from "./useSystemEndianess.ts";

const BYTES_REPRESENTATIONS = [
    // ['char', 'int8', 'Int8', 1],
    ['uchar', 'uint8', 'Uint8', 1],
    // ['short', 'int16', 'Int16', 2],
    ['ushort', 'uint16', 'Uint16', 2],
    // ['int', 'int32', 'Int32', 4],
    ['uint', 'uint32', 'Uint32', 4],
    // ['long', 'int64', 'BigInt64', 8],
    ['ulong', 'uint64', 'BigUint64', 8],
    // IEEE 754 maybe?
    // ['half', 'float16', 'getFloat16', 4], // TODO: Find which reads are supported on the platform
    ['float', 'float32', 'Float32', 8],
    ['double', 'float64', 'Float64', 16],
] as const;

function dataviewToArrayOfHexBytes(dw: DataView) {
    return Array.from(new Uint8Array(dw.buffer, dw.byteOffset, dw.byteLength), byte => byte.toString(16).padStart(2, '0'));
}

function getByteRepresentationsOfNumber(n: number, text: string) {
    return BYTES_REPRESENTATIONS.map(([idiom, technical, functionName, width]) => {
        try {
            const bebuffer = new ArrayBuffer(width);
            const beview = new DataView(bebuffer);
            let overflow = false;
            if (functionName.includes('Big')) {
                // @ts-ignore
                beview['set' + functionName](0, BigInt.asUintN(8, text), false);
                // @ts-ignore
                overflow = beview['get' + functionName](0, false) != BigInt.asUintN(8, text);
            } else {
                // @ts-ignore
                beview['set' + functionName](0, n, false);
                // @ts-ignore
                overflow = beview['get' + functionName](0, false) != n;
            }

            const lebuffer = new ArrayBuffer(width);
            const leview = new DataView(lebuffer);
            if (functionName.includes('Big')) {
                // @ts-ignore
                leview['set' + functionName](0, BigInt.asUintN(8, text), true);
            } else {
                // @ts-ignore
                leview['set' + functionName](0, n, true);
            }

            return {
                idiom,
                technical,
                overflow,
                invalid: false,
                be: dataviewToArrayOfHexBytes(beview),
                le: dataviewToArrayOfHexBytes(leview),
            }
        } catch (err) {
            console.error(err);
            return {
                idiom,
                technical,
                overflow: false,
                invalid: true,
            };
        }
    });
}

export function HexHelper() {
    // Yes, the number is a string since it can be in hex
    const [number, setNumber] = useState<string>('');
    const [forceHex, setForceHex] = useState<boolean>(false);

    const [isInvalid, setIsInvalid] = useState<boolean>(false);
    const [endianess] = useSystemEndianess();

    function handleKeypressesForShortcuts(ev: KeyboardEvent) {
        if (ev.altKey && ev.code === 'KeyH') {
            ev.preventDefault();
            setForceHex(!forceHex);
        }
    }

    useEffect(() => {
        window.addEventListener('keydown', handleKeypressesForShortcuts);
        return () => {
            window.removeEventListener('keydown', handleKeypressesForShortcuts);
        }
    });

    const numberDetails = useMemo(() => {
        setIsInvalid(false);
        if (number.trim() == '') return null;
        let n = (forceHex ? '0x' : '') + number.toLowerCase().trim();
        let numeric = NaN;

        if (
            n.startsWith('0x') ||
            n.startsWith('x') ||
            ['a', 'b', 'c', 'd', 'e', 'f', '-'].map(x => n.includes(x)).filter(x => x).length > 0
        ) {
            while (n.startsWith('0x')) n = n.substring(2);
            while (n.startsWith('x')) n = n.substring(1);

            numeric = parseInt(n, 16);
        } else if (
            n.split('').map(x => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, '.', ',', '-'].map(x => `${x}`).includes(x)).filter(x => !x).length === 0
        ) {
            numeric = parseInt(n, 10);
        }

        if (isNaN(numeric)) {
            setIsInvalid(true);
            return null;
        }

        return getByteRepresentationsOfNumber(numeric, n);
    }, [number, forceHex]);

    return (<div>
        <fieldset role="group">
            {forceHex && <button disabled>0x</button>}
            <input type="text" placeholder="Enter a number, decimal or hexa" onChange={(e) => setNumber(e.target.value)} value={number}/>
        </fieldset>

        <fieldset>
            <input id="force-hex" type="checkbox" onChange={(e) => setForceHex(!forceHex)} checked={forceHex} />
            <label htmlFor="force-hex">Force input to be in <u>h</u>ex? <kbd>ALT + H</kbd></label>
        </fieldset>


        {isInvalid && <blockquote>The number you entered is invalid.</blockquote>}
        {numberDetails && <table>
            <thead>
                <tr>
                    <th>&nbsp;</th>
                    <th>&nbsp;</th>
                    <th>Big Endian</th>
                    <th>Little Endian</th>
                </tr>
            </thead>
            <tbody>
                {numberDetails.map(detail => {
                    return (<tr key={detail.idiom}>
                        <th>{detail.idiom}</th>
                        <th>{detail.technical}</th>
                        <td>
                            {detail.invalid ? <i>invalid</i> : <code>{detail.be?.join(' ')}</code>}
                            {detail.overflow && <i>!overflow</i>}
                        </td>
                        <td>
                            {detail.invalid ? <i>invalid</i> : <code>{detail.le?.join(' ')}</code>}
                            {detail.overflow && <i>!overflow</i>}
                        </td>
                    </tr>);
                })}
            </tbody>
            </table>}
    </div>);
}
