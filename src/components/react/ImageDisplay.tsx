import { useEffect, useRef, useState } from "react";

const MAX_PREVIEW_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const PNG_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==';
const PNG_NO_PREVIEW_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAADqElEQVR4Xu2aW8hNQRTHf5/7tSjxgqJEiBIPcovI7UkSJcmDRBIiKdcoUkRJkgeKEB5IeaAoyT0PyOVRvAgl97v+Nbv2N+19zmxn73P27LPn7fvOmtlr/ee/1qy1Zlpo8tHS5PZTAlAyoMkRKF2gyQlQBsE4F1gAbAaGAG08Z8lf4DmwHTht2xIFwPwoQc9BCNTXxp4J2xIFwGNgWEEMts14AgyvBsAvoG1BAfhj2xbFAPlMeOwEdgA/PAOlo/H7DZberWx2AUAL+WZ8YHNP4H2tAPicLHUDPpYAtEYgsQvkhQGdgBXAwtAppah+AjgEfI+IUV2BT0VgQD/gcoXjWUf3TOCVZWwhANDO33fITQTCaIsJXYDPvjNgLbDX8QheA+wPyRYCgAfAKEcAxJQxRQPgG6BcxGV8BbTrwegMfPHdBZoegFpcoBAMUGDb58J/YDVwICSrE0RuER4NSYRUXaoSswstF7vk/wpurcrYiImPTAAMJ0QNB0AKKEtT9qaCSrujTlNSIPqaRCgOBBk/KyIRajgApwB1YcJDZ/o6l623ZMSE5TGp8OGYVFhzFEQb4gKbTB8hytaNwO7/ACHplIYBMAc4DxW7zkuBo0ktSijfIYIZmQfBkcBNQIVIpfEbUANWQGU16g5AH+Au0N/RIgXG2cDVKvLtze8/HdcNxOoKgPztGjA2oZKq16cA92LmrQR2GXfSOZ/EbQSc3c7LzAWOAYsTGh+IvwPGA89C89sBB4Flof/p+FwEnHT8Tt0AWA/scVQqTuw1MANQXd/bdHqmRQirba8ge8nhe3UBQD58MaUrNAXGp8BAq6qzbVV6Ox24UQUEsciOG6m6gG6QbgHdHXYjbZEPwGTgYYWFMwWgl4n4A9K2LMF6b4AJwIuYOapB5DLhkQoD5FtXgEkJlM1K9CUwLqIO0PcyA+AIoEwuL0NxYyLw1lIoEwBWWTV3XkBQyax8InwTpLcNCqypuYCOJfXn83p7fN3cDwQVYKoADAZuAz3ysuUxelwA5pqdTw0A3bLeAQbl3PhAvePAEvOHOlE1uYAivmg/1RPjAzXVfVI/sWYAlI+rIPFxbDWPJGpigI+GV9I5cSJUAlAwBEoGxAYE80PSnr1vBCkZUI0Byp19fx8cx0qnh5J6eDTUN1476qsrtBHVGFDkx9LzgHPVANDvus/bAqgA8t0dRHt1m7cBZ22m5OUNoCOD0xcrAUgfU79WLBng136lr23JgPQx9WvFpmfAPz+5xEGs8PNSAAAAAElFTkSuQmCC';

type DataURLBuffer = string | ArrayBuffer | null;

type Props = {
    file: File;
}

function readFileAsDataURL(file: File): Promise<DataURLBuffer> {
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
        try {
            if (file.size > MAX_PREVIEW_FILE_SIZE) {
                reject(new Error('File too large'));
            }

            reader.addEventListener('load', () => {
                resolve(reader.result);
            }, false);

            if (file) {
                reader.readAsDataURL(file);
            }
        } catch(e) {
            reject(e);
        }
    });
}

// When image is loading for more than 1.5 seconds, cancel the loading
const IMAGE_LOADING_TIMEOUT = 1500;

export function ImageDisplay({file}: Props) {
    const [src, setSrc] = useState<string>(PNG_PIXEL);
    const imgElementRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        readFileAsDataURL(file).then((dataUrl) => {
            if (dataUrl instanceof ArrayBuffer) {
                setSrc(() => ArrayBuffer.toString());
            } else {
                setSrc(dataUrl ?? PNG_PIXEL);
            }
        }).catch(() => {
            setSrc(PNG_PIXEL);
        });
    });

    async function processDataUrl(dataUrl: DataURLBuffer): Promise<void> {
        if (dataUrl === null) {
            // This happens when file is deleted from filesystem when read
            return;
        }

        if (dataUrl instanceof ArrayBuffer) {
            setSrc(() => ArrayBuffer.toString());
        } else {
            setSrc(() => dataUrl);
        }

        if (imgElementRef.current?.src === window.location.href) {
            // Safari hack, as above
            return;
        }

        await new Promise<void>(resolve => {
            const loadingTimeoutHandle = setTimeout(() => {
                setSrc(() => PNG_NO_PREVIEW_IMAGE);
                resolve();
            }, IMAGE_LOADING_TIMEOUT);

            if (imgElementRef.current?.complete) {
                resolve();
            } else {
                imgElementRef.current?.addEventListener('load', () => {
                    clearTimeout(loadingTimeoutHandle);
                    resolve();
                }, {
                    'once': true,
                });
            }

        });
    }

    return (<img alt="Displayed image" src={src} ref={imgElementRef}/>);
}