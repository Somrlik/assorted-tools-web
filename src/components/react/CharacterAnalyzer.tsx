import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useHexCasePreferences } from "./useHexCasePreferences.tsx";

import HTML_ENTITIES_NAMES_RAW from './codepoint-to-html-entity.json';
import { CopyToClipboardButton } from "./CopyToClipboardButton.tsx";

const GALLERY = [
    ['Different whitespaces', `\n\t${String.fromCharCode(160)}`],
    ['Small letter C with caron', 'č'],
    ['G Clef', '𝄞'],
    ['Rocket', '🚀'],
    ['Family: Woman, Girl', '👩‍👧'],
    ['Family: Man, Man, Girl, Girl', '👨‍👨‍👧‍👧'],
    ['Cursed test', 'ṯ̷̨̡̗̖̻̼̻̹͔̖̤̂̀̐̿̅́̇̔̾͆̓́̄͛͝e̸̙͔͍̎͊͒̄̓ͅs̸̗̐̈́͐̒̓͠ţ̸̪͇͓̝͎̥̰̱̘̤̥̥̿̄́̾̂̔'],
];

const SPECIAL_CODEPOINTS: Record<number, string> = {
    7: '\\a',
    9: '\\t',
    10: '\\n',
    11: '\\v',
    13: '\\r',
    32: '[space]',
    160: '&nbsp;',
    8205: '&zwj;',
};

interface CharDetails {
    character: string;
    bytesWidth: number;
    urlencode: string;
    unicodeIndex10: number;
    unicodeIndex16: string;
    htmlEscape10: string;
    htmlEscape16: string;
    utf8: string;
    utf16: string;
    charbase: string;
    htmlNamedEntities: string[],
}

const CHARBASE_LINK = 'https://charbase.com';
const COMPART_LINK = 'https://www.compart.com/en/unicode';
const UNICODE_EXPLORER_LINK = 'https://unicode-explorer.com/c';
const MAX_SELECTION_LENGTH = 100;

const segmenter = new Intl.Segmenter;

type Strategy = 'split' | 'segmenter';

export function CharacterAnalyzer() {
    const HTML_ENTITIES_NAMES: Record<number, string[]> = HTML_ENTITIES_NAMES_RAW.data;

    const [input, setInput] = useState('');
    const [selection, setSelection] = useState('');
    const [strategy, setStrategy] = useState<Strategy>('split');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [totalBytesSelected, setTotalBytesSelected] = useState(0);

    const [isHexUppercase, _, hexUppercaseButton] = useHexCasePreferences();

    const selectionDetails = useMemo<CharDetails[]>(() => {
        let bytesSelected = 0;
        if (selection.length > MAX_SELECTION_LENGTH) return [];

        let array = [];
        if (strategy === 'segmenter') {
            const segments = [...segmenter.segment(selection)];
            array = segments;
        } else {
            const split = [...selection];
            array = split;
        }

        const toReturn = array.map((segmentDataOrChar) => {
            let char: string;
            if (strategy === 'segmenter') {
                char = (segmentDataOrChar as Intl.SegmentData).segment;
            } else {
                char = segmentDataOrChar as string;
            }

            const bytesWidth = encodeURIComponent(char).split(/%(?:u[0-9A-F]{2})?[0-9A-F]{2}|./).length - 1;
            bytesSelected += bytesWidth;

            const hex = new TextEncoder().encode(char);
            const hexArr = Array.from(hex).map(i => i.toString(16));
            const utf8 = hexArr.join(' ');

            const unicodeIndex10 = char.codePointAt(0) ?? 0;
            const unicodeIndex16 = 'U+' + unicodeIndex10.toString(16).padStart(4, '0');

            const htmlEscape10 = `&#${unicodeIndex10};`;
            const htmlEscape16 = `&#x${unicodeIndex10.toString(16)};`;

            const charAts = [];
            for (let i = 0; i < bytesWidth; i++) {
                const charAt = char.charAt(i) ?? '';
                if (charAt !== '') {
                    const twoBytes = char.charCodeAt(i).toString(16);
                    charAts.push(twoBytes);
                }
            }
            const utf16 = charAts.map(s => s.padStart(4, '0')).join(' ');

            return {
                character: char,
                bytesWidth,
                urlencode: isHexUppercase ? encodeURIComponent(char) : encodeURIComponent(char).toLowerCase(),
                unicodeIndex10,
                unicodeIndex16: isHexUppercase ? unicodeIndex16.toUpperCase() : unicodeIndex16,
                htmlEscape10,
                htmlEscape16: isHexUppercase ? htmlEscape16.toUpperCase() : htmlEscape16,
                utf8: isHexUppercase ? utf8.toUpperCase() : utf8,
                utf16: isHexUppercase ? utf16.toUpperCase() : utf16,
                charbase: (unicodeIndex10 ?? 0).toString(16).padStart(4, '0'),
                htmlNamedEntities: HTML_ENTITIES_NAMES[unicodeIndex10] ? HTML_ENTITIES_NAMES[unicodeIndex10] : [],
            };
        });

        setTotalBytesSelected(bytesSelected);
        return toReturn;
    }, [selection, strategy, isHexUppercase]);

    function switchStrategy() {
        setStrategy(strategy === 'split' ? 'segmenter' : 'split')
    }

    useEffect(() => {
        textareaRef.current?.addEventListener('select', handleNativeSelectEvent)
        return () => textareaRef.current?.removeEventListener('select', handleNativeSelectEvent);
    }, []);

    function handleNativeSelectEvent(e: Event) {
        const target = e.target as HTMLTextAreaElement;
        setSelection(target.value.substring(target.selectionStart, target.selectionEnd));
    }

    function loadFromGallery(sequence: string) {
        setInput(sequence);
        setSelection(sequence);
    }

    return (<div>
        <article>
            When inputting, you can write/paste as many characters as you want.
            You can then select which ones you are interested in, for example offending whitespaces.
            Below is a small gallery with some juicy examples.
        </article>

        <fieldset>
            <label htmlFor="textarea">Input</label>
            <textarea
                id="textarea"
                placeholder="Waiting for text..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                ref={textareaRef}
                autoComplete='off'
                autoCorrect='off'
                autoCapitalize='off'
                spellCheck={false}
            ></textarea>
        </fieldset>

        <p>Total bytes selected: {totalBytesSelected}</p>

        <button onClick={() => switchStrategy()}>
            Switch from <code>{strategy}</code> to <code>{strategy === 'split' ? 'segmenter' : 'split'}</code>
        </button>
        &nbsp;
        {hexUppercaseButton}

        {selection.length > MAX_SELECTION_LENGTH && <article>
            Sorry, cannot select more than {MAX_SELECTION_LENGTH} to prevent lag.
        </article>}

        <div className="card-container">
            {selectionDetails.map((charDetail, idx) => {
                return <Card key={idx} {...charDetail}/>;
            })}
        </div>

        <hr/>
        <h2>Gallery</h2>
        <ul>
            {GALLERY.map(([description, sequence]) => {
                return (<li key={description}>
                    {description}: <code>{sequence}</code>&nbsp;
                    <a href="#" onClick={() => loadFromGallery(sequence)}>Try it</a>
                </li>);
            })}
        </ul>
    </div>);
}

