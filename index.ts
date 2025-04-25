import {ChatOpenAI} from '@langchain/openai'
import {HumanMessage} from '@langchain/core/messages'
import {START, StateGraph} from '@langchain/langgraph'
import {AgentState, members} from './constants'
import {createChartGenNode} from './nodes/chartGen'
import {createSupervisorNode} from './nodes/supervisor'
import {createResearcherNode} from './nodes/researcher'

const llm = new ChatOpenAI({
  temperature: 0,
  modelName: 'gpt-4o',
  configuration: {
    baseURL: 'http://localhost:3001',
    apiKey: process.env.OPENAI_API_KEY,
  },
})

async function main() {
  const chartGenNode = createChartGenNode(llm)

  const researcherNode = createResearcherNode(llm)

  const supervisorNode = await createSupervisorNode(llm)

  const workflow = new StateGraph(AgentState)
    // 2. Add the nodes; these will do the work
    .addNode('researcher', researcherNode)
    .addNode('chart_generator', chartGenNode)
    .addNode('supervisor', supervisorNode)

  members.forEach((member) => {
    workflow.addEdge(member, 'supervisor')
  })

  workflow.addConditionalEdges(
    'supervisor',
    (x: typeof AgentState.State) => x.next
  )

  workflow.addEdge(START, 'supervisor')

  const graph = workflow.compile()

  let streamResults = graph.stream(
    {
      messages: [
        new HumanMessage({
          content: 'What were the 3 most popular tv shows in 2023?',
        }),
      ],
    },
    {recursionLimit: 100}
  )

  for await (const output of await streamResults) {
    if (!output?.__end__) {
      console.log(output)
      console.log('----')
    }
  }
}

main()
