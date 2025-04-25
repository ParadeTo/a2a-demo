import {BaseMessage} from '@langchain/core/messages'
import {Annotation, END} from '@langchain/langgraph'

// Supevisor
export const members = ['researcher', 'chart_generator'] as const

export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  // The agent node that last performed work
  next: Annotation<string>({
    reducer: (x, y) => y ?? x ?? END,
    default: () => END,
  }),
})
