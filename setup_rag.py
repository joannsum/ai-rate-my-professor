from dotenv import load_dotenv
load_dotenv()
from pinecone import Pinecone, ServerlessSpec
# from openai import OpenAI
import os
import json

# Initialize Pinecone
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

# Create a Pinecone index
pc.create_index(
    name="rag",
    dimension=768, #and googleapi uses 1536-dimentional embeddings
    metric="cosine",
    spec=ServerlessSpec(cloud="aws", region="us-east-1"),
)

# Load the review data
data = json.load(open("reviews.json"))

# Configure Gemini API
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

processed_data = []

# Create embeddings for each review
for review in data["reviews"]:
    ##openai
    # response = client.embeddings.create(
    #     input=review['review'], model="text-embedding-3-small"
    # )
    #embedding =response.data[0].embedding

    ##geminiapi
    embedding = genai.embed_content(
        model = "models/embedding-001",
        content = review['review'],
        task_type = "retrieval_document"
    )
    processed_data.append(
        {
            "values": embedding,
            "id": review["professor"],
            "metadata":{
                "review": review["review"],
                "subject": review["subject"],
                "stars": review["stars"],
            }
        }
    )

# Insert the embeddings into the Pinecone index
index = pc.Index("rag")
upsert_response = index.upsert(
    vectors=processed_data,
    namespace="ns1",
)
print(f"Upserted count: {upsert_response['upserted_count']}")

# Print index statistics
print(index.describe_index_stats())
