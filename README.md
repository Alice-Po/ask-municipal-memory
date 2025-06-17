# Ask Municipal Memory: MVP for Transparent Municipal Council Search

[<img width="1234" alt="new-blog" src="https://github.com/user-attachments/assets/4afbcff2-64a9-4808-81b9-96be4f10eeec" />](https://flo-bit.dev/blog-template/)

## Project Overview

**Ask Municipal Memory** is a Minimum Viable Product (MVP) for a Retrieval-Augmented Generation (RAG) application. Its goal is to enable natural language search through the city council minutes of the municipality of Putanges-le-Lac. The project is designed to promote transparency and make public information more accessible to all citizens.

- **Mission:** Facilitate transparency and accessibility of municipal information by allowing anyone to query council minutes in plain language.
- **Open Source:** This project welcomes contributions and feedback from the community. Feel free to open issues, submit pull requests, or suggest improvements!

## 🚀 Quick Start

### Prerequisites

Before running the project, you need to set up the following services:

1. **Hugging Face Account** - [Sign up for free](https://huggingface.co/join)
2. **Qdrant Cloud Account** - [Sign up for free](https://cloud.qdrant.io/)

### Environment Configuration

Create a `.env` file in the root directory with the following variables:

```bash
# Hugging Face API Key (required)
HUGGINGFACE_API_KEY=your_huggingface_api_key_here

# Qdrant Configuration (required)
QDRANT_URL=https://your-qdrant-instance.qdrant.io
QDRANT_API_KEY=your_qdrant_api_key_here
QDRANT_COLLECTION_NAME=municipal_council_minutes
```

### Local Development

```bash
npm install
npm run dev
```

### Production Build

```bash
npm run build
npm run preview
```

## 🏗️ Architecture & Data Flow

### System Overview

The application follows a modern RAG (Retrieval-Augmented Generation) architecture:

```
[User Interface] → [API Route] → [Vector Search] → [LLM Generation] → [Response]
```

### Detailed Data Flow

1. **User Input** 📝

   - User types a question in the Svelte chat interface
   - Question is sent via POST to `/api/chat`

2. **Embedding Generation** 🔍

   - Question is converted to vector embedding using Hugging Face
   - Model: `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions)

3. **Vector Search** 🎯

   - Embedding is used to search Qdrant vector database
   - Returns top 5 most relevant document chunks
   - Includes metadata: filename, page number, relevance score

4. **Context Building** 📚

   - Relevant chunks are assembled into context
   - Sources are properly attributed with file and page information

5. **LLM Generation** 🤖

   - Context + user question sent to Mistral-7B-Instruct-v0.2
   - Uses chat completion API for natural conversation
   - Generates contextual response with source citations

6. **Response Delivery** 📤
   - Structured JSON response with answer and metadata
   - Sources displayed in chat interface with relevance scores

### Technical Stack

- **Frontend:** Astro + Svelte components
- **Backend:** Astro API Routes (server-side)
- **Vector Database:** Qdrant Cloud
- **AI Services:** Hugging Face Inference API
- **Deployment:** Vercel (ready)

## 📊 Data Structure

### Document Chunks in Qdrant

```json
{
  "text": "extrait du chunk...",
  "filename": "proces-verbal-2025-04-14.pdf",
  "filepath": "/data/municipal/proces-verbal-2025-04-14.pdf",
  "chunk_index": 3,
  "total_chunks": 12,
  "section_title": "Approbation du compte de gestion 2024",
  "page_number": 5,
  "timestamp": "2025-06-16T19:28:56.005Z"
}
```

### API Response Format

```json
{
  "answer": "Réponse générée par l'IA...",
  "sources": [
    {
      "filename": "compte-rendu-seance-du-3-fevrier-2025.pdf",
      "page": 8,
      "score": 0.20737344
    }
  ],
  "chunksFound": 5
}
```

## 🔧 Configuration Details

### Hugging Face Setup

- **Free Tier:** 30,000 requests/month
- **Models Used:**
  - Embeddings: `sentence-transformers/all-MiniLM-L6-v2`
  - LLM: `mistralai/Mistral-7B-Instruct-v0.2`
- **API Endpoint:** Chat completion for natural conversation

### Qdrant Cloud Setup

- **Free Tier:** 1GB storage, perfect for small projects
- **Collection:** `municipal_council_minutes` (default)
- **Vector Size:** 384 dimensions (matching embedding model)
- **Distance Metric:** Cosine similarity

## 🛠️ How It Works

### Document Processing Pipeline

1. **Upload & OCR** 📄

   - Upload PDF documents through web interface
   - Extract text using Tesseract.js OCR
   - Process and clean extracted text

2. **Chunking & Embedding** ✂️

   - Split documents into ~1000 character chunks
   - Generate embeddings for each chunk
   - Store in Qdrant with metadata

3. **Search & Retrieval** 🔍

   - User question → embedding → vector search
   - Retrieve most relevant chunks
   - Rank by similarity score

4. **Generation & Response** 💬
   - Build context from retrieved chunks
   - Generate answer using Mistral LLM
   - Return response with source citations

### Key Features

- **Natural Language Queries:** Ask questions in plain French
- **Source Attribution:** Every answer includes document sources
- **Relevance Scoring:** See how relevant each source is
- **Real-time Processing:** Fast responses with streaming UI
- **Municipal Focus:** Specialized for council meeting content

## 🚀 Deployment

### Vercel Deployment

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Environment Variables for Production

Same as development, but configured in Vercel dashboard:

- `HUGGINGFACE_API_KEY`
- `QDRANT_URL`
- `QDRANT_API_KEY`
- `QDRANT_COLLECTION_NAME`

## 🤝 Contributing & Feedback

We encourage contributions and feedback! If you have ideas, find bugs, or want to help:

1. **Open an issue** for bugs or feature requests
2. **Submit a pull request** for improvements
3. **Share feedback** on the user experience

Your input helps make municipal information more accessible and transparent for everyone.

## 📝 Development Notes

### Recent Improvements

- ✅ **API Routes:** Migrated from Edge Functions to Astro API Routes for better development experience
- ✅ **Hugging Face SDK:** Updated to latest `InferenceClient` (replacing deprecated `HfInference`)
- ✅ **Chat Interface:** Modern Svelte component with real-time messaging
- ✅ **Error Handling:** Robust error handling with detailed logging
- ✅ **Source Attribution:** Complete metadata tracking for transparency

### Architecture Decisions

- **Astro API Routes:** Better development experience than Edge Functions
- **Static Output:** Simpler deployment and faster builds
- **Svelte Components:** Reactive UI with excellent developer experience
- **Hugging Face Inference:** Reliable AI services with generous free tier

## 📄 License

MIT.

## 🙏 Credits

This project is based on the excellent [Astro blog template by flo-bit](https://github.com/flo-bit/blog-template). Many thanks to flo-bit for the foundation and inspiration!
