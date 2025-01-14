import { useCallback, useEffect, useState } from "react";

export function MidiTester() {
    const [midiEnabled, startMidi, midiAccess, error] = useIsMidiEnabled();

    useEffect(() => {
        const timeout = setTimeout(startMidi, 50);
        return () => {
            clearTimeout(timeout);
        }
    }, []);

    return (
        <>
            {midiEnabled && midiAccess !== null && <MidiDashboard midi={midiAccess}/>}
            {!midiEnabled && <p>You should enable midi access</p>}
            {error && <p>Error: {error}</p>}
            {!midiEnabled && <button onClick={() => startMidi()}>Request MIDI</button>}
        </>
    );
}

// TODO: Handle disconnecting of MIDI device
function MidiDashboard({midi}: {midi: MIDIAccess}) {
    const [inputDevice, setInputDevice] = useState<MIDIInput | null>(null);
    const [outputDevice, setOutputDevice] = useState<MIDIOutput | null>(null);

    const [inputDeviceList, setInputDeviceList] = useState<MIDIInput[]>([]);
    const [outputDeviceList, setOutputDeviceList] = useState<MIDIOutput[]>([]);

    useEffect(() => {
        const newInputList = [];

        for (const entry of midi.inputs) {
            const input = entry[1];
            newInputList.push(input);
        }
        setInputDeviceList(newInputList);

        const newOutputList = [];
        for (const entry of midi.outputs) {
            const output = entry[1];
            newOutputList.push(output);
        }
        setOutputDeviceList(newOutputList);

    }, []);

    return <>
        <form>
            <fieldset className="grid">
                <label>
                    Input
                    <select onChange={(ev) => setInputDevice(midi.inputs.get(ev.target.value) ?? null)}>
                        {inputDeviceList.map(dev => {
                            return <option key={`${dev.id}`} value={dev.id}>
                                {dev.manufacturer} {dev.name}
                            </option>;
                        })}
                    </select>
                </label>
                <label>
                    Output
                    <select onChange={(ev) => setOutputDevice(midi.outputs.get(ev.target.value) ?? null)}>
                        {outputDeviceList.map(dev => {
                            return <option key={`${dev.id}`} value={dev.id}>
                                {dev.manufacturer} {dev.name}
                            </option>;
                        })}
                    </select>
                </label>
            </fieldset>
        </form>
        {outputDevice && <ClockGenerator output={outputDevice}/>}
        {outputDevice && <MidiSweeper output={outputDevice}/>}
        {outputDevice && <ButtonHitter output={outputDevice}/>}
        {(outputDevice && inputDevice) && <InfiniteScroll input={inputDevice} output={outputDevice}/>}
        <MIDILogger title="Input Log" input={inputDevice}/>
    </>;
}

const AFTERTOUCH = [0b1010_0000, 0b1101_0000];
const SENSING = 0b1111_1110;
const SYSEX = 0b1111_0000;

function MIDILogger(props: {title: string, input: MIDIInput | null}) {
    const [theLog, setLog] = useState<string[]>([]);

    const [aftertouch, setAfterTouch] = useState(false);
    const [sysEx, setSysEx] = useState(true);
    const [sensing, setSensing] = useState(true);

    function onMidiMessage(msg: MIDIMessageEvent) {
        if (msg.data) {
            const bytes = Array.from(msg.data);

            const command = bytes[0];
            if (!sensing && (command & SENSING) === SENSING) {
                return;
            }

            if (!sysEx && (command & SYSEX) === SYSEX) {
                return;
            }

            if (!aftertouch) {
                for (const byte of AFTERTOUCH) {
                    // Check only high nibble
                    if ((command & 0xF0) === byte) {
                        return;
                    }
                }
            }

            const newLogLine = bytes.map((x) => x.toString(16).padStart(2, '0')).join(' ') + ' => ' + translateMIDIBytesToHuman(msg.data);
            setLog((theLog) => [newLogLine, ...theLog]);
        } else {
            console.warn('Message with no data', msg);
        }
    }

    useEffect(() => {
        props.input?.addEventListener('midimessage', onMidiMessage);
        return () => {
            props.input?.removeEventListener('midimessage', onMidiMessage);
        }
    }, [props.input, aftertouch, sysEx, sensing]);

    return (
        <>
            {props.input === null && <p>No input device selected.</p>}
            {props.input !== null &&
            <>
                <form>
                    <fieldset className="grid">
                        <label>
                            <input onChange={() => setAfterTouch(!aftertouch)} checked={aftertouch} type="checkbox"/> Aftertouch?
                        </label>
                        <label>
                            <input onChange={() => setSysEx(!sysEx)} checked={sysEx} type="checkbox"/> SysEx?
                        </label>
                        <label>
                            <input onChange={() => setSensing(!sensing)} checked={sensing} type="checkbox"/> Sensing?
                        </label>
                    </fieldset>
                </form>
                <pre>
                    {theLog.join('\n')}
                </pre>
            </>
            }
        </>
    )
}

