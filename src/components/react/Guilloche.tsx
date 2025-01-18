import { useEffect, useMemo, useRef, useState } from "react";
import { CopyToClipboardButton } from "./CopyToClipboardButton.tsx";
import { downloadString } from "./downloadString.ts";

type Options = {
    wheels: WheelOptions[],
    shape: 'circle' | 'rectangle',
    rectAspectRatio?:  number | 'a4',
    samples: number,
    dashed: boolean,
    lineColor: string,
    lineWidth: number,
};

type WheelOptions = {
    scale: number,
    phaseDeg: number,
    rate: number,
}

function deg2rad(deg: number): number {
    return deg * Math.PI / 180;
}

function runSim({wheels, shape, rectAspectRatio, samples, dashed}: Options) {
    if (shape === 'rectangle') {
        throw new Error(`Not implemented (yet)`);
    }
    const mainRadius = 1;

    // Compute the scale of the whole guilloche by summing all wheel scales
    const radiusSum = wheels.reduce((acc, wheel) => acc += (wheel.scale) * mainRadius, 0) + mainRadius;
    const scale = mainRadius / radiusSum;
    const step = 2 * Math.PI / samples;
    let temp: number;
    const points: [x: number, y: number][] = [];

    for (let sample = 0; sample < samples; ++sample) {
        const a = sample * step;
        let x = 0, y = 0;

        for (const {scale, phaseDeg, rate} of wheels) {
            temp = a * rate + deg2rad(phaseDeg);
            x += scale * Math.sin(temp);
            y += scale * Math.cos(temp);
        }

        points.push([x * scale, y * scale]);
    }

    return {points, scale};
}

function makeSvg(options: Options) {
    const points = runSim(options);
    // 1024 might yield better results due to scaling
    const
        width = 1024,
        height = 1024,
        hCenter = -(width / 2),
        vCenter = -(height / 2),
        hScale = width / 2,
        vScale = height / 2;

    let svgContents = '';
    if (options.dashed) {
        while (points.points.length !== 0) {
            const a = points.points.pop();
            const b = points.points.pop();

            if (a === undefined || b === undefined) {
                break;
            }
            // <line x1="0" y1="80" x2="100" y2="20" stroke="black" />
            svgContents += `<line x1="${a[0] * hScale}" y1="${a[1] * vScale}" x2="${b[0] * hScale}" y2="${b[1] * vScale}" stroke="${options.lineColor}" stroke-width="${options.lineWidth}" />\n`;
        }
    } else {
        const style = {
            'fill': 'none',
            'stroke': options.lineColor,
            'stroke-width': options.lineWidth,
        };
        const styleStr = Object.entries(style).map(([property, value]) => `${property}:${value}`).join(';');

        const pointsStr = points.points.map(p => `${p[0] * hScale}, ${p[1] * vScale} `);
        svgContents = `<polygon points="${pointsStr}" style="${styleStr}"/>`;
    }

    return `
        <svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${width}" height="${height}" viewBox="${hCenter},${vCenter},${width},${height}">
            <!-- Generated with somrlik/assorted-tools-web -->
            ${svgContents}
        </svg>
    `.trim();
}

const defaultOptions: Options = {
    wheels: [
        {phaseDeg: 50, rate: 74, scale: 6},
        {phaseDeg: 0, rate: 10, scale: 3},
        {phaseDeg: 130, rate: 11, scale: 14},
    ],
    samples: 2000,
    shape: 'circle',
    dashed: false,
    lineColor: '#0172ad',
    lineWidth: 1,
}

