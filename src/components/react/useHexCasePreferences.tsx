import { useEffect, useState } from "react";

const HEX_CASE_UPPER_LOCALSTORAGE_KEY = 'assorted_tools_hex_uppercase';

export function useHexCasePreferences() {
    const [isHexUppercase, setHexUppercase] = useState(false);

    useEffect(() => {
        const shouldBeUpper = !!window.localStorage.getItem(HEX_CASE_UPPER_LOCALSTORAGE_KEY);
        setHexUppercase(shouldBeUpper);
    }, []);

    function toggleUppercase() {
        if (isHexUppercase) {
            window.localStorage.removeItem(HEX_CASE_UPPER_LOCALSTORAGE_KEY);
        } else {
            window.localStorage.setItem(HEX_CASE_UPPER_LOCALSTORAGE_KEY, 'something not falsy');
        }

        setHexUppercase(!isHexUppercase);
    }

    const toggleButton = (
        <button onClick={() => toggleUppercase()}>
            Switch from <code>{isHexUppercase ? 'HEX' : 'hex'}</code> to <code>{isHexUppercase ? 'hex' : 'HEX'}</code>
        </button>
    );

    return [
        isHexUppercase,
        toggleUppercase,
        toggleButton,
    ] as const;
}