function useIsMidiEnabled() {
    const [enabled, setEnabled] = useState(false);
    const [midi, setMidi] = useState<MIDIAccess | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Wont be using sysex for now
    // const midiPermission = { name: "midi", sysex: false };
    const midiPermission = {name: "midi"};

    function startMidi() {
        // TODO: Investigate: If queried on mounting in dev mode, causes chrome to segfault
        // @ts-expect-error 2345
        navigator.permissions.query(midiPermission).then((result) => {
            if (result.state === "granted") {
                setEnabled(true);
            } else if (result.state === "prompt") {
                setError(`Accept permissions for MIDI access.`);
            } else if (result.state === 'denied') {
                setError(`Policy or user did not grant permission.`);
            }
        });

        navigator.requestMIDIAccess().then((midiAccess) => {
            setMidi(midiAccess);
        }, (err) => {
            setError(`Failed to get MIDI access - ${err}. Firefox fails silently if no MIDI devices are detected, make sure to connect it.`);
        });
    }

    return [
        enabled,
        startMidi,
        midi,
        error,
    ] as const;
}

function ClockGenerator(props: {output: MIDIOutput}) {
    const [bpm, setBpm] = useState(60);
    const [on, setOn] = useState(false);

    // Sent 24 times per quarter note when synchronization is required (see text).
    const intervalMs = 60 * 1000 / bpm / 24;

    // This is a bad clock, but works for experimenting. Might want to use precision clock, scheduling and worker
    useEffect(() => {
        const interval = setInterval(() => {
            if (on)
                props.output.send([0xF8]);
        }, intervalMs);

        return () => {
            clearInterval(interval);
        }
    }, [bpm, on]);

    return (
        <>
            Test Clock (imprecise) <button onClick={() => setOn(!on)}>Turn {on ? 'Off' : 'On'}</button>
            <pre>
                ON: {on ? 'true' : 'false'} BPM: {bpm} Interval: {intervalMs}ms
            </pre>
        </>
    );
}

function MidiSweeper(props: {output: MIDIOutput}) {
    const [sweeping, setSweeping] = useState(false);
    const [channel, setChannel] = useState(0);
    const [note, setNote] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            if (!sweeping) return;

            const commandByte = (0x90 + channel);
            const functionByte = note & 0x7F;
            const velocityByte = 0x7F;

            const toSend = [commandByte, functionByte, velocityByte];
            console.log(`Sending ${toSend.map(x => x.toString(16).padStart(2, '0')).join(' ')} ${translateMIDIBytesToHuman(Uint8Array.from(toSend))}`);

            props.output.send([commandByte, functionByte, velocityByte]);

            setNote(oldNote => oldNote + 1);
            if (note >= 127) {
                setChannel(oldChannel => oldChannel + 1)
                setNote(_ => 0);
            }
        }, 200);

        return () => {
            clearInterval(interval);
        };
    }, [sweeping, channel, note]);

    return (
        <>
            <p>
                Sweeping: {sweeping ? 'true' : 'false'} channel: {channel} note: {note}
            </p>
            <button onClick={() => setSweeping(!sweeping)}>Run/pause</button>
        </>
    )
}

function InfiniteScroll(props: {input: MIDIInput, output: MIDIOutput}) {
    const controlByte = 0xb0;
    const controlId = 0x03;
    const middleValue = 0x40;

    const [value, setValue] = useState(0);
    const [prevData, setPrevData] = useState(0);

    function onMidiMessage(msg: MIDIMessageEvent) {
        if (msg.data) {
            const bytes = msg.data;
            if (bytes[0] === controlByte && bytes[1] === controlId) {
                const data = bytes[2];

                const diff = data - prevData;
                setValue(value => value + diff);
                setPrevData(_ => data);

                // Reset the knob to middle when moved near boundaries
                if (data > 111) {
                    props.output.send([controlByte, controlId, middleValue]);
                    setPrevData(_ => middleValue);
                } else if (data < 10) {
                    props.output.send([controlByte, controlId, middleValue]);
                    setPrevData(_ => middleValue);
                }

            }
        }
    }

    useEffect(() => {
        props.input.addEventListener('midimessage', onMidiMessage);
        return () => {
            props.input.removeEventListener('midimessage', onMidiMessage);
        }
    }, [props.input, props.output, prevData]);

    return (<pre>
        Infinite scroll value: {value}
    </pre>)

}

