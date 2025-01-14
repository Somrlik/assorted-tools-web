type WorkerMessageMap = {
    'WORKER_FILE_GOOD': {

    },
    'WORKER_FILE_BAD': {

    },
    'WORKER_UNKNOWN_ERROR': {

    },
};

type WorkerMessage<MsgName extends keyof WorkerMessageMap = keyof WorkerMessageMap> = {
    name: MsgName;
    data: WorkerMessageMap[MsgName];
}

type ViewMessageMap = {
    'VIEW_TRANSFER_FILE': {
        file: File,
    },
}

type ViewMessage<MsgName extends keyof ViewMessageMap = keyof ViewMessageMap> = {
    name: MsgName;
    data: ViewMessageMap[MsgName];
}
