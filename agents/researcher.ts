import {ChatOpenAI} from '@langchain/openai'
import {
  TaskContext,
  A2AServer,
  InMemoryTaskStore,
  TaskYieldUpdate,
  schema,
} from '../a2a/server' // Import server components
import {createReactAgent} from '@langchain/langgraph/prebuilt'
import {BaseMessage, SystemMessage} from '@langchain/core/messages'
import {TavilySearchResults} from '@langchain/community/tools/tavily_search'

const llm = new ChatOpenAI({
  temperature: 0,
  modelName: 'gpt-4o',
  configuration: {
    baseURL: 'http://localhost:3001',
    apiKey: process.env.OPENAI_API_KEY,
  },
})

const tavilyTool = new TavilySearchResults()

async function* researcherAgent({
  task,
  history, // Extract history from context
}: TaskContext): AsyncGenerator<TaskYieldUpdate, schema.Task | void, unknown> {
  const agent = createReactAgent({
    llm,
    tools: [tavilyTool],
    stateModifier: new SystemMessage(
      'You are a web researcher. You may use the Tavily search engine to search the web for important information'
    ),
  })

  const messages: BaseMessage[] = (history ?? [])
    .map((m) => ({
      role: m.role === 'agent' ? 'assistant' : 'user',
      content: m.parts
        .filter((p): p is schema.TextPart => !!(p as schema.TextPart).text)
        .map((p) => ({text: p.text})),
    }))
    .filter((m) => m.content.length > 0)

  if (messages.length === 0) {
    console.warn(
      `[ResearchAgent] No history/messages found for task ${task.id}`
    )
    yield {
      state: 'failed',
      message: {
        role: 'agent',
        parts: [{text: 'No input message found.', type: 'text'}],
      },
    }
    return
  }

  yield {
    state: 'working',
    message: {
      role: 'agent',
      parts: [{type: 'text', text: 'Researching...'}],
    },
  }

  const result = await agent.invoke({messages})
  const lastMessage = result.messages[result.messages.length - 1]
  yield {
    state: 'completed',
    message: {
      role: 'agent',
      parts: [{type: 'text', text: lastMessage.content as string}],
    },
  }
}

const researcherAgentCard: schema.AgentCard = {
  name: 'Research Agent',
  description:
    'An agent that can use the Tavily search engine to search the web for important information.',
  url: 'http://localhost:41241', // Default port used in the script
  provider: {
    organization: 'A2A Samples',
  },
  version: '0.0.1',
  capabilities: {
    // Although it yields multiple updates, it doesn't seem to implement full A2A streaming via TaskYieldUpdate artifacts
    // It uses Genkit streaming internally, but the A2A interface yields start/end messages.
    // State history seems reasonable as it processes history.
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  authentication: null,
  defaultInputModes: ['text'],
  defaultOutputModes: ['text'],
  skills: [
    {
      id: 'search_info',
      name: 'Search Information',
      description:
        'Use the Tavily search engine to search the web for important information.',
      tags: ['search', 'information', 'web'],
      examples: [
        'Find the most popular TV shows in 2023',
        'Search for the latest AI technology trends',
        'Find recent research on climate change',
        'Search for 2024 tech industry predictions',
        'Find the latest developments in quantum computing',
      ],
    },
    // The specific tools are used internally by the Genkit agent,
    // but from the A2A perspective, it exposes one general chat skill.
  ],
}

// Create server with the task handler. Defaults to InMemoryTaskStore.
const server = new A2AServer(researcherAgent, {card: researcherAgentCard})

// Start the server
server.start() // Defaults to port 41241

console.log('[MovieAgent] Server started on http://localhost:41241')
console.log('[MovieAgent] Press Ctrl+C to stop the server')
