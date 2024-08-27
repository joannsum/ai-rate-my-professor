const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({path:'../../../../.env.local'});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

async function createEmbedding(text) {
  const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
  const result = await embeddingModel.embedContent(text);
  // Extract the values from the embedding result
  return result.embedding.values;
}

function formatEmbedding(embedding) {
  if (!Array.isArray(embedding)) {
    console.error('Unexpected embedding format:', embedding);
    return null;
  }
  return `[${embedding.join(',')}]`;
}

async function generateEmbeddings() {
  let processedCount = 0;
  let hasMore = true;
  const batchSize = 5;

  while (hasMore) {
    const { data: reviews, error } = await supabase
      .from('professor_reviews')
      .select('id, professor, university, subject, review')
      .is('embedding', null)
      .range(processedCount, processedCount + batchSize - 1);

    if (error) {
      console.error('Error fetching reviews:', error);
      return;
    }

    if (reviews.length === 0) {
      hasMore = false;
      console.log('No more reviews to process.');
      break;
    }

    console.log(`Processing batch of ${reviews.length} reviews.`);

    for (const review of reviews) {
      try {
        const embeddingText = `${review.professor} ${review.university} ${review.subject} ${review.review}`;
        const embedding = await createEmbedding(embeddingText);
        const formattedEmbedding = formatEmbedding(embedding);

        if (formattedEmbedding === null) {
          console.error(`Skipping update for review ${review.id} due to formatting error.`);
          continue;
        }

        const { data, error: updateError } = await supabase
          .from('professor_reviews')
          .update({ embedding: formattedEmbedding })
          .eq('id', review.id)
          .select();

        if (updateError) {
          console.error(`Error updating review ${review.id}:`, updateError);
        } else {
          console.log(`Updated embedding for review ${review.id}.`);
        }
      } catch (err) {
        console.error(`Error processing review ${review.id}:`, err);
      }
    }

    processedCount += reviews.length;
    console.log(`Processed ${processedCount} reviews so far.`);

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('Finished processing all reviews.');
}

generateEmbeddings().catch(console.error);