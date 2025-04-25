import {DynamicStructuredTool} from '@langchain/core/tools'
import {RunnableConfig} from '@langchain/core/runnables'
import {ChatOpenAI} from '@langchain/openai'
import {HumanMessage, SystemMessage} from '@langchain/core/messages'

import * as d3 from 'd3'
import {createCanvas} from 'canvas'
import {z} from 'zod'
import {writeFileSync} from 'fs'
import {createReactAgent} from '@langchain/langgraph/prebuilt'
import {AgentState} from '../constants'

const chartTool = new DynamicStructuredTool({
  name: 'generate_bar_chart',
  description:
    'Generates a bar chart from an array of data points using D3.js and displays it for the user.',
  schema: z.object({
    data: z
      .object({
        label: z.string(),
        value: z.number(),
      })
      .array(),
  }),
  func: async ({data}) => {
    const width = 500
    const height = 500
    const margin = {top: 20, right: 30, bottom: 30, left: 40}

    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')

    const x = d3
      .scaleBand()
      .domain(data.map((d) => d.label))
      .range([margin.left, width - margin.right])
      .padding(0.1)

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.value) ?? 0])
      .nice()
      .range([height - margin.bottom, margin.top])

    const colorPalette = [
      '#e6194B',
      '#3cb44b',
      '#ffe119',
      '#4363d8',
      '#f58231',
      '#911eb4',
      '#42d4f4',
      '#f032e6',
      '#bfef45',
      '#fabebe',
    ]

    data.forEach((d, idx) => {
      ctx.fillStyle = colorPalette[idx % colorPalette.length]
      ctx.fillRect(
        x(d.label) ?? 0,
        y(d.value),
        x.bandwidth(),
        height - margin.bottom - y(d.value)
      )
    })

    ctx.beginPath()
    ctx.strokeStyle = 'black'
    ctx.moveTo(margin.left, height - margin.bottom)
    ctx.lineTo(width - margin.right, height - margin.bottom)
    ctx.stroke()

    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    x.domain().forEach((d) => {
      const xCoord = (x(d) ?? 0) + x.bandwidth() / 2
      ctx.fillText(d, xCoord, height - margin.bottom + 6)
    })

    ctx.beginPath()
    ctx.moveTo(margin.left, height - margin.top)
    ctx.lineTo(margin.left, height - margin.bottom)
    ctx.stroke()

    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    const ticks = y.ticks()
    ticks.forEach((d) => {
      const yCoord = y(d) // height - margin.bottom - y(d);
      ctx.moveTo(margin.left, yCoord)
      ctx.lineTo(margin.left - 6, yCoord)
      ctx.stroke()
      ctx.fillText(d.toString(), margin.left - 8, yCoord)
    })
    const filePath = './chart.png'
    writeFileSync(filePath, new Uint8Array(canvas.toBuffer()))
    return 'Chart has been generated and displayed to the user!'
  },
})

const createChartGenAgent = (llm: ChatOpenAI) => {
  const chartGenAgent = createReactAgent({
    llm,
    tools: [chartTool],
    stateModifier: new SystemMessage(
      "You excel at generating bar charts. Use the researcher's information to generate the charts."
    ),
  })
  return chartGenAgent
}

export function createChartGenNode(llm: ChatOpenAI) {
  const chartGenAgent = createChartGenAgent(llm)
  return async (state: typeof AgentState.State, config?: RunnableConfig) => {
    const result = await chartGenAgent.invoke(state, config)
    const lastMessage = result.messages[result.messages.length - 1]
    return {
      messages: [
        new HumanMessage({
          content: lastMessage.content,
          name: 'ChartGenerator',
        }),
      ],
    }
  }
}
