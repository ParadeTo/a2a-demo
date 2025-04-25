import {RunnableConfig} from '@langchain/core/runnables'
import {ChatOpenAI} from '@langchain/openai'
import {HumanMessage, SystemMessage} from '@langchain/core/messages'
import {TavilySearchResults} from '@langchain/community/tools/tavily_search'
import {createReactAgent} from '@langchain/langgraph/prebuilt'
import {AgentState} from '../constants'

const tavilyTool = new TavilySearchResults()

const createResearcherAgent = (llm: ChatOpenAI) =>
  createReactAgent({
    llm,
    tools: [tavilyTool],
    stateModifier: new SystemMessage(
      'You are a web researcher. You may use the Tavily search engine to search the web for' +
        ' important information, so the Chart Generator in your team can make useful plots.'
    ),
  })

export function createResearcherNode(llm: ChatOpenAI) {
  const researcherAgent = createResearcherAgent(llm)
  return async (state: typeof AgentState.State, config?: RunnableConfig) => {
    const result = await researcherAgent.invoke(state, config)
    const lastMessage = result.messages[result.messages.length - 1]
    return {
      messages: [
        new HumanMessage({content: lastMessage.content, name: 'Researcher'}),
      ],
    }
  }
}
