declare global {
    interface Window {
        assortedToolsWeb?: {
            hexAnalyzerWorker?: Worker,
            midiTesterWorker?: Worker,
        }
    }
}

export {}
