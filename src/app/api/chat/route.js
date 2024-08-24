import { NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { GoogleGenerativeAI } from '@google/generative-ai'

console.log('Environment Variables Check:');
console.log('PINECONE_API_KEY exists:', !!process.env.PINECONE_API_KEY);
console.log('PINECONE_ENVIRONMENT exists:', !!process.env.PINECONE_ENVIRONMENT);
console.log('GOOGLE_API_KEY exists:', !!process.env.GOOGLE_API_KEY);

// if (process.env.PINECONE_API_KEY) {
//     console.log('PINECONE_API_KEY (first 5 chars):', process.env.PINECONE_API_KEY.substring(0, 5));
// }
// if (process.env.PINECONE_ENVIRONMENT) {
//     console.log('PINECONE_ENVIRONMENT:', process.env.PINECONE_ENVIRONMENT);
// }
// if (process.env.GOOGLE_API_KEY) {
//     console.log('GOOGLE_API_KEY (first 5 chars):', process.env.GOOGLE_API_KEY.substring(0, 5));
// }

const systemPrompt = `
You are a rate my professor agent to help students find classes, that takes in user questions and answers them.
For every user question, the top 3 professors that match the user question are returned.
Use them to answer the question if needed.
`

export async function POST(req) {
    try {
        console.log('Starting POST request')
        const data = await req.json()
        
        if (!process.env.PINECONE_API_KEY || !process.env.GOOGLE_API_KEY) {
            throw new Error('Missing required API keys')
        }

        console.log('Initializing Pinecone')
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
        })

        console.log('Getting Pinecone index')
        const index = pinecone.index("rag")

        console.log('Initializing Google AI')
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
        const embedModel = genAI.getGenerativeModel({ model: "embedding-001" })
        const chatModel = genAI.getGenerativeModel({ model: "gemini-pro" })

        const text = data[data.length - 1].content
        console.log('Processing text:', text)

        console.log('Generating embedding')
        const embedResult = await embedModel.embedContent(text)
        const embedding = embedResult.embedding
        if (!embedding) {
            throw new Error('Failed to generate embedding')
        }
        console.log('Embedding generated, length:', embedding.length)

        console.log('Querying Pinecone')

        console.log('Embedding type:', typeof embedding)
        console.log('Embedding length:', embedding.length)
        // console.log('First few elements of embedding:', embedding.slice(0, 5))

        const queryResponse = await index.query({
            vector: embedding,
            topK: 5,
            includeMetadata: true
        })
        
        console.log('Pinecone query results:', JSON.stringify(queryResponse))

        console.log('Query response type:', typeof queryResponse)
        console.log('Query response keys:', Object.keys(queryResponse))

        let resultString = ''
        if (queryResponse.matches && queryResponse.matches.length > 0) {
            queryResponse.matches.forEach((match) => {
                resultString += `
                Returned Results:
                Professor: ${match.id}
                Review: ${match.metadata?.review || 'N/A'}
                Subject: ${match.metadata?.subject || 'N/A'}
                Stars: ${match.metadata?.stars || 'N/A'}
                \n\n`
            })
        } else {
            resultString = 'No relevant professor information found.'
        }

        const lastMessage = data[data.length - 1]
        const lastMessageContent = lastMessage.content + resultString
        const lastDataWithoutLastMessage = data.slice(0, data.length - 1)

        console.log('Starting chat')
        const chat = chatModel.startChat({
            history: [
                { role: "user", parts: systemPrompt },
                ...lastDataWithoutLastMessage.map(msg => ({ role: msg.role, parts: msg.content })),
            ],
        })

        console.log('Sending message stream')
        const result = await chat.sendMessageStream(lastMessageContent)

        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder()
                try {
                    for await (const chunk of result.stream) {
                        const text = encoder.encode(chunk.text())
                        controller.enqueue(text)
                    }
                } catch (err) {
                    console.error('Streaming error:', err)
                    controller.error(err)
                } finally {
                    controller.close()
                }
            },
        })
        console.log('Returning stream response')
        return new NextResponse(stream)
    } catch (error) {
        console.error('Error in POST request:', error)
        return new NextResponse(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}