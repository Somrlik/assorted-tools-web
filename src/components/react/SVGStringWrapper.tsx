import { useEffect, useRef, type SVGProps } from "react"

type Props = {
    svg: string;
} & SVGProps<SVGSVGElement>;


export function SVGStringWrapper(props: Props) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        svgRef.current!.innerHTML = props.svg;
    }, []);

    return (<svg {...props} ref={svgRef}/>)
}
