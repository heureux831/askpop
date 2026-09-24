export const IPC = {
  channels: {
    clipboardRead: 'clipboard:read',
    clipboardWrite: 'clipboard:write',
    providerSave: 'provider:save',
    providerDelete: 'provider:delete',
    tasksSave: 'tasks:save',
    modelSave: 'model:save',
    modelDelete: 'model:delete',
    assistantSave: 'assistant:save',
    assistantDelete: 'assistant:delete',
    assistantSelect: 'assistant:select',
    configGet: 'config:get',
    configSet: 'config:set',
    configSetKey: 'config:setKey',
    chatStream: 'chat:stream',
    chatAbort: 'chat:abort',
    quickDragStart: 'quick:dragStart',
    quickDragEnd: 'quick:dragEnd',
    quickDragMove: 'quick:dragMove',
    quickHide: 'quick:hide',
    quickSetPin: 'quick:setPin',
    settingsOpen: 'settings:open'
  },
  events: {
    configChanged: 'config:changed',
    chatReasoning: 'chat:reasoning',
    chatChunk: 'chat:chunk',
    chatDone: 'chat:done',
    chatError: 'chat:error',
    quickShown: 'quick:shown'
  }
} as const