function OptionsControl({onOptionsChange, defaultOptions}: {onOptionsChange: (options: Options) => void, defaultOptions: Options}) {
    const [samples, setSamples] = useState(defaultOptions.samples);
    const [wheels, setWheels] = useState(defaultOptions.wheels);
    const [lineColor, setLineColor] = useState(defaultOptions.lineColor);
    const [dashed, setDashed] = useState(defaultOptions.dashed);
    const [lineWidth, setLineWidth] = useState(defaultOptions.lineWidth);

    useEffect(() => {
        onOptionsChange({samples, wheels, lineColor, shape: 'circle', dashed, lineWidth});
    }, [samples, wheels, lineColor, dashed, lineWidth]);

    function onWheelChange(idx: number, wheel: WheelOptions) {
        setWheels((prev) => {
            return prev.map((prevWheel, current) => {
                return idx !== current ? prevWheel : {...prevWheel, ...wheel};
            });
        });
    }

    function addWheel() {
        setWheels([...wheels, {phaseDeg: 30, rate: 15, scale: 5}]);
    }

    function removeWheel() {
        setWheels(wheels.slice(0, -1));
    }

    return (<form>
        <fieldset>
            <label>
                Samples ({samples})
                <input type="range" min="1" max="20000" value={samples} onChange={(ev) => setSamples(parseInt(ev.target.value))}/>
            </label>
            <label>
                <input type="checkbox" checked={dashed} onChange={() => setDashed(!dashed)}/>
                Dashed?
            </label>
            <label>
                Line color (
                <span style={{backgroundColor: lineColor, border: '1px solid rebeccapurple', width: '1em', height: '1em', display: 'inline-block'}}></span>)
            </label>
            <label>
                Line width ({lineWidth})
                <input type="range" min="1" max="10" value={lineWidth} onChange={(ev) => setLineWidth(parseInt(ev.target.value))}/>
            </label>
            <input type="color" value={lineColor} onChange={(ev) => setLineColor(ev.target.value)}/>
        </fieldset>
        {wheels.map((wheel, idx) => {
            return <WheelControl key={idx} defaultOptions={wheel} onWheelChange={(v) => onWheelChange(idx, v)} />
        })}
        <button onClick={(e) => {e.preventDefault(), addWheel();}}>Add new wheel</button>
        <button onClick={(e) => {e.preventDefault(), removeWheel();}}>Remove last wheel</button>
    </form>);
}

function WheelControl({onWheelChange, defaultOptions}: {onWheelChange: (v: WheelOptions) => void, defaultOptions: WheelOptions}) {
    const [phaseDeg, setPhaseDeg] = useState(defaultOptions.phaseDeg);
    const [rate, setRate] = useState(defaultOptions.rate);
    const [scale, setScale] = useState(defaultOptions.scale);

    useEffect(() => {
        onWheelChange({phaseDeg, rate, scale});
    }, [phaseDeg, rate, scale]);

    return (
        <article>
            <header>
                Wheel
            </header>
            <main>
                <label>
                    Phase ({phaseDeg}°)
                    <input type="range" step="1" min="0" max="360" onChange={(ev) => {setPhaseDeg(parseInt(ev.target.value))}} value={phaseDeg}/>
                </label>
                <label>
                    Rotation rate ({rate}x main wheel)
                    <input type="range" step="1" min="0" max="100" onChange={(ev) => {setRate(parseInt(ev.target.value))}} value={rate}/>
                </label>
                <label>
                    Scale ({scale}x main wheel)
                    <input type="range" step="1" min="-10" max="100" onChange={(ev) => {setScale(parseInt(ev.target.value))}} value={scale}/>
                </label>
            </main>
        </article>
    );
}

export function GuillocheDashboard() {
    const [options, setOptions] = useState(defaultOptions);

    function onOptionsChange(opts: Options) {
        setOptions({...options, ...opts});
    }

    const renderedSvg = useMemo(() => {
        return makeSvg(options);
    }, [options]);

    const markup = {
        __html: renderedSvg,
    }

    function downloadSVG(): void {
        downloadString(renderedSvg, 'guilloche.svg', 'image/svg+xml');
    }

    function showSVG(): void {
        showSVGDialog.current?.showModal();
    }

    function hideSVG(): void {
        showSVGDialog.current?.close();
    }

    const showSVGDialog = useRef<HTMLDialogElement>(null);

    return (<main className="container-fluid grid">
        <section>
            <OptionsControl defaultOptions={defaultOptions} onOptionsChange={onOptionsChange}/>
        </section>
        <section>
            <h2>Preview</h2>
            <div dangerouslySetInnerHTML={markup}></div>
            <button onClick={(e) => downloadSVG()}>Download <code>SVG</code></button>
            <button onClick={(e) => showSVG()}>Show <code>SVG</code></button>
        </section>
        <dialog ref={showSVGDialog}>
            <article>
                <header>SVG Output</header>
                <main>
                    <textarea readOnly value={renderedSvg} cols={20}></textarea>
                </main>
                <footer>
                    <CopyToClipboardButton data={renderedSvg}/>
                    <button onClick={() => hideSVG()}>Close</button>
                </footer>
            </article>
        </dialog>
    </main>);
}
