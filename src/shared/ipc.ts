export const IPC = {
  channels: {
    configGet: 'config:get',
    configSet: 'config:set',
    configSetKey: 'config:setKey',
    chatStream: 'chat:stream',
    chatAbort: 'chat:abort',
    quickHide: 'quick:hide',
    quickSetPin: 'quick:setPin'
  },
  events: {
    chatChunk: 'chat:chunk',
    chatDone: 'chat:done',
    chatError: 'chat:error',
    quickShown: 'quick:shown'
  }
} as const
