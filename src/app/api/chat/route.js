import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, EmbeddingModel } from '@google/generative-ai';

console.log('Initializing Supabase client...');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Initializing Google AI client...');
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
const generativeModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function generateEmbedding(text) {
    console.log('Generating embedding for:', text);
    try {
      const result = await embeddingModel.embedContent(text);
      console.log('Embedding generated successfully');
      return result.embedding.values; // Return the actual embedding values
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }
  
    function extractKeywords(query) {
    // List of common words to ignore
    const stopWords = new Set([
      'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves'
    ]);
  
    // Split the query into words, convert to lowercase, and remove stop words
    const words = query.toLowerCase().split(/\W+/).filter(word => !stopWords.has(word) && word.length > 1);
  
    // Join the words back together
    return words.join(' ');
  }
  
  async function searchSimilarProfessors(query, limit = 5) {
    console.log('Original query:', query);
    const extractedKeywords = extractKeywords(query);
    console.log('Extracted keywords:', extractedKeywords);
  
    const embedding = await generateEmbedding(extractedKeywords);
  
    console.log('Generated embedding:', embedding.slice(0, 5) + '...'); // Log only first 5 values
  
    // Use improved Postgres similarity search
    console.log('Calling match_professors with parameters:', {
      query_text: extractedKeywords,
      query_embedding: embedding.slice(0, 5) + '...',
      match_threshold: 0.78,
      match_count: limit
    });
  
    const { data, error } = await supabase
      .rpc('match_professors', {
        query_text: extractedKeywords,
        query_embedding: embedding,
        match_threshold: 0.78,
        match_count: limit
      });
  
    if (error) {
      console.error('Error in searchSimilarProfessors:', error);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      return [];
    }
  
    console.log('Similar professors found:', data ? data.length : 0);
    if (data && data.length > 0) {
      console.log('First professor data:', JSON.stringify(data[0], null, 2));
    } else {
      console.log('No professors found');
    }
    return data || [];
  }

async function insertReview(review) {
  console.log('Inserting review:', review);
  const embeddingText = `${review.professor} ${review.university} ${review.subject} ${review.review}`;
  const embedding = await generateEmbedding(embeddingText);
  
  console.log('Inserting review into Supabase...');
  const { data, error } = await supabase
    .from('professor_reviews')
    .insert({
      ...review,
      embedding: embedding,
    })
    .select();

  if (error) {
    console.error('Error inserting review:', error);
    throw error;
  }
  console.log('Review inserted successfully:', data);
  return data;
}

export async function POST(req) {
  console.log('POST request received');
  try {
    const body = await req.json();
    console.log('Received body:', body);

    if (body.action === 'insert_review') {
      console.log('Inserting new review...');
      const result = await insertReview(body.review);
      return NextResponse.json({ success: true, data: result });
    }

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      console.error('Invalid request body: messages array is missing or empty');
      throw new Error('Invalid request body: messages array is missing or empty');
    }

    const lastUserMessage = body.messages[body.messages.length - 1].content;
    console.log('Received user message:', lastUserMessage);

    console.log('Searching for similar professors...');
    const similarProfessors = await searchSimilarProfessors(lastUserMessage);

    const professorContext = similarProfessors.map(prof =>
      `Professor: ${prof.professor}\nUniversity: ${prof.university}\nSubject: ${prof.subject}\nReview: ${prof.review}\nStars: ${prof.stars}\nSimilarity: ${prof.similarity.toFixed(2)}`
    ).join('\n\n');

    const prompt = `
      You are a rate my professor agent to help students find classes, that takes in user questions and answers them.
      For every user question, the top 3 professors that match the user question are returned.
      Use them to answer the question if needed.
      Context about relevant professors:
      ${professorContext}
      If the user is asking about a specific professor or course and it's in the context, provide details about that professor and/or course. If it's not in the context, politely inform the user that you don't have information about that specific professor and/or course and offer to provide information about professors based on some other information about the course or professors.

      Chat history:
      ${body.messages.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

      Human: ${lastUserMessage}
      Assistant: Based on the professors in the context and the user's question, here's my response:`;

    console.log('Generating content with Google AI...');
    const result = await generativeModel.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // Remove "Assistant:" prefix if present
    text = text.replace(/^Assistant:\s*/, '');
    
    // Trim whitespace
    text = text.trim();

    console.log('Generated response:', text);

    // Return the response as JSON
    return NextResponse.json({ content: text });
  } catch (error) {
    console.error('Error in API route:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request: ' + error.message },
      { status: 400 }
    );
  }
}