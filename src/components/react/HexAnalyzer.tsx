async function readFromFile(file: File) {
    const buffer = await file.arrayBuffer();
}

type Endianess = 'little' | 'big';

function findEndianess(): Endianess {
    const arrayBuffer = new ArrayBuffer(2);
    const uint8Array = new Uint8Array(arrayBuffer);
    const uint16array = new Uint16Array(arrayBuffer);
    uint8Array[0] = 0xAA;
    uint8Array[1] = 0xBB;
    if(uint16array[0] === 0xBBAA) return 'little';
    if(uint16array[0] === 0xAABB) return 'big';
    else throw new Error("PDP-11 endianess not supported, how the hell did you get this running anyways?");
}

const DATAVIEW_CALLS = [
    ['char', 'int8', 'getInt8', 1],
    ['uchar', 'uint8', 'getUint8', 1],
    ['short', 'int16', 'getInt16', 2],
    ['ushort', 'uint16', 'getUint16', 2],
    ['int', 'int32', 'getInt32', 4],
    ['uint', 'uint32', 'getUint32', 4],
    ['long', 'int64', 'getBigInt64', 8],
    ['ulong', 'uint64', 'getBigUint64', 8],
    // IEEE 754 maybe?
    // ['half', 'float16', 'getFloat16', 4], // TODO: Find which reads are supported on the platform
    ['float', 'float32', 'getFloat32', 8],
    ['double', 'float64', 'getFloat64', 16],
];

export function HexAnalyzer() {
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01]);
    const values = bytesToValues(bytes);

    const worker = window!.assortedToolsWeb!.hexAnalyzerWorker as Worker;

    console.log(values);

    return (<div>
        <button onClick={() => {

            worker.postMessage('test');
            worker.onmessage = (ev) => {
                console.log('message from worker ', ev)
            }
        }}>Message worker</button>
        <input type="file" onChange={(ev) => {
            worker.postMessage({'file': ev.target.files});
        }}></input>
    </div>);
}

function bytesToValues(bytes: Uint8Array) {
    const dw = new DataView(bytes.buffer);

    const readValues = DATAVIEW_CALLS.map(([idiomatic, precise, call]) => {
        try {
            // @ts-ignore
            return [idiomatic, dw[call](0, true), dw[call](0, false)];
        } catch (e) {
            return [idiomatic, NaN];
        }
    });

    return readValues;
}
