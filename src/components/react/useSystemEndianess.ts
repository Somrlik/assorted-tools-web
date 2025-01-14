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

export function useSystemEndianess(): [Endianess] {
    return [findEndianess()];
}