function ButtonHitter(props: {output: MIDIOutput}) {
    function sendNoteOn() {
        props.output.send([0x90, 0x24, 0x7F]);
        // props.output.send([0xb0, 0x03, 0x01]);
    }

    function sendNoteOff() {
        props.output.send([0x80, 0x24, 0x7F]);
        // props.output.send([0xb0, 0x03, 0x50]);
    }

    return (
        <div>
            <button onClick={() => {sendNoteOn()}}>Send note on</button>
            <button onClick={() => {sendNoteOff()}}>Send note off</button>
        </div>
    );
}

// ------------------------------------

// Adapted from https://midi.org/expanded-midi-1-0-messages-list
const CONTROL_BYTES: Record<number, [string, string | null, string | null]> = {
    0x80: ['Chan 1 Note off', '!note', 'Velocity'],
    0x81: ['Chan 2 Note off', '!note', 'Velocity'],
    0x82: ['Chan 3 Note off', '!note', 'Velocity'],
    0x83: ['Chan 4 Note off', '!note', 'Velocity'],
    0x84: ['Chan 5 Note off', '!note', 'Velocity'],
    0x85: ['Chan 6 Note off', '!note', 'Velocity'],
    0x86: ['Chan 7 Note off', '!note', 'Velocity'],
    0x87: ['Chan 8 Note off', '!note', 'Velocity'],
    0x88: ['Chan 9 Note off', '!note', 'Velocity'],
    0x89: ['Chan 10 Note off', '!note', 'Velocity'],
    0x8A: ['Chan 11 Note off', '!note', 'Velocity'],
    0x8B: ['Chan 12 Note off', '!note', 'Velocity'],
    0x8C: ['Chan 13 Note off', '!note', 'Velocity'],
    0x8D: ['Chan 14 Note off', '!note', 'Velocity'],
    0x8E: ['Chan 15 Note off', '!note', 'Velocity'],
    0x8F: ['Chan 16 Note off', '!note', 'Velocity'],
    0x90: ['Chan 1 Note on', '!note', 'Velocity'],
    0x91: ['Chan 2 Note on', '!note', 'Velocity'],
    0x92: ['Chan 3 Note on', '!note', 'Velocity'],
    0x93: ['Chan 4 Note on', '!note', 'Velocity'],
    0x94: ['Chan 5 Note on', '!note', 'Velocity'],
    0x95: ['Chan 6 Note on', '!note', 'Velocity'],
    0x96: ['Chan 7 Note on', '!note', 'Velocity'],
    0x97: ['Chan 8 Note on', '!note', 'Velocity'],
    0x98: ['Chan 9 Note on', '!note', 'Velocity'],
    0x99: ['Chan 10 Note on', '!note', 'Velocity'],
    0x9A: ['Chan 11 Note on', '!note', 'Velocity'],
    0x9B: ['Chan 12 Note on', '!note', 'Velocity'],
    0x9C: ['Chan 13 Note on', '!note', 'Velocity'],
    0x9D: ['Chan 14 Note on', '!note', 'Velocity'],
    0x9E: ['Chan 15 Note on', '!note', 'Velocity'],
    0x9F: ['Chan 16 Note on', '!note', 'Velocity'],
    0xA0: ['Chan 1 Polyphonic Aftertouch', '!note', 'Pressure'],
    0xA1: ['Chan 2 Polyphonic Aftertouch', '!note', 'Pressure'],
    0xA2: ['Chan 3 Polyphonic Aftertouch', '!note', 'Pressure'],
    0xA3: ['Chan 4 Polyphonic Aftertouch', '!note', 'Pressure'],
    0xA4: ['Chan 5 Polyphonic Aftertouch', '!note', 'Pressure'],
    0xA5: ['Chan 6 Polyphonic Aftertouch', '!note', 'Pressure'],
    0xA6: ['Chan 7 Polyphonic Aftertouch', '!note', 'Pressure'],
    0xA7: ['Chan 8 Polyphonic Aftertouch', '!note', 'Pressure'],
    0xA8: ['Chan 9 Polyphonic Aftertouch', '!note', 'Pressure'],
    0xA9: ['Chan 10 Polyphonic Aftertouch', '!note', 'Pressure'],
    0xAA: ['Chan 11 Polyphonic Aftertouch', '!note', 'Pressure'],
    0xAB: ['Chan 12 Polyphonic Aftertouch', '!note', 'Pressure'],
    0xAC: ['Chan 13 Polyphonic Aftertouch', '!note', 'Pressure'],
    0xAD: ['Chan 14 Polyphonic Aftertouch', '!note', 'Pressure'],
    0xAE: ['Chan 15 Polyphonic Aftertouch', '!note', 'Pressure'],
    0xAF: ['Chan 16 Polyphonic Aftertouch', '!note', 'Pressure'],
    0xB0: ['Chan 1 Control/Mode Change', '!control', '!control'],
    0xB1: ['Chan 2 Control/Mode Change', '!control', '!control'],
    0xB2: ['Chan 3 Control/Mode Change', '!control', '!control'],
    0xB3: ['Chan 4 Control/Mode Change', '!control', '!control'],
    0xB4: ['Chan 5 Control/Mode Change', '!control', '!control'],
    0xB5: ['Chan 6 Control/Mode Change', '!control', '!control'],
    0xB6: ['Chan 7 Control/Mode Change', '!control', '!control'],
    0xB7: ['Chan 8 Control/Mode Change', '!control', '!control'],
    0xB8: ['Chan 9 Control/Mode Change', '!control', '!control'],
    0xB9: ['Chan 10 Control/Mode Change', '!control', '!control'],
    0xBA: ['Chan 11 Control/Mode Change', '!control', '!control'],
    0xBB: ['Chan 12 Control/Mode Change', '!control', '!control'],
    0xBC: ['Chan 13 Control/Mode Change', '!control', '!control'],
    0xBD: ['Chan 14 Control/Mode Change', '!control', '!control'],
    0xBE: ['Chan 15 Control/Mode Change', '!control', '!control'],
    0xBF: ['Chan 16 Control/Mode Change', '!control', '!control'],
    0xC0: ['Chan 1 Program Change', 'Program #', null],
    0xC1: ['Chan 2 Program Change', 'Program #', null],
    0xC2: ['Chan 3 Program Change', 'Program #', null],
    0xC3: ['Chan 4 Program Change', 'Program #', null],
    0xC4: ['Chan 5 Program Change', 'Program #', null],
    0xC5: ['Chan 6 Program Change', 'Program #', null],
    0xC6: ['Chan 7 Program Change', 'Program #', null],
    0xC7: ['Chan 8 Program Change', 'Program #', null],
    0xC8: ['Chan 9 Program Change', 'Program #', null],
    0xC9: ['Chan 10 Program Change', 'Program #', null],
    0xCA: ['Chan 11 Program Change', 'Program #', null],
    0xCB: ['Chan 12 Program Change', 'Program #', null],
    0xCC: ['Chan 13 Program Change', 'Program #', null],
    0xCD: ['Chan 14 Program Change', 'Program #', null],
    0xCE: ['Chan 15 Program Change', 'Program #', null],
    0xCF: ['Chan 16 Program Change', 'Program #', null],
    0xD0: ['Chan 1 Channel Aftertouch', 'Pressure', null],
    0xD1: ['Chan 2 Channel Aftertouch', 'Pressure', null],
    0xD2: ['Chan 3 Channel Aftertouch', 'Pressure', null],
    0xD3: ['Chan 4 Channel Aftertouch', 'Pressure', null],
    0xD4: ['Chan 5 Channel Aftertouch', 'Pressure', null],
    0xD5: ['Chan 6 Channel Aftertouch', 'Pressure', null],
    0xD6: ['Chan 7 Channel Aftertouch', 'Pressure', null],
    0xD7: ['Chan 8 Channel Aftertouch', 'Pressure', null],
    0xD8: ['Chan 9 Channel Aftertouch', 'Pressure', null],
    0xD9: ['Chan 10 Channel Aftertouch', 'Pressure', null],
    0xDA: ['Chan 11 Channel Aftertouch', 'Pressure', null],
    0xDB: ['Chan 12 Channel Aftertouch', 'Pressure', null],
    0xDC: ['Chan 13 Channel Aftertouch', 'Pressure', null],
    0xDD: ['Chan 14 Channel Aftertouch', 'Pressure', null],
    0xDE: ['Chan 15 Channel Aftertouch', 'Pressure', null],
    0xDF: ['Chan 16 Channel Aftertouch', 'Pressure', null],
    0xE0: ['Chan 1 Pitch Bend Change', 'LSB', 'MSB'],
    0xE1: ['Chan 2 Pitch Bend Change', 'LSB', 'MSB'],
    0xE2: ['Chan 3 Pitch Bend Change', 'LSB', 'MSB'],
    0xE3: ['Chan 4 Pitch Bend Change', 'LSB', 'MSB'],
    0xE4: ['Chan 5 Pitch Bend Change', 'LSB', 'MSB'],
    0xE5: ['Chan 6 Pitch Bend Change', 'LSB', 'MSB'],
    0xE6: ['Chan 7 Pitch Bend Change', 'LSB', 'MSB'],
    0xE7: ['Chan 8 Pitch Bend Change', 'LSB', 'MSB'],
    0xE8: ['Chan 9 Pitch Bend Change', 'LSB', 'MSB'],
    0xE9: ['Chan 10 Pitch Bend Change', 'LSB', 'MSB'],
    0xEA: ['Chan 11 Pitch Bend Change', 'LSB', 'MSB'],
    0xEB: ['Chan 12 Pitch Bend Change', 'LSB', 'MSB'],
    0xEC: ['Chan 13 Pitch Bend Change', 'LSB', 'MSB'],
    0xED: ['Chan 14 Pitch Bend Change', 'LSB', 'MSB'],
    0xEE: ['Chan 15 Pitch Bend Change', 'LSB', 'MSB'],
    0xEF: ['Chan 16 Pitch Bend Change', 'LSB', 'MSB'],
    0xF0: ['System Exclusive (SysEx)', '', ''],
    0xF1: ['MIDI Time Code Qtr. Frame', '-see spec-', '-see spec-'],
    0xF2: ['Song Position Pointer', 'LSB', 'MSB'],
    0xF3: ['Song Select (Song #)', 'Song No.', null],
    0xF4: ['Undefined (Reserved)', null, null],
    0xF5: ['Undefined (Reserved)', null, null],
    0xF6: ['Tune request', null, null],
    0xF7: ['End of SysEx (EOX)', null, null],
    0xF8: ['Timing clock', null, null],
    0xF9: ['Undefined (Reserved)', null, null],
    0xFA: ['Start', null, null],
    0xFB: ['Continue', null, null],
    0xFC: ['Stop', null, null],
    0xFD: ['Undefined (Reserved)', null, null],
    0xFE: ['Active Sensing', null, null],
    0xFF: ['System Reset', null, null],
};