function Card(details: CharDetails) {
    return (
        <article className="card">
            <pre style={{fontSize: '2em', textAlign: 'center'}}>
                {SPECIAL_CODEPOINTS[details.unicodeIndex10] ?? details.character}
            </pre>
            <table>
            <tbody>
                <tr>
                    <th>Width</th>
                    <td>{details.bytesWidth} byte{details.bytesWidth > 1 ? 's' : ''}</td>
                </tr>
                <tr>
                    <th>Unicode U+</th>
                    <td><code>{details.unicodeIndex16}</code></td>
                </tr>
                <tr>
                    <th>Unicode DEC</th>
                    <td><code>{details.unicodeIndex10}</code></td>
                </tr>
                <tr>
                    <th>URL encode</th>
                    <td><code>{details.urlencode}</code></td>
                </tr>
                <tr>
                    <th>HTML Entity dec</th>
                    <td><code>{details.htmlEscape10}</code></td>
                </tr>
                <tr>
                    <th>HTML Entity hex</th>
                    <td><code>{details.htmlEscape16}</code></td>
                </tr>
                <tr>
                    <th>HTML Entity name</th>
                    <td>
                        {details.htmlNamedEntities.length == 0 && <i>none</i>}
                        {details.htmlNamedEntities.length > 0 && <>
                            {details.htmlNamedEntities.map(x => {
                                return (<code>&{x};</code>);
                            })}
                        </>}
                    </td>
                </tr>
                <tr>
                    <th>UTF8 hex</th>
                    <td><code>{details.utf8}</code></td>
                </tr>
                <tr>
                    <th>UTF16 hex</th>
                    <td><code>{details.utf16}</code></td>
                </tr>
                <tr>
                    <th>Links</th>
                    <td>
                        <a href={`${CHARBASE_LINK}/${details.charbase}`} target="_blank">charbase.com</a><br/>
                        <a href={`${COMPART_LINK}/${details.unicodeIndex16}`} target="_blank">compart.com</a><br/>
                        <a href={`${UNICODE_EXPLORER_LINK}/${details.unicodeIndex16.substring(2)}`} target="_blank">unicode-explorer.com</a>
                    </td>
                </tr>
                <tr>
                    <th>Copy</th>
                    <td>
                        <CopyToClipboardButton data={details.character}/>
                    </td>
                </tr>
            </tbody>
            </table>
        </article>
    )
}