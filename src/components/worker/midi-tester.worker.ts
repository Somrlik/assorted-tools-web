onmessage = (ev) => {
    console.log(ev);
    postMessage('hello world from worker');
}