function translateMIDIBytesToHuman(rawBytes: Uint8Array) {
    const bytes = Array.from(rawBytes);
    const controlByte = bytes[0];
    const functionByte = bytes[1] ?? null;
    const data1Byte = bytes[2] ?? null;
    const data2Byte = bytes[3] ?? null;

    let description = '';
    const info = CONTROL_BYTES[controlByte] ?? null;
    if (info === null) {
        return `Unknown control byte - ${controlByte.toString(16)}`;
    }

    description += info[0] + ' ->';
    if (info[1] !== null) {
        if (info[1] === '!note') {
            description += ` Note ${functionByte.toString(10)} (${MIDINoteToMusical(functionByte)})`
        } else if (info[1] === '!control') {
            description += ` No.${(functionByte ?? '').toString(10)} value ${(data1Byte ?? '').toString(10)}`;
        } else {
            description += ` ${info[1]} ${functionByte.toString(10)}`;
        }
    }

    if (info[2] !== null) {
        if (info[2] !== '!control') {
            description += ` ${info[2]} ${data1Byte.toString(10)}`;
        }
    }

    return description;
}

const MUSICAL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTES_IN_OCTAVE = MUSICAL_NOTES.length;

function MIDINoteToMusical(midiNote: number) {
    const octave = Math.floor(midiNote / NOTES_IN_OCTAVE) - 2;
    const note = midiNote % NOTES_IN_OCTAVE;
    return `${MUSICAL_NOTES[note]}${octave}`;
}

function MIDIControlFromTable(firstByte: number, secondByte: number) {
    // TODO: Parsing this is pain
    return '';
}
