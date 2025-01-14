import { useEffect, useState, type PropsWithChildren } from "react";
import { ImageDisplay } from "./ImageDisplay.tsx";

const DRAG_EVENTS_TO_PREVENT = ['drag', 'dragstart', 'dragend', 'dragover', 'dragenter', 'dragleave', 'drop'];
const DRAG_EVENTS_START = ['dragover', 'dragenter'];
const DRAG_EVENTS_STOP = ['dragleave', 'dragend'/*, 'drop' */];

type STATE = 'initial' | 'dragging' | 'processing' | 'not_supported' | 'done';

interface ClipboardDetails {
    DTIs: ClipboardDTI[];
    files: ClipboardFile[];
}

interface ClipboardDTI {
    type: string;
    textDetails: null | ReturnType<typeof makeTextDetails>;
    data: any; // TODO Maybe rework to unknown
}

interface ClipboardFile {
    raw: File;
}

function preventDefaultAndStopPropagation(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
}

type PasteHandler = (e: ClipboardEvent) => void;
type DropHandler = (e: DragEvent) => void;
type StubHandler = () => void;

function registerEventHandlers(
    paste: PasteHandler,
    drop: DropHandler,
    startDrag: StubHandler,
    stopDrag: StubHandler,
): void {
    document.body.addEventListener('paste', paste);
    DRAG_EVENTS_TO_PREVENT.forEach((eventName) => {
      document.body.addEventListener(eventName, preventDefaultAndStopPropagation);
    });
    DRAG_EVENTS_START.forEach((eventName) => {
      document.body.addEventListener(eventName, startDrag);
    });
    DRAG_EVENTS_STOP.forEach((eventName) => {
      document.body.addEventListener(eventName, stopDrag);
    });
    document.body.addEventListener('drop', drop);
}

function unregisterEventHandlers(
    paste: PasteHandler,
    drop: DropHandler,
    startDrag: StubHandler,
    stopDrag: StubHandler,
): void {
    document.body.removeEventListener('paste', paste);
    DRAG_EVENTS_TO_PREVENT.forEach((eventName) => {
        document.body.removeEventListener(eventName, preventDefaultAndStopPropagation);
    });
    DRAG_EVENTS_START.forEach((eventName) => {
        document.body.removeEventListener(eventName, startDrag);
    });
    DRAG_EVENTS_STOP.forEach((eventName) => {
        document.body.removeEventListener(eventName, stopDrag);
    });
    document.body.removeEventListener('drop', drop);
}

function scrollToId(id: string): void {
    const el = document.getElementById(id);
    if (!el) {
      return;
    }

    el.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
}

type NEWLINE_TYPE = 'UNIX (LF)' | 'Windows (CR LF)';

function makeTextDetails(text: string) {
    const hex = new TextEncoder().encode(text);
    const hexArr = Array.from(hex).map(i => i.toString(16).padStart(2, '0'));
    const spaces = hexArr.filter(i => i == '20').length;
    const words = text.split(' ').length;
    const newlines = hexArr.filter(i => i == '0a').length;
    let newlineType = 'UNIX (LF)';
    if (newlines > 0) {
        if (hexArr.findIndex(i => i == '0d') !== -1) newlineType = 'Windows (CR LF)';
    }

    return {
        length: text.length,
        bytes: hexArr.length,
        spaces,
        words,
        newlines,
        newlineType,
    };
}

