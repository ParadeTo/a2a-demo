import {ChatPromptTemplate, MessagesPlaceholder} from '@langchain/core/prompts'
import {ChatOpenAI} from '@langchain/openai'
import {END} from '@langchain/langgraph'
import {z} from 'zod'
import {members} from '../constants'

const systemPrompt =
  'You are a supervisor tasked with managing a conversation between the' +
  ' following workers: {members}. Given the following user request,' +
  ' respond with the worker to act next. Each worker will perform a' +
  ' task and respond with their results and status. When finished,' +
  ' respond with FINISH.'

const options = [END, ...members]

// Define the routing function
const routingTool = {
  name: 'route',
  description: 'Select the next role.',
  schema: z.object({
    next: z.enum([END, ...members]),
  }),
}

const prompt = ChatPromptTemplate.fromMessages([
  ['system', systemPrompt],
  new MessagesPlaceholder('messages'),
  [
    'human',
    'Given the conversation above, who should act next?' +
      ' Or should we FINISH? Select one of: {options}',
  ],
])

export async function createSupervisorNode(llm: ChatOpenAI) {
  const formattedPrompt = await prompt.partial({
    options: options.join(', '),
    members: members.join(', '),
  })
  return (
    formattedPrompt
      .pipe(
        llm.bindTools([routingTool], {
          tool_choice: 'route',
        })
      )
      // select the first one
      .pipe((x) => x?.tool_calls?.[0].args)
  )
}