export function PasteAnalyzer() {
    const [state, setState] = useState<STATE>('initial');
    const [clipboardDetails, setClipboardDetails] = useState<ClipboardDetails>({
        DTIs: [],
        files: [],
    });

    useEffect(() => {
        registerEventHandlers(
            handlePaste,
            handleDrop,
            startDrag,
            stopDrag,
        );
        return () => unregisterEventHandlers(
            handlePaste,
            handleDrop,
            startDrag,
            stopDrag,
        );
    }, []);

    function handlePaste(e: ClipboardEvent) {
        setState('processing');
        if (!e.clipboardData) {
            setState('not_supported');
            return;
        }

        handleDataTransfer(e.clipboardData);
    }

    function handleDrop(e: DragEvent) {
        setState('processing');
        if (!e.dataTransfer) {
            setState('not_supported');
            return;
        }

        handleDataTransfer(e.dataTransfer);
    }

    function startDrag() {
        setState('dragging');
    }

    function stopDrag() {
        if (clipboardDetails.DTIs.length > 0 || clipboardDetails.files.length > 0) {
            setState('done');
        } else {
            setState('initial');
        }
    }

    function handleDataTransfer(dt: DataTransfer) {
        reset();
        console.log('handling data transfer', dt);

        const DTIs: ClipboardDTI[] = [];
        dt.types.forEach((dataType) => {
            // Ignore the Files type, since we are processing them separately
            if (dataType === 'Files') {
                return;
            }

            const data = dt.getData(dataType);
            let textDetails = null;
            if (dataType.startsWith('text/')) {
                textDetails = makeTextDetails(data);
            }

            DTIs.push({
                type: dataType,
                textDetails,
                data,
            });
        });

        const files: ClipboardFile[] = [];
        for (let i = 0; i < dt.files.length; i++) {
            const file = dt.files.item(i);

            // Happens when no file was actually passed
            if (file === null) {
                continue;
            }

            files.push({
                raw: file,
            });
        }

        // Move text/plain to first place
        DTIs.sort((dti) => dti.type === 'text/plain' ? 0 : 1);

        setClipboardDetails(Object.assign({}, clipboardDetails, {
            DTIs,
            files,
        }));

        setState('done');
    }

    function reset() {
        setState('initial');
        setClipboardDetails(Object.assign({}, clipboardDetails, {DTIs: [], files: []}));
    }

    return (<div>
        {state === 'not_supported' && (
            <article>
                The clipboard was empty or the clipboard API is not supported in your browser.
            </article>
        )}
        {state === 'initial' && (
            <article>
                Awaiting input - press Ctrl+V to paste the contents of your clipboard.<br/>
                Or you can drag and drop anything, the <code>DataTransfer</code> API is the same.
            </article>
        )}
        {state === 'dragging' && (
            <article>
                Waiting for the drop...
            </article>
        )}
        {state === 'processing' && (
            <article>
                Processing data...
            </article>
        )}
        {state === 'done' && (
            <div>
                <button onClick={() => reset()} type="reset">Reset</button>
                <hr/>
                <ul>
                    {clipboardDetails.DTIs.map((dti, idx) => {
                        return (<li key={`${dti.type}-${idx}`}>
                            <a href={`#dti-${idx}`}>Item: {dti.type}</a>
                        </li>);
                    })}
                    {clipboardDetails.files.map((file, idx) => {
                        return (<li key={`${file.raw.type}-${idx}`}>
                            <a href={`#file-${idx}`}>File: {file.raw.name}</a>
                        </li>);
                    })}
                </ul>
                <hr/>

                <h2>Items</h2>
                {clipboardDetails.DTIs.length === 0 && <i>No items pasted.</i>}
                {clipboardDetails.DTIs.length > 0 && (
                    <div className="card-container">
                        {clipboardDetails.DTIs.map((dti, idx) => {
                            return (<Card key={`${dti.type}-${idx}`} id={`dti-${idx}`} title={dti.type}>
                                <pre>{dti.data}</pre>
                                {dti.textDetails && <>
                                    <table>
                                    <tbody>
                                        <tr>
                                            <td>Text length</td>
                                            <td>{dti.textDetails.length}</td>
                                        </tr>
                                        <tr>
                                            <td>Bytes length</td>
                                            <td>{dti.textDetails.bytes}</td>
                                        </tr>
                                        <tr>
                                            <td>Space count</td>
                                            <td>{dti.textDetails.spaces}</td>
                                        </tr>
                                        <tr>
                                            <td>Words count</td>
                                            <td>{dti.textDetails.words}</td>
                                        </tr>
                                        <tr>
                                            <td>Newlines count</td>
                                            <td>{dti.textDetails.newlines}</td>
                                        </tr>
                                        <tr>
                                            <td>Newlines type</td>
                                            <td>
                                                {dti.textDetails.newlines == 0 && <i>No newlines detected</i>}
                                                {dti.textDetails.newlines > 0 && dti.textDetails.newlineType}
                                            </td>
                                        </tr>
                                    </tbody>
                                    </table>
                                </>}
                            </Card>);
                        })}
                    </div>
                )}
                <h2>Files</h2>
                {clipboardDetails.files.length === 0 && <i>No files pasted.</i>}
                {clipboardDetails.files.length > 0 && (
                    <div className="card-container files">
                        {clipboardDetails.files.map((file, idx) => {
                            return (<Card key={`${file.raw.type}-${idx}`} id={`file-${idx}`} title={file.raw.name}>
                                <i>Size: {file.raw.size} bytes</i>
                                <br/>
                                <i>Last modified: {(new Date(file.raw.lastModified)).toISOString()}</i>
                                <br/>
                                <i>Type: <code>{file.raw.type}</code></i>
                                <br/>
                                {file.raw.type.startsWith('image') && <ImageDisplay file={file.raw}/>}
                            </Card>);
                        })}
                    </div>
                )}
            </div>
        )}
        <hr/>
        {state === 'done' && <button onClick={() => reset()} type="reset">Reset</button>}
    </div>);
}

type CardProps = {
    id: string,
    title: string,
} & PropsWithChildren;

function Card({id, title, children}: CardProps) {
    return (<article id={id} className="card">
        <h3>{title}</h3>
        <div>
            {children && children}
            {!children && <i>No details on this item.</i>}
        </div>
    </article>);
}
